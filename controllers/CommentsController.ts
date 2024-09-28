import { Router, Response, Request, NextFunction } from "express";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  deleteDoc,
  getDoc,
  increment,
  deleteField,
} from "firebase/firestore";
import { commentSchema, partialCommentSchema } from "../schemas/commentSchema";
import { IComment } from "../interfaces/comment.interface";

export class CommentsController {
  static readonly PATH = "/posts/:postId/comments";
  static collectionPath = "Comments";
  static postCollectionPath = "Posts";
  static db: any;

  static registerRouter(db: any) {
    CommentsController.db = db;

    const router = Router();

    router.post(CommentsController.PATH, CommentsController.createComment);
    router.post(
      `${CommentsController.PATH}/:commentId/upvote`,
      CommentsController.upvoteComment
    );
    router.post(
      `${CommentsController.PATH}/:commentId/removeUpvote`,
      CommentsController.removeUpvote
    );
    router.post(
      `${CommentsController.PATH}/:commentId/downvote`,
      CommentsController.downvoteComment
    );
    router.post(
      `${CommentsController.PATH}/:commentId/removeDownvote`,
      CommentsController.removeDownvote
    );

    router.put(
      `${CommentsController.PATH}/:commentId`,
      CommentsController.updateComment
    );

    router.delete(
      `${CommentsController.PATH}/:commentId`,
      CommentsController.deleteComment
    );

    return router;
  }

  static async createComment(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;

    const parseResult = commentSchema.safeParse(req.body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return next(
        res.status(400).json({
          statusCode: 400,
          message: errorMessage,
        })
      );
    }

    const { username, content } = parseResult.data;

    try {
      const result = await addDoc(
        collection(CommentsController.db, CommentsController.collectionPath),
        {
          username,
          content,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          upvotes: 0,
          downvotes: 0,
        }
      );

      const postRef = doc(
        CommentsController.db,
        CommentsController.postCollectionPath,
        postId
      );
      await updateDoc(postRef, {
        comments: arrayUnion(result.id),
      });

      res.status(201).json({
        statusCode: 201,
        message: "Comment created successfully",
        data: { id: result.id },
      });
    } catch (error) {
      next(
        res.status(500).json({
          statusCode: 500,
          message: "Failed to create comment",
        })
      );
    }
  }

  static async updateComment(req: Request, res: Response, next: NextFunction) {
    const { commentId } = req.params;

    const parseResult = partialCommentSchema.safeParse(req.body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return next(
        res.status(400).json({
          statusCode: 400,
          message: errorMessage,
        })
      );
    }

    const updatedData = parseResult.data;

    if (Object.keys(updatedData).length === 0) {
      return next(
        res.status(400).json({
          statusCode: 400,
          message: "No valid fields to update",
        })
      );
    }

    try {
      const commentRef = doc(
        CommentsController.db,
        CommentsController.collectionPath,
        commentId
      );
      const dataToUpdate = {
        ...updatedData,
        updated_at: serverTimestamp(),
      };
      await updateDoc(commentRef, dataToUpdate);
      res.status(200).json({
        statusCode: 200,
        message: "Comment updated successfully",
      });
    } catch (error) {
      next(
        res.status(500).json({
          statusCode: 500,
          message: "Failed to update comment",
        })
      );
    }
  }

  static async deleteComment(req: Request, res: Response, next: NextFunction) {
    const { commentId } = req.params;

    try {
      const commentRef = doc(
        CommentsController.db,
        CommentsController.collectionPath,
        commentId
      );
      await deleteDoc(commentRef);

      res.status(200).json({
        statusCode: 200,
        message: "Comment deleted successfully",
      });
    } catch (error) {
      next(
        res.status(500).json({
          statusCode: 500,
          message: "Failed to delete comment",
        })
      );
    }
  }

  static async upvoteComment(req: Request, res: Response, next: NextFunction) {
    const { commentId } = req.params;
    const { username } = req.body;

    if (!username) {
      return next(
        res.status(400).json({
          statusCode: 400,
          message: "Username is required",
        })
      );
    }

    try {
      const commentRef = doc(
        CommentsController.db,
        CommentsController.collectionPath,
        commentId
      );
      const commentSnapshot = await getDoc(commentRef);

      if (!commentSnapshot.exists()) {
        return next(
          res.status(404).json({
            statusCode: 404,
            message: "Comment not found",
          })
        );
      }

      const commentData = commentSnapshot.data() as IComment;

      if (commentData.upvoters && commentData.upvoters[username]) {
        return next(
          res.status(409).json({
            statusCode: 409,
            message: "User has already upvoted this comment.",
          })
        );
      }
      if (commentData.downvoters && commentData.downvoters[username]) {
        await updateDoc(commentRef, {
          downvotes: increment(-1),
          [`downvoters.${username}`]: deleteField(),
        });
      }

      await updateDoc(commentRef, {
        upvotes: increment(1),
        [`upvoters.${username}`]: true,
      });

      res.status(200).json({
        statusCode: 200,
        message: "Comment upvoted successfully",
      });
    } catch (error) {
      next(
        res.status(500).json({
          statusCode: 500,
          message: "Failed to upvote comment",
        })
      );
    }
  }

  static async removeUpvote(req: Request, res: Response, next: NextFunction) {
    const { commentId } = req.params;
    const { username } = req.body;

    if (!username) {
      return next(
        res.status(400).json({
          statusCode: 400,
          message: "Username is required",
        })
      );
    }

    try {
      const commentRef = doc(
        CommentsController.db,
        CommentsController.collectionPath,
        commentId
      );
      const commentSnapshot = await getDoc(commentRef);

      if (!commentSnapshot.exists()) {
        return next(
          res.status(404).json({
            statusCode: 404,
            message: "Comment not found",
          })
        );
      }

      const commentData = commentSnapshot.data() as IComment;

      if (!commentData.upvoters || !commentData.upvoters[username]) {
        return next(
          res.status(400).json({
            statusCode: 400,
            message: "User has not upvoted this comment",
          })
        );
      }

      await updateDoc(commentRef, {
        upvotes: increment(-1),
        [`upvoters.${username}`]: deleteField(),
      });

      res.status(200).json({
        statusCode: 200,
        message: "Upvote removed successfully",
      });
    } catch (error) {
      next(
        res.status(500).json({
          statusCode: 500,
          message: "Failed to remove upvote",
        })
      );
    }
  }

  static async downvoteComment(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const { commentId } = req.params;
    const { username } = req.body;

    if (!username) {
      return next(
        res.status(400).json({
          statusCode: 400,
          message: "Username is required",
        })
      );
    }

    try {
      const commentRef = doc(
        CommentsController.db,
        CommentsController.collectionPath,
        commentId
      );
      const commentSnapshot = await getDoc(commentRef);

      if (!commentSnapshot.exists()) {
        return next(
          res.status(404).json({
            statusCode: 404,
            message: "Comment not found",
          })
        );
      }

      const commentData = commentSnapshot.data() as IComment;

      if (commentData.upvoters && commentData.upvoters[username]) {
        await updateDoc(commentRef, {
          upvotes: increment(-1),
          [`upvoters.${username}`]: deleteField(),
        });
      }

      if (commentData.downvoters && commentData.downvoters[username]) {
        return res.status(200).json({
          statusCode: 200,
          message: "User has already downvoted this comment.",
        });
      }

      await updateDoc(commentRef, {
        downvotes: increment(1),
        [`downvoters.${username}`]: true,
      });

      res.status(200).json({
        statusCode: 200,
        message: "Comment downvoted successfully",
      });
    } catch (error) {
      next(
        res.status(500).json({
          statusCode: 500,
          message: "Failed to downvote comment",
        })
      );
    }
  }

  static async removeDownvote(req: Request, res: Response, next: NextFunction) {
    const { commentId } = req.params;
    const { username } = req.body;

    if (!username) {
      return next(
        res.status(400).json({
          statusCode: 400,
          message: "Username is required",
        })
      );
    }

    try {
      const commentRef = doc(
        CommentsController.db,
        CommentsController.collectionPath,
        commentId
      );
      const commentSnapshot = await getDoc(commentRef);

      if (!commentSnapshot.exists()) {
        return next(
          res.status(404).json({
            statusCode: 404,
            message: "Comment not found",
          })
        );
      }

      const commentData = commentSnapshot.data() as IComment;

      if (!commentData.downvoters || !commentData.downvoters[username]) {
        return next(
          res.status(400).json({
            statusCode: 400,
            message: "User has not downvoted this comment",
          })
        );
      }

      await updateDoc(commentRef, {
        downvotes: increment(-1),
        [`downvoters.${username}`]: deleteField(),
      });

      res.status(200).json({
        statusCode: 200,
        message: "Downvote removed successfully",
      });
    } catch (error) {
      next({
        statusCode: 500,
        message: "Failed to remove downvote",
      });
    }
  }
}
