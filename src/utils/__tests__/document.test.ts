import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { placeholder, renderDocument, resetFormatting, toggle } from "./helpers";

// The document every new user starts from, so its examples must actually work
const markdown = readFileSync(resolve("src/content/markdown/getting-started.md"), "utf8");

beforeEach(resetFormatting);

describe("the getting-started document", () => {
    test("renders without leaving literal markers behind", () => {
        const root = renderDocument(markdown, {});

        expect(root.textContent).not.toMatch(/\[=|\[\?|\?\?\]/);
    });

    test("keeps its section numbering, as its optional blocks are unnumbered", () => {
        const headings = [...renderDocument(markdown, {}).querySelectorAll("h2")]
            .map(element => element.textContent?.trim());

        expect(headings).toContain("11. Optional blocks");
        expect(headings).toContain("12. Calculations");
        expect(headings).toContain("14. Headers and footers");
    });

    test("resolves the now() example to a full timestamp", () => {
        const example = [...renderDocument(markdown, {}).querySelectorAll("content-editable[expression]")]
            .find(element => element.getAttribute("expression") === "now()");

        expect(example?.getAttribute("format")).toBe("date");
        expect(example?.getAttribute("value")).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
        expect(example?.hasAttribute("readonly")).toBe(true);
    });

    test("shows the derived optional blocks in their documented default state", () => {
        const root = renderDocument(markdown, {});

        // [?extended??=true] starts included, [?basic=not extended] mirrors it
        expect(toggle(root, "extended")?.checked).toBe(true);
        expect(toggle(root, "basic")?.checked).toBe(false);
        expect(toggle(root, "self-hosting")?.checked).toBe(false);
    });

    test("flips the mirrored block when the derived one is turned off", () => {
        const root = renderDocument(markdown, { "?extended": "false" });

        expect(toggle(root, "extended")?.checked).toBe(false);
        expect(toggle(root, "basic")?.checked).toBe(true);
    });

    test("keeps the documented fallback example editable and optional", () => {
        const variable = placeholder(renderDocument(markdown, {}), "Variable");

        expect(variable?.getAttribute("fallback")).toBe("1200");
        expect(variable?.getAttribute("format")).toBe("currency");
        expect(variable?.hasAttribute("readonly")).toBe(false);
    });

    test("computes the gross price example from the net price", () => {
        expect(placeholder(renderDocument(markdown, { Net: "1000" }), "Gross")?.getAttribute("value")).toBe("1190");
    });
});
