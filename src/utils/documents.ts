import { db, eq, desc, Document } from "astro:db";

// The latest draft or version of each document of a user, most recently updated first
export const getDocuments = async (user: string) => {
    const entries = await db.select().from(Document).where(eq(Document.user, user)).orderBy(desc(Document.updated));
    return entries.filter((entry, index) => index === entries.findIndex(({ document }) => document === entry.document));
};
