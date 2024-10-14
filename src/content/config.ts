import { defineCollection, z } from "astro:content";

export const collections = {
    translations: defineCollection({
        type: "data",
        schema: z.record(z.string())
    }),
    markdown: defineCollection({
        type: "content"
    })
};
