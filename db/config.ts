import { defineDb, defineTable, column } from "astro:db";

const Document = defineTable({
    columns: {
        id: column.text({ primaryKey: true }),
        name: column.text({ default: String() }),
        markdown: column.text({ default: String() }),
        version: column.number({ optional: true }),
        document: column.text(),
        updated: column.date(),
        user: column.text()
    }
});

// One key per user, stored as a SHA-256 hash, so it is only shown once when created
const ApiKey = defineTable({
    columns: {
        user: column.text({ primaryKey: true }),
        hash: column.text({ unique: true }),
        created: column.date()
    }
});

// https://astro.build/db/config
export default defineDb({
    tables: { Document, ApiKey }
});
