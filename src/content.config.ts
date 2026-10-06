import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

export const collections = {
    translations: defineCollection({
        loader: glob({ pattern: "*.json", base: "./src/content/translations" }),
        schema: z.record(z.string())
    }),
    markdown: defineCollection({
        loader: glob({ pattern: "*.md", base: "./src/content/markdown" })
    })
};
