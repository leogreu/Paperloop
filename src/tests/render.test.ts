import { describe, expect, test } from "vitest";
import { markdownToHTML } from "@/utils/markdown";

const toggle = `<input type="checkbox" class="optional-toggle not-prose" data-optional="self-hosting">`;

describe("optional markers", () => {
    test("render inline within their block", () => {
        const html = markdownToHTML(`[?self-hosting] A paragraph.

- Regular item
- [?self-hosting] Optional item

| Service | Price |
|---------|-------|
| Base | 250 |
| [?self-hosting] On-premise | 500 |

## [?self-hosting] Optional heading
`, {});

        expect(html).toContain(`<p>${toggle} A paragraph.`);
        expect(html).toMatch(/<li>\s*<input type="checkbox"[^>]*data-optional="self-hosting"> Optional item/);
        expect(html).toContain(`<td>${toggle} On-premise</td>`);
        expect(html).toContain(`<h2>${toggle} Optional heading</h2>`);
    });

    test("are not consumed by the placeholder pass", () => {
        const html = markdownToHTML(`[?self-hosting] With a [Name] inside.`, {});

        expect(html).not.toContain(`placeholder="?self-hosting"`);
        expect(html).toMatch(/optional-toggle[^>]*> With a <content-editable[^>]*placeholder="Name"/);
    });

    test("attach to a multi-line paragraph when standing on their own line", () => {
        const html = markdownToHTML(`[?multi]\nFirst line\nsecond line.`, {});

        expect(html).toMatch(/<p><input[^>]*data-optional="multi"> First line<br>\s*second line\.<\/p>/);
    });

    test("move inside the heading they precede", () => {
        expect(markdownToHTML(`[?section]\n## Title`, {}))
            .toMatch(/<h2><input[^>]*data-optional="section"> Title<\/h2>/);
    });

    test("reflect the stored state", () => {
        expect(markdownToHTML(`[?a] Text`, {})).not.toContain(" checked");
        expect(markdownToHTML(`[?a] Text`, { "?a": "true" })).toContain(`data-optional="a" checked`);
        expect(markdownToHTML(`[?a] Text`, { "?a": "false" })).not.toContain(" checked");
    });

    test("carry their expression, and a plain marker does not", () => {
        const html = markdownToHTML(`[?a] A\n\n[?b=not a] B\n\n[?c??=true] C`, {});

        expect(html).toMatch(/data-optional="a"(?![^>]*data-expression)/);
        expect(html).toContain(`data-optional="b" data-expression="not a" disabled`);
        expect(html).toContain(`data-optional="c" data-expression="true"`);
        // Only a single = locks the toggle, so ??= stays clickable
        expect(html).not.toMatch(/data-optional="c"[^>]*disabled/);
    });

    test("inherit the expression from the first occurrence", () => {
        const html = markdownToHTML(`[?c??=true] First\n\n[?c] Second`, {});

        expect([...html.matchAll(/data-optional="c" data-expression="true"/g)]).toHaveLength(2);
    });
});

describe("placeholders", () => {
    test("become editable elements, leaving markdown links alone", () => {
        const html = markdownToHTML(`Hello [Name], see [link](https://example.com) and [a=b](https://example.com).`, {});

        expect(html).toContain(`placeholder="Name"`);
        expect(html).toContain(`<a href="https://example.com">link</a>`);
        expect(html).toContain(`<a href="https://example.com">a=b</a>`);
    });

    test("keep a trailing attribute block as classes", () => {
        expect(markdownToHTML(`[?a] Aligned {.text-right}`, {}))
            .toMatch(/<p class="text-right"><input[^>]*data-optional="a"> Aligned<\/p>/);
        expect(markdownToHTML(`[Name]{.font-bold}`, {}))
            .toContain(`class="not-prose font-bold"`);
    });

    test("encode line breaks so inline HTML survives markdown parsing", () => {
        expect(markdownToHTML(`[Address]`, { Address: "Hafenweg 16\n48155 Münster" }))
            .toContain(`value="Hafenweg 16&#10;48155 Münster"`);
    });

    test("strip the frontmatter", () => {
        expect(markdownToHTML(`---\ntop-center: Header\n---\n\nText`, {})).not.toContain("top-center");
    });
});

describe("fallbacks", () => {
    test("distinguish ?? from ??=, which pre-fills the value", () => {
        const html = markdownToHTML(`[A??1200]\n\n[B??=800]`, {});

        expect(html).toContain(`value="" placeholder="A" fallback="1200"`);
        expect(html).toContain(`value="800" placeholder="B" default="800"`);
    });

    test("may contain a colon", () => {
        expect(markdownToHTML(`[Termin??12:30]`, {})).toContain(`placeholder="Termin" fallback="12:30"`);
    });

    test("apply to every occurrence, defined at the first one", () => {
        const html = markdownToHTML(`[A??1200] und [A]\n\n[B??=800] und [B]`, {});

        expect([...html.matchAll(/placeholder="A" fallback="1200"/g)]).toHaveLength(2);
        expect([...html.matchAll(/value="800" placeholder="B" default="800"/g)]).toHaveLength(2);
    });

    test("an empty one marks an optional field that prints nothing", () => {
        const html = markdownToHTML(`[Note??]\n\n[Required]`, {});

        expect(html).toContain(`value="" placeholder="Note" fallback=""`);
        expect(html).not.toMatch(/placeholder="Required"[^>]*fallback/);
    });

    test("a stored value wins over a default", () => {
        expect(markdownToHTML(`[B??=800]`, { B: "900" })).toContain(`value="900" placeholder="B" default="800"`);
    });

    test("[Name??=] is a default and [Name??:currency] keeps its format", () => {
        const html = markdownToHTML(`[A??=]\n\n[B??:currency]`, {});

        expect(html).toContain(`placeholder="A" default=""`);
        expect(html).toContain(`placeholder="B" fallback="" format="currency"`);
    });
});

describe("calculations", () => {
    test("emit a read-only element carrying the expression", () => {
        expect(markdownToHTML(`[Gross=Net*1.19]`, {}))
            .toContain(`expression="Net*1.19" placeholder="Gross" readonly>`);
    });

    test("are not consumed by the placeholder pass", () => {
        expect(markdownToHTML(`[Gross=Net*1.19]`, {})).not.toContain(`placeholder="Gross=`);
    });

    test("split off a format suffix", () => {
        expect(markdownToHTML(`[Gross=Net*1.19:currency("EUR", "de")]`, {}))
            .toContain(`expression="Net*1.19" placeholder="Gross" format="currency(&quot;EUR&quot;, &quot;de&quot;)"`);
    });

    test("keep quoted strings incl. spaces and colons", () => {
        const html = markdownToHTML(`[Intro=Price ? "" : "Optional: "]\n\n[Single=Price ? '' : 'Optional: ']`, {});

        expect(html).toContain(`expression="Price ? &quot;&quot; : &quot;Optional: &quot;"`);
        expect(html).toContain(`expression="Price ? '' : 'Optional: '"`);
    });

    test("allow ternaries with and without spaces", () => {
        expect(markdownToHTML(`[A=Net > 1 ? 2 : 3]`, {})).toContain(`expression="Net &gt; 1 ? 2 : 3"`);
        expect(markdownToHTML(`[B=Net>1?2:3]`, {})).toContain(`expression="Net&gt;1?2:3"`);
    });

    test("may omit the name entirely", () => {
        expect(markdownToHTML(`[=true ? "hi" : "ho"]`, {}))
            .toContain(`expression="true ? &quot;hi&quot; : &quot;ho&quot;" placeholder=""`);
        // A link whose text starts with = must stay a link
        expect(markdownToHTML(`[=x](https://example.com)`, {})).toContain(`<a href="https://example.com">=x</a>`);
    });

    test("show their result at every occurrence of the name, read-only", () => {
        const html = markdownToHTML(`[Total=A+B]\n\n[Total]`, {});

        expect([...html.matchAll(/expression="A\+B" placeholder="Total" readonly/g)]).toHaveLength(2);
        expect(html).not.toContain(`placeholder="Total" underline`);
    });

    test("keep a per-occurrence format suffix", () => {
        const html = markdownToHTML(`[Total=A+B]\n\n[Total:number(2)]`, {});

        expect(html).toContain(`placeholder="Total" format="number(2)"`);
    });
});

describe("malformed input", () => {
    test("an unknown suffix stays literal text", () => {
        expect(markdownToHTML(`[Preis:netto]`, {})).toContain("[Preis:netto]");
    });

    test("an unclosed bracket does not swallow the following lines", () => {
        const html = markdownToHTML(`Offen: [Broken=\nThe next line survives, incl. [Name].`, {});

        expect(html).toContain("[Broken=");
        expect(html).toMatch(/The next line survives, incl\. <content-editable[^>]*placeholder="Name"/);
    });

    test("invalid frontmatter YAML is treated as none, without throwing", () => {
        expect(() => markdownToHTML(`---\nmargins:\n  top-center: [A] — [B]\n---\n\nText`, {})).not.toThrow();
    });
});
