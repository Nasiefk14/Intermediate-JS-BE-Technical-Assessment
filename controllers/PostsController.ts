import { Router, Response, Request, NextFunction } from "express";
import {
  collection,
  getDocs,
  where,
  query,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  deleteField,
  increment,
} from "firebase/firestore";
import { partialPostSchema, postSchema } from "../schemas/postSchema";
import { IComment } from "../interfaces/comment.interface";
import { IPostData } from "../interfaces/post.interface";

export class PostsController {
  static readonly PATH = "/posts";
  static collectionPath = "Posts";
  static commentsCollectionPath = "Comments";
  static db: any;

  static registerRouter(db: any) {
    PostsController.db = db;

    const router = Router();
    router.get(PostsController.PATH, PostsController.getAll);
    router.get(`${PostsController.PATH}/:postId`, PostsController.getPostById);
    router.get(`${PostsController.PATH}/user/:username`, PostsController.getPostsByUsername);
    router.get(`${PostsController.PATH}/user/:username/votes`, PostsController.getUserVotedPosts);

    router.post(PostsController.PATH, PostsController.createPost);
    router.post(`${PostsController.PATH}/:postId/upvote`, PostsController.upvotePost);
    router.post(`${PostsController.PATH}/:postId/removeUpvote`, PostsController.removePostUpvote);
    router.post(`${PostsController.PATH}/:postId/downvote`, PostsController.downvotePost);
    router.post(`${PostsController.PATH}/:postId/removeDownvote`, PostsController.removePostDownvote);

    router.put(`${PostsController.PATH}/:postId`, PostsController.updatePost);

    router.delete(`${PostsController.PATH}/:postId`, PostsController.deletePostById);

    return router;
  }

  static async getAll(_: Request, res: Response, next: NextFunction) {
    try {
      const postsSnapshot = await getDocs(
        collection(PostsController.db, PostsController.collectionPath)
        );

      const postList = await Promise.all(
        postsSnapshot.docs.map(async (postDoc) => {
          const postData = postDoc.data();
          const postId = postDoc.id;

          const commentIds = postData.comments || [];
          let comments: IComment[] = [];

          if (commentIds.length > 0) {
            const commentsRef = collection(PostsController.db, PostsController.commentsCollectionPath);
            const commentsQuery = query(
              commentsRef,
              where("__name__", "in", commentIds)
            );
            const commentsSnapshot = await getDocs(commentsQuery);

            comments = commentsSnapshot.docs.map(
              (commentDoc) =>
                ({
                  id: commentDoc.id,
                  ...(commentDoc.data() as IComment)
                })
            );
          }

          return {
            id: postId,
            ...postData,
            comments,
          };
        })
      );

      res.status(200).send({
        statusCode: 200,
        message: "Posts retreived successfully",
        data: postList,
      });
    } catch (error) {
      next(res.status(500).json({
        statusCode: 500,
        message: "Failed to get all posts"
      }));
    }
  }

  static async getPostById(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;

    try {
      const postRef = doc(PostsController.db, PostsController.collectionPath, postId);
      const postsSnapshot = await getDoc(postRef);

      if (!postsSnapshot.exists()) {
        return next({
          statusCode: 404,
          message: "Post not found",
        });
      }

      const postData = postsSnapshot.data();
      const commentIds = postData.comments || [];
      let comments: IComment[] = [];

      if (commentIds.length > 0) {
        const commentsRef = collection(PostsController.db, PostsController.commentsCollectionPath);
        const commentsQuery = query(
          commentsRef,
          where("__name__", "in", commentIds)
        );
        const commentsSnapshot = await getDocs(commentsQuery);

        comments = commentsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as IComment),
        }));
      }

      res.status(200).json({
        statusCode: 200,
        message: "Post retreived successfully",
        data: {
          ...postData,
          id: postsSnapshot.id,
          comments,
        },
      });
    } catch (error) {
      next(res.status(500).json({
        statusCode: 500,
        message: "Failed to get post"
      }));
    }
  }

  static async getPostsByUsername(req: Request, res: Response, next: NextFunction) {
    const { username } = req.params;

    if (!username) {
      return next({
        statusCode: 400,
        message: "Username is required",
      });
    }

    try {
      const postsRef = collection(PostsController.db, PostsController.collectionPath);
      const postsQuery = query(postsRef, where("username", "==", username));
      const querySnapshot = await getDocs(postsQuery);

      if (querySnapshot.empty) {
        return next({
          statusCode: 404,
          message: "No posts found for this user.",
        });
      }

      const posts = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const postData = doc.data();
          const postId = doc.id;

          const commentIds = postData.comments || [];
          let comments: IComment[] = [];

          if (commentIds.length > 0) {
            const commentsRef = collection(PostsController.db, PostsController.commentsCollectionPath);
            const commentsQuery = query(
              commentsRef,
              where("__name__", "in", commentIds)
            );
            const commentsSnapshot = await getDocs(commentsQuery);

            comments = commentsSnapshot.docs.map((commentDoc) => ({
              id: commentDoc.id,
              ...(commentDoc.data() as IComment),
            }));
          }

          return {
            id: postId,
            ...postData,
            comments,
          };
        })
      );

      res.status(200).json({
        statusCode: 200,
        message: "Posts retreived successfully",
        data: posts,
      });
    } catch (error) {
      next(res.status(500).json({
        statusCode: 500,
        message: "Unable to get posts"
      }));
    }
  }

  static async createPost(req: Request, res: Response, next: NextFunction) {
    const parseResult = postSchema.safeParse(req.body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return next({
        statusCode: 400,
        message: errorMessage,
      });
    }

    const { username, title, content } = parseResult.data;

    try {
      const result = await addDoc(
        collection(PostsController.db, PostsController.collectionPath),
        {
          username,
          title,
          content,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        }
      );
      res.status(201).json({
        statusCode: 201,
        message: "Post created successfully",
        data: {
          id: result.id,
        },
      });
    } catch (error) {
        next(res.status(500).json({
          statusCode: 500,
          message: "Unable to create post"
        }));    
      }
  }

  static async updatePost(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;
    const parseResult = partialPostSchema.safeParse(req.body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return next({
        statusCode: 400,
        message: errorMessage,
      });
    }

    const updatedData = parseResult.data;

    if (Object.keys(updatedData).length === 0) {
      return next({
        statusCode: 400,
        message: "No valid fields to update",
      });
    }

    try {
      const postRef = doc(PostsController.db, PostsController.collectionPath, postId);
      const dataToUpdate = {
        ...updatedData,
        updated_at: serverTimestamp(),
      };

      await updateDoc(postRef, dataToUpdate);

      res.status(200).json({
        statusCode: 200,
        message: "Post updated successfully",
      });
    } catch (error) {
      next(res.status(500).json({
        statusCode: 500,
        message: "Unable to update post"
      }));
    }
  }

  static async deletePostById(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;

    try {
      const postRef = doc(PostsController.db, PostsController.collectionPath, postId);
      const postSnapshot = await getDoc(postRef);

      if (!postSnapshot.exists()) {
        return next({
          statusCode: 404,
          message: "Post not found",
        });
      }

      await deleteDoc(postRef);

      res.status(200).json({
        statusCode: 200,
        message: "Post deleted successfully",
      });
    } catch (error) {
      next({
        statusCode: 500,
        message: "Failed to delete post",
      });
    }
  }

  static async upvotePost(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;
    const { username } = req.body;

    if (!username) {
      return next({
        statusCode: 400,
        message: "Username is required",
      });
    }

    try {
      const postRef = doc(PostsController.db, PostsController.collectionPath, postId);
      const postSnapshot = await getDoc(postRef);

      if (!postSnapshot.exists()) {
        return next({
          statusCode: 404,
          message: "Post not found",
        });
      }

      const postData = postSnapshot.data();
      const hasDownvoted = postData.downvoters && postData.downvoters[username];

      if (postData.upvoters && postData.upvoters[username]) {
        return next({
          statusCode: 200,
          message: "User has already upvoted this post.",
        });
      }
      if (hasDownvoted) {
        await updateDoc(postRef, {
          downvotes: Math.max((postData.downvotes || 0) - 1, 0),
          [`downvoters.${username}`]: deleteField(),
        });
      }

      await updateDoc(postRef, {
        upvotes: increment(1),
        upvoters: { ...postData.upvoters, [username]: true },
      });

      res.status(200).json({
        statusCode: 200,
        message: "Post upvoted successfully",
      });
    } catch (error) {
      next({
        statusCode: 500,
        message: "Failed to upvote post",
      });
    }
  }

  static async removePostUpvote(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;
    const { username } = req.body;

    if (!username) {
      return next({
        statusCode: 400,
        message: "Username is required",
      });
    }

    try {
      const postRef = doc(PostsController.db, PostsController.collectionPath, postId);

      const postSnap = await getDoc(postRef);

      if (!postSnap.exists()) {
        return next({
          statusCode: 404,
          message: "Post not found",
        });
      }

      const postData = postSnap.data();
      const currentUpvotes = postData.upvotes || 0;
      const voters = postData.upvoters || {};

      if (!voters[username]) {
        return next({
          statusCode: 400,
          message: "User has not upvoted this post",
        });
      }

      await updateDoc(postRef, {
        upvotes: Math.max(currentUpvotes - 1, 0),
        [`upvoters.${username}`]: deleteField(),
      });

      res.status(200).json({
        statusCode: 200,
        message: "Upvote removed successfully",
      });
    } catch (error) {
      next({
        statusCode: 500,
        message: "Failed to remove upvote",
      });
    }
  }

  static async downvotePost(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;
    const { username } = req.body;

    if (!username) {
      return next({
        statusCode: 400,
        message: "Username is required",
      });
    }

    try {
      const postRef = doc(PostsController.db, PostsController.collectionPath, postId);

      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) {
        return next({
          statusCode: 404,
          message: "Post not found",
        });
      }

      const postData = postSnap.data();
      const hasUpvoted = postData.upvoters && postData.upvoters[username];

      if (postData.downvoters && postData.downvoters[username]) {
        res.status(200).json({
          statusCode: 200,
          message: "User has already downvoted this post.",
        });
      }
      if (hasUpvoted) {
        await updateDoc(postRef, {
          upvotes: Math.max((postData.upvotes || 0) - 1, 0),
          [`upvoters.${username}`]: deleteField(),
        });
      }

      await updateDoc(postRef, {
        downvotes: increment(1),
        downvoters: { ...postData.downvoters, [username]: true },
      });

      res.status(200).json({
        statusCode: 200,
        message: "Post downvoted successfully.",
      });
    } catch (error) {
      next({
        statusCode: 500,
        message: "Failed to downupvote post",
      });
    }
  }

  static async removePostDownvote(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;
    const { username } = req.body;

    try {
      const postRef = doc(PostsController.db, PostsController.collectionPath, postId);

      const postSnap = await getDoc(postRef);

      if (!postSnap.exists()) {
        return res.status(404).json({
          statusCode: 404,
          message: "Post not found",
        });
      }

      const postData = postSnap.data();
      const currentdownvotes = postData.downvotes || 0;
      const downvoters = postData.downvoters || {};

      if (!downvoters[username]) {
        return res.status(400).json({
          statusCode: 400,
          message: "User has not downvoted this post",
        });
      }

      await updateDoc(postRef, {
        downvotes: Math.max(currentdownvotes - 1, 0),
        [`downvoters.${username}`]: deleteField(),
      });

      res.status(200).json({
        statusCode: 200,
        message: "Downvote removed successfully",
      });
    } catch (error) {
      next({
        statusCode: 500,
        message: "Failed to remove downupvote",
      });
    }
  }

  static async getUserVotedPosts(req: Request, res: Response, next: NextFunction) {
    const { username } = req.params;

    try {
      const postsSnapshot = await getDocs(
        collection(PostsController.db, PostsController.collectionPath)
      );

      const votedPosts = postsSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...(doc.data() as IPostData),
        }))
        .filter((post) => {
          const upvoters = post.upvoters || {};
          const downvoters = post.downvoters || {};
          return upvoters[username] || downvoters[username];
        });

      res.status(200).json({
        statusCode: 200,
        message: "User voted posts received successfully",
        data: votedPosts,
      });
    } catch (error) {
      next({
        statusCode: 500,
        message: "Failed to retrieve voted posts",
      });
    }
  }
}
