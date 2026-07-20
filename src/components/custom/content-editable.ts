import { applyFormat, encodeHTML } from "@/utils/markdown";

export class ContentEditable extends HTMLElement {
    static observedAttributes = ["value", "placeholder"];

    value = String();
    placeholder = String();

    // The formatted representation shown while not editing; the raw value stays in `value`
    get display() {
        const format = this.getAttribute("format");
        return format && this.value ? applyFormat(this.value, format) : this.value;
    }

    // Shown in gray while empty: the formatted fallback if present, the placeholder name otherwise
    get hint() {
        const fallback = this.getAttribute("fallback");
        const format = this.getAttribute("format");
        return fallback ? (format ? applyFormat(fallback, format) : fallback) : this.placeholder;
    }

    get styles() {
        return `
            :host {
                display: inline-block;
                min-width: 0.5rem;
                min-height: 0.5rem;
            }

            [contenteditable] {
                outline: none;
                cursor: text;
                min-height: inherit;

                /* Keeps line breaks and leading or trailing spaces intact */
                white-space: break-spaces;
            }

            [contenteditable]:empty:before {
                content: attr(placeholder);
                color: hsl(var(--placeholder));
            }

            :host([underline]) [contenteditable]:not(:empty) {
                text-decoration: underline;
            }

            :host([readonly]) [contenteditable] {
                cursor: default;
            }

            /* An expression resolving to an empty string is no field to be filled, but simply gone */
            :host([expression][value=""]) {
                display: none;
            }

            span {
                padding: .25rem .5rem;
                background-color: hsl(var(--secondary));
                border-radius: var(--radius);
            }

            @media print {
                :host([underline]) [contenteditable]:not(:empty) {
                    text-decoration: none;
                }

                [contenteditable]:empty {
                    min-width: 7.5rem;
                    background-color: color-mix(in srgb, hsl(var(--placeholder)), white 50%);
                    border-radius: var(--radius);
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                [contenteditable]:empty:before {
                    content: "";
                }

                /* Fallbacks are printed as normal text instead of a to-be-filled box */
                :host([fallback]) [contenteditable]:empty {
                    min-width: unset;
                    background-color: unset;
                }

                :host([fallback]) [contenteditable]:empty:before {
                    content: attr(placeholder);
                    color: unset;
                }
            }
        `;
    }

    render() {
        this.shadowRoot!.innerHTML = `
            <style>${this.styles}</style>
            <div placeholder="${encodeHTML(this.hint)}" contenteditable="${this.hasAttribute("readonly") ? "false" : "plaintext-only"}">${encodeHTML(this.display)}</div>
        `;
    }

    get content() {
        return this.shadowRoot?.querySelector("div")!;
    }

    constructor() {
        super();
        const shadowRoot = this.attachShadow({ mode: "open" });
        this.addEventListener("input", () => {
            // Unset textContent due to issue with Safari (still containing a <br>)
            this.value = this.content.textContent ||= String();
        });

        this.addEventListener("blur", this.highlightTag);

        // Formatted values are edited raw, like spreadsheet cells
        this.addEventListener("focus", () => {
            if (this.hasAttribute("format") && this.content.textContent !== this.value) {
                this.content.textContent = this.value;

                const range = document.createRange();
                range.selectNodeContents(this.content);
                range.collapse(false);
                const selection = window.getSelection();
                selection?.removeAllRanges();
                selection?.addRange(range);
            }
        });
    }

    attributeChangedCallback(name: string, _: string, value: string | null) {
        Reflect.set(this, name, value ?? String());
        this.render();
        this.highlightTag();
    }

    highlightTag() {
        this.content.innerHTML = encodeHTML(this.display).replace(/(#[^\s]+)/g, "<span>$1</span>");
    }
}

customElements.define("content-editable", ContentEditable);

declare global {
    interface HTMLElementTagNameMap {
        "content-editable": ContentEditable;
    }
}
