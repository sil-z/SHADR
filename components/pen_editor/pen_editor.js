class PenEditor extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    async connectedCallback() {
        const response = await fetch(new URL("components/pen_editor/pen_editor.html", window.location.href));
        const html = await response.text();

        const temp = document.createElement("div");
        temp.innerHTML = html;

        const template = temp.querySelector('template[data-component="pen_editor"]');
        const content = template.content.cloneNode(true);

        this.shadowRoot.appendChild(content);
    }
}

customElements.define("pen-editor", PenEditor); 