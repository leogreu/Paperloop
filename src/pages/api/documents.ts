import type { APIRoute } from "astro";
import { db, eq, ApiKey, Document } from "astro:db";
import { z } from "astro:schema";
import { hashApiKey } from "@/utils/api-key";

const Input = z.object({
    name: z.string(),
    markdown: z.string(),
    values: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

// Creates a draft for the owner of the API key and returns its URL, with the values in the fragment,
// as it is never sent to the server and thereby not subject to its URL length limit
export const POST: APIRoute = async ({ request, url }) => {
    const [scheme, key] = request.headers.get("authorization")?.split(" ") ?? [];
    const apiKey = scheme === "Bearer" && key
        ? await db.select().from(ApiKey).where(eq(ApiKey.hash, await hashApiKey(key))).get()
        : undefined;
    if (!apiKey) return Response.json({ error: "Invalid API key" }, { status: 401 });

    const input = Input.safeParse(await request.json().catch(() => null));
    if (!input.success) {
        const issues = input.error.issues.map(({ path, message }) => `${path.join(".") || "body"}: ${message}`);
        return Response.json({ error: issues.join(", ") }, { status: 400 });
    }

    const { name, markdown, values = {} } = input.data;
    const [document] = await db.insert(Document).values({
        id: crypto.randomUUID(),
        document: crypto.randomUUID(),
        name,
        markdown,
        updated: new Date(),
        user: apiKey.user
    }).returning();

    const fragment = new URLSearchParams(
        Object.entries(values).map(([key, value]) => [key, String(value)])
    ).toString();

    return Response.json(
        { url: `${url.origin}/docs/${document.id}${fragment && `#${fragment}`}` },
        { status: 201 }
    );
};
