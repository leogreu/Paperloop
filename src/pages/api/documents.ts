import type { APIRoute } from "astro";
import { db, Document } from "astro:db";
import { Input, error, getApiUser, getDocumentUrl, parseInput } from "@/utils/api";
import { getDocuments } from "@/utils/documents";
import { patchValues } from "@/utils/values";

// Lists the documents whose name contains every word of the query, in any order and case, with the
// latest draft or version of each, just like the overview; an empty query lists all of them
export const GET: APIRoute = async ({ request, url }) => {
    const user = await getApiUser(request);
    if (!user) return error("Invalid API key", 401);

    const words = (url.searchParams.get("query") ?? String()).toLowerCase().split(/\s+/).filter(Boolean);
    const documents = (await getDocuments(user))
        .filter(({ name }) => words.every(word => name.toLowerCase().includes(word)));

    return Response.json(documents.map(({ id, name, version, updated }) => (
        { name, url: getDocumentUrl(url.origin, id), version, updated }
    )));
};

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
    if (values) await patchValues(document.document, user, values);

    return Response.json({ url: getDocumentUrl(url.origin, document.id) }, { status: 201 });
};
