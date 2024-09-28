import { z } from "zod";

export const commentSchema = z.object({
  username: z.string(),
  content: z.string(),
});

export const partialCommentSchema = commentSchema.pick({
  content: true
}).partial();
