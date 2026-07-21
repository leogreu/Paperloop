import { beforeEach, describe, expect, test } from "vitest";
import { applyFormat, markdownToHTML } from "@/utils/markdown";
import { resetFormatting } from "./helpers";

// markdownToHTML picks up the frontmatter defaults, exactly as it does on every render
const withDefaults = (block: string) => markdownToHTML(`---\n${block}\n---\n`, {});

const currency = (value: number, code: string, locale: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(value);
const number = (value: number, decimals: number | undefined, locale: string) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
const date = (value: string, style: "short" | "medium" | "long" | "full", locale: string) =>
    new Date(`${value}T00:00`).toLocaleDateString(locale, { dateStyle: style });

beforeEach(resetFormatting);

describe(":currency", () => {
    test("defaults to USD and the browser language", () => {
        expect(applyFormat("1234.5", "currency")).toBe(currency(1234.5, "USD", navigator.language));
    });

    test("takes the currency and the language as arguments", () => {
        expect(applyFormat("1234.5", 'currency("EUR", "de")')).toBe(currency(1234.5, "EUR", "de"));
    });

    test("reads a decimal comma", () => {
        expect(applyFormat("1,5", 'currency("EUR", "de")')).toBe(currency(1.5, "EUR", "de"));
    });
});

describe(":number", () => {
    test("takes the decimal places and the language", () => {
        expect(applyFormat("1234.5", 'number(2, "de")')).toBe(number(1234.5, 2, "de"));
        expect(applyFormat("1234.5", 'number(0, "de")')).toBe(number(1234.5, 0, "de"));
    });
});

describe(":date", () => {
    test("renders an ISO value in the given style and language", () => {
        expect(applyFormat("2026-07-20", 'date("medium", "de")')).toBe(date("2026-07-20", "medium", "de"));
        expect(applyFormat("2026-07-20", 'date("long", "de")')).toBe(date("2026-07-20", "long", "de"));
    });

    test("defaults to the medium style", () => {
        expect(applyFormat("2026-07-20", 'date("medium", "de")')).toBe(applyFormat("2026-07-20", 'date(undefined, "de")'));
    });

    test("keeps the calendar day of a date-only value, regardless of the timezone", () => {
        // Parsed as UTC midnight it would slip to the previous day west of Greenwich
        expect(applyFormat("2026-07-20", 'date("short", "en-US")')).toContain("20");
    });

    test("renders a full timestamp in local time", () => {
        const instant = new Date("2026-07-20T12:00:00Z");

        expect(applyFormat(instant.toISOString(), 'date("medium", "de")'))
            .toBe(instant.toLocaleDateString("de", { dateStyle: "medium" }));
    });
});

describe("values a format cannot read", () => {
    test("are left as they are instead of rendering an error", () => {
        expect(applyFormat("Hamburg", "currency")).toBe("Hamburg");
        expect(applyFormat("Hamburg", "number(2)")).toBe("Hamburg");
        expect(applyFormat("Hamburg", "date")).toBe("Hamburg");
    });

    test("an empty value yields nothing", () => {
        expect(applyFormat("", "currency")).toBe("");
        expect(applyFormat("", "date")).toBe("");
    });

    test("a nullish value yields nothing, never the text \"undefined\"", () => {
        expect(applyFormat(undefined, "currency")).toBe("");
        expect(applyFormat(null, "date")).toBe("");
    });

    test("a bare number is not misread as a year by :date", () => {
        expect(applyFormat("1200", "date")).toBe("1200");
        expect(applyFormat("1234.5", "date")).toBe("1234.5");
    });
});

describe("document-wide defaults", () => {
    test("a bare suffix picks up currency, decimals and locale", () => {
        withDefaults(`formatting:\n  currency: EUR\n  decimals: 2\n  locale: de`);

        expect(applyFormat("1234.5", "currency")).toBe(currency(1234.5, "EUR", "de"));
        expect(applyFormat("1234.5", "number")).toBe(number(1234.5, 2, "de"));
    });

    test("arguments written at the suffix still take precedence", () => {
        withDefaults(`formatting:\n  currency: EUR\n  locale: de`);

        expect(applyFormat("1234.5", 'currency("USD", "en-US")')).toBe(currency(1234.5, "USD", "en-US"));
    });

    test("an explicit currency still inherits the language", () => {
        withDefaults(`formatting:\n  currency: EUR\n  locale: de`);

        expect(applyFormat("1234.5", 'currency("USD")')).toBe(currency(1234.5, "USD", "de"));
    });

    test("each setting may be left out on its own", () => {
        withDefaults(`formatting:\n  currency: EUR`);
        expect(applyFormat("1234.5", "currency")).toBe(currency(1234.5, "EUR", navigator.language));

        withDefaults(`formatting:\n  locale: de`);
        expect(applyFormat("1234.5", "currency")).toBe(currency(1234.5, "USD", "de"));
    });

    test("decimals do not leak into :currency", () => {
        withDefaults(`formatting:\n  currency: EUR\n  locale: de\n  decimals: 2`);

        expect(applyFormat("1234.5", "currency")).toBe(currency(1234.5, "EUR", "de"));
    });

    test("removing the block restores the defaults, as it is re-read on every render", () => {
        withDefaults(`formatting:\n  currency: EUR\n  locale: de`);
        markdownToHTML(`# Without frontmatter`, {});

        expect(applyFormat("1234.5", "currency")).toBe(currency(1234.5, "USD", navigator.language));
    });

    test("unrelated frontmatter keys change nothing", () => {
        withDefaults(`margins:\n  top-center: Header`);

        expect(applyFormat("1234.5", "currency")).toBe(currency(1234.5, "USD", navigator.language));
    });

    test("malformed settings degrade to the defaults instead of throwing", () => {
        withDefaults(`formatting: EUR`);
        expect(applyFormat("1234.5", "currency")).toBe(currency(1234.5, "USD", navigator.language));

        withDefaults(`formatting:\n  currency: NOPE`);
        expect(typeof applyFormat("1234.5", "currency")).toBe("string");

        withDefaults(`formatting:\n  decimals: notanumber`);
        expect(typeof applyFormat("1234.5", "number")).toBe("string");
    });
});
