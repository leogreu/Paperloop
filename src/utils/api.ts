import { and, db, eq, ApiKey, Document } from "astro:db";
import { z } from "astro:schema";
import { hashApiKey } from "@/utils/api-key";

export const Input = z.object({
    name: z.string(),
    markdown: z.string(),
    values: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

export const error = (message: string, status: number) => Response.json({ error: message }, { status });

// The owner of the API key in the authorization header, if it is a valid one
export const getApiUser = async (request: Request) => {
    const [scheme, key] = request.headers.get("authorization")?.split(" ") ?? [];
    if (scheme !== "Bearer" || !key) return;

    const apiKey = await db.select().from(ApiKey).where(eq(ApiKey.hash, await hashApiKey(key))).get();
    return apiKey?.user;
};

// The draft or version of the owner of the API key, or the response to answer with otherwise
export const getApiDocument = async (request: Request, id = String()) => {
    const user = await getApiUser(request);
    if (!user) return error("Invalid API key", 401);

    const document = await db.select().from(Document)
        .where(and(eq(Document.id, id), eq(Document.user, user)))
        .get();
    return document ?? error("Document not found", 404);
};

// The validated JSON body, or a response listing its issues
export const parseInput = async <T extends z.ZodTypeAny>(request: Request, schema: T) => {
    const input = schema.safeParse(await request.json().catch(() => null));
    if (input.success) return input.data as z.infer<T>;

    const issues = input.error.issues.map(({ path, message }) => `${path.join(".") || "body"}: ${message}`);
    return error(issues.join(", "), 400);
};

// The rendered view of a document, with the values in the fragment, as it is never sent to the server
// and thereby not subject to its URL length limit
export const getDocumentUrl = (origin: string, id: string, values: z.infer<typeof Input>["values"] = {}) => {
    const fragment = new URLSearchParams(
        Object.entries(values).map(([key, value]) => [key, String(value)])
    ).toString();

    return `${origin}/docs/${id}/render${fragment && `#${fragment}`}`;
};
