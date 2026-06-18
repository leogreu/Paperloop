import markdownit from "markdown-it";
import attrs from "markdown-it-attrs";
import { parse } from "yaml";

const md = markdownit({
    html: true,
    breaks: true
}).use(attrs);

const frontmatter = /^---\s*\n([\s\S]*?)\n---/;
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
