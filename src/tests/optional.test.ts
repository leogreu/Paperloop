import { describe, expect, test } from "vitest";
import { blocks, renderDocument, toggle } from "./helpers";

const state = (root: ParentNode, name: string) => {
    const input = toggle(root, name);
    const block = input?.closest("p, li, tr, h1, h2, h3, h4, h5, h6");

    return {
        checked: input?.checked,
        excluded: block?.classList.contains("excluded"),
        disabled: input?.disabled
    };
};

const template = `[?plain] Plain toggle.

[?on??=true] Default on, still clickable.

[?mirror=not plain] Mirrors the plain toggle.

[?locked=true] Always on.

[?plain] Second occurrence of plain.

[?forward=not later] References a toggle defined further down.

[?later] Defined later.
`;

describe("derived states", () => {
    test("??= sets the initial state but stays clickable", () => {
        expect(state(renderDocument(template, {}), "on")).toMatchObject({ checked: true, excluded: false, disabled: false });
    });

    test("a single = always applies and disables the checkbox", () => {
        expect(state(renderDocument(template, {}), "locked")).toMatchObject({ checked: true, disabled: true });
    });

    test("an expression follows the toggle it references", () => {
        expect(state(renderDocument(template, {}), "mirror")).toMatchObject({ checked: true, excluded: false });
        expect(state(renderDocument(template, { "?plain": "true" }), "mirror")).toMatchObject({ checked: false, excluded: true });
    });

    test("a plain toggle keeps its stored state", () => {
        expect(state(renderDocument(template, {}), "plain")).toMatchObject({ checked: false, excluded: true });
        expect(state(renderDocument(template, { "?plain": "true" }), "plain")).toMatchObject({ checked: true, excluded: false });
    });

    test("an explicit state overrides a ??= default, but never a = expression", () => {
        expect(state(renderDocument(template, { "?on": "false" }), "on").checked).toBe(false);
        expect(state(renderDocument(template, { "?on": "true" }), "on").checked).toBe(true);
        expect(state(renderDocument(template, { "?locked": "false" }), "locked").checked).toBe(true);
    });

    test("an expression may reference a plain toggle defined further down", () => {
        expect(state(renderDocument(template, {}), "forward").checked).toBe(true);
    });

    test("an unresolvable expression keeps the block excluded instead of throwing", () => {
        const root = renderDocument(`[?broken=not missing] Broken.\n\n[?syntax=!plain] Bad syntax.\n\n[?plain] Plain.`, {});

        expect(state(root, "broken")).toMatchObject({ checked: false, excluded: true });
        expect(state(root, "syntax").checked).toBe(false);
    });

    test("expressions chain in document order", () => {
        const markdown = `[?a] A.\n\n[?b=a ? false : true] B.\n\n[?c=b and not a] C.`;

        expect(state(renderDocument(markdown, {}), "b").checked).toBe(true);
        expect(state(renderDocument(markdown, {}), "c").checked).toBe(true);
        expect(state(renderDocument(markdown, { "?a": "true" }), "b").checked).toBe(false);
        expect(state(renderDocument(markdown, { "?a": "true" }), "c").checked).toBe(false);
    });
});

describe("lifting the state onto blocks", () => {
    const markdown = `### [?A] A\n\nText\n\n[?B] B\n`;

    test("a marker in a heading toggles the whole section", () => {
        expect(blocks(renderDocument(markdown, {}))).toBe("-A | -Text | -B");
        expect(blocks(renderDocument(markdown, { "?A": "true", "?B": "true" }))).toBe("+A | +Text | +B");
    });

    test("a paragraph inside an included section keeps its own switch", () => {
        expect(blocks(renderDocument(markdown, { "?A": "true" }))).toBe("+A | +Text | -B");
    });

    test("an excluded section wins over an inner toggle", () => {
        expect(blocks(renderDocument(markdown, { "?B": "true" }))).toBe("-A | -Text | -B");
    });

    test("a subsection inside a section keeps its own switch", () => {
        const nested = `## [?Outer] Outer\n\n### [?Inner] Inner\n\nText\n`;

        expect(blocks(renderDocument(nested, { "?Outer": "true" }))).toBe("+Outer | -Inner | -Text");
        expect(blocks(renderDocument(nested, { "?Outer": "true", "?Inner": "true" }))).toBe("+Outer | +Inner | +Text");
        expect(blocks(renderDocument(nested, { "?Inner": "true" }))).toBe("-Outer | -Inner | -Text");
    });

    test("two markers in one block require both to be on", () => {
        expect(blocks(renderDocument(`[?A] [?B] Text`, { "?A": "true" }))).toBe("-Text");
        expect(blocks(renderDocument(`[?A] [?B] Text`, { "?A": "true", "?B": "true" }))).toBe("+Text");
    });

    test("content after a same- or higher-level heading is untouched", () => {
        expect(blocks(renderDocument(`### [?A] A\n\nInside\n\n## Other\n\nOutside\n`, {})))
            .toBe("-A | -Inside | +Other | +Outside");
    });

    test("unmarked blocks are never excluded", () => {
        expect(blocks(renderDocument(`Normal\n\n[?A] Optional`, {}))).toBe("+Normal | -Optional");
    });
});
