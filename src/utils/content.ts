import { getEntry } from "astro:content";
import { db, Document } from "astro:db";

export const createGettingStarted = async (userId: string) => {
    const markdown = await getEntry("markdown", "getting-started");

    await db.insert(Document).values({
        id: crypto.randomUUID(),
        document: crypto.randomUUID(),
        updated: new Date(),
        user: userId,
        version: 1,
        name: "Getting started",
        markdown: markdown.body
    })
};
