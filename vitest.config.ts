import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url))
        }
    },
    test: {
        // The rendering utilities read document and navigator, just like in the browser
        environment: "jsdom",
        include: ["src/**/*.test.ts"]
    }
});
