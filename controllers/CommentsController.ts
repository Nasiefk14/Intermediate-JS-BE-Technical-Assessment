import { Router, Response, Request, NextFunction } from "express";
import {
  collection,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  deleteDoc,
  getDoc,
  increment,
  deleteField,
  setDoc,
} from "firebase/firestore";
import { commentSchema, partialCommentSchema } from "../schemas/commentSchema";
import { IComment } from "../interfaces/comment.interface";
import { Error, NotFoundError } from "../utils/ErrorHandlerUtil";
import { Success, SuccessfullyCreated } from "../utils/SuccessHandlerUtil";
import { ResponseHandler } from "../utils/ResponseHandlerUtil";

export class CommentsController {
  static readonly PATH = "/posts/:postId/comments";
  static collectionPath = "Comments";
  static postCollectionPath = "Posts";
  static db: any;

  static registerRouter(db: any) {
    CommentsController.db = db;

    const router = Router();

    router.post(CommentsController.PATH, CommentsController.createComment);
    router.post(`${CommentsController.PATH}/:commentId/upvote`, CommentsController.upvoteComment);
    router.post(`${CommentsController.PATH}/:commentId/removeUpvote`, CommentsController.removeUpvote);
    router.post(`${CommentsController.PATH}/:commentId/downvote`, CommentsController.downvoteComment);
    router.post(`${CommentsController.PATH}/:commentId/removeDownvote`, CommentsController.removeDownvote);

    router.put(`${CommentsController.PATH}/:commentId`, CommentsController.updateComment);

    router.delete(`${CommentsController.PATH}/:commentId`, CommentsController.deleteComment);

    return router;
  }

  static async createComment(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;
    const response = new ResponseHandler(res);

    const parseResult = commentSchema.safeParse(req.body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return next(new Error(400, errorMessage));
    }

    const { username, content } = parseResult.data;

    try {
      const commentRef = doc(collection(CommentsController.db, CommentsController.collectionPath));
      await setDoc(commentRef, {
        username,
        content,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        upvotes: 0,
        downvotes: 0,
      });

      const postRef = doc(CommentsController.db, CommentsController.postCollectionPath, postId);
      await updateDoc(postRef, {
        comments: arrayUnion(commentRef.id),
      });

      response.send(
        new SuccessfullyCreated({ id: commentRef.id }, "Comment created successfully")
      );
    } catch (error) {
      next(new Error(500, "Failed to create comment", error));
    }
  }

  static async updateComment(req: Request, res: Response, next: NextFunction) {
    const { commentId } = req.params;
    const response = new ResponseHandler(res);

    const parseResult = partialCommentSchema.safeParse(req.body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return next(new Error(400, errorMessage)
      );
    }

    const updatedData = parseResult.data;

    if (Object.keys(updatedData).length === 0) {
      return next(new Error(400, "No valid fields to update")
      );
    }

    try {
      const commentRef = doc(CommentsController.db, CommentsController.collectionPath, commentId);
      const dataToUpdate = {
        ...updatedData,
        updated_at: serverTimestamp(),
      };
      await updateDoc(commentRef, dataToUpdate);
      response.send(new Success(undefined, "Comment updated succeffully"));
    } catch (error) {
      next(new Error(500, "Failed to update comment", error));
    }
  }

  static async deleteComment(req: Request, res: Response, next: NextFunction) {
    const { commentId } = req.params;
    const response = new ResponseHandler(res);

    try {
      const commentRef = doc(CommentsController.db, CommentsController.collectionPath, commentId);
      await deleteDoc(commentRef);

      response.send(new Success(undefined, "Comment deleted successfully"));
    } catch (error) {
      next(new Error(500, "Failed to delete comment", error));
    }
  }

  static async upvoteComment(req: Request, res: Response, next: NextFunction) {
    const { commentId } = req.params;
    const { username } = req.body;
    const response = new ResponseHandler(res);

    if (!username) {
      return next(new Error(400, "Username is required"));
    }

    try {
      const commentRef = doc(CommentsController.db, CommentsController.collectionPath, commentId);
      const commentSnapshot = await getDoc(commentRef);

      if (!commentSnapshot.exists()) {
        return next(new NotFoundError("Comment not found"));
      }

      const commentData = commentSnapshot.data() as IComment;

      if (commentData.upvoters && commentData.upvoters[username]) {
        return next(new Error(409, "User has already upvoted this comment"));
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

      response.send(new Success(undefined, "Comment upvoted successfully"));
    } catch (error) {
      next(new Error(500, "Failed to upvote comment", error));
    }
  }

  static async removeUpvote(req: Request, res: Response, next: NextFunction) {
    const { commentId } = req.params;
    const { username } = req.body;
    const response = new ResponseHandler(res);

    if (!username) {
      return next(new Error(400, "Username is required"));
    }

    try {
      const commentRef = doc(CommentsController.db, CommentsController.collectionPath, commentId);
      const commentSnapshot = await getDoc(commentRef);

      if (!commentSnapshot.exists()) {
        return next(new NotFoundError("Comment not found"));
      }

      const commentData = commentSnapshot.data() as IComment;

      if (!commentData.upvoters || !commentData.upvoters[username]) {
        return next(new Error(400, "User has not upvoted this comment"));
      }

      await updateDoc(commentRef, {
        upvotes: increment(-1),
        [`upvoters.${username}`]: deleteField(),
      });

      response.send(new Success(undefined, "Upvote removed successfully"));
    } catch (error) {
      next(new Error(500, "Failed to remove upvote", error));
    }
  }

  static async downvoteComment(req: Request, res: Response, next: NextFunction) {
    const { commentId } = req.params;
    const { username } = req.body;
    const response = new ResponseHandler(res);

    if (!username) {
      return next(new Error(400, "Username is required")
      );
    }

    try {
      const commentRef = doc(CommentsController.db, CommentsController.collectionPath, commentId);
      const commentSnapshot = await getDoc(commentRef);

      if (!commentSnapshot.exists()) {
        return next(new NotFoundError("Comment not found"));
      }

      const commentData = commentSnapshot.data() as IComment;

      if (commentData.upvoters && commentData.upvoters[username]) {
        await updateDoc(commentRef, {
          upvotes: increment(-1),
          [`upvoters.${username}`]: deleteField(),
        });
      }

      if (commentData.downvoters && commentData.downvoters[username]) {
        return next(
          new Success(undefined, "user has already downvoted this comment")
        );
      }

      await updateDoc(commentRef, {
        downvotes: increment(1),
        [`downvoters.${username}`]: true,
      });

      response.send(new Success(undefined, "Comment downvoted successfully"));
    } catch (error) {
      next(new Error(500, "Failed to downvote comment", error));
    }
  }

  static async removeDownvote(req: Request, res: Response, next: NextFunction) {
    const { commentId } = req.params;
    const { username } = req.body;
    const response = new ResponseHandler(res);

    if (!username) {
      return next(new Error(400, "Username is required") );
    }

    try {
      const commentRef = doc(CommentsController.db, CommentsController.collectionPath, commentId);
      const commentSnapshot = await getDoc(commentRef);

      if (!commentSnapshot.exists()) {
        return next(new NotFoundError("Comment not found")
        );
      }

      const commentData = commentSnapshot.data() as IComment;

      if (!commentData.downvoters || !commentData.downvoters[username]) {
        return next(new Error(400, "User has not downvoted this comment")
        );
      }

      await updateDoc(commentRef, {
        downvotes: increment(-1),
        [`downvoters.${username}`]: deleteField(),
      });

      response.send(new Success(undefined, "Downvote removed successfully"))
    } catch (error) {
      next(new Error(500, "Failed to downvote comment", error));
    }
  }
}
