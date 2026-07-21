import { describe, expect, test } from "vitest";
import { renderDocument } from "./helpers";

const headings = (root: ParentNode) =>
    [...root.querySelectorAll("h1, h2, h3")].map(element => element.textContent?.trim());

const cells = (root: ParentNode) =>
    [...root.querySelectorAll("tbody td:first-child")].map(element => element.textContent?.trim());

const optional = `## 1. Basics

Text.

[?epro]
## 2. ePRO module

Content.

### 2.1 Subsection

Text.

# Interlude

## 3. Support

## Appendix

| Pos | Service |
|-----|---------|
| 1. | Base |
| [?epro] 2. | ePRO |
| 3. | Support |
`;

describe("headings", () => {
    test("an excluded one shows a hash in the typed style", () => {
        expect(headings(renderDocument(optional, {})).slice(1, 3)).toEqual(["#. ePRO module", "# Subsection"]);
    });

    test("the following headings close the gap", () => {
        expect(headings(renderDocument(optional, {}))[4]).toBe("2. Support");
    });

    test("an included section is numbered hierarchically", () => {
        const rendered = headings(renderDocument(optional, { "?epro": "true" }));

        expect(rendered[1]).toBe("2. ePRO module");
        expect(rendered[2]).toBe("2.1 Subsection");
        expect(rendered[4]).toBe("3. Support");
    });

    test("unnumbered headings are left alone and do not reset the counters", () => {
        const rendered = headings(renderDocument(optional, {}));

        expect(rendered[3]).toBe("Interlude");
        expect(rendered[5]).toBe("Appendix");
    });
});

describe("table rows", () => {
    test("an excluded row shows a hash, keeping the column stable", () => {
        expect(cells(renderDocument(optional, {}))).toEqual(["1.", "#.", "2."]);
    });

    test("an included row is numbered in sequence", () => {
        expect(cells(renderDocument(optional, { "?epro": "true" }))).toEqual(["1.", "2.", "3."]);
    });
});

describe("documents without optional blocks", () => {
    const untouched = `## 3. Subject

# 2024 Report

| Amount | Article |
|--------|---------|
| 5 | Screws |
| 12 | Nuts |

[?opt] An optional paragraph.
`;

    test("numbered headings keep the numbers the author typed", () => {
        expect(headings(renderDocument(untouched, {})).slice(0, 2)).toEqual(["3. Subject", "2024 Report"]);
    });

    test("a numeric data column is not mistaken for a numbering", () => {
        expect(cells(renderDocument(untouched, {}))).toEqual(["5", "12"]);
    });
});
