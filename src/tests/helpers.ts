import { markdownToHTML, updateOptional, updateComputed, updateNumbering } from "@/utils/markdown";

// Runs the full render pipeline of document-render.astro, in the order the passes depend on
export const renderDocument = (markdown: string, values: Record<string, string> = {}) => {
    const root = document.createElement("article");
    root.innerHTML = markdownToHTML(markdown, values);

    updateOptional(root, values);
    updateComputed(root, values);
    updateNumbering(root);

    return root;
};

export const placeholder = (root: ParentNode, name: string) =>
    root.querySelector(`content-editable[placeholder="${name}"]`);

export const placeholders = (root: ParentNode, name: string) =>
    [...root.querySelectorAll(`content-editable[placeholder="${name}"]`)];

export const toggle = (root: ParentNode, name: string) =>
    root.querySelector<HTMLInputElement>(`input[data-optional="${name}"]`);

// The block a toggle governs, marked with - when excluded, to assert whole layouts at once
export const blocks = (root: Element) => [...root.children]
    .map(element => `${element.classList.contains("excluded") ? "-" : "+"}${element.textContent?.trim()}`)
    .join(" | ");

// Resets the module-level formatting defaults, which markdownToHTML reads from the frontmatter
export const resetFormatting = () => markdownToHTML(String(), {});
