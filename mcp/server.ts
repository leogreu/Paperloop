import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { printPdf } from "./pdf";

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

const authorization = () => {
    if (!PAPERLOOP_API_KEY) {
        throw new Error("PAPERLOOP_API_KEY is not set. Ask the user to create an API key with the key button at the "
            + "top right of their documents in Paperloop, and to add it as PAPERLOOP_API_KEY to the env of the "
            + "paperloop server in the MCP configuration of their client. The key must never be shared in the chat.");
    }
    return `Bearer ${PAPERLOOP_API_KEY}`;
};

const api = async (path: string, method = "GET", body?: object) => {
    const response = await request(path, {
        method,
        headers: { "Authorization": authorization(), "Content-Type": "application/json" },
        body: body && JSON.stringify(body)
    });
    return response.json();
};

// Only the ID is taken from a link, so that the key is never sent to the host it names
const documentId = (url: string) => {
    const [, id] = url.match(/\/docs\/([\w-]+)/) ?? [];
    if (!id) throw new Error(`${url} is not a link to a Paperloop document`);
    return id;
};

// A local path, relative to the given folder in the home folder unless absolute, with ~ for the home folder as in a shell
const localPath = (path: string, ...folder: string[]) => resolve(homedir(), ...folder, path.replace(/^~(?=[/\\]|$)/, homedir()));

// Takes the markdown from a local file instead, so that a long template need not pass through the chat; only
// Markdown files can be read, so that no other one, e.g. a configuration with the key, ends up in a document
const readMarkdown = async <T extends { markdown?: string, markdown_file?: string }>(input: T) => {
    const { markdown_file, ...rest } = input;
    if (!markdown_file) return rest;
    if (input.markdown !== undefined) throw new Error("Pass either markdown or markdown_file, not both");
    if (!/\.md$/i.test(markdown_file)) throw new Error(`${markdown_file} is not a Markdown file ending in .md`);

    const path = localPath(markdown_file);
    const markdown = await readFile(path, "utf8").catch(() => {
        throw new Error(`${path} could not be read. The path has to be the one on the computer running this `
            + "server, so ask the user for it if yours may differ, e.g. in a sandbox.");
    });
    return { ...rest, markdown };
};

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });

const url = z.string().describe("Link of the document, as returned by create_document, search_documents, or update_document, or copied from the browser.");
const name = z.string().describe("Name of the document. A #tag at its start groups it in the user's documents, e.g. \"#Offers Ada\".");
const markdown = z.string().describe("Content of the document, written in the syntax described in the guide.");
const markdown_file = z.string().optional()
    .describe("Path of a .md file on this computer to take the markdown from instead of passing it, e.g. a template in one of the user's folders, absolute or relative to their home folder.");
const edits = z.array(z.object({
    find: z.string().describe("Passage of the current markdown to replace, which has to appear exactly once in it, so include some of the surrounding text if needed."),
    replace: z.string().describe("Text to put in its place, or an empty one to remove the passage.")
})).optional()
    .describe("Small changes to the current markdown, applied in order, instead of passing all of it, e.g. to fix a typo or remove a line. If a passage does not appear exactly once, nothing is changed.");
const values = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]).nullable()).optional()
    .describe("Values to fill in, as a flat object keyed by placeholder names, with \"?name\": true or false for optional blocks, as described in the guide's section on importing values. Null removes a value, e.g. to let an optional block follow its expression again.");

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
        inputSchema: z.object({ name, markdown: markdown.optional(), markdown_file, values }),
        annotations: { destructiveHint: false }
    }, async input => text((await api("/api/documents", "POST", await readMarkdown(input))).url));

    server.registerTool("search_documents", {
        title: "Search Paperloop documents",
        description: "Finds documents in the user's Paperloop account by their name, which often starts with a #tag "
            + "grouping them, e.g. to collect the documents of a contract. Every word of the query has to appear in "
            + "the name, in any order and case, and an empty query lists all documents. Returns the name, the link, "
            + "the version (null for a draft, whose markdown can be changed), and the last update of the latest "
            + "draft or version of each document as JSON, most recently updated first. Use the links with the other "
            + "tools.",
        inputSchema: z.object({
            query: z.string().default(String()).describe("Words to find in the names, e.g. \"#Contracts ACME\".")
        }),
        annotations: { readOnlyHint: true }
    }, async ({ query }) => text(JSON.stringify(await api(`/api/documents?${new URLSearchParams({ query })}`))));

    server.registerTool("get_document", {
        title: "Read a Paperloop document",
        description: "Returns the name, the current markdown, the values, and the link of a document in the user's "
            + "Paperloop account as JSON. Read it right before changing the document with update_document, as the "
            + "user may have edited it in Paperloop since. Leave out what you do not need, as a long markdown fills "
            + "the context: the markdown, e.g. to only reuse the values in another document, or the values to only "
            + "work on the template.",
        inputSchema: z.object({
            url,
            markdown: z.boolean().default(true).describe("Whether to include the markdown."),
            values: z.boolean().default(true).describe("Whether to include the values.")
        }),
        annotations: { readOnlyHint: true }
    }, async ({ url, markdown, values }) => {
        const document = await api(`/api/documents/${documentId(url)}`);
        if (!markdown) delete document.markdown;
        if (!values) delete document.values;
        return text(JSON.stringify(document));
    });

    server.registerTool("update_document", {
        title: "Update a Paperloop document",
        description: "Changes a document in the user's Paperloop account and returns its link. Pass only what "
            + "changes. For small changes, prefer edits, which replace single passages of the current markdown. The "
            + "markdown, in contrast, replaces the current one as a whole, so base it on the one returned by "
            + "get_document to keep the user's edits. The values only replace the keys they contain and keep all "
            + "others, and null removes one. Published versions cannot be changed, except for their values, which all versions of a "
            + "document share. A document that is still open in the browser shows the changes once reloaded.",
        inputSchema: z.object({ url, name: name.optional(), edits, markdown: markdown.optional(), markdown_file, values })
    }, async ({ url, ...input }) => text((await api(`/api/documents/${documentId(url)}`, "PATCH", await readMarkdown(input))).url));

    server.registerTool("export_pdf", {
        title: "Export Paperloop documents as a PDF",
        description: "Prints one or more documents of the user's Paperloop account with Google Chrome on this "
            + "computer, just like its print dialog does, with their values, headers, footers, and page numbers, and "
            + "merges them in the given order into one PDF file, e.g. to check the final result of a document or to "
            + "put together a contract from several ones. Returns the path of the file and the pages of each "
            + "document in it. Requires Google Chrome to be installed.",
        inputSchema: z.object({
            urls: z.array(z.string()).min(1).describe("Links of the documents, in the order they should appear in the PDF, or a single link for just one document."),
            file: z.string().describe("Name of the PDF file to save in the user's Downloads folder, e.g. \"Contract Ada.pdf\", a path within it, e.g. \"Paperloop/Contract Ada.pdf\", or an absolute path. Missing folders are created."),
            overwrite: z.boolean().default(false).describe("Whether to replace an existing file, e.g. an earlier export of the same documents to check them again.")
        })
    }, async ({ urls, file, overwrite }) => {
        // Only PDF files are written, so that no other file can be replaced
        if (!/\.pdf$/i.test(file)) throw new Error(`${file} is not a PDF file ending in .pdf`);

        const { pdf, contents } = await printPdf(
            urls.map(url => new URL(`/docs/${documentId(url)}/render`, PAPERLOOP_URL).href),
            new URL(PAPERLOOP_URL).origin,
            authorization()
        );

        const path = localPath(file, "Downloads");
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, await pdf.save(), { flag: overwrite ? "w" : "wx" }).catch(error => {
            throw error.code === "EEXIST"
                ? new Error(`${path} already exists, so choose another name, or set overwrite to true to replace it`)
                : error;
        });

        // The title of a page is the name of its document, followed by the one of Paperloop
        const pages = pdf.getPageCount();
        return text([
            `Saved the PDF with ${pages} ${pages === 1 ? "page" : "pages"} to ${path}:`,
            ...contents.map(({ title, first, last }) => `- ${first === last ? `Page ${first}` : `Pages ${first}–${last}`}: `
                + title.replace(/ \| Paperloop$/, ""))
        ].join("\n"));
    });

    return server;
});
