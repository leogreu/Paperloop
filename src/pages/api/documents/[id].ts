import type { APIRoute } from "astro";
import { db, eq, Document } from "astro:db";
import { z } from "astro:schema";
import { Input, error, getApiDocument, getDocumentUrl, parseInput } from "@/utils/api";
import { getValues, patchValues } from "@/utils/values";

// Returns the current state of a document, e.g. for an agent to base an update on
export const GET: APIRoute = async ({ request, params, url }) => {
    const document = await getApiDocument(request, params.id);
    if (document instanceof Response) return document;

    const { id, name, markdown } = document;
    const values = await getValues(document.document);
    return Response.json({ name, markdown, values, url: getDocumentUrl(url.origin, id) });
};

// Edits replace single passages of the markdown, so that small changes need not pass all of it
const Update = Input.partial().extend({
    edits: z.array(z.object({ find: z.string().min(1), replace: z.string() })).optional()
});

// Changes the name or markdown of a draft, and replaces only the given values, which are shared by
// all versions and can thereby be changed for published ones as well
export const PATCH: APIRoute = async ({ request, params, url }) => {
    const document = await getApiDocument(request, params.id);
    if (document instanceof Response) return document;

    const input = await parseInput(request, Update);
    if (input instanceof Response) return input;

    const { name, edits, values } = input;
    let { markdown } = input;
    if (name !== undefined || markdown !== undefined || edits) {
        if (document.version) {
            return error("This version is published and cannot be changed, except for its values. Ask the user "
                + "to click edit on it in Paperloop, which creates a new draft, and to share the link of that draft.", 409);
        }

        // Each find text has to appear exactly once, so that an edit cannot change the wrong passage
        if (edits) {
            if (markdown !== undefined) return error("Pass either markdown or edits, not both", 400);

            markdown = document.markdown;
            for (const [index, { find, replace }] of edits.entries()) {
                const count = markdown.split(find).length - 1;
                if (count !== 1) {
                    return error(`The find text of edit ${index + 1}, ${JSON.stringify(find)}, appears ${count} times `
                        + "in the markdown instead of exactly once, so nothing was changed. Base it on the current "
                        + "markdown, and add some of the surrounding text if it appears more than once.", 400);
                }
                markdown = markdown.replace(find, () => replace);
            }
        }

        await db.update(Document)
            .set({ name, markdown, updated: new Date() })
            .where(eq(Document.id, document.id));
    }
    if (values) await patchValues(document.document, document.user, values);

    return Response.json({ url: getDocumentUrl(url.origin, document.id) });
};
