import markdownit from "markdown-it";
import attrs from "markdown-it-attrs";
import { evaluate, format } from "mathjs/number";
import { parse } from "yaml";

const md = markdownit({
    html: true,
    breaks: true
}).use(attrs);

const frontmatter = /^---\s*\n([\s\S]*?)\n---/;

// Mirrors the placeholder syntax: = always follows the expression, ??= only sets the initial state.
// Optionally consumes the line break after a standalone marker so it attaches to the following paragraph or heading
const optionals = /\[\?([^\s=?\]]+)(?:(\?\?)?=([^\]\r\n]+?))?\][ \t]*(?:\r?\n(#{1,6}[ \t]+)|\r?\n(?=[ \t]*\S))?/g;

// Shared trailing part with an optional display-only format suffix, closing bracket, and attribute
// block; only known function names count as formats, so colons can occur in expressions and fallbacks
const formats = "currency|format";
const suffix = String.raw`(?::((?:${formats})\([^\]\r\n]*\)|${formats}))?\](?!\()(?:\{([^}]*)\})?`;
// The name may be omitted when the result is only rendered and not referenced elsewhere
const computed = new RegExp(String.raw`\[([^\s=?\]]*)=([^\]\r\n]+?)${suffix}`, "g");
// An empty fallback ([Name??]) marks an optional field, which prints nothing while it is empty
const placeholders = new RegExp(String.raw`\[([^\s:?\]]+)(?:\?\?(=?)([^\]\r\n]*?))?${suffix}`, "g");

export const encodeHTML = (value: string) => md.utils.escapeHtml(value);

// Additionally encodes line breaks, which would otherwise break inline HTML during markdown parsing
export const encodeAttribute = (value: string) => encodeHTML(value).replace(/\r\n?|\n/g, "&#10;");

// Turns a trailing {.foo .bar} attribute block into a class list (e.g. "foo bar")
const parseClasses = (attributes?: string) => (attributes ?? String())
    .split(/\s+/)
    .map(token => token.replace(/^\./, String()))
    .filter(Boolean)
    .join(" ");

// Serializes attributes, skipping undefined ones
const renderAttributes = (properties: Record<string, string | undefined>) => Object.entries(properties)
    .flatMap(([key, value]) => value !== undefined ? `${key}="${encodeAttribute(value)}"` : [])
    .join(" ");

// Emits a <content-editable> element with the given attributes
const renderEditable = (attributes: string | undefined, properties: Record<string, string | undefined>, flags: string) => {
    const classes = ["not-prose", parseClasses(attributes)].filter(Boolean).join(" ");
    return `<content-editable ${renderAttributes({ class: classes, ...properties })} ${flags}></content-editable>`;
};

export const markdownToHTML = (value: string, values: Record<string, string>) => {
    formatting = parseFrontmatter(value)?.formatting ?? {};

    // TODO: Evaluate whether to create markdown-it plugin
    const fallbacks: Record<string, [string, string]> = {};
    const expressions: Record<string, [string, string]> = {};
    const calculations: Record<string, string> = {};
    const replaced = value
        .replace(frontmatter, String())
        // Must run before the placeholder pass, which would otherwise consume [?name] tokens
        .replace(optionals, (_, key, assign, expression, heading) => {
            // An expression applies to every occurrence of its toggle, defined at the first one
            if (expression) expressions[key] = [assign, expression];
            else [assign, expression] = expressions[key] ?? [assign, expression];

            const attributes = renderAttributes({
                class: "optional-toggle not-prose",
                "data-optional": key,
                "data-expression": expression,
                checked: values[`?${key}`] === "true" ? "checked" : undefined,
                // A single = always follows the expression, while ??= only sets the initial state
                disabled: expression && !assign ? "disabled" : undefined
            });

            return `${heading ?? String()}<input type="checkbox" ${attributes}> `;
        })
        // Must also run before the placeholder pass, which would otherwise consume spaceless expressions
        .replace(computed, (_, key, expression, format, attributes) => {
            if (key) calculations[key] = expression;
            return renderEditable(attributes, { expression, placeholder: key, format }, "readonly");
        })
        .replace(placeholders, (_, key, assign, fallback, format, attributes) => {
            // A calculated name shows its result at every occurrence, and stays read-only there
            const expression = calculations[key];
            if (expression) return renderEditable(attributes, { expression, placeholder: key, format }, "readonly");

            // A fallback applies to every occurrence of its placeholder, defined at the first one
            if (fallback !== undefined) fallbacks[key] = [assign, fallback];
            else [assign, fallback] = fallbacks[key] ?? [assign, fallback];

            return renderEditable(attributes, {
                value: values[key] ?? (assign ? fallback : String()),
                placeholder: key,
                [assign ? "default" : "fallback"]: fallback,
                format
            }, "underline");
        });

    return md.render(replaced);
};

// Defaults for the format suffixes, so a document states its currency and language only once;
// namespaced under `formatting` to not collide with frontmatter of other markdown-based tools
let formatting: { currency?: string, decimals?: number, locale?: string } = {};

const currency = (value: number, currency = formatting.currency ?? "USD", locale = formatting.locale ?? navigator.language) => new Intl.NumberFormat(locale, {
    style: "currency",
    currency
}).format(value);

const formatNumber = (value: number, decimals = formatting.decimals ?? 2, locale = formatting.locale ?? navigator.language) => new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
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
            currency: (code?: string, locale?: string) => currency(input, code, locale),
            format: (decimals?: number, locale?: string) => formatNumber(input, decimals, locale)
        });
        return String(typeof result === "function" ? result() : result);
    } catch {
        return String(value);
    }
};

// Resolves derived optional toggles, whose expressions evaluate to a boolean (e.g. "not other")
export const updateOptional = (root: ParentNode, values: Record<string, string>) => {
    const scope: Record<string, boolean> = {};
    const derived: HTMLInputElement[] = [];

    // A = expression (which renders as disabled) always applies, a ??= one only until set explicitly;
    // all other states are known upfront, so expressions can reference them anywhere in the document
    for (const input of root.querySelectorAll<HTMLInputElement>("input.optional-toggle")) {
        const { optional = String(), expression } = input.dataset;
        if (expression && (input.disabled || values[`?${optional}`] === undefined)) derived.push(input);
        else scope[optional] = input.checked;
    }

    // Resolved in document order, so expressions can reference earlier derived toggles
    for (const input of derived) {
        let state = false;
        try {
            state = Boolean(evaluate(input.dataset.expression ?? String(), scope));
        } catch {
            // Unresolvable (e.g., toggles defined further down): keep excluded
        }

        input.checked = state;
        scope[input.dataset.optional ?? String()] = state;
    }
};

// Evaluates [Name=Expression] elements in document order, so later expressions can reference earlier results
export const updateComputed = (root: ParentNode, values: Record<string, string>) => {
    const scope: Record<string, unknown> = {};

    // Optional toggles are in scope as booleans (requires updateOptional to have run before)
    for (const input of root.querySelectorAll<HTMLInputElement>("input.optional-toggle")) {
        scope[input.dataset.optional ?? String()] = input.checked;
    }

    for (const [key, value] of Object.entries(values)) {
        if (value.trim() && !key.startsWith("?")) scope[key] = toNumber(value);
    }

    // Optional placeholders (declared via ??) count as zero while empty; defaults count as entered,
    // unless they sit in an excluded optional block (requires the lift pass to have run before)
    for (const element of root.querySelectorAll("content-editable[fallback], content-editable[default]")) {
        const key = element.getAttribute("placeholder") ?? String();
        const preset = element.getAttribute("default");
        scope[key] ??= preset !== null && values[key] === undefined && !element.closest(".excluded")
            ? toNumber(preset)
            : 0;
    }

    for (const element of root.querySelectorAll("content-editable[expression]")) {
        let value: string | null = null;
        try {
            const result = evaluate(element.getAttribute("expression") ?? String(), scope);
            scope[element.getAttribute("placeholder") ?? String()] = result;
            value = typeof result === "number" ? format(result, { precision: 14 }) : String(result);
        } catch {
            // Unresolvable (e.g., empty inputs): drop the value, so the name is shown instead
        }

        // Store the raw result (the display getter applies any :format suffix), and only when
        // changed; an expression resolving to an empty string keeps the attribute and renders nothing
        if (element.getAttribute("value") === value) continue;
        if (value === null) element.removeAttribute("value");
        else element.setAttribute("value", value);
    }
};

// Finds the first non-empty text node, which numbering prefixes are read from and written to
const firstText = (element: Element) => [...element.childNodes].find(
    (node): node is Text => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
);

const numbered = /^(\s*)(\d+(?:\.\d+)*)(\.?)\s/;

// Renumbers headings and table rows with numeric prefixes; excluded blocks are skipped and lose
// their number, so the visible numbering always matches the printed output. Only applies where
// optional blocks are actually involved, leaving purely static numbering untouched
export const updateNumbering = (root: ParentNode) => {
    const counters: Record<number, number> = {};
    if (root.querySelector(":is(h1, h2, h3, h4, h5, h6)[data-optional]")) {
        for (const heading of root.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
            const text = firstText(heading);
            const match = text?.textContent?.match(numbered);
            if (!text || !match) continue;

            const level = Number(heading.tagName[1]);
            for (const key of Object.keys(counters)) if (Number(key) > level) delete counters[Number(key)];

            if (heading.classList.contains("excluded")) {
                text.textContent = text.textContent!.replace(numbered, `${match[1]}#${match[3]} `);
            } else {
                counters[level] = (counters[level] ?? 0) + 1;
                const components = Object.keys(counters).map(Number).sort((a, b) => a - b).map(key => counters[key]);
                text.textContent = text.textContent!.replace(numbered, `${match[1]}${components.join(".")}${match[3]} `);
            }
        }
    }

    for (const body of root.querySelectorAll("tbody")) {
        if (!body.querySelector("[data-optional]")) continue;

        let count = 0;
        for (const row of body.querySelectorAll("tr")) {
            const cell = row.querySelector("td");
            const text = cell && firstText(cell);
            const match = text?.textContent?.match(/^(\s*)(\d+)(\.?)\s*$/);
            if (!text || !match) continue;

            text.textContent = row.classList.contains("excluded")
                ? `${match[1]}#${match[3]}`
                : `${match[1]}${++count}${match[3]}`;
        }
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
