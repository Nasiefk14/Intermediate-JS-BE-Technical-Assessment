import { Router, Response, Request, NextFunction } from "express";
import {
  collection,
  getDocs,
  where,
  query,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  deleteField,
  increment,
  setDoc,
} from "firebase/firestore";
import { partialPostSchema, postSchema } from "../schemas/postSchema";
import { IComment } from "../interfaces/comment.interface";
import { IPostData } from "../interfaces/post.interface";
import { Error, NotFoundError } from "../utils/ErrorHandlerUtil";
import { Success, SuccessfullyCreated } from "../utils/SuccessHandlerUtil";
import { ResponseHandler } from "../utils/ResponseHandlerUtil";

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
    const response = new ResponseHandler(res);
    
    try {
      const postsSnapshot = await getDocs(collection(PostsController.db, PostsController.collectionPath));

      const postList = await Promise.all(
        postsSnapshot.docs.map(async (postDoc) => {
          const postData = postDoc.data();
          const postId = postDoc.id;

          const commentIds = postData.comments || [];
          let comments: IComment[] = [];

          if (commentIds.length > 0) {
            const commentsRef = collection(PostsController.db, PostsController.commentsCollectionPath);
            const commentsQuery = query(commentsRef, where("__name__", "in", commentIds));
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

      response.send(new Success(postList, "Post retreived successfully"));
    } catch (error) {
      next(new Error(500, "Failed to get all posts"));
    }
  }

  static async getPostById(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;
    const response = new ResponseHandler(res);

    try {
      const postRef = doc(PostsController.db, PostsController.collectionPath, postId);
      const postsSnapshot = await getDoc(postRef);

      if (!postsSnapshot.exists()) {
        return next(new NotFoundError("Post not found"));
      }

      const postData = postsSnapshot.data();
      const commentIds = postData.comments || [];
      let comments: IComment[] = [];

      if (commentIds.length > 0) {
        const commentsRef = collection(PostsController.db, PostsController.commentsCollectionPath);
        const commentsQuery = query(commentsRef, where("__name__", "in", commentIds));
        const commentsSnapshot = await getDocs(commentsQuery);

        comments = commentsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as IComment),
        }));
      }

      response.send(new Success({
        ...postData,
        id: postsSnapshot.id,
        comments
      },"Post retreived successfully"));
    } catch (error) {
      next(new Error(500, "Failed to get post"));
    }
  }

  static async getPostsByUsername(req: Request, res: Response, next: NextFunction) {
    const { username } = req.params;
    const response = new ResponseHandler(res);

    if (!username) {
      return next(new Error(400, "Username is required"));
    }

    try {
      const postsRef = collection(PostsController.db, PostsController.collectionPath);
      const postsQuery = query(postsRef, where("username", "==", username));
      const querySnapshot = await getDocs(postsQuery);

      if (querySnapshot.empty) {
        return next(new NotFoundError("No post found for this user."));
      }

      const postsList = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const postData = doc.data();
          const postId = doc.id;

          const commentIds = postData.comments || [];
          let comments: IComment[] = [];

          if (commentIds.length > 0) {
            const commentsRef = collection(PostsController.db, PostsController.commentsCollectionPath);
            const commentsQuery = query(commentsRef, where("__name__", "in", commentIds));
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

      response.send(new Success(postsList, "Posts retreived successfully"));
    } catch (error) {
      next(new Error(500, "Unable to get posts"))
    }
  }

  static async createPost(req: Request, res: Response, next: NextFunction) {
    const parseResult = postSchema.safeParse(req.body);
    const response = new ResponseHandler(res);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return next(new Error(400, errorMessage));    
    }

    const { username, title, content } = parseResult.data;

    try {
      const postRef = doc(collection(PostsController.db, PostsController.collectionPath))
      await setDoc(postRef,
        {
          username,
          title,
          content,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        }
      );

      response.send(new SuccessfullyCreated({id: postRef.id}, "Post created successfully"));
    } catch (error) {
      next(new Error(500, "Unable to create post"));  
    }
  }

  static async updatePost(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;
    const parseResult = partialPostSchema.safeParse(req.body);
    const response = new ResponseHandler(res);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors
        .map((e) => e.message)
        .join(", ");
      return next(new Error(400, errorMessage));
    }

    const updatedData = parseResult.data;

    if (Object.keys(updatedData).length === 0) {
      return next(new Error(400, "No valid fields to update"));
    }

    try {
      const postRef = doc(PostsController.db, PostsController.collectionPath, postId);
      const dataToUpdate = {
        ...updatedData,
        updated_at: serverTimestamp(),
      };

      await updateDoc(postRef, dataToUpdate);

      response.send(new Success(undefined, "Post updated sucessfully"));
    } catch (error) {
      next(new Error(500, "Unable to update post"));
    }
  }

  static async deletePostById(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;
    const response = new ResponseHandler(res);

    try {
      const postRef = doc(PostsController.db, PostsController.collectionPath, postId);
      const postSnapshot = await getDoc(postRef);

      if (!postSnapshot.exists()) {
        return next(new NotFoundError("Post not found"));
      }

      await deleteDoc(postRef);

      response.send(new Success(undefined, "Post deleted successfully"));
    } catch (error) {
      next(new Error(500, "Failed to delete post"));
    }
  }

  static async upvotePost(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;
    const { username } = req.body;
    const response = new ResponseHandler(res);

    if (!username) {
      return next(new Error(400, "Username is required"));
    }

    try {
      const postRef = doc(PostsController.db, PostsController.collectionPath, postId);
      const postSnapshot = await getDoc(postRef);

      if (!postSnapshot.exists()) {
        return next(new NotFoundError("Post not found"));
      }

      const postData = postSnapshot.data();
      const hasDownvoted = postData.downvoters && postData.downvoters[username];

      if (postData.upvoters && postData.upvoters[username]) {
        return response.send(new Success(undefined, "User has already upvoted this post"));
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

      response.send(new Success(undefined, "Post upvoted successfully"));
    } catch (error) {
      next(new Error(500, "Failed to upvote post"));
    }
  }

  static async removePostUpvote(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;
    const { username } = req.body;
    const response = new ResponseHandler(res);

    if (!username) {
      return next(new Error(400, "Username is required"));    
    }

    try {
      const postRef = doc(PostsController.db, PostsController.collectionPath, postId);

      const postSnap = await getDoc(postRef);

      if (!postSnap.exists()) {
        return next(new NotFoundError("Post not found"));      
      }

      const postData = postSnap.data();
      const currentUpvotes = postData.upvotes || 0;
      const voters = postData.upvoters || {};

      if (!voters[username]) {
        return next(new Error(400, "User has not upvoted this post"));
      }

      await updateDoc(postRef, {
        upvotes: Math.max(currentUpvotes - 1, 0),
        [`upvoters.${username}`]: deleteField(),
      });

      response.send(new Success(undefined, "Upvote removed successfully"));
    } catch (error) {
      next(new Error(500, "Failed to remove upvote"));
    }
  }

  static async downvotePost(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;
    const { username } = req.body;
    const response = new ResponseHandler(res);

    if (!username) {
      return next(new Error(400, "Username is required"));
    }

    try {
      const postRef = doc(PostsController.db, PostsController.collectionPath, postId);

      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) {
        return next(new NotFoundError("Post not found"));
      }

      const postData = postSnap.data();
      const hasUpvoted = postData.upvoters && postData.upvoters[username];

      if (postData.downvoters && postData.downvoters[username]) {
        return response.send(new Success(undefined, "User has already downvoted this post"));
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

      response.send(new Success(undefined, "Post downvoted successfully"));
    } catch (error) {
      next(new Error(500, "Failed to downvote post"));
    }
  }

  static async removePostDownvote(req: Request, res: Response, next: NextFunction) {
    const { postId } = req.params;
    const { username } = req.body;
    const response = new ResponseHandler(res);

    if (!username) {
      return next(new Error(400, "Username is required"));
    }

    try {
      const postRef = doc(PostsController.db, PostsController.collectionPath, postId);

      const postSnap = await getDoc(postRef);

      if (!postSnap.exists()) {
        return next(new NotFoundError("Post not found"));
      }

      const postData = postSnap.data();
      const currentdownvotes = postData.downvotes || 0;
      const downvoters = postData.downvoters || {};

      if (!downvoters[username]) {
        return next(new Error(400, "User has not downvoted this post"));
      }

      await updateDoc(postRef, {
        downvotes: Math.max(currentdownvotes - 1, 0),
        [`downvoters.${username}`]: deleteField(),
      });

      response.send(new Success(undefined, "Downvote removed successfully"));
    } catch (error) {
      next(new Error(500, "Failed to remove downvote"));
    }
  }

  static async getUserVotedPosts(req: Request, res: Response, next: NextFunction) {
    const { username } = req.params;
    const response = new ResponseHandler(res);

    try {
      const postsSnapshot = await getDocs(collection(PostsController.db, PostsController.collectionPath));
  
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
  
      if (votedPosts.length === 0) {
        return next(new NotFoundError("User has not voted on any posts"));
      }
  
      response.send(new Success(votedPosts, "User votes posts reveived successfully"));
    } catch (error) {
      next(new Error(500, "Failed to get user voted posts", error));
    }
  }
}