import { describe, expect, test } from "vitest";
import { ContentEditable } from "@/components/custom/content-editable";

const editable = (attributes: Record<string, string>) => {
    const element = document.createElement("content-editable");
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    return element;
};

describe("display", () => {
    test("shows a ?-prefixed value without its prefix, formatted as usual", () => {
        expect(editable({ value: "?2400" }).display).toBe("2400");
        expect(editable({ value: "?2400", format: 'currency("EUR", "de")' }).display)
            .toBe(new Intl.NumberFormat("de", { style: "currency", currency: "EUR" }).format(2400));
    });

    test("keeps the raw value, prefix included, for editing", () => {
        const element = editable({ value: "?2400" });

        expect(element).toBeInstanceOf(ContentEditable);
        expect(element.value).toBe("?2400");
    });
});
