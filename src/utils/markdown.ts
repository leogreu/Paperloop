import markdownit from "markdown-it";
import attrs from "markdown-it-attrs";
import { parse } from "yaml";

const md = markdownit({
    html: true,
    breaks: true
}).use(attrs);

const frontmatter = /^---\s*\n([\s\S]*?)\n---/;
const placeholders = /\[(\S+)\](?!\()/g;

export const markdownToHTML = (value: string, values: Record<string, string>) => {
    // TODO: Evaluate whether to create markdown-it plugin
    const replaced = value
        .replace(frontmatter, String())
        .replace(placeholders, (_, key) => {
            const value = values[key] ?? String();
            return `<content-editable class="not-prose" value="${value}" placeholder="${key}" underline></content-editable>`;
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
