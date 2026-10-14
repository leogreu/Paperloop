import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

// The key is only ever sent to Paperloop, and the URL may point to a development server instead
const { PAPERLOOP_API_KEY, PAPERLOOP_URL = "https://www.paperloop.io" } = process.env;

// Passes on the error of the API, so that the agent can correct its input
const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(new URL(path, PAPERLOOP_URL), init);
    if (!response.ok) {
        const { error } = await response.json().catch(() => ({}));
        throw new Error(`Paperloop responded with ${response.status}: ${error ?? response.statusText}`);
    }
    return response;
};

const api = async (path: string, method = "GET", body?: object) => {
    if (!PAPERLOOP_API_KEY) {
        throw new Error("PAPERLOOP_API_KEY is not set. Ask the user to create an API key with the key button at the "
            + "top right of their documents in Paperloop, and to add it as PAPERLOOP_API_KEY to the env of the "
            + "paperloop server in the MCP configuration of their client. The key must never be shared in the chat.");
    }

    const response = await request(path, {
        method,
        headers: { "Authorization": `Bearer ${PAPERLOOP_API_KEY}`, "Content-Type": "application/json" },
        body: body && JSON.stringify(body)
    });
    return response.json();
};

// Only the ID is taken from a link, so that the key is never sent to the host it names
const documentPath = (url: string) => {
    const [, id] = url.match(/\/docs\/([\w-]+)/) ?? [];
    if (!id) throw new Error(`${url} is not a link to a Paperloop document`);
    return `/api/documents/${id}`;
};

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });

const url = z.string().describe("Link of the document, as returned by create_document or update_document, or copied from the browser.");
const name = z.string().describe("Name of the document. A #tag at its start groups it in the user's documents, e.g. \"#Offers Ada\".");
const markdown = z.string().describe("Content of the document, written in the syntax described in the guide.");
const values = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
    .describe("Values to fill in, as a flat object keyed by placeholder names, with \"?name\": true or false for optional blocks, as described in the guide's section on importing values.");

serveStdio(() => {
    const server = new McpServer({ name: "paperloop", version: "1.0.0" });

    server.registerTool("get_guide", {
        title: "Read the Paperloop guide",
        description: "Returns the current Paperloop guide in Markdown. Paperloop documents are Markdown templates "
            + "with a syntax of their own for placeholders, calculations, formatting, optional blocks, repetitions, "
            + "and headers and footers, and their values follow a format of their own. As this syntax goes beyond "
            + "plain Markdown and evolves over time, read the guide before your first create_document or "
            + "update_document in a conversation.",
        annotations: { readOnlyHint: true }
    }, async () => text(await (await request("/api/getting-started")).text()));

    server.registerTool("create_document", {
        title: "Create a Paperloop document",
        description: "Creates a new draft in the user's Paperloop account, stores its values along with it, and "
            + "returns the link to share with the user. Read the guide with get_guide first, as the markdown and the "
            + "values follow the syntax described there. To change the document later on, use update_document "
            + "rather than creating another one.",
        inputSchema: z.object({ name, markdown, values }),
        annotations: { destructiveHint: false }
    }, async input => text((await api("/api/documents", "POST", input)).url));

    server.registerTool("get_document", {
        title: "Read a Paperloop document",
        description: "Returns the name, the current markdown, the values, and the link of a document in the user's "
            + "Paperloop account as JSON. Read it right before changing the document with update_document, as the "
            + "user may have edited it in Paperloop since.",
        inputSchema: z.object({ url }),
        annotations: { readOnlyHint: true }
    }, async ({ url }) => text(JSON.stringify(await api(documentPath(url)))));

    server.registerTool("update_document", {
        title: "Update a Paperloop document",
        description: "Changes a document in the user's Paperloop account and returns its link. Pass only what "
            + "changes. The markdown replaces the current one as a whole, so base it on the one returned by "
            + "get_document to keep the user's edits. The values only replace the keys they contain and keep all "
            + "others. Published versions cannot be changed, except for their values, which all versions of a "
            + "document share. A document that is still open in the browser shows the changes once reloaded.",
        inputSchema: z.object({ url, name: name.optional(), markdown: markdown.optional(), values })
    }, async ({ url, ...input }) => text((await api(documentPath(url), "PATCH", input)).url));

    return server;
});
