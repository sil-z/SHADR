class NodeEditor extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
    }

    async connectedCallback() {
        const response = await fetch(new URL("components/node_editor/node_editor.html", window.location.href));
        const html = await response.text();

        const temp = document.createElement("div");
        temp.innerHTML = html;

        const template = temp.querySelector('template[data-component="node_editor"]');
        const content = template.content.cloneNode(true);

        this.shadowRoot.appendChild(content);
    }
}

customElements.define("node-editor", NodeEditor); 