import markdownit from "markdown-it";
import attrs from "markdown-it-attrs";
import { evaluate, format } from "mathjs/number";
import { parse } from "yaml";

const md = markdownit({
    html: true,
    breaks: true
}).use(attrs);

const frontmatter = /^---\s*\n([\s\S]*?)\n---/;
// Optionally consumes the line break after a standalone marker so it attaches to the following paragraph or heading
const optionals = /\[\?(\S+?)\][ \t]*(?:\r?\n(#{1,6}[ \t]+)|\r?\n(?=[ \t]*\S))?/g;
const computed = /\[([^\s=\]]+)=([^\]]+)\](?!\()(?:\{([^}]*)\})?/g;
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
        // Must also run before the placeholder pass, which would otherwise consume spaceless expressions
        .replace(computed, (_, key, expression, attributes) => {
            const classes = ["not-prose", parseClasses(attributes)].filter(Boolean).join(" ");
            return `<content-editable class="${encodeAttribute(classes)}" expression="${encodeAttribute(expression)}" placeholder="${encodeAttribute(key)}" underline readonly></content-editable>`;
        })
        .replace(placeholders, (_, key, attributes) => {
            const value = values[key] ?? String();
            const classes = ["not-prose", parseClasses(attributes)].filter(Boolean).join(" ");
            return `<content-editable class="${encodeAttribute(classes)}" value="${encodeAttribute(value)}" placeholder="${encodeAttribute(key)}" underline></content-editable>`;
        });

    return md.render(replaced);
};

const formatNumber = (value: number, decimals = 2) => new Intl.NumberFormat(navigator.language, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
}).format(value);

// Evaluates [Name=Expression] elements in document order, so later expressions can reference earlier results
export const updateComputed = (root: ParentNode, values: Record<string, string>) => {
    const scope: Record<string, unknown> = { formatNumber };
    for (const [key, value] of Object.entries(values)) {
        const numeric = Number(value.trim().replace(/^(-?\d+),(\d+)$/, "$1.$2"));
        if (value.trim() && !key.startsWith("?")) scope[key] = isNaN(numeric) ? value : numeric;
    }

    for (const element of root.querySelectorAll("content-editable[expression]")) {
        let display = String();
        try {
            const result = evaluate(element.getAttribute("expression") ?? String(), scope);
            scope[element.getAttribute("placeholder") ?? String()] = result;
            display = typeof result === "number" ? format(result, { precision: 14 }) : String(result);
        } catch {
            // Unresolvable (e.g., empty inputs): keep empty so the name is shown instead
        }
        element.setAttribute("value", display);
    }
};

export const parseFrontmatter = (value: string) => {
    const [_, match] = value.match(frontmatter) ?? [];
    return match && parse(match);
};

export const updateRender: {
    setValue?: (value: string) => void,
    setValues?: (values: Record<string, string>) => void
} = {};
