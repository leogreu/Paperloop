import markdownit from "markdown-it";
import attrs from "markdown-it-attrs";
import { parse } from "yaml";

const md = markdownit({
    html: true,
    breaks: true
}).use(attrs);

const frontmatter = /^---\s*\n([\s\S]*?)\n---/;
// Optionally consumes the line break after a standalone marker so it attaches to the following paragraph or heading
const optionals = /\[\?(\S+?)\][ \t]*(?:\r?\n(#{1,6}[ \t]+)|\r?\n(?=[ \t]*\S))?/g;
const placeholders = /\[(\S+?)\](?!\()(?:\{([^}]*)\})?/g;

const encodeAttribute = (value: string) => md.utils.escapeHtml(value).replace(/\r\n?|\n/g, "&#10;");

// Turns a trailing {.foo .bar} attribute block into a class list (e.g. "foo bar")
const parseClasses = (attributes?: string) => (attributes ?? String())
    .split(/\s+/)
    .map(token => token.replace(/^\./, String()))
    .filter(Boolean)
    .join(" ");

export const markdownToHTML = (value: string, values: Record<string, string>) => {
    // TODO: Evaluate whether to create markdown-it plugin
    const replaced = value
        .replace(frontmatter, String())
        // Must run before the placeholder pass, which would otherwise consume [?name] tokens
        .replace(optionals, (_, key, heading) => {
            const checked = values[`?${key}`] ? " checked" : String();
            return `${heading ?? String()}<input type="checkbox" class="optional-toggle not-prose" data-optional="${encodeAttribute(key)}"${checked}> `;
        })
        .replace(placeholders, (_, key, attributes) => {
            const value = values[key] ?? String();
            const classes = ["not-prose", parseClasses(attributes)].filter(Boolean).join(" ");
            return `<content-editable class="${encodeAttribute(classes)}" value="${encodeAttribute(value)}" placeholder="${encodeAttribute(key)}" underline></content-editable>`;
        });

    return md.render(replaced);
};

export const parseFrontmatter = (value: string) => {
    const [_, match] = value.match(frontmatter) ?? [];
    return match && parse(match);
};

export const updateRender: {
    setValue?: (value: string) => void,
    setValues?: (values: Record<string, string>) => void
} = {};
