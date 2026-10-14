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

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });

serveStdio(() => {
    const server = new McpServer({ name: "paperloop", version: "1.0.0" });

    server.registerTool("get_guide", {
        title: "Read the Paperloop guide",
        description: "Returns the current Paperloop guide in Markdown. Paperloop documents are Markdown templates "
            + "with a syntax of their own for placeholders, calculations, formatting, optional blocks, repetitions, "
            + "and headers and footers, and their values follow a format of their own. As this syntax goes beyond "
            + "plain Markdown and evolves over time, read the guide before your first create_document in a conversation.",
        annotations: { readOnlyHint: true }
    }, async () => text(await (await request("/api/getting-started")).text()));

    server.registerTool("create_document", {
        title: "Create a Paperloop document",
        description: "Creates a new draft in the user's Paperloop account and returns its link. Read the guide with "
            + "get_guide first, as the markdown and the values follow the syntax described there. The values travel "
            + "within the link and are only filled in when the user opens exactly this link in a browser where they "
            + "are logged in to Paperloop, so always share the complete link.",
        inputSchema: z.object({
            name: z.string().describe("Name of the document. A #tag at its start groups it in the user's documents, e.g. \"#Offers Ada\"."),
            markdown: z.string().describe("Content of the document, written in the syntax described in the guide."),
            values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
                .describe("Values to fill in, as a flat object keyed by placeholder names, with \"?name\": true or false for optional blocks, as described in the guide's section on importing values.")
        }),
        annotations: { destructiveHint: false }
    }, async input => {
        if (!PAPERLOOP_API_KEY) {
            throw new Error("PAPERLOOP_API_KEY is not set. Ask the user to create an API key with the key button at the "
                + "top right of their documents in Paperloop, and to add it as PAPERLOOP_API_KEY to the env of the "
                + "paperloop server in the MCP configuration of their client. The key must never be shared in the chat.");
        }

        const response = await request("/api/documents", {
            method: "POST",
            headers: { "Authorization": `Bearer ${PAPERLOOP_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify(input)
        });
        const { url } = await response.json();
        return text(url);
    });

    return server;
});
