import { db, eq, sql, DocumentValues } from "astro:db";

// The values of a document, shared by all of its versions
export const getValues = async (document: string) => {
    const entry = await db.select().from(DocumentValues).where(eq(DocumentValues.document, document)).get();
    return (entry?.values ?? {}) as Record<string, string>;
};

// Merges changes into the values of a document as a JSON merge patch, so that null removes a key, and
// each change only touches its own keys, keeping others changed meanwhile, e.g. by an agent
export const patchValues = async (document: string, user: string, changes: Record<string, unknown>) => {
    const patch = Object.fromEntries(
        Object.entries(changes).map(([key, value]) => [key, value === null ? null : String(value)])
    );
    const values = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== null));

    await db.insert(DocumentValues)
        .values({ document, user, values })
        .onConflictDoUpdate({
            target: DocumentValues.document,
            set: { values: sql`json_patch(${DocumentValues.values}, ${JSON.stringify(patch)})` }
        });
};
