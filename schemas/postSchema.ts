import { z } from 'zod';

export const postSchema = z.object({
    username: z.string().min(1, 'Username is required!'),
    title: z.string().min(1, 'Title is required!'),
    content: z.string().min(1, 'Content is required!'),
});

export const partialPostSchema = postSchema.pick({
    title: true,
    content: true,
  }).partial();