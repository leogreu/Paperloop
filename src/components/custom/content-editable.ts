export class ContentEditable extends HTMLElement {
    static observedAttributes = ["value", "placeholder"];

    value = String();
    placeholder = String();

    get styles() {
        return `
            :host {
                display: inline-block;
                min-width: 1rem;
            }

            [contenteditable] {
                outline: none;
                cursor: text;
            }


            [contenteditable]:empty:before {
                content: attr(placeholder);
                color: hsl(var(--placeholder));
            }

            :host([underline]) [contenteditable]:not(:empty) {
                text-decoration: underline;
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
                    min-height: 1.25rem;
                    background-color: color-mix(in srgb, hsl(var(--placeholder)), white 50%);
                    border-radius: var(--radius);
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                [contenteditable]:empty:before {
                    content: "";
                }
            }
        `;
    }

    render() {
        this.shadowRoot!.innerHTML = `
            <style>${this.styles}</style>
            <div placeholder="${this.placeholder}" contenteditable="plaintext-only">${this.value}</div>
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
    }

    attributeChangedCallback(name: string, _: string, value: string) {
        Reflect.set(this, name, value);
        this.render();
        this.highlightTag();
    }

    highlightTag() {
        this.content.innerHTML = this.value.replace(/(#[^\s]+)/g, "<span>$1</span>");
    }
}

customElements.define("content-editable", ContentEditable);

declare global {
    interface HTMLElementTagNameMap {
        "content-editable": ContentEditable;
    }
}
