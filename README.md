# Paperloop

Paperloop separates the static from the dynamic parts of your documents. Write a template once, then fill in the dynamic parts for each variant directly in the rendered preview — and print the result as a clean PDF. Every document is versioned, with an integrated diff view to compare changes between versions.

## Features

- **Markdown editing** — Write documents in plain Markdown with a live side-by-side preview: headings, emphasis, lists, links, images, blockquotes, code, and tables. Horizontal rules (`---`) become page breaks when printing.
- **Placeholders** — Wrap a variable name in square brackets (`[Name]`) to create an inline-editable field in the rendered document. Placeholders sharing the same name automatically share their value, and values are saved with the document, shared by all of its versions.
- **Optional blocks** — Mark a paragraph, bullet point, or table row with `[?name]` to make it toggleable via a checkbox. Unchecked blocks appear faded in the preview and are left out entirely when printing. Placed in front of a heading, the marker toggles the whole section, and blocks sharing a name are toggled together. A block can also derive its state from an expression referencing other blocks, either as an initial state (`[?name??=true]`) or permanently (`[?name=not other]`). Numbered headings, table rows, and ordered lists renumber automatically.
- **Calculations** — Compute values from other placeholders with expressions like `[Gross=Net*1.19]`, powered by [math.js](https://mathjs.org/). Results update live while you type, and later expressions can reference earlier results. Fallbacks like `[Module??1200]` display a value that counts as zero in calculations until the field is filled — with `??=` it is pre-filled and counts right away. The function `now()` yields the current date and time.
- **Repetitions** — Mark a table row, list item, or line with `[#Year=2..Years]` to repeat it once per value of the counter, following the placeholders its bounds reference. Within the line, `{Year}` and `{Year-1}` insert the current or a neighboring value — in text as well as in names, so each row can build on the one before. `sum(Total_*)` adds up `Total_1`, `Total_2`, and so on, however many rows there are.
- **Formatting** — Append `:currency`, `:number` or `:date` to a placeholder or calculation to display its value nicely, while the raw value stays available for further calculations and editing. Each option takes optional arguments, and a document can set its defaults once in the frontmatter.
- **Styling and alignment** — Align or style text and images with Tailwind CSS classes, e.g. `{.text-right}` at the end of a line or paragraph.
- **Headers and footers** — Define print headers and footers via frontmatter at the top of a document, rendered with CSS page-margin boxes including page numbers. They may contain placeholders and calculations, which are filled in with the same values as the document itself.
- **Value import** — Paste a JSON object of values via the clipboard button in the preview to fill in a document at once, e.g. one prepared by an AI agent. The [getting started guide](src/content/markdown/getting-started.md) describes the full syntax and the value format, and can be handed to an agent as is.
- **API** — Create drafts from scripts or AI agents with a single `POST /api/documents`, authenticated by an API key from the documents overview. The response links to the new draft, and values passed along are stored with it. `GET /api/documents?query=…` finds documents by name, `GET` and `PATCH /api/documents/{id}` read and update a document, and `GET /api/getting-started` serves the guide as Markdown.
- **MCP server** — Let AI agents like Claude or Codex find, create, update, and export documents as one PDF directly via a small local server in [mcp/](mcp/), which works with any MCP client, reads the current guide and keeps the API key out of the chat. See [MCP server](#mcp-server) for how to set it up.
- **Versions and diffs** — Publish read-only versions of a document and browse the full history side by side, with word-level diff highlighting between versions.

## Development

```sh
npm install
npm run dev
```

`npm run build` type-checks and builds the site.

## MCP server

The MCP server in `mcp/` is a separate package that is not part of the site's build. With [Node.js](https://nodejs.org/) installed, the following bundles it into the self-contained `mcp/dist/server.mjs`:

```sh
cd mcp
npm install
npm run build
```

Then add the server to the MCP configuration of your client, with the full path to the built file and an API key from the key button at the top right of your documents, and restart the client. Most clients take an entry like the following, others the same command, arguments and environment in a format of their own:

```json
{
  "mcpServers": {
    "paperloop": {
      "command": "node",
      "args": ["/path/to/Paperloop/mcp/dist/server.mjs"],
      "env": { "PAPERLOOP_API_KEY": "pl_..." }
    }
  }
}
```

Should the client not find Node.js, replace `node` with the full path that `which node` prints in a terminal. To point the server to the development server instead, add `"PAPERLOOP_URL": "http://localhost:4321"` to its environment.

To export documents as one PDF, the server prints their rendered view with the locally installed Google Chrome, just like its print dialog does, and saves the file in the Downloads folder. It requires Node.js 22 or newer, and for Chrome in another location, add its path as `CHROME_PATH` to the environment. For printing, the rendered view also accepts the API key, which the server only sends to Paperloop itself.

## License

[MIT](LICENSE)
