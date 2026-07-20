# Welcome 👋

In Paperloop, you can write documents using Markdown, a lightweight and popular markup language. Markdown is widely used for writing websites, blog posts, presentations, and books. It allows you to format documents easily using plain text.

Since not everyone is familiar with Markdown, this article explores the essential features by showcasing various text formatting options and elements.

---

## 1. Headings

Headings in Markdown are created by using the `#` symbol. The number of `#` symbols denotes the level of the heading, with one `#` for the largest heading and up to five `#####` for the smallest heading.

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5

---

## 2. Emphasis

You can emphasize text by making it **bold**, *italic*, or ***bold and italic*** using the following syntax:

- **Bold**: Use `**text**` or `__text__`
- *Italic*: Use `*text*` or `_text_`
- ***Bold and italic***: Use `***text***` or `___text___`

---

## 3. Lists

### 3.1 Unordered Lists

To create unordered lists, use `-`, `+`, or `*` followed by a space:

- Item
- Item
  - Subitem
  - Subitem

### 3.2 Ordered Lists

Ordered lists are created by simply using numbers followed by periods (`1.`, `2.`, `3.`, etc.).

1. Item
2. Item
   1. Subitem
   2. Subitem

---

## 4. Links

To add a link, you can use the following syntax: `[Link Text](URL)`.

[Visit Paperloop](https://paperloop.io)

You can also link to different headings on the current page:

[Go to Alignment](#alignment)

---

## 5. Images

You can insert images using similar syntax to links, but with an exclamation mark `!` in front: `![Alt Text](Image URL)`.

![Paperloop](https://paperloop.io/og-image.png)

If you want to align or size your images, please refer to section [Alignment](#alignment).

---

## 6. Blockquotes

Blockquotes are used to highlight quoted or important text. Start a line with `>` followed by a space.

> This is a blockquote.
> Blockquotes can span multiple lines.

---

## 7. Code

### 7.1 Inline Code

To include inline code, wrap the text in backticks (`).

Use `console.log()` in JavaScript to display output.

### 7.2 Code Blocks

For multi-line code blocks, use triple backticks (```).

```js
const greet = (name) => {
    console.log(`Hello, ${name}!`);
};
```

---

## 8. Horizontal rule

You can create horizontal lines or separators by using three or more dashes (`---`), asterisks (`***`), or underscores (`___`). Horizontal rules will result in a page break when printing.

---

## 9. Tables

Tables can be created using pipes (`|`) and dashes (`-`) to separate columns and rows.

| Column 1 | Column 2 |
|----------|----------|
| Row 1    | Data 1   |
| Row 2    | Data 2   |
| Row 3    | Data 3   |
| Row 4    | Data 4   |

---

## 10. Placeholders

Paperloop allows to define placeholders in your documents that you can dynamically fill for each document. This results in a separation of static and dynamic content. Usually, the majority of a document is static while only a few parts are dynamic. This separation allows you to find a generic structure for your document that fits most use cases and then only adjust those parts that don't.

To define a placeholder, simply wrap a word in square brackets `[]`.

**Example:** Hello, [Name]!

When you use a placeholder with the same variable name, it will get the same value automatically.

**Example:** Thank you for reading this, [Name].

## 11. Optional blocks

Sometimes a paragraph, bullet point, or table row only applies to some documents. Mark it optional by starting it with `[?name]`, and it will show a checkbox in the rendered document. Unchecked blocks appear faded and are left out entirely when printing, while checked blocks print like normal content.

[?self-hosting] This paragraph is only included if self-hosting is selected.

- Regular item
- [?self-hosting] Optional item

| Service | Price |
|---------|-------|
| Base setup | 250 € |
| [?self-hosting] On-premise setup | 500 € |

Blocks with the same name are toggled together — just like placeholders sharing a value. Your choices are saved per document.

A block can also derive its state from an expression, following the same syntax as placeholders. With `??=` the expression only sets the initial state, so you can still toggle the block yourself. With a single `=` the block always follows its expression, and its checkbox is disabled.

[?extended??=true] This block starts out included, but can still be turned off.

[?basic=not extended] And this one is shown automatically whenever the block above is not.

Expressions result in true or false and may reference other blocks by name, e.g. `not other`, `first and not second`, or `other ? false : true`. Please note that `!` is not supported, as it means factorial. A referenced block can be placed anywhere in the document, unless its own state is derived as well — in that case, it needs to be defined earlier. Like fallbacks, the expression is defined at the first occurrence of a name and then applies to all of them.

For paragraphs spanning multiple lines, you can also place the marker on its own line directly above the text. And if you place it in front of a heading (or inside it, like `## [?name] Title`), the entire section is toggled — from the heading up to the next heading of the same or a higher level.

Numbered headings (like `## 3. Title`), table rows whose first cell is a number, and numbered lists are renumbered automatically as optional blocks are toggled — excluded entries lose their number until they are included.

## 12. Calculations

You can calculate values from other placeholders by writing an expression after a `=` sign. Results update live as you fill in the referenced placeholders.

**Example:** The net price is [Net:currency], so the gross price is [Gross=Net*1.19:currency].

Append `:currency` to a placeholder or calculation to display it as a currency amount — the raw number stays available for further calculations, and inputs switch back to the raw value while you edit them. Two optional arguments set the currency and the language, e.g. `:currency("EUR", "de")` — by default, USD and your browser language are used.

Similarly, append `:format` to display a plain formatted number, with optional arguments for the number of decimal places and the language, e.g. `:format(2, "de")`.

To avoid repeating these settings, a document can state them once in its frontmatter, after which a plain `:currency` or `:format` is enough. Arguments written at a suffix still take precedence, and each setting may be left out on its own:

```
---
formatting:
  currency: EUR
  decimals: 2
  locale: de
---
```

Later expressions can reference earlier results by their name. Please use simple names (letters and digits, no spaces or hyphens) for placeholders you want to reference in expressions.

For optional placeholders, append `??` with a fallback value that is shown and printed while the placeholder is empty — but counts as zero in calculations until you actually fill in the field. With `??=` the value is considered in calculations right away instead. Define the fallback at the first occurrence of a placeholder — it then applies to all of them. Leaving the fallback out entirely, as in `[Note??]`, marks a purely optional field: it shows its name while you edit, but prints nothing at all instead of an empty box to fill in.

**Example:** Optional placeholder: [Variable??1200:currency].

Expressions can also result in text rather than a number. Wrap it in straight quotes (single or double), which may contain spaces and colons, and use a condition to decide between two of them. This way, a label can be shown only while a placeholder is still empty, and disappear as soon as it is filled in — on screen as well as in print.

**Example:** [Intro=Amount ? "" : "Optional: "][Amount??500:currency]

If you do not need the result anywhere else, you can leave out the name entirely and simply write `[=Condition ? "Yes" : "No"]`. A condition can also reference an optional block by its name, which is true while the block is included. Please note that a placeholder containing `0` counts as not filled in, just like an empty one.

## 13. Alignment {#alignment}

Paperloop also allows you to align text using [Tailwind CSS](https://tailwindcss.com/) classes. If you want a sentence or word to be right-aligned, simple add `{.text-right}` to the end.

This text is on the right {.text-right}

You can also align an multi-line paragraphs:

**This is a centered text block**
with text on multiple lines.
{.text-right}

You can use the same syntax to align images. Together with the option to resize them using `img-w-8` (where 8 stands for a size unit in [Tailwind](https://tailwindcss.com/docs/width)), you can create a custom letter header for your company. The suffix `img-mb-2:` lets you specify the space below an image (margin bottom, as explained [here](https://tailwindcss.com/docs/margin)).

![Logo](/favicon.svg)
**Paperloop, Inc.**
John Doe
Metropolis, CA 90210
{.text-right .prose-img:w-8 .prose-img:mb-2}

## 14. Headers and footers

You can use [Frontmatter](https://docs.github.com/en/contributing/writing-for-github-docs/using-yaml-frontmatter) to add headers and footers to your pages when printing a document. To do this, add the following block to the beginning of your document.

```
---
top-center: Offer for [Company]
bottom-left: "[Reference??Draft]"
---
```

Headers and footers may contain placeholders, which are filled in with the same values as the document itself, including their fallbacks and a `:currency` or `:format` suffix. Since YAML reads a leading `[` as the start of a list, put such a value in quotes — as in the footer above. Brackets in the middle of a line need no quotes.

Please note that this feature uses the new [Page-Margin Boxes](https://www.w3.org/TR/css-page-3/#margin-boxes) CSS feature, which is available starting in Chrome 131 (November, 2024).

---

That's it for now. We hope you could learn something. If you have any questions left, just send us an email or open an issue over at [GitHub](https://github.com/leogreu/Paperloop/issues).
