import type { APIRoute } from "astro";
import { getEntry } from "astro:content";

// Serves the guide as plain Markdown, so that agents always read the syntax of the deployed version
export const GET: APIRoute = async () => {
    const entry = await getEntry("markdown", "getting-started");
    return new Response(entry?.body, {
        headers: { "Content-Type": "text/markdown; charset=utf-8" }
    });
};
