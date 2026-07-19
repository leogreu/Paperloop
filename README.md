# Paperloop

Paperloop separates the static from the dynamic parts of your documents. Write a template once, then fill in the dynamic parts for each variant directly in the rendered preview — and print the result as a clean PDF. Every document is versioned, with an integrated diff view to compare changes between versions.

## Features

- **Markdown editing** — Write documents in plain Markdown with a live side-by-side preview: headings, emphasis, lists, links, images, blockquotes, code, and tables. Horizontal rules (`---`) become page breaks when printing.
- **Placeholders** — Wrap a variable name in square brackets (`[Name]`) to create an inline-editable field in the rendered document. Placeholders sharing the same name automatically share their value, and values are saved per document.
- **Optional blocks** — Mark a paragraph, bullet point, or table row with `[?name]` to make it toggleable via a checkbox. Unchecked blocks appear faded in the preview and are left out entirely when printing. Placed in front of a heading, the marker toggles the whole section, and blocks sharing a name are toggled together.
- **Calculations** — Compute values from other placeholders with expressions like `[Gross=Net*1.19]`, powered by [math.js](https://mathjs.org/). Results update live while you type, and later expressions can reference earlier results. Fallbacks like `[Module??1200]` display a value that counts as zero in calculations until the field is filled — with `??=` it is pre-filled and counts right away.
- **Formatting** — Append `:currency` to a placeholder or calculation to display it as a currency amount (with optional currency and language arguments), or `:format` for a plain localized number (with optional decimal places and language), while the raw number stays available for further calculations and editing.
- **Styling and alignment** — Align or style text and images with Tailwind CSS classes, e.g. `{.text-right}` at the end of a line or paragraph.
- **Headers and footers** — Define print headers and footers via frontmatter at the top of a document, rendered with CSS page-margin boxes including page numbers.
- **Versions and diffs** — Publish read-only versions of a document and browse the full history side by side, with word-level diff highlighting between versions.

## Development

```sh
npm install
npm run dev
```

`npm run build` type-checks and builds the site.

## License

[MIT](LICENSE)
