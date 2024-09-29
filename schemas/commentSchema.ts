import { z } from "zod";

export const commentSchema = z.object({
  username: z.string().min(1, 'Username is required!'),
  content: z.string().min(1, 'Content is required!'),
});

export const partialCommentSchema = commentSchema.pick({
  content: true
}).partial();
