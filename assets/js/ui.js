// Diálogo modal reutilizable, formularios por esquema y avisos.
import { escapeHtml } from "./util.js";

let modal; let opener = null; let openerKey = null; let cleanup = null;

function getModal() {
  if (!modal) {
    modal = document.getElementById("modal");
    modal.addEventListener("close", () => {
      if (cleanup) { cleanup(); cleanup = null; }
      modal.innerHTML = "";
      const target = opener && opener.isConnected ? opener
        : openerKey ? document.querySelector(`[data-fk="${CSS.escape(openerKey)}"]`) : null;
      if (target) target.focus();
      opener = null; openerKey = null;
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.close(); // clic en el fondo
    });
  }
  return modal;
}

export function closeDialog() {
  if (modal && modal.open) modal.close();
}

/**
 * Abre el diálogo con contenido libre.
 * mount(root, close) se ejecuta al abrir; puede devolver una función de limpieza.
 */
export function openDialog({ title, body, footer = "", size = "md", mount }) {
  const dlg = getModal();
  if (dlg.open) dlg.close();
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  openerKey = opener?.dataset?.fk || null;
  dlg.className = `modal modal-${size}`;
  dlg.setAttribute("aria-labelledby", "modalTitle");
  dlg.innerHTML = `
    <div class="modal-head">
      <h2 id="modalTitle">${escapeHtml(title)}</h2>
      <button type="button" class="icon-btn" data-close aria-label="Cerrar" title="Cerrar">✕</button>
    </div>
    <div class="modal-content">${body}</div>
    ${footer ? `<div class="modal-foot">${footer}</div>` : ""}`;
  dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dlg.close()));
  dlg.showModal();
  if (mount) cleanup = mount(dlg, () => dlg.close()) || null;
  const first = dlg.querySelector("[autofocus], .modal-content input:not([type=hidden]), .modal-content select, .modal-content textarea, .modal-content button");
  if (first) first.focus();
  return dlg;
}

function optionList(options) {
  return (options || []).map((o) => (typeof o === "object" ? o : { value: o, label: o }));
}

function fieldHtml(f) {
  const id = `f_${f.name}`;
  const req = f.required ? "required" : "";
  const cls = `field${f.full ? " full" : ""}`;
  const hint = f.hint ? `<small class="field-hint" id="${id}_hint">${escapeHtml(f.hint)}</small>` : "";
  const desc = f.hint ? `aria-describedby="${id}_hint"` : "";
  const attrs = ["min", "max", "step", "placeholder", "maxlength", "accept", "inputmode", "list", "autocomplete"]
    .filter((k) => f[k] !== undefined).map((k) => `${k}="${escapeHtml(f[k])}"`).join(" ");
  const value = f.value ?? "";
  switch (f.type) {
    case "select":
      return `<label class="${cls}" for="${id}"><span>${escapeHtml(f.label)}</span>
        <select class="input" id="${id}" name="${f.name}" ${req} ${desc}>
          ${optionList(f.options).map((o) => `<option value="${escapeHtml(o.value)}" ${String(o.value) === String(value) ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("")}
        </select>${hint}</label>`;
    case "textarea":
      return `<label class="${cls}" for="${id}"><span>${escapeHtml(f.label)}</span>
        <textarea class="input" id="${id}" name="${f.name}" rows="${f.rows || 3}" ${req} ${attrs} ${desc}>${escapeHtml(value)}</textarea>${hint}</label>`;
    case "checkbox":
      return `<label class="${cls} field-check" for="${id}">
        <input type="checkbox" id="${id}" name="${f.name}" ${value ? "checked" : ""} ${desc}>
        <span>${escapeHtml(f.label)}</span>${hint}</label>`;
    case "file":
      return `<label class="${cls}" for="${id}"><span>${escapeHtml(f.label)}</span>
        <input class="input input-file" type="file" id="${id}" name="${f.name}" ${attrs} ${desc}>${hint}</label>`;
    default:
      return `<label class="${cls}" for="${id}"><span>${escapeHtml(f.label)}</span>
        <input class="input" type="${f.type || "text"}" id="${id}" name="${f.name}" value="${escapeHtml(value)}" ${req} ${attrs} ${desc}>${hint}</label>`;
  }
}

/**
 * Formulario modal generado desde un esquema.
 * onSubmit(values) puede devolver un texto de error (se muestra y el diálogo sigue abierto)
 * o una promesa con el mismo contrato.
 */
export function openForm({ title, intro = "", fields, submitLabel = "Guardar", onSubmit, extraActions = [] }) {
  const body = `
    <form class="form-grid" id="modalForm" novalidate>
      ${intro ? `<p class="form-intro full">${intro}</p>` : ""}
      ${fields.map(fieldHtml).join("")}
      <p class="form-error full" role="alert" hidden></p>
    </form>`;
  const footer = `
    ${extraActions.map((a, i) => `<button type="button" class="btn btn-ghost" data-extra="${i}">${escapeHtml(a.label)}</button>`).join("")}
    <span class="spacer"></span>
    <button type="button" class="btn" data-close>Cancelar</button>
    <button type="submit" class="btn btn-primary" form="modalForm">${escapeHtml(submitLabel)}</button>`;
  return openDialog({
    title, body, footer,
    mount(root, close) {
      const form = root.querySelector("#modalForm");
      const errorBox = form.querySelector(".form-error");
      const showError = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };
      root.querySelectorAll("[data-extra]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const res = await extraActions[Number(btn.dataset.extra)].onClick();
          if (typeof res === "string") showError(res); else close();
        });
      });
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorBox.hidden = true;
        const values = {};
        fields.forEach((f) => {
          const el = form.elements[f.name];
          if (!el) return;
          if (f.type === "checkbox") values[f.name] = el.checked;
          else if (f.type === "file") values[f.name] = el.files && el.files[0] ? el.files[0] : null;
          else values[f.name] = el.value;
        });
        const missing = fields.find((f) => f.required && !String(values[f.name] ?? "").trim());
        if (missing) {
          showError(`Completa “${missing.label}”.`);
          form.elements[missing.name]?.focus();
          return;
        }
        const res = await onSubmit(values);
        if (typeof res === "string") showError(res); else close();
      });
    }
  });
}

/* Avisos ------------------------------------------------------------ */

let toastTimer;
export function toast(message, action) {
  const el = document.getElementById("toast");
  if (!el) return;
  clearTimeout(toastTimer);
  el.innerHTML = `<span>${escapeHtml(message)}</span>${action ? `<button type="button" class="toast-btn">${escapeHtml(action.label)}</button>` : ""}`;
  el.classList.add("is-visible");
  if (action) el.querySelector(".toast-btn").addEventListener("click", () => { action.onClick(); hide(); }, { once: true });
  function hide() { el.classList.remove("is-visible"); }
  toastTimer = setTimeout(hide, action ? 6000 : 3200);
}
