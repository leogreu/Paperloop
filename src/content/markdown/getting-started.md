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

[Go to Headings](#1.-headings)

---

## 5. Images

You can insert images using similar syntax to links, but with an exclamation mark `!` in front: `![Alt Text](Image URL)`.

![Paperloop](https://paperloop.io/og-image.png)

If you want to align or size your images, please refer to section [Alignment](#11.-alignment).

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

## 11. Alignment

Paperloop also allows you to align text using [Tailwind CSS](https://tailwindcss.com/) classes. If you want a sentence or word to be right-aligned, simple write `text-right:` in front of it.

text-right: This text is on the right

You can also align an multi-line paragraphs:

text-center:
**This is a centered text block**
with text on multiple lines.

You can use the same syntax to align images. Together with the option to resize them using `img-w-8` (where 8 stands for a size unit in [Tailwind](https://tailwindcss.com/docs/width)), you can create a custom letter header for your company. The suffix `img-mb-2:` lets you specify the space below an image (margin bottom, as explained [here](https://tailwindcss.com/docs/margin)).

text-right:img-w-8:img-mb-2:
![Logo](/favicon.svg)
**Paperloop, Inc.**
John Doe
Metropolis, CA 90210

---

That's it for now. We hope you could learn something. If you have any questions left, just send us an email or open an issue over at [GitHub](https://github.com/leogreu/Paperloop/issues).
