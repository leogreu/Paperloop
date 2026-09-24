import { beforeEach, describe, expect, test } from "vitest";
import { markdownToHTML, repetitionInputs } from "@/utils/markdown";
import { placeholder, placeholders, renderDocument, resetFormatting, toggle } from "./helpers";

const value = (root: ParentNode, name: string) => placeholder(root, name)?.getAttribute("value");
const cells = (root: ParentNode) => [...root.querySelectorAll("tbody tr")].map(row => row.querySelector("td")?.textContent?.trim());

const table = (row: string) => `| Year | Value |\n|------|-------|\n${row}\n`;

beforeEach(resetFormatting);

describe("repeated lines", () => {
    test("repeats a line once per counter value, starting at 1 by default", () => {
        expect(cells(renderDocument(table(`| [#Year=3] {Year} | x |`)))).toEqual(["1", "2", "3"]);
    });

    test("starts at the lower bound, when given", () => {
        expect(cells(renderDocument(table(`| [#Year=2..4] {Year} | x |`)))).toEqual(["2", "3", "4"]);
    });

    test("inserts the counter with an offset, in names as well as in text", () => {
        const root = renderDocument(`- [#Row=2..3] {Row} after {Row-1}, before {Row + 1}: [Value_{Row}=Row_Base_{Row-1}]`);

        expect([...root.querySelectorAll("li")].map(item => item.textContent?.trim())).toEqual([
            "2 after 1, before 3:",
            "3 after 2, before 4:"
        ]);
        expect(placeholders(root, "Value_3")[0]?.getAttribute("expression")).toBe("Row_Base_2");
    });

    test("leaves braces of other names and attribute blocks untouched", () => {
        const root = renderDocument(`[#Row=1] {Other} text {.text-right}`);

        expect(root.querySelector("p")?.textContent?.trim()).toBe("{Other} text");
        expect(root.querySelector("p")?.classList.contains("text-right")).toBe(true);
    });

    test("leaves lines without a marker as they are", () => {
        expect(cells(renderDocument(table(`| 1 | {Year} |`)))).toEqual(["1"]);
    });

    test("leaves markers in code spans as they are", () => {
        const root = renderDocument("Write `[#Year=Years]` to repeat a line.");

        expect(root.querySelector("p")?.textContent).toMatch(/^Write .* to repeat a line\.$/);
        expect(repetitionInputs.size).toBe(0);
    });
});

describe("bounds", () => {
    const markdown = `[Duration??=3]\n\n${table(`| [#Year=Duration] {Year} | x |`)}`;

    test("reads an entered value, which may use a decimal comma", () => {
        expect(cells(renderDocument(markdown, { Duration: "5" }))).toHaveLength(5);
        expect(cells(renderDocument(markdown, { Duration: "2,7" }))).toHaveLength(2);
    });

    test("reads a ??= default until a value is entered", () => {
        expect(cells(renderDocument(markdown, {}))).toHaveLength(3);
    });

    test("counts a cleared default or a ?? fallback as zero", () => {
        expect(cells(renderDocument(markdown, { Duration: "" }))).toHaveLength(0);
        expect(cells(renderDocument(`[Duration??3]\n\n${table(`| [#Year=Duration] {Year} | x |`)}`, {}))).toHaveLength(0);
    });

    test("evaluates expressions", () => {
        expect(cells(renderDocument(table(`| [#Year=Months/12..Months/6] {Year} | x |`), { Months: "24" }))).toEqual(["2", "3", "4"]);
    });

    test("drops the line when a bound is unresolvable or no rows remain", () => {
        expect(cells(renderDocument(table(`| [#Year=Missing] {Year} | x |`)))).toHaveLength(0);
        expect(cells(renderDocument(table(`| [#Year=2..1] {Year} | x |`)))).toHaveLength(0);
        expect(cells(renderDocument(table(`| [#Year=Text] {Year} | x |`), { Text: "abc" }))).toHaveLength(0);
    });

    test("caps the number of rows", () => {
        expect(cells(renderDocument(table(`| [#Year=1000] {Year} | x |`)))).toHaveLength(100);
    });

    test("records the names a bound references", () => {
        markdownToHTML(`[#Year=Start..Duration + 1] {Year}`, {});

        expect([...repetitionInputs]).toEqual(["Start", "Duration"]);

        markdownToHTML(`No repetition`, {});
        expect(repetitionInputs.size).toBe(0);
    });
});

describe("repeated calculations", () => {
    const offer = `[Years??=5] [Discount??=15]

| Year | Platform | Total |
|------|---------:|------:|
| 1 | [Platform_1=Platform:currency] | [Total_1=Platform_1 + Ongoing + Once:currency] |
| [#Year=2..Years] {Year} | [Platform_{Year}=Platform_{Year-1} * (1 - Discount / 100):currency] | [Total_{Year}=Platform_{Year} + Ongoing:currency] |

[Sum=sum(Total_*):currency]`;
    const values = { Platform: "10000", Ongoing: "1000", Once: "500" };

    test("chains every row onto the one before, following a hand-written first row", () => {
        const root = renderDocument(offer, values);

        expect(cells(root)).toEqual(["1", "2", "3", "4", "5"]);
        expect(value(root, "Platform_5")).toBe("5220.0625");
    });

    test("sums all rows via the wildcard, whatever their number", () => {
        expect(value(renderDocument(offer, values), "Sum")).toBe("42586.3125");
        expect(value(renderDocument(offer, { ...values, Years: "1" }), "Sum")).toBe("11500");
        expect(value(renderDocument(offer, { ...values, Years: "2" }), "Sum")).toBe("21000");
    });

    test("keeps entered values per row", () => {
        const root = renderDocument(table(`| [#Row=2] {Row} | [Extra_{Row}??=0] |`), { Extra_2: "7" });

        expect(value(root, "Extra_1")).toBe("0");
        expect(value(root, "Extra_2")).toBe("7");
    });

    test("toggles optional rows together, or each on its own via the counter", () => {
        const shared = renderDocument(table(`| [#Row=2] [?Rows] {Row} | x |`), { "?Rows": "true" });
        const single = renderDocument(table(`| [#Row=2] [?Row_{Row}] {Row} | x |`), { "?Row_2": "true" });

        expect([...shared.querySelectorAll("tbody tr.excluded")]).toHaveLength(0);
        expect(toggle(single, "Row_1")?.checked).toBe(false);
        expect(toggle(single, "Row_2")?.checked).toBe(true);
    });
});

describe("wildcards", () => {
    test("list the matching names in numeric order", () => {
        const root = renderDocument(`[A_10] [A_2] [A_1] [Max=max(A_*)]`, { A_1: "3", A_2: "1", A_10: "2" });

        expect(placeholder(root, "Max")?.getAttribute("expression")).toBe("max(A_1, A_2, A_10)");
    });

    test("only match a numeric suffix", () => {
        const root = renderDocument(`[A_1] [A_Net] [A_1b] [Sum=sum(A_*)]`, { A_1: "3", A_Net: "5" });

        expect(value(root, "Sum")).toBe("3");
    });

    test("include calculated names", () => {
        expect(value(renderDocument(`[B_1=2] [B_2=B_1*2] [Sum=sum(B_*)]`), "Sum")).toBe("6");
    });

    test("stand for zero without any match", () => {
        expect(value(renderDocument(`[Sum=sum(None_*)]`), "Sum")).toBe("0");
    });

    test("leave plain text untouched", () => {
        expect(renderDocument(`[A_1] Some A_* text`).textContent).toContain("Some A_* text");
    });
});
