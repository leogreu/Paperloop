import { beforeEach, describe, expect, test } from "vitest";
import { updateMargins } from "@/utils/markdown";
import { resetFormatting } from "./helpers";

const margin = (key: string) => document.documentElement.getAttribute(key);
const withMargins = (block: string, values: Record<string, string> = {}) =>
    updateMargins(`---\nmargins:\n${block}\n---\n`, values);

beforeEach(() => {
    resetFormatting();
    for (const attribute of [...document.documentElement.attributes]) {
        document.documentElement.removeAttribute(attribute.name);
    }
});

describe("placeholders", () => {
    test("are filled in with the document values", () => {
        withMargins(`  top-center: Offer for [Company]`, { Company: "Confimedis" });

        expect(margin("top-center")).toBe("Offer for Confimedis");
    });

    test("resolve to nothing while empty, unless they carry a fallback", () => {
        withMargins(`  top-left: "[Reference]"\n  top-right: "[Reference??Draft]"`, {});

        expect(margin("top-left")).toBe("");
        expect(margin("top-right")).toBe("Draft");
    });

    test("apply their format suffix", () => {
        withMargins(`  top-left: "Total: [Total:currency]"`, { Total: "1234.5" });

        expect(margin("top-left")).toContain(new Intl.NumberFormat(navigator.language, {
            style: "currency",
            currency: "USD"
        }).format(1234.5));
    });

    test("text without placeholders is passed through", () => {
        withMargins(`  top-left: Appendix 1`, {});

        expect(margin("top-left")).toBe("Appendix 1");
    });
});

describe("calculations", () => {
    test("are resolved with the document values", () => {
        withMargins(`  top-left: "[=Net*1.19]"`, { Net: "1000" });

        expect(margin("top-left")).toBe("1190");
    });

    test("get the same float cleanup as the document body", () => {
        withMargins(`  top-left: "[=0.1+0.2]"`, {});

        expect(margin("top-left")).toBe("0.3");
    });

    test("provide now(), rendered by :date", () => {
        withMargins(`  top-left: "[=now():date]"`, {});

        expect(margin("top-left")).toBe(new Date().toLocaleDateString(navigator.language, { dateStyle: "medium" }));
    });

    test("an unresolvable one leaves the box empty", () => {
        withMargins(`  top-left: "[=Missing+1]"`, {});

        expect(margin("top-left")).toBe("");
    });

    test("a degenerate one never prints \"undefined\"", () => {
        withMargins(`  top-left: "[= :currency]"`, {});

        expect(margin("top-left")).toBe("");
    });

    test("without the = it is a placeholder name, not an expression", () => {
        withMargins(`  top-right: "[now():date]"`, {});

        expect(margin("top-right")).toBe("");
    });
});

describe("the frontmatter block", () => {
    test("only the margin boxes become attributes", () => {
        updateMargins(`---\ntitle: Contract\nmargins:\n  top-left: Left\n---\n`, {});

        expect(margin("top-left")).toBe("Left");
        expect(margin("title")).toBe(null);
        expect(margin("margins")).toBe(null);
    });

    test("bottom-center is not offered, as the page number occupies it", () => {
        withMargins(`  bottom-center: Ignored`, {});

        expect(margin("bottom-center")).toBe(null);
    });

    test("a removed key clears its attribute again", () => {
        withMargins(`  top-left: Left\n  top-right: Right`, {});
        withMargins(`  top-left: Left`, {});

        expect(margin("top-left")).toBe("Left");
        expect(margin("top-right")).toBe(null);
    });

    test("an empty value clears the box instead of printing \"null\"", () => {
        withMargins(`  top-left:\n  top-right: X`, {});

        expect(margin("top-left")).toBe(null);
        expect(margin("top-right")).toBe("X");
    });

    test("a document without frontmatter clears every box", () => {
        withMargins(`  top-left: Left\n  bottom-right: Right`, {});
        updateMargins(`# No frontmatter\n`, {});

        expect(margin("top-left")).toBe(null);
        expect(margin("bottom-right")).toBe(null);
    });

    test("invalid YAML clears the boxes instead of throwing", () => {
        withMargins(`  top-left: Left`, {});

        expect(() => updateMargins(`---\nmargins:\n  top-center: [A] — [B]\n---\n`, {})).not.toThrow();
        expect(margin("top-left")).toBe(null);
    });

    test("YAML reads a leading bracket as a list, so such values need quotes", () => {
        withMargins(`  top-left: "[A]"\n  top-right: Text [A]`, { A: "ok" });

        expect(margin("top-left")).toBe("ok");
        expect(margin("top-right")).toBe("Text ok");
    });
});
