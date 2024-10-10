import { defineAction, ActionError } from "astro:actions";
import { and, db, eq, Document } from "astro:db";
import { z } from "astro:schema";
import { supabase } from "@/lib/supabase";

export const server = {
    register: defineAction({
        accept: "form",
        input: z.object({
            email: z.string(),
            password: z.string()
        }),
        handler: async ({ email, password }, { cookies }) => {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error || !data.session) throw new ActionError({ code: "BAD_REQUEST" });

            // TODO: Evaluate whether to call login() action instead
            const { access_token, refresh_token } = data.session;
            cookies.set("sb-access-token", access_token, { path: "/" });
            cookies.set("sb-refresh-token", refresh_token, { path: "/" });
        }
    }),
    login: defineAction({
        accept: "form",
        input: z.object({
            email: z.string(),
            password: z.string()
        }),
        handler: async ({ email, password }, { cookies }) => {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw new ActionError({ code: "BAD_REQUEST" });
        
            const { access_token, refresh_token } = data.session;
            cookies.set("sb-access-token", access_token, { path: "/" });
            cookies.set("sb-refresh-token", refresh_token, { path: "/" });
        }
    }),
    logout: defineAction({
        accept: "json",
        handler: (_, { cookies }) => {
            cookies.delete("sb-access-token", { path: "/" });
            cookies.delete("sb-refresh-token", { path: "/" });
        }
    }),
    createDocument: defineAction({
        accept: "json",
        handler: async (_, { locals: { user }}) => {
            if (!user) throw new ActionError({ code: "UNAUTHORIZED" });

            const [document] = await db.insert(Document).values({
                id: crypto.randomUUID(),
                document: crypto.randomUUID(),
                updated: new Date(),
                user: user.id
            }).returning();

            return { id: document.id };
          },
    }),
    updateDocument: defineAction({
        accept: "json",
        input: z.object({
            id: z.string(),
            name: z.string().optional(),
            markdown: z.string().optional(),
            updated: z.date().optional()
        }),
        handler: async ({ id, name, markdown, updated = new Date() }, { locals: { user }}) => {
            if (!user) throw new ActionError({ code: "UNAUTHORIZED" });

            await db.update(Document)
                .set({ name, markdown, updated })
                .where(and(eq(Document.id, id), eq(Document.user, user.id)));
        }
    }),
    publishDocument: defineAction({
        accept: "json",
        input: z.string(),
        handler: async (id, { locals: { user }}) => {
            if (!user) throw new ActionError({ code: "UNAUTHORIZED" });

            const [current] = await db.select().from(Document).where(
                and(eq(Document.id, id), eq(Document.user, user.id))
            );
            if (!current) throw new ActionError({ code: "BAD_REQUEST" });

            const versions = await db.select().from(Document).where(
                eq(Document.document, current.document)
            );
            await db.update(Document)
                .set({
                    version: Math.max(...versions.map(entry => entry.version ?? 0), 0) + 1,
                    updated: new Date()
                })
                .where(eq(Document.id, id));
        }
    }),
    duplicateDocument: defineAction({
        accept: "json",
        input: z.string(),
        handler: async (id, { locals: { user }}) => {
            if (!user) throw new ActionError({ code: "UNAUTHORIZED" });

            const [current] = await db.select().from(Document).where(
                and(eq(Document.id, id), eq(Document.user, user.id))
            );
            if (!current) throw new ActionError({ code: "BAD_REQUEST" });

            await db.insert(Document).values({
                ...current,
                id: crypto.randomUUID(),
                version: undefined,
                updated: new Date()
            });
        }
    }),
    deleteDocument: defineAction({
        accept: "json",
        input: z.string(),
        handler: async (id, { locals: { user }}) => {
            if (!user) throw new ActionError({ code: "UNAUTHORIZED" });

            const [deleted] = await db.delete(Document).where(
                and(eq(Document.id, id), eq(Document.user, user.id))
            ).returning();
            if (!deleted) throw new ActionError({ code: "BAD_REQUEST" });

            const remaining = await db.select().from(Document).where(
                eq(Document.document, deleted.document)
            );
            return remaining.length ? `/docs/versions/${deleted.document}` : "/docs";
        }
    }),
    deleteDocuments: defineAction({
        accept: "json",
        input: z.string(),
        handler: async (document, { locals: { user }}) => {
            if (!user) throw new ActionError({ code: "UNAUTHORIZED" });

            await db.delete(Document).where(
                and(eq(Document.document, document), eq(Document.user, user.id))
            );
            return "/docs";
        }
    })
}
