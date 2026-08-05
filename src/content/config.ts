import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    excerpt: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    author: z.string().default("Cayad Auto Transport"),
    state: z.string().optional(),
    tags: z.array(z.string()).default([]),
    coverImage: z.string(),
    coverAlt: z.string(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
  }),
});

export const collections = { blog };
