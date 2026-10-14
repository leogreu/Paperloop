import type { APIRoute } from "astro";
import { db, eq, Document } from "astro:db";
import { Input, error, getApiDocument, getDocumentUrl, parseInput } from "@/utils/api";

// Returns the current state of a document, e.g. for an agent to base an update on; its values are
// only stored in the browser and thereby not included
export const GET: APIRoute = async ({ request, params, url }) => {
    const document = await getApiDocument(request, params.id);
    if (document instanceof Response) return document;

    const { id, name, markdown } = document;
    return Response.json({ name, markdown, url: getDocumentUrl(url.origin, id) });
};

// Changes the name or markdown of a draft and returns its URL; with values only, nothing is changed,
// so that the URL merely fills them in when it is opened, just like on creation
export const PATCH: APIRoute = async ({ request, params, url }) => {
    const document = await getApiDocument(request, params.id);
    if (document instanceof Response) return document;

    const input = await parseInput(request, Input.partial());
    if (input instanceof Response) return input;

    const { name, markdown, values } = input;
    if (name !== undefined || markdown !== undefined) {
        if (document.version) {
            return error("This version is published and cannot be changed, except for its values. Ask the user "
                + "to click edit on it in Paperloop, which creates a new draft, and to share the link of that draft.", 409);
        }

        await db.update(Document)
            .set({ name, markdown, updated: new Date() })
            .where(eq(Document.id, document.id));
    }

    return Response.json({ url: getDocumentUrl(url.origin, document.id, values) });
};
