import type { APIRoute } from "astro";
import { db, Document } from "astro:db";
import { Input, error, getApiUser, getDocumentUrl, parseInput } from "@/utils/api";

// Creates a draft for the owner of the API key and returns the URL of its rendered view
export const POST: APIRoute = async ({ request, url }) => {
    const user = await getApiUser(request);
    if (!user) return error("Invalid API key", 401);

    const input = await parseInput(request, Input);
    if (input instanceof Response) return input;

    const { name, markdown, values } = input;
    const [document] = await db.insert(Document).values({
        id: crypto.randomUUID(),
        document: crypto.randomUUID(),
        name,
        markdown,
        updated: new Date(),
        user
    }).returning();

    return Response.json({ url: getDocumentUrl(url.origin, document.id, values) }, { status: 201 });
};
