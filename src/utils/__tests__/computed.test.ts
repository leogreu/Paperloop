import { beforeEach, describe, expect, test, vi } from "vitest";
import { updateComputed } from "@/utils/markdown";
import { placeholder, placeholders, renderDocument, resetFormatting } from "./helpers";

const value = (root: ParentNode, name: string) => placeholder(root, name)?.getAttribute("value");

beforeEach(resetFormatting);

describe("evaluation", () => {
    test("resolves once its inputs are filled in", () => {
        expect(value(renderDocument(`[Net] [Gross=Net*1.19]`, {}), "Gross")).toBe(null);
        expect(value(renderDocument(`[Net] [Gross=Net*1.19]`, { Net: "1000" }), "Gross")).toBe("1190");
    });

    test("drops the value when unresolvable, so the name is shown instead", () => {
        const root = renderDocument(`[Gross=Net*1.19]`, {});

        expect(placeholder(root, "Gross")?.hasAttribute("value")).toBe(false);
    });

    test("chains in document order, using the raw result", () => {
        const root = renderDocument(`[Net] [Gross=Net*1.19:currency] [Yearly=Gross*12]`, { Net: "1000" });

        expect(value(root, "Gross")).toBe("1190");
        expect(value(root, "Yearly")).toBe("14280");
    });

    test("cleans up the float noise of binary arithmetic", () => {
        expect(value(renderDocument(`[Float=0.1+0.2]`, {}), "Float")).toBe("0.3");
        expect(value(renderDocument(`[Net] [Gross=Net*1.19]`, { Net: "1000" }), "Gross")).toBe("1190");
    });

    test("accepts a decimal comma in the entered value", () => {
        expect(value(renderDocument(`[Net] [Double=Net*2]`, { Net: "1,5" }), "Double")).toBe("3");
    });

    test("keeps a result that is an empty string, so the element renders nothing", () => {
        const root = renderDocument(`[Price??500] [Intro=Price ? "" : "Optional: "]`, { Price: "1000" });

        expect(value(root, "Intro")).toBe("");
        expect(placeholder(root, "Intro")?.hasAttribute("value")).toBe(true);
    });

    test("renders a text result as it is", () => {
        expect(value(renderDocument(`[Price??500] [Intro=Price ? "" : "Optional: "]`, {}), "Intro")).toBe("Optional: ");
    });

    test("provides now() as a full ISO timestamp", () => {
        expect(value(renderDocument(`[Today=now()]`, {}), "Today")).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    });

    test("does not offer currency() inside expressions, only as a suffix", () => {
        expect(placeholder(renderDocument(`[Net] [A=currency(Net)]`, { Net: "1000" }), "A")?.hasAttribute("value")).toBe(false);
    });

    test("writes the value attribute only when it changed", () => {
        const root = renderDocument(`[Net] [Gross=Net*1.19]`, { Net: "1000" });
        const spy = vi.spyOn(Element.prototype, "setAttribute");

        updateComputed(root, { Net: "1000" });
        expect(spy.mock.calls.filter(([name]) => name === "value")).toHaveLength(0);

        updateComputed(root, { Net: "2000" });
        expect(spy.mock.calls.filter(([name]) => name === "value")).toHaveLength(1);
        spy.mockRestore();
    });
});

describe("optional placeholders in calculations", () => {
    test("a ?? fallback counts as zero while empty, and as entered once filled", () => {
        expect(value(renderDocument(`[Module??1200] [Sum=Module+100]`, {}), "Sum")).toBe("100");
        expect(value(renderDocument(`[Module??1200] [Sum=Module+100]`, { Module: "500" }), "Sum")).toBe("600");
    });

    test("a ??= default counts right away", () => {
        expect(value(renderDocument(`[Module??=1200] [Sum=Module+100]`, {}), "Sum")).toBe("1300");
    });

    test("a cleared ??= default counts as zero again", () => {
        expect(value(renderDocument(`[Module??=1200] [Sum=Module+100]`, { Module: "" }), "Sum")).toBe("100");
    });

    test("a default inside an excluded block does not count", () => {
        const markdown = `[?extra] [Module??=1200] belongs to the block\n\n[Sum=Module+100]`;

        expect(value(renderDocument(markdown, {}), "Sum")).toBe("100");
        expect(value(renderDocument(markdown, { "?extra": "true" }), "Sum")).toBe("1300");
    });

    test("an empty optional field counts as zero", () => {
        expect(value(renderDocument(`[Note??] [Sum=Note+5]`, {}), "Sum")).toBe("5");
    });
});

describe("optional blocks in calculations", () => {
    test("a toggle is in scope as a boolean", () => {
        const markdown = `[?Optional] Optional\n\nChosen: [=Optional ? "Yes" : "No"]`;

        expect(placeholder(renderDocument(markdown, {}), "")?.getAttribute("value")).toBe("No");
        expect(placeholder(renderDocument(markdown, { "?Optional": "true" }), "")?.getAttribute("value")).toBe("Yes");
    });

    test("a derived toggle is read with its resolved state", () => {
        const root = renderDocument(`[?a] A\n\n[?b=not a] B\n\nChosen: [=b ? "Yes" : "No"]`, {});

        expect(placeholder(root, "")?.getAttribute("value")).toBe("Yes");
    });

    test("a placeholder of the same name takes precedence over a toggle", () => {
        const root = renderDocument(`[?X] X\n\n[X??7]\n\n[Result=X+1]`, {});

        expect(value(root, "Result")).toBe("1");
    });
});

describe("repeated names", () => {
    test("every occurrence of a calculated name shows the result", () => {
        const root = renderDocument(`[A] [B] [Result=A+B]\n\n[Result]`, { A: "1", B: "2" });

        expect(placeholders(root, "Result").map(element => element.getAttribute("value"))).toEqual(["3", "3"]);
    });

    test("an occurrence before the calculation resolves too", () => {
        const root = renderDocument(`[Result]\n\n[A] [Result=A+1]`, { A: "5" });

        expect(placeholders(root, "Result").map(element => element.getAttribute("value"))).toEqual(["6", "6"]);
    });

    test("an unresolvable calculation shows the name at every occurrence", () => {
        const root = renderDocument(`[Result=Missing+1]\n\n[Result]`, {});

        expect(placeholders(root, "Result").every(element => !element.hasAttribute("value"))).toBe(true);
    });
});
