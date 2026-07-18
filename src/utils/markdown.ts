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
// Both allow a trailing :format suffix (e.g. :currency("EUR", "de")) that only affects the display
const computed = /\[([^\s=\]]+)=([^\]]+?)(?::(\w+\([^\]]*\)|\w+))?\](?!\()(?:\{([^}]*)\})?/g;
const placeholders = /\[([^\s:\]]+)(?::(\w+\([^\]]*\)|\w+))?\](?!\()(?:\{([^}]*)\})?/g;

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
        .replace(computed, (_, key, expression, format, attributes) => {
            const classes = ["not-prose", parseClasses(attributes)].filter(Boolean).join(" ");
            const formatted = format ? ` format="${encodeAttribute(format)}"` : String();
            return `<content-editable class="${encodeAttribute(classes)}" expression="${encodeAttribute(expression)}" placeholder="${encodeAttribute(key)}"${formatted} readonly></content-editable>`;
        })
        .replace(placeholders, (_, key, format, attributes) => {
            const value = values[key] ?? String();
            const classes = ["not-prose", parseClasses(attributes)].filter(Boolean).join(" ");
            const formatted = format ? ` format="${encodeAttribute(format)}"` : String();
            return `<content-editable class="${encodeAttribute(classes)}" value="${encodeAttribute(value)}" placeholder="${encodeAttribute(key)}"${formatted} underline></content-editable>`;
        });

    return md.render(replaced);
};

const currency = (value: number, currency = "EUR", locale = navigator.language) => new Intl.NumberFormat(locale, {
    style: "currency",
    currency
}).format(value);

// Parses numeric input incl. a decimal comma (e.g. "1,5"); non-numeric input is returned as-is
const toNumber = (value: string) => {
    const normalized = value.trim().replace(/^(-?\d+),(\d+)$/, "$1.$2");
    const numeric = Number(normalized);
    return normalized && !isNaN(numeric) ? numeric : value;
};

// Applies a :format suffix (e.g. currency("EUR", "de")) to a value, which is bound as first argument
export const applyFormat = (value: unknown, expression: string) => {
    const input = typeof value === "string" ? toNumber(value) : value;
    if (typeof input !== "number") return String(value ?? String());

    try {
        const result = evaluate(expression, {
            currency: (code?: string, locale?: string) => currency(input, code, locale)
        });
        return String(typeof result === "function" ? result() : result);
    } catch {
        return String(value);
    }
};

// Evaluates [Name=Expression] elements in document order, so later expressions can reference earlier results
export const updateComputed = (root: ParentNode, values: Record<string, string>) => {
    const scope: Record<string, unknown> = { currency };
    for (const [key, value] of Object.entries(values)) {
        if (value.trim() && !key.startsWith("?")) scope[key] = toNumber(value);
    }

    for (const element of root.querySelectorAll("content-editable[expression]")) {
        let display = String();
        try {
            const result = evaluate(element.getAttribute("expression") ?? String(), scope);
            scope[element.getAttribute("placeholder") ?? String()] = result;

            const formatted = element.getAttribute("format");
            display = formatted ? applyFormat(result, formatted)
                : typeof result === "number" ? format(result, { precision: 14 }) : String(result);
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
