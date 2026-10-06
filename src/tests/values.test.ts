import { describe, expect, test } from "vitest";
import { parseValues } from "@/utils/markdown";
import { placeholder, renderDocument, toggle } from "./helpers";

describe("parsing values", () => {
    test("keeps strings as they are", () => {
        expect(parseValues(`{"Company": "Acme Inc.", "Net": "1200,5", "?extended": "false"}`))
            .toEqual({ Company: "Acme Inc.", Net: "1200,5", "?extended": "false" });
    });

    test("takes numbers and booleans as their text", () => {
        expect(parseValues(`{"Net": 1200.5, "Years": 3, "?self-hosting": true}`))
            .toEqual({ Net: "1200.5", Years: "3", "?self-hosting": "true" });
    });

    test("rejects anything but a flat object", () => {
        expect(() => parseValues(`not json`)).toThrow();
        expect(() => parseValues(`["Acme"]`)).toThrow("JSON object");
        expect(() => parseValues(`null`)).toThrow("JSON object");
        expect(() => parseValues(`{"Customer": {"Name": "Acme"}}`)).toThrow(`"Customer"`);
        expect(() => parseValues(`{"Net": null}`)).toThrow(`"Net"`);
    });

    test("fills in the document", () => {
        const root = renderDocument(`[?self-hosting] Hello, [Company]! [Gross=Net*1.19]`,
            parseValues(`{"Company": "Acme", "Net": 100, "?self-hosting": true}`));

        expect(placeholder(root, "Company")?.getAttribute("value")).toBe("Acme");
        expect(toggle(root, "self-hosting")?.checked).toBe(true);
        expect(placeholder(root, "Gross")?.getAttribute("value")).toBe("119");
    });
});
