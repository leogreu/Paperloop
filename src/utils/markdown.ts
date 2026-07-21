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
const formats = "currency|number|date";
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

const formatCurrency = (value: number, currency = formatting.currency ?? "USD", locale = formatting.locale ?? navigator.language) => new Intl.NumberFormat(locale, {
    style: "currency",
    currency
}).format(value);

const formatNumber = (value: number, decimals = formatting.decimals ?? 2, locale = formatting.locale ?? navigator.language) => new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
}).format(value);

const formatDate = (value: string, style: Intl.DateTimeFormatOptions["dateStyle"] = "medium", locale = formatting.locale ?? navigator.language) => {
    // A date-only value is parsed as UTC midnight, so anchor it to local time to avoid an off-by-one
    return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00` : value).toLocaleDateString(locale, { dateStyle: style });
};

// Parses numeric input incl. a decimal comma (e.g. "1,5"); non-numeric input is returned as-is
const toNumber = (value: string) => {
    const normalized = value.trim().replace(/^(-?\d+),(\d+)$/, "$1.$2");
    const numeric = Number(normalized);
    return normalized && !isNaN(numeric) ? numeric : value;
};

// The base scope shared by calculations: the document values as numbers, plus the now() function,
// which returns the current instant as a full ISO timestamp (the :date suffix renders it for the reader)
const valueScope = (values: Record<string, string>) => {
    const scope: Record<string, unknown> = {
        now: () => new Date().toISOString()
    };

    for (const [key, value] of Object.entries(values)) {
        if (value.trim() && !key.startsWith("?")) scope[key] = toNumber(value);
    }

    return scope;
};

// Renders a raw expression result, cleaning up the float noise mathjs can produce
const renderResult = (result: unknown) =>
    typeof result === "number" ? format(result, { precision: 14 }) : String(result ?? String());

// Applies a format suffix (e.g. currency("EUR", "de")) to a value, which is bound as first argument
export const applyFormat = (value: unknown, expression: string) => {
    const text = renderResult(value);
    const input = toNumber(text);

    try {
        // Every format leaves a value it cannot read as it is, rather than rendering an error
        const result = evaluate(expression, {
            currency: (code?: string, locale?: string) =>
                typeof input === "number" ? formatCurrency(input, code, locale) : text,
            number: (decimals?: number, locale?: string) =>
                typeof input === "number" ? formatNumber(input, decimals, locale) : text,
            date: (style?: Intl.DateTimeFormatOptions["dateStyle"], locale?: string) =>
                typeof input === "number" || isNaN(Date.parse(text)) ? text : formatDate(text, style, locale)
        });
        return String(typeof result === "function" ? result() : result);
    } catch {
        return text;
    }
};

// Resolves derived optional toggles, whose expressions evaluate to a boolean (e.g. "not other"),
// and lifts every toggle state to the block it governs; must run before updateComputed and
// updateNumbering, which read the resulting classes
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

    for (const input of root.querySelectorAll<HTMLInputElement>("input.optional-toggle")) {
        const block = input.closest("li, tr") ?? input.closest("p, h1, h2, h3, h4, h5, h6");
        if (!block) continue;

        // A marker in a heading toggles the whole section, up to the next same- or higher-level heading
        const section = [block];
        if (/^H[1-6]$/.test(block.tagName)) {
            let sibling = block.nextElementSibling;
            while (sibling && !(/^H[1-6]$/.test(sibling.tagName) && sibling.tagName <= block.tagName)) {
                section.push(sibling);
                sibling = sibling.nextElementSibling;
            }
        }

        // Blocks start out included after each render, so a block is excluded as soon as any toggle
        // governing it is off — an inner one therefore still applies within a section
        for (const element of section) {
            element.setAttribute("data-optional", input.dataset.optional ?? String());
            if (!input.checked) element.classList.add("excluded");
        }
    }
};

// Evaluates [Name=Expression] elements in document order, so later expressions can reference earlier results
export const updateComputed = (root: ParentNode, values: Record<string, string>) => {
    const scope = valueScope(values);

    // Optional toggles are in scope as booleans (requires updateOptional to have run before), while
    // placeholders of the same name take precedence, as they are already in the scope
    for (const input of root.querySelectorAll<HTMLInputElement>("input.optional-toggle")) {
        scope[input.dataset.optional ?? String()] ??= input.checked;
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
            value = renderResult(result);
        } catch {
            // Unresolvable (e.g., empty inputs): drop the value, so the name is shown instead
        }

        // Store the raw result (the display getter applies any format suffix), and only when
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

// Mirrors the @page margin boxes of the stylesheet, where bottom-center is taken by the page number
const boxes = ["top-left", "top-center", "top-right", "bottom-left", "bottom-right"];

// Header and footer are rendered by the @page margin boxes, which read attributes off <html>; their
// placeholders are resolved here and set on the root element right before printing
export const updateMargins = (value: string, values: Record<string, string>) => {
    const margins = parseFrontmatter(value)?.margins ?? {};
    const scope = valueScope(values);

    for (const key of boxes) {
        const text = margins[key];
        if (text == null) {
            document.documentElement.removeAttribute(key);
            continue;
        }

        // Calculations are resolved first, as the placeholder pass would otherwise consume them
        document.documentElement.setAttribute(key, String(text)
            .replace(computed, (_, _name, expression, format) => {
                try {
                    const result = evaluate(expression, scope);
                    return format ? applyFormat(result, format) : renderResult(result);
                } catch {
                    return String();
                }
            })
            .replace(placeholders, (_, name, _assign, fallback, format) => {
                const resolved = values[name] || fallback || String();
                return format ? applyFormat(resolved, format) : resolved;
            }));
    }
};

const parseFrontmatter = (value: string) => {
    const [_, match] = value.match(frontmatter) ?? [];
    try {
        return match && parse(match);
    } catch {
        // Invalid YAML, e.g. while it is still being typed: treated as no frontmatter at all
    }
};

export const updateRender: {
    setValue?: (value: string) => void,
    setValues?: (values: Record<string, string>) => void
} = {};
