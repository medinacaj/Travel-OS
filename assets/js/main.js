// Punto de entrada: carga estado, conecta eventos y renderiza.
import * as S from "./store.js";
import { state } from "./store.js";
import {
  CATEGORIES, PERIODS, PRIORITIES, RES_STATUS, DOC_CATEGORIES, STYLES, CURRENCIES,
  escapeHtml as e, uid, toNumber, isValidLat, isValidLng, hasCoords, safeHttpUrl,
  encodeShare, decodeShare, mapsDirUrl, debounce, prefersReducedMotion, placeholderSvg
} from "./util.js";
import { openDialog, openForm, closeDialog, toast } from "./ui.js";
import { renderApp, renderHistory, renderTodayStrip, todayInfo } from "./views.js";
import { imageSrc, hasCustomImage, loadStoredImages, saveImage, resetImage, storeDocumentFile, openDocumentFile, cleanOrphanDocuments, removeCloudDocument } from "./media.js";
import * as Sync from "./sync.js";
import { refreshMapSize } from "./map.js";
import * as D from "./deals.js";
import { TOOLS, DEAL_TYPES, SOURCE_KINDS, NEWS_IMPACT, buildToolPrompt, buildAnalyzePrompt, buildRefreshPrompt } from "./deals-core.js";
import { buildEmailSummary, buildReportHtml } from "./deals-report.js";
import { reportModel } from "./deals-view.js";
import { allowedRoute } from "./views-control.js";
import { initDashboard } from "./views-dash.js";
import { exportToMyMaps } from "./mymaps.js";
import { icon } from "./icons.js";

/* ------------------------------------------------------------------ */
/* Rutas: #/inicio, #/viajes, #/viajes/<id>/<sección>, #/ofertas… */
/* ------------------------------------------------------------------ */

function parseHash() {
  const m = location.hash.match(/^#\/(.*)$/);
  if (!m) return { route: null };
  const parts = m[1].split("/").filter(Boolean).map((x) => decodeURIComponent(x));
  const tab = (t) => (t === "dinero" ? "presupuesto" : t || "itinerario"); // enlaces antiguos a "Dinero"
  if (parts[0] === "viajes" && parts[1]) return { route: `viaje/${tab(parts[2])}`, tripId: parts[1] };
  if (parts[0] === "viaje") return { route: `viaje/${tab(parts[1])}` };
  return { route: parts[0] || "inicio" };
}
const hashFor = (route) => `#/${route.startsWith("viaje/") ? `viajes/${encodeURIComponent(state.activeTripId)}/${route.slice(6)}` : route}`;

/** Lee la ruta del enlace, abre el viaje indicado y muestra la pantalla (respetando permisos). */
function applyHash({ scroll = true } = {}) {
  if (state.shareMode) return;
  const p = parseHash();
  if (p.tripId && p.tripId !== state.activeTripId && S.switchTrip(p.tripId)) Sync.applyCache();
  let route = allowedRoute(p.route || state.route || "inicio");
  if (p.route === "viaje/resumen") route = "inicio"; // el Resumen del viaje ahora está en Inicio
  const changed = route !== state.route;
  S.setUi({ route });
  const want = hashFor(route);
  if (location.hash !== want) window.history.replaceState(null, "", want);
  if (route === "viaje/mapa") refreshMapSize();
  if (changed && scroll) window.scrollTo(0, 0);
}
function go(route) {
  const target = hashFor(route);
  if (location.hash === target) applyHash(); else location.hash = target;
}

/* ------------------------------------------------------------------ */
/* Utilidades de interacción                                           */
/* ------------------------------------------------------------------ */

function doUndo() {
  const label = S.undo();
  toast(label ? `Deshecho: ${label}` : "No hay cambios para deshacer");
}
function doRedo() {
  const label = S.redo();
  toast(label ? `Rehecho: ${label}` : "No hay cambios para rehacer");
}
const undoAction = { label: "Deshacer", onClick: doUndo };

function scrollToSection(key) {
  go(key);
}

function flashCard(id) {
  requestAnimationFrame(() => {
    const card = document.getElementById(`card-${id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    card.classList.add("is-flash");
    setTimeout(() => card.classList.remove("is-flash"), 1600);
  });
}

/* ------------------------------------------------------------------ */
/* Formularios: panoramas                                              */
/* ------------------------------------------------------------------ */

function dayOptions() {
  return state.trips.map((d, i) => ({ value: i, label: `Día ${i + 1} · ${d.name}` }));
}

function openPlaceForm({ id, dayIndex = state.activeDay, period } = {}) {
  const found = id ? S.findPlace(id) : null;
  const p = found ? found.place : { period: period || "Tarde", priority: "Media", category: "Imperdible" };
  openForm({
    title: found ? `Editar ${p.name}` : "Agregar panorama",
    submitLabel: found ? "Guardar cambios" : "Agregar al itinerario",
    fields: [
      { name: "name", label: "Nombre", value: p.name, required: true, full: true, maxlength: 120, placeholder: "Ej.: Museo Nacional de Bellas Artes" },
      { name: "day", label: "Día", type: "select", options: dayOptions(), value: found ? found.dayIndex : dayIndex },
      { name: "period", label: "Bloque del día", type: "select", options: PERIODS, value: p.period },
      { name: "time", label: "Hora", type: "time", value: p.time },
      { name: "fixedTime", label: "Mostrar hora exacta (vuelo, reserva, función)", type: "checkbox", value: p.fixedTime },
      { name: "duration", label: "Duración", value: p.duration, placeholder: "Ej.: 60 min", maxlength: 40 },
      { name: "transport", label: "Traslado", value: p.transport, placeholder: "A pie, Subte, Taxi…", maxlength: 40 },
      { name: "priority", label: "Prioridad", type: "select", options: PRIORITIES, value: p.priority },
      { name: "category", label: "Categoría", type: "select", options: CATEGORIES, value: p.category },
      { name: "context", label: "Etiqueta de contexto", value: p.context, full: true, maxlength: 160, placeholder: "Gratis • A 15 min en metro • Ideal para la tarde" },
      { name: "lat", label: "Latitud", value: hasCoords(p) ? p.lat : "", inputmode: "decimal", placeholder: "-34.6081", hint: "Opcional, para el mapa." },
      { name: "lng", label: "Longitud", value: hasCoords(p) ? p.lng : "", inputmode: "decimal", placeholder: "-58.3783", hint: "En Google Maps: clic derecho sobre el lugar." }
    ],
    onSubmit(v) {
      const latEmpty = !String(v.lat).trim();
      const lngEmpty = !String(v.lng).trim();
      const lat = toNumber(v.lat);
      const lng = toNumber(v.lng);
      if (latEmpty !== lngEmpty) return "Completa latitud y longitud, o deja ambas vacías.";
      if (!latEmpty && !isValidLat(lat)) return "La latitud debe estar entre -90 y 90.";
      if (!lngEmpty && !isValidLng(lng)) return "La longitud debe estar entre -180 y 180.";
      if (v.fixedTime && !v.time) return "Para mostrar la hora exacta, indica la hora.";
      const day = Number(v.day);
      if (!Number.isInteger(day) || day < 0 || day >= state.trips.length) return "Elige un día válido.";
      const data = {
        name: v.name, period: v.period, time: v.time, fixedTime: v.fixedTime, duration: v.duration,
        transport: v.transport, priority: v.priority, category: v.category, context: v.context,
        lat: latEmpty ? null : lat, lng: lngEmpty ? null : lng
      };
      if (found) {
        S.updatePlace(id, data, day);
        S.setUi({ activeDay: day }, { render: false });
        renderApp();
        toast("Cambios guardados", undoAction);
        flashCard(id);
      } else {
        const newId = S.addPlace(day, data);
        if (!newId) return "No se pudo agregar el panorama.";
        S.setUi({ activeDay: day });
        go("viaje/itinerario");
        toast(`Agregado a Día ${day + 1}`, undoAction);
        flashCard(newId);
      }
      return null;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Imágenes                                                            */
/* ------------------------------------------------------------------ */

function openImageViewer(id) {
  const found = S.findPlace(id);
  if (!found) return;
  const p = found.place;
  openDialog({
    title: p.name,
    size: "lg",
    body: `<figure class="image-view"><img src="${e(imageSrc(p))}" data-ph="${e(placeholderSvg(p.name, p.category))}" alt="Imagen de ${e(p.name)}">
      <figcaption>${e(p.context || p.category)}</figcaption></figure>`,
    footer: `<span class="spacer"></span>${state.shareMode || state.readOnly ? "" : `<button type="button" class="btn" data-img-edit>✎ Cambiar imagen</button>`}<button type="button" class="btn btn-primary" data-close>Cerrar</button>`,
    mount(root) {
      root.querySelector("[data-img-edit]")?.addEventListener("click", () => openImageEditor(id));
    }
  });
}

function openImageEditor(id) {
  const found = S.findPlace(id);
  if (!found) return;
  const p = found.place;
  openForm({
    title: `Imagen de ${p.name}`,
    intro: `<span class="image-preview"><img src="${e(imageSrc(p))}" data-ph="${e(placeholderSvg(p.name, p.category))}" alt="" width="72" height="72"></span>
      Pega la URL de una imagen o sube un archivo. ${Sync.cloudMode() ? "Los archivos se suben a la base central y los ven todos los visitantes." : "Los archivos quedan guardados solo en este navegador."}`,
    submitLabel: "Guardar imagen",
    fields: [
      { name: "url", label: "Pegar URL", type: "url", full: true, placeholder: "https://…", value: state.imageUrls[id] || "" },
      { name: "file", label: "Subir archivo", type: "file", full: true, accept: "image/*" }
    ],
    extraActions: hasCustomImage(id) ? [{ label: "Restablecer", onClick: async () => { await resetImage(id); toast("Imagen restablecida"); } }] : [],
    async onSubmit(v) {
      if (!v.file && !String(v.url).trim()) return "Pega una URL o elige un archivo.";
      const err = await saveImage(id, { url: v.url, file: v.file });
      if (err) return err;
      toast("Imagen actualizada");
      return null;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Pendientes, reservas, documentos                                    */
/* ------------------------------------------------------------------ */

function openPendingForm(id) {
  const item = state.pending.find((p) => p.id === id);
  openForm({
    title: item ? "Editar acción pendiente" : "Nueva acción pendiente",
    submitLabel: item ? "Guardar cambios" : "Agregar",
    fields: [
      { name: "text", label: "Acción", value: item?.text, required: true, full: true, maxlength: 200, placeholder: "Ej.: Comprar entradas del Teatro Colón" },
      { name: "priority", label: "Prioridad", type: "select", options: ["Normal", "Importante"], value: item?.priority || "Normal" }
    ],
    onSubmit(v) {
      S.savePending({ text: v.text, priority: v.priority, done: item?.done || false }, item?.id);
      toast(item ? "Pendiente actualizado" : "Pendiente agregado", undoAction);
    }
  });
}

function openReservationForm(id) {
  const r = state.reservations.find((x) => x.id === id);
  openForm({
    title: r ? "Editar reserva" : "Nueva reserva",
    submitLabel: r ? "Guardar cambios" : "Agregar reserva",
    fields: [
      { name: "name", label: "Nombre", value: r?.name, required: true, full: true, maxlength: 120, placeholder: "Ej.: Hotel en San Telmo" },
      { name: "datetime", label: "Fecha y hora", type: "datetime-local", value: r?.datetime },
      { name: "status", label: "Estado", type: "select", options: RES_STATUS, value: r?.status || "Pendiente" },
      { name: "code", label: "Código / localizador", value: r?.code, maxlength: 60, full: true },
      { name: "notes", label: "Notas", type: "textarea", value: r?.notes, full: true, maxlength: 500 }
    ],
    onSubmit(v) {
      S.saveReservation(v, r?.id);
      toast(r ? "Reserva actualizada" : "Reserva agregada", undoAction);
    }
  });
}

function openDocumentForm(id) {
  const d = state.documents.find((x) => x.id === id);
  const fields = [
    { name: "name", label: "Nombre", value: d?.name, required: true, full: true, maxlength: 120, placeholder: "Ej.: Pasaje de ida" },
    { name: "category", label: "Categoría", type: "select", options: DOC_CATEGORIES, value: d?.category || "Pasaje" },
    { name: "url", label: "URL (opcional)", type: "url", value: d?.url, placeholder: "https://…" },
    { name: "file", label: d?.fileKey ? `Reemplazar archivo (actual: ${d.fileName || "archivo"})` : "Archivo local (opcional)", type: "file", full: true, hint: Sync.cloudMode() ? "Se guarda en la base central (privado: solo el administrador lo ve)." : "Se guarda solo en este navegador (IndexedDB), no en la nube." },
    { name: "notes", label: "Notas", type: "textarea", value: d?.notes, full: true, maxlength: 500 }
  ];
  if (d?.fileKey) fields.splice(4, 0, { name: "removeFile", label: "Quitar el archivo guardado", type: "checkbox", full: true });
  openForm({
    title: d ? "Editar documento" : "Nuevo documento",
    submitLabel: d ? "Guardar cambios" : "Agregar documento",
    fields,
    async onSubmit(v) {
      const url = String(v.url || "").trim();
      if (url && !safeHttpUrl(url)) return "La URL debe empezar con https:// o http://";
      const docId = d?.id || uid("doc");
      let file = { fileKey: d?.fileKey || "", fileName: d?.fileName || "", fileSize: d?.fileSize || 0, fileCloud: Boolean(d?.fileCloud) };
      if (v.removeFile) {
        if (d?.fileCloud) await removeCloudDocument(d.fileKey);
        file = { fileKey: "", fileName: "", fileSize: 0, fileCloud: false };
      }
      if (v.file) {
        const res = await storeDocumentFile(docId, v.file);
        if (res.error) return res.error;
        file = { fileKey: docId, fileName: v.file.name, fileSize: v.file.size, fileCloud: res.cloud };
      }
      S.saveDocument({ id: docId, name: v.name, category: v.category, url, notes: v.notes, ...file }, d?.id);
      toast(d ? "Documento actualizado" : "Documento agregado", undoAction);
      return null;
    }
  });
}

async function openDocument(id) {
  const d = state.documents.find((x) => x.id === id);
  if (!d) return;
  if (d.fileKey) {
    try {
      if (await openDocumentFile(d.fileKey, { cloud: d.fileCloud, name: d.fileName })) return;
    } catch { /* continúa con la URL */ }
    if (!d.url) { toast(d.fileCloud ? "No se pudo descargar el archivo de la base. Revisa la conexión." : "El archivo no está guardado en este navegador. Súbelo de nuevo desde ✎ Editar."); return; }
  }
  const url = safeHttpUrl(d.url);
  if (url) window.open(url, "_blank", "noopener");
}

/* ------------------------------------------------------------------ */
/* Asistente “Nuevo viaje” (3 pasos)                                   */
/* ------------------------------------------------------------------ */

function openPlanner() {
  const draft = { destination: "", days: 4, style: "Mixto", startDate: "" };
  let step = 1;
  openDialog({
    title: "Nuevo viaje",
    body: `<div class="planner" id="planner"></div>`,
    footer: `<button type="button" class="btn" data-back>Atrás</button><span class="spacer"></span>
      <button type="button" class="btn" data-close>Cancelar</button>
      <button type="button" class="btn btn-primary" data-next>Siguiente</button>`,
    mount(root, close) {
      const box = root.querySelector("#planner");
      const back = root.querySelector("[data-back]");
      const next = root.querySelector("[data-next]");
      const paint = () => {
        const progress = `<p class="planner-step">Paso ${step} de 3</p><div class="planner-dots" aria-hidden="true">${[1, 2, 3].map((n) => `<span class="${n <= step ? "on" : ""}"></span>`).join("")}</div>`;
        if (step === 1) {
          box.innerHTML = `${progress}<label class="planner-q" for="pDest">¿A dónde vas?</label>
            <input class="input input-xl" id="pDest" list="pDestList" value="${e(draft.destination)}" placeholder="Ej.: Mendoza" maxlength="80" autocomplete="off">
            <datalist id="pDestList"><option value="Buenos Aires"><option value="Santiago"><option value="Mendoza"><option value="Montevideo"></datalist>
            <p class="form-error" role="alert" hidden></p>`;
          box.querySelector("#pDest").focus();
        } else if (step === 2) {
          box.innerHTML = `${progress}<label class="planner-q" for="pDays">¿Cuántos días?</label>
            <div class="days-picker"><input type="range" id="pDays" min="1" max="14" value="${draft.days}" aria-describedby="pDaysOut">
            <output id="pDaysOut" for="pDays">${draft.days} ${draft.days === 1 ? "día" : "días"}</output></div>`;
          const range = box.querySelector("#pDays");
          range.addEventListener("input", () => {
            draft.days = Number(range.value);
            box.querySelector("#pDaysOut").textContent = `${draft.days} ${draft.days === 1 ? "día" : "días"}`;
          });
          range.focus();
        } else {
          box.innerHTML = `${progress}<fieldset class="planner-styles"><legend class="planner-q">¿Qué estilo prefieres?</legend>
            ${STYLES.map((s) => `<label class="style-option"><input type="radio" name="pStyle" value="${s}" ${s === draft.style ? "checked" : ""}><span>${s}</span></label>`).join("")}
            </fieldset>
            <label class="field" for="pStart"><span>Fecha de inicio (opcional)</span><input class="input" type="date" id="pStart" value="${e(draft.startDate || "")}"></label>
            <p class="muted small">Se crea un viaje nuevo; tus otros viajes no cambian. Los viajeros se copian del viaje actual.</p>`;
          box.querySelectorAll("input[name=pStyle]").forEach((r) => r.addEventListener("change", () => { draft.style = r.value; }));
          box.querySelector("#pStart").addEventListener("change", (ev) => { draft.startDate = ev.target.value; });
          box.querySelector("input[name=pStyle]:checked")?.focus();
        }
        back.disabled = step === 1;
        next.textContent = step === 3 ? "Crear borrador" : "Siguiente";
      };
      const advance = () => {
        if (step === 1) {
          const input = box.querySelector("#pDest");
          draft.destination = input.value.trim();
          if (!draft.destination) {
            const err = box.querySelector(".form-error");
            err.textContent = "Escribe el destino para continuar.";
            err.hidden = false;
            input.focus();
            return;
          }
        }
        if (step < 3) { step += 1; paint(); return; }
        const newId = S.createTrip(draft);
        if (newId) {
          close();
          toast(`Viaje a ${draft.destination} creado`);
          location.hash = `#/viajes/${encodeURIComponent(newId)}/itinerario`;
        }
      };
      next.addEventListener("click", advance);
      back.addEventListener("click", () => { if (step > 1) { step -= 1; paint(); } });
      box.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && ev.target.tagName === "INPUT" && ev.target.type !== "checkbox") { ev.preventDefault(); advance(); }
      });
      paint();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Compartir (solo lectura)                                            */
/* ------------------------------------------------------------------ */

function openShare() {
  const link = `${location.origin}${location.pathname}#share=${encodeShare(S.sharePayload())}`;
  openDialog({
    title: "Compartir itinerario",
    body: `<p>Cualquiera con este enlace verá el itinerario, los destinos y el mapa en <strong>solo lectura</strong>, sin registrarse.</p>
      <p class="muted small">No incluye gastos, reservas, documentos, observaciones ni imágenes guardadas en este navegador.</p>
      <label class="field full" for="shareLink"><span>Enlace</span><input class="input" id="shareLink" readonly value="${e(link)}"></label>
      <p class="muted small">El enlace contiene una copia del itinerario de hoy: si haces cambios, genera uno nuevo.</p>`,
    footer: `<a class="btn" href="${e(link)}" target="_blank" rel="noopener">Ver vista compartida</a><span class="spacer"></span>
      <button type="button" class="btn btn-primary" data-copy>Copiar enlace</button>`,
    mount(root) {
      const input = root.querySelector("#shareLink");
      input.addEventListener("focus", () => input.select());
      root.querySelector("[data-copy]").addEventListener("click", async (ev) => {
        try {
          await navigator.clipboard.writeText(link);
          ev.target.textContent = "Enlace copiado";
        } catch {
          input.focus();
          input.select();
          ev.target.textContent = "Copia con Ctrl+C";
        }
      });
    }
  });
}

function readShareHash() {
  const m = location.hash.match(/^#share=([A-Za-z0-9_-]{1,200000})$/);
  if (!m) return location.hash.startsWith("#share=") ? "invalid" : null;
  try {
    return S.loadSharedPayload(decodeShare(m[1])) ? "ok" : "invalid";
  } catch {
    return "invalid";
  }
}

/* ------------------------------------------------------------------ */
/* Franja del día: clima y Plan B                                     */
/* ------------------------------------------------------------------ */

function dayCenter(dayIndex) {
  const pts = (state.trips[dayIndex]?.items || []).filter(hasCoords);
  const all = pts.length ? pts : state.trips.flatMap((d) => d.items).filter(hasCoords);
  if (!all.length) return null;
  return {
    lat: all.reduce((s, p) => s + p.lat, 0) / all.length,
    lng: all.reduce((s, p) => s + p.lng, 0) / all.length
  };
}

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
async function updateWeather() {
  const c = dayCenter(state.activeDay);
  if (!c) { todayInfo.weather = { status: "idle" }; renderTodayStrip(); return; }
  const key = `${c.lat.toFixed(2)},${c.lng.toFixed(2)}`;
  if (todayInfo.weatherKey === key && todayInfo.weather.status !== "error") return;
  todayInfo.weatherKey = key;
  todayInfo.weather = { status: "loading" };
  renderTodayStrip();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat.toFixed(4)}&longitude=${c.lng.toFixed(4)}&current=weather_code,precipitation,temperature_2m&timezone=auto`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const cur = data.current || {};
    const rain = RAIN_CODES.has(cur.weather_code) || Number(cur.precipitation) > 0;
    todayInfo.weather = { status: "ok", rain, temp: Number(cur.temperature_2m) };
  } catch {
    todayInfo.weather = { status: "error" };
  } finally {
    clearTimeout(timer);
  }
  if (todayInfo.weatherKey === key) renderTodayStrip();
}

function showPlanB() {
  const dayIndex = state.activeDay;
  const day = state.trips[dayIndex];
  const indoor = ["Cultura", "Comida", "Compras"];
  const options = day.items.filter((p) => indoor.includes(p.category) && !state.doneItems[p.id]);
  const c = dayCenter(dayIndex);
  const search = c
    ? `https://www.google.com/maps/search/museos+cafés+galerías/@${c.lat.toFixed(5)},${c.lng.toFixed(5)},15z`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`museos y cafés en ${state.meta.destination}`)}`;
  let html;
  if (options.length) {
    html = `<p><strong>Alternativas bajo techo de este día:</strong></p><ul>${options.slice(0, 3).map((p) =>
      `<li><a href="${e(mapsDirUrl(p, state.meta.destination))}" target="_blank" rel="noopener">${e(p.name)}</a> <span class="muted">· ${e(p.category)}${p.context ? ` · ${e(p.context)}` : ""}</span></li>`).join("")}</ul>
      <p class="small"><a href="${e(search)}" target="_blank" rel="noopener">Buscar más lugares bajo techo cerca</a></p>`;
  } else {
    html = `<p>No hay panoramas bajo techo pendientes hoy. <a href="${e(search)}" target="_blank" rel="noopener">Buscar museos y cafés cercanos en Google Maps</a>.</p>`;
  }
  todayInfo.planB = { dayIndex, html };
  renderTodayStrip();
}

/* ------------------------------------------------------------------ */
/* Módulo Ofertas                                                      */
/* ------------------------------------------------------------------ */

async function copyText(text, okMessage) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
  } catch {
    openDialog({
      title: "Copia el texto",
      body: `<p class="muted small">Tu navegador no permitió copiar automáticamente. Selecciona el texto y cópialo.</p>
        <textarea class="input" rows="12" readonly id="copyFallback">${e(text)}</textarea>`,
      footer: `<span class="spacer"></span><button type="button" class="btn btn-primary" data-close>Listo</button>`,
      mount(root) { const t = root.querySelector("#copyFallback"); t.focus(); t.select(); }
    });
  }
}

const WEEKDAY_OPTIONS = [
  { value: "", label: "Cualquier día" }, { value: "1", label: "Solo lunes" }, { value: "2", label: "Solo martes" },
  { value: "3", label: "Solo miércoles" }, { value: "4", label: "Solo jueves" }, { value: "5", label: "Solo viernes" },
  { value: "6", label: "Solo sábado" }, { value: "0", label: "Solo domingo" }
];
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : "");

function openDealForm(id) {
  const d = state.deals.find((x) => x.id === id);
  openForm({
    title: d ? "Editar oferta" : "Nueva oferta",
    intro: "Registra solo datos que puedas respaldar con una fuente. Lo que no sepas, déjalo vacío: el puntaje lo considera.",
    submitLabel: d ? "Guardar cambios" : "Agregar oferta",
    fields: [
      { name: "title", label: "Título", value: d?.title, required: true, full: true, maxlength: 140, placeholder: "Ej.: Santiago → Buenos Aires" },
      { name: "type", label: "Tipo", type: "select", options: Object.entries(DEAL_TYPES).map(([value, label]) => ({ value, label })), value: d?.type || "vuelo" },
      { name: "provider", label: "Aerolínea, hotel o agencia", value: d?.provider, maxlength: 80 },
      { name: "origin", label: "Origen", value: d?.origin, maxlength: 80 },
      { name: "destination", label: "Destino", value: d?.destination ?? state.meta.destination, maxlength: 80 },
      { name: "price", label: "Precio final (CLP)", type: "number", min: 0, step: 1, value: d?.price ?? "", hint: "Vacío si no hay precio publicado." },
      { name: "referencePrice", label: "Precio habitual (CLP)", type: "number", min: 0, step: 1, value: d?.referencePrice ?? "", hint: "Para calcular el ahorro real." },
      { name: "priceIncludesTaxes", label: "El precio incluye tasas", type: "checkbox", value: d ? d.priceIncludesTaxes : true },
      { name: "referenceSource", label: "Origen del precio habitual", type: "select", value: d?.referenceSource || "", options: [{ value: "", label: "Sin referencia" }, { value: "proveedor", label: "Lo publica el proveedor" }, { value: "independiente", label: "Historial independiente" }] },
      { name: "priceBasis", label: "Detalle del precio", value: d?.priceBasis, full: true, maxlength: 200, placeholder: "Ej.: por tramo, por persona, ida y vuelta…" },
      { name: "discountPct", label: "Descuento declarado (%)", type: "number", min: 0, max: 100, step: 1, value: d?.discountPct ?? "" },
      { name: "sourceKind", label: "Tipo de fuente", type: "select", options: Object.entries(SOURCE_KINDS).map(([value, label]) => ({ value, label })), value: d?.sourceKind || "usuario" },
      { name: "sourceName", label: "Nombre de la fuente", value: d?.sourceName, maxlength: 120 },
      { name: "sourceUrl", label: "Enlace a la fuente", type: "url", value: d?.sourceUrl, placeholder: "https://…" },
      { name: "validFrom", label: "Se puede comprar desde", type: "datetime-local", value: toLocalInput(d?.validFrom) },
      { name: "validUntil", label: "Se puede comprar hasta", type: "datetime-local", value: toLocalInput(d?.validUntil) },
      { name: "buyDay", label: "Días de compra", type: "select", options: WEEKDAY_OPTIONS, value: d?.buyDays?.length === 1 ? String(d.buyDays[0]) : "" },
      { name: "travelUntil", label: "Volar hasta", type: "date", value: d?.travelUntil?.slice(0, 10) },
      { name: "requiresCard", label: "Requiere tarjeta o banco específico", type: "checkbox", value: d?.requiresCard },
      { name: "stockLimited", label: "Stock limitado", type: "checkbox", value: d?.stockLimited },
      { name: "conditions", label: "Condiciones (una por línea)", type: "textarea", full: true, rows: 4, value: d?.conditions?.join("\n") },
      { name: "notes", label: "Notas", type: "textarea", full: true, rows: 2, value: d?.notes, maxlength: 500 }
    ],
    onSubmit(v) {
      if (v.sourceUrl && !safeHttpUrl(v.sourceUrl)) return "El enlace debe empezar con https://";
      if (v.validFrom && v.validUntil && new Date(v.validFrom) > new Date(v.validUntil)) return "La fecha de inicio es posterior al término.";
      const keepDays = d && d.buyDays.length > 1 && v.buyDay === "" ? d.buyDays : null;
      D.saveDeal({
        type: v.type, title: v.title, provider: v.provider, origin: v.origin, destination: v.destination,
        price: v.price, priceIncludesTaxes: v.priceIncludesTaxes, priceBasis: v.priceBasis,
        referencePrice: v.referencePrice, referenceSource: v.referenceSource,
        discountPct: v.discountPct, discountBasis: v.discountPct ? "declarado" : "desconocido",
        sourceKind: v.sourceKind, sourceName: v.sourceName, sourceUrl: v.sourceUrl,
        verifiedAt: new Date().toISOString().slice(0, 10),
        validFrom: fromLocalInput(v.validFrom), validUntil: fromLocalInput(v.validUntil),
        buyDays: keepDays || (v.buyDay === "" ? [] : [Number(v.buyDay)]),
        travelUntil: v.travelUntil, requiresCard: v.requiresCard, stockLimited: v.stockLimited,
        conditions: String(v.conditions || "").split("\n").map((x) => x.trim()).filter(Boolean), notes: v.notes
      }, d?.id);
      toast(d ? "Oferta actualizada" : "Oferta agregada", undoAction);
      return null;
    }
  });
}

function openNewsForm(id) {
  const n = state.dealNews.find((x) => x.id === id);
  openForm({
    title: n ? "Editar noticia" : "Nueva noticia",
    submitLabel: n ? "Guardar cambios" : "Agregar noticia",
    fields: [
      { name: "title", label: "Titular", value: n?.title, required: true, full: true, maxlength: 220 },
      { name: "source", label: "Medio o fuente", value: n?.source, maxlength: 80 },
      { name: "date", label: "Fecha", type: "date", value: n?.date?.slice(0, 10) },
      { name: "url", label: "Enlace", type: "url", value: n?.url, full: true, placeholder: "https://…" },
      { name: "impact", label: "Impacto", type: "select", options: Object.entries(NEWS_IMPACT).map(([value, label]) => ({ value, label })), value: n?.impact || "precios" }
    ],
    onSubmit(v) {
      if (v.url && !safeHttpUrl(v.url)) return "El enlace debe empezar con https://";
      D.saveNews(v, n?.id);
      toast(n ? "Noticia actualizada" : "Noticia agregada", undoAction);
      return null;
    }
  });
}

function gotoDeal(id) {
  S.setUi({ dealsTab: "ofertas", dealFilter: { ...state.dealFilter, type: "all", status: "all", q: "", mine: false } });
  const search = document.getElementById("dealSearch");
  if (search) search.value = "";
  requestAnimationFrame(() => {
    const card = document.getElementById(`deal-${id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    card.classList.add("is-flash");
    setTimeout(() => card.classList.remove("is-flash"), 1600);
  });
}

function handleDealAction(act, el) {
  const id = el.dataset.id;
  switch (act) {
    case "deal-tab": S.setUi({ dealsTab: el.dataset.tab }); return true;
    case "deal-type": D.setDealFilter({ type: el.dataset.type }); return true;
    case "deal-add": openDealForm(); return true;
    case "deal-edit": openDealForm(id); return true;
    case "deal-delete": if (D.deleteDeal(id)) toast("Oferta eliminada", undoAction); return true;
    case "deal-goto": gotoDeal(id); return true;
    case "deal-reserve":
      if (D.dealToReservation(id)) toast("Guardada en Reservas como pendiente", undoAction);
      return true;
    case "deal-analyze": {
      const d = state.deals.find((x) => x.id === id);
      if (d) copyText(buildAnalyzePrompt(d), "Análisis copiado: pégalo en tu chat con Claude");
      return true;
    }
    case "deal-refresh-prompt":
      copyText(buildRefreshPrompt(state.dealSettings, state.meta.destination), "Instrucción copiada: pégala en tu chat con Claude");
      return true;
    case "deal-export":
      copyText(JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), deals: state.deals, news: state.dealNews, discarded: state.dealDiscarded }, null, 2), "JSON copiado");
      return true;
    case "report-scope": S.setUi({ reportScope: el.dataset.scope }); return true;
    case "report-copy-mail": {
      const mail = buildEmailSummary(reportModel());
      copyText(`Asunto: ${mail.subject}\n\n${mail.body}`, "Asunto y resumen copiados");
      return true;
    }
    case "report-download": {
      const model = reportModel();
      const mail = buildEmailSummary(model);
      const url = URL.createObjectURL(new Blob([buildReportHtml(model, mail)], { type: "text/html;charset=utf-8" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: mail.filename });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(`Dashboard descargado: ${mail.filename}`);
      return true;
    }
    case "discarded-delete": if (D.deleteDiscarded(id)) toast("Descartado quitado", undoAction); return true;
    case "discarded-clear": if (D.clearDiscarded()) toast("Lista de descartados vacía", undoAction); return true;
    case "deal-purge": {
      const n = D.deleteExpiredDeals();
      toast(n ? `${n} ofertas vencidas eliminadas` : "No hay ofertas vencidas", n ? undoAction : undefined);
      return true;
    }
    case "deal-sync":
      toast("Sincronizando…");
      D.syncFeed().then((r) => toast(r.error ? r.error : `${r.count} ofertas leídas desde tu fuente`));
      return true;
    case "news-add": openNewsForm(); return true;
    case "news-edit": openNewsForm(id); return true;
    case "news-delete": if (D.deleteNews(id)) toast("Noticia eliminada", undoAction); return true;
    case "tool-copy": {
      const out = document.getElementById(`out-${el.dataset.tool}`);
      if (out && out.value) copyText(out.value, "Instrucción copiada: pégala en tu chat con Claude");
      return true;
    }
    default: return false;
  }
}

/* ------------------------------------------------------------------ */
/* Eventos                                                             */
/* ------------------------------------------------------------------ */

function onClick(ev) {
  const dealLink = ev.target.closest("[data-goto-deal]");
  if (dealLink) { ev.preventDefault(); go("ofertas"); gotoDeal(dealLink.dataset.gotoDeal); return; }
  const tabLink = ev.target.closest("a[data-deals-tab]");
  if (tabLink) { S.setUi({ dealsTab: tabLink.dataset.dealsTab }); }
  const openTrip = ev.target.closest("a[data-open-trip]");
  if (openTrip && S.switchTrip(openTrip.dataset.openTrip)) Sync.applyCache();
  const el = ev.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const { act, id } = el.dataset;
  if (act === "cloud-login") { openLogin(); return; }
  if (act === "cloud-logout") { doLogout(); return; }
  if (handleDealAction(act, el)) return;
  const day = el.dataset.day !== undefined ? Number(el.dataset.day) : undefined;

  switch (act) {
    case "undo": doUndo(); break;
    case "redo": doRedo(); break;
    case "theme": applyTheme(el.dataset.theme, true); break;
    case "mode-toggle": applyTheme(DARK_PAIR[state.theme] || "ui-noche", true); break;
    case "mymaps": exportToMyMaps(toast); break;
    case "collapse": {
      const key = el.dataset.sec;
      const collapsed = state.collapsed.includes(key) ? state.collapsed.filter((c) => c !== key) : [...state.collapsed, key];
      S.setUi({ collapsed });
      if (key === "mapa" && !collapsed.includes("mapa")) refreshMapSize();
      break;
    }
    case "planner": openPlanner(); break;
    case "share": openShare(); break;
    case "add-place": openPlaceForm({ dayIndex: day ?? state.activeDay, period: el.dataset.period }); break;
    case "sort-day":
      if (S.sortDay(state.activeDay)) toast("Día ordenado por bloque y hora", undoAction);
      else toast("No hay suficientes panoramas para ordenar");
      break;
    case "day": S.setUi({ activeDay: day }); updateWeather(); break;
    case "day-add": S.addDay(); toast("Día agregado", undoAction); break;
    case "day-rename": {
      const d = state.trips[state.activeDay];
      openForm({
        title: "Renombrar día", submitLabel: "Guardar",
        fields: [{ name: "name", label: "Nombre del día", value: d.name, required: true, full: true, maxlength: 80 }],
        onSubmit(v) { S.renameDay(state.activeDay, v.name); }
      });
      break;
    }
    case "day-delete": {
      const name = state.trips[state.activeDay].name;
      if (S.deleteDay(state.activeDay)) toast(`Eliminado: ${name}`, undoAction);
      break;
    }
    case "goto":
      S.setUi({ activeDay: day });
      go("viaje/itinerario");
      flashCard(id);
      break;
    case "trip-edit": openTripForm(); break;
    case "trip-delete": confirmDeleteTrip(el.dataset.trip); break;
    case "trip-public":
      S.setTripPublic(state.activeTripId, el.checked);
      Sync.onVisibilityChange(state.activeTripId);
      toast(el.checked ? "El viaje es visible para los visitantes" : "El viaje quedó privado");
      break;
    case "share-copy": {
      const input = document.getElementById("shareLinkInput");
      if (input) copyText(input.value, "Enlace copiado");
      break;
    }
    case "backup-export": downloadBackup(); break;
    case "place-edit": openPlaceForm({ id }); break;
    case "place-delete": {
      const name = S.findPlace(id)?.place.name;
      if (S.deletePlace(id)) toast(`Eliminado “${name}”`, undoAction);
      break;
    }
    case "move":
      if (!S.movePlace(id, Number(el.dataset.dir))) toast(Number(el.dataset.dir) < 0 ? "Ya está al inicio del día" : "Ya está al final del día");
      break;
    case "done": S.toggleDone(id); break;
    case "img-view": openImageViewer(id); break;
    case "img-edit": openImageEditor(id); break;
    case "map-layer": S.setUi({ mapLayer: el.dataset.layer }); break;
    case "goto-next": flashCard(id); break;
    case "plan-b": showPlanB(); break;
    case "pending-filter": S.setUi({ pendingFilter: el.dataset.filter }); break;
    case "pending-add": openPendingForm(); break;
    case "pending-edit": openPendingForm(id); break;
    case "pending-toggle": S.togglePending(id); break;
    case "pending-delete": if (S.deletePending(id)) toast("Pendiente eliminado", undoAction); break;
    case "res-add": openReservationForm(); break;
    case "res-edit": openReservationForm(id); break;
    case "res-delete": if (S.deleteReservation(id)) toast("Reserva eliminada", undoAction); break;
    case "doc-add": openDocumentForm(); break;
    case "doc-edit": openDocumentForm(id); break;
    case "doc-open": openDocument(id); break;
    case "doc-delete": if (S.deleteDocument(id)) toast("Documento eliminado", undoAction); break;
    case "idea-delete": if (S.deleteIdea(id)) toast("Idea eliminada", undoAction); break;
    case "vote": {
      const res = S.voteIdea(id, Number(el.dataset.dir));
      if (res === "promoted") toast("¡3 votos! La idea pasó al itinerario", undoAction);
      break;
    }
    case "budget-base": {
      openForm({
        title: "Presupuesto inicial", submitLabel: "Guardar",
        fields: [
          { name: "base", label: "Monto", type: "number", min: 0, step: "any", value: state.budget.base, required: true },
          { name: "currency", label: "Moneda", type: "select", options: Object.keys(CURRENCIES), value: state.budget.currency }
        ],
        onSubmit(v) {
          if (!S.setBudgetBase(v.base, v.currency)) return "Ingresa un monto válido (0 o más).";
          toast("Presupuesto actualizado", undoAction);
          return null;
        }
      });
      break;
    }
    case "budget-reset": if (S.resetBudget()) toast("Presupuesto reiniciado", undoAction); break;
    case "move-delete": if (S.deleteBudgetMove(id)) toast("Movimiento eliminado", undoAction); break;
    case "person-remove": {
      const res = S.removePerson(id);
      if (res === "in-use") toast("No se puede quitar: tiene gastos registrados. Elimina esos gastos primero.");
      else if (res === "last") toast("Debe quedar al menos un viajero.");
      break;
    }
    case "gx-delete": if (S.deleteGroupExpense(id)) toast("Gasto eliminado", undoAction); break;
    default: break;
  }
}

function formError(form, msg) {
  let box = form.querySelector(".form-error");
  if (!box) return toast(msg);
  box.textContent = msg;
  box.hidden = !msg;
  return undefined;
}

function onSubmit(ev) {
  const form = ev.target.closest("form[data-form]");
  if (!form) return;
  ev.preventDefault();
  const f = new FormData(form);
  formError(form, "");
  switch (form.dataset.form) {
    case "deal-tool": {
      const tool = TOOLS.find((t) => t.id === form.dataset.tool);
      const values = Object.fromEntries(tool.fields.map(([key]) => [key, String(f.get(key) || "").trim()]));
      const res = buildToolPrompt(tool, values);
      if (res.error) { formError(form, res.error); return; }
      const out = form.querySelector(".tool-out");
      out.hidden = false;
      out.querySelector("textarea").value = res.prompt;
      out.querySelector("textarea").focus();
      break;
    }
    case "deal-rules": {
      const target = toNumber(f.get("targetPrice"));
      if (!Number.isFinite(target) || target < 1000) { formError(form, "El precio objetivo debe ser de al menos $1.000."); return; }
      D.setDealSettings({ targetPrice: target, lastMinuteDays: Number(f.get("lastMinuteDays")) });
      toast("Reglas de alerta guardadas");
      break;
    }
    case "deal-import": {
      const res = D.importDealsText(String(f.get("json") || ""));
      if (res.error) { formError(form, res.error); return; }
      form.reset();
      toast(`Importadas: ${res.added} nuevas, ${res.updated} actualizadas, ${res.newsAdded} noticias${res.discardedAdded ? `, ${res.discardedAdded} descartes registrados` : ""}${res.skipped ? `, ${res.skipped} inválidas` : ""}`, undoAction);
      S.setUi({ dealsTab: "ofertas" });
      break;
    }
    case "deal-feed": {
      const url = String(f.get("feedUrl") || "").trim();
      if (url && !safeHttpUrl(url)) { formError(form, "La URL debe empezar con https://"); return; }
      const mail = String(f.get("reportEmail") || "").trim();
      if (mail && !/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(mail)) { formError(form, "Revisa el correo: debe tener el formato nombre@dominio.cl"); return; }
      D.setDealSettings({ feedUrl: url, homeCity: String(f.get("homeCity") || ""), reportEmail: mail });
      toast(url ? "Fuente guardada" : "Preferencias guardadas");
      if (url) D.syncFeed().then((r) => toast(r.error ? r.error : `${r.count} ofertas leídas desde tu fuente`));
      break;
    }
    case "budget": {
      const type = ev.submitter?.value === "add" ? "add" : "expense";
      const amount = toNumber(f.get("amount"));
      if (!Number.isFinite(amount) || amount <= 0) { formError(form, "Ingresa un monto mayor que 0."); return; }
      S.addBudgetMove(type, amount, f.get("concept"), f.get("currency"));
      form.reset();
      form.elements.currency.value = state.budget.currency;
      toast(type === "add" ? "Monto agregado al presupuesto" : "Gasto registrado", undoAction);
      break;
    }
    case "idea": {
      const name = String(f.get("name") || "").trim();
      if (!name) { formError(form, "Escribe el nombre del lugar."); return; }
      S.addIdea({ name, category: f.get("category"), targetDay: Number(f.get("targetDay")), context: f.get("context") });
      form.reset();
      toast("Idea guardada", undoAction);
      break;
    }
    case "person": {
      const name = String(f.get("name") || "").trim();
      if (!name) { formError(form, "Escribe un nombre."); return; }
      if (!S.addPerson(name)) { formError(form, "Ese viajero ya existe."); return; }
      form.reset();
      break;
    }
    case "gx": {
      const amount = toNumber(f.get("amount"));
      const participantIds = f.getAll("participants").map(String);
      if (!Number.isFinite(amount) || amount <= 0) { formError(form, "Ingresa un monto mayor que 0."); return; }
      if (!participantIds.length) { formError(form, "Elige al menos una persona para dividir."); return; }
      S.addGroupExpense({ concept: f.get("concept"), amount, category: f.get("category"), payerId: String(f.get("payer")), participantIds });
      form.elements.concept.value = "";
      form.elements.amount.value = "";
      toast("Gasto compartido registrado", undoAction);
      break;
    }
    default: break;
  }
}

function onChange(ev) {
  const t = ev.target;
  if (t.id === "tripSwitch") {
    if (!state.route.startsWith("viaje/")) { if (S.switchTrip(t.value)) Sync.applyCache(); applyHash({ scroll: false }); return; }
    location.hash = `#/viajes/${encodeURIComponent(t.value)}/${state.route.slice(6)}`;
    return;
  }
  if (t.matches("[data-act-change='backup-import']")) { restoreBackup(t.files && t.files[0]); t.value = ""; return; }
  if (t.id === "dealStatus") { D.setDealFilter({ status: t.value }); return; }
  if (t.id === "dealMine") { D.setDealFilter({ mine: t.checked }); return; }
  if (t.matches("[data-deal-alert]")) { D.setDealSettings({ alerts: { [t.dataset.dealAlert]: t.checked } }); return; }
  if (t.id === "budgetCurrency") {
    // La moneda del formulario solo etiqueta el movimiento; no convierte montos.
    return;
  }
  if (t.matches("textarea[data-note]")) {
    const id = t.dataset.note;
    S.setNote(id, t.value, noteSnapshots.get(id) || S.snapshot());
    noteSnapshots.set(id, S.snapshot());
    renderHistory();
  }
}

const noteSnapshots = new Map();
const persistNotes = debounce(() => S.persist(["notes"]), 400);

function onFocusIn(ev) {
  const t = ev.target;
  if (t.matches?.("textarea[data-note]")) noteSnapshots.set(t.dataset.note, S.snapshot());
}
const searchDeals = debounce((q) => D.setDealFilter({ q }), 250);
function onInput(ev) {
  const t = ev.target;
  if (t.id === "dealSearch") { searchDeals(t.value); return; }
  if (t.matches("textarea[data-note]")) {
    state.notes = { ...state.notes, [t.dataset.note]: t.value };
    persistNotes();
  }
}

function onKeyDown(ev) {
  const mod = ev.ctrlKey || ev.metaKey;
  const typing = ev.target.closest?.("input, textarea, select, [contenteditable]");
  if (mod && !typing && !document.getElementById("modal").open) {
    const k = ev.key.toLowerCase();
    if (k === "z" && !ev.shiftKey) { ev.preventDefault(); doUndo(); return; }
    if (k === "y" || (k === "z" && ev.shiftKey)) { ev.preventDefault(); doRedo(); return; }
  }
  // Flechas en listas de pestañas.
  if ((ev.key === "ArrowRight" || ev.key === "ArrowLeft") && ev.target.getAttribute?.("role") === "tab") {
    const tabs = [...ev.target.closest("[role=tablist]").querySelectorAll("[role=tab]")];
    const i = tabs.indexOf(ev.target);
    const next = tabs[(i + (ev.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    if (next) { ev.preventDefault(); next.focus(); }
  }
}

function onImageError(ev) {
  const img = ev.target;
  if (img.tagName === "IMG" && img.dataset.ph && img.src !== img.dataset.ph) img.src = img.dataset.ph;
}

/* ------------------------------------------------------------------ */
/* Tema, navegación y arranque                                         */
/* ------------------------------------------------------------------ */

const THEME_COLORS = { claro: "#f3f5fb", noche: "#0e141c", arena: "#f3f0ea", factory: "#101010", seline: "#fafaf9", steep: "#ffffff", ui: "#f5f5f5", "ui-noche": "#0a0a0a" };
// El tema Factory usa Geist y Geist Mono: se cargan solo cuando se elige ese tema.
// Los temas Factory, Seline, Steep y UI traen su propia tipografía: se carga solo al elegirlos.
const THEME_FONTS = {
  factory: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500&family=Geist+Mono:wght@400&display=swap",
  seline: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:wght@400;500&display=swap",
  steep: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;1,8..60,400&display=swap",
  ui: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap",
  "ui-noche": "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap"
};
function loadThemeFonts(t) {
  if (!THEME_FONTS[t] || document.getElementById(`fonts-${t}`)) return;
  document.head.append(Object.assign(document.createElement("link"), { id: `fonts-${t}`, rel: "stylesheet", href: THEME_FONTS[t] }));
}
// Pareja claro ↔ oscuro de cada tema (los temas sin pareja pasan a UI oscuro / UI).
const DARK_PAIR = { ui: "ui-noche", "ui-noche": "ui", claro: "noche", noche: "claro", factory: "ui", arena: "noche", seline: "ui-noche", steep: "ui-noche" };
const DARK_THEMES = ["ui-noche", "noche", "factory"];
function renderModeToggle(t) {
  const b = document.getElementById("modeToggle");
  if (!b) return;
  const dark = DARK_THEMES.includes(t);
  b.innerHTML = icon(dark ? "sun" : "moon", 20);
  b.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
}
// Si el entorno (p. ej. el visor de artifacts) escribe su propio data-theme ("dark"/"light"),
// se restaura el tema elegido en la app.
new MutationObserver(() => {
  const cur = document.documentElement.dataset.theme;
  if (cur !== state.theme && !THEME_COLORS[cur]) applyTheme(state.theme, false);
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
function applyTheme(theme, save) {
  const t = THEME_COLORS[theme] ? theme : "ui";
  document.documentElement.dataset.theme = t;
  loadThemeFonts(t);
  renderModeToggle(t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[t]);
  document.querySelectorAll("[data-act='theme']").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.theme === t)));
  if (save) S.setUi({ theme: t }, { render: false });
}

/* ------------------------------------------------------------------ */
/* Base central: barra de estado e inicio de sesión del administrador  */
/* ------------------------------------------------------------------ */

const CLOUD_LABELS = {
  idle: "Base central", loading: "Sincronizando…", saving: "Guardando…", saved: "Guardado en la base",
  pending: "Cambios pendientes", error: "Sin conexión con la base"
};
function renderCloudBar() {
  const bar = document.getElementById("cloudBar");
  const note = document.getElementById("sidebarNote");
  if (!bar) return;
  const c = state.cloud;
  if (c.mode !== "cloud" || state.shareMode) { bar.hidden = true; return; }
  bar.hidden = false;
  const time = c.lastSync ? new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit" }).format(new Date(c.lastSync)) : "";
  const pill = `<span class="cloud-pill" data-status="${c.status}" title="${e(c.message || "")}">${e(CLOUD_LABELS[c.status] || "")}${c.status === "saved" && time ? ` · ${time}` : ""}</span>`;
  const html = c.role === "admin"
    ? `${pill}<span class="cloud-user">Administrador: ${e(c.user)}</span><button type="button" class="link-btn" data-act="cloud-logout">Salir</button>`
    : `<span class="cloud-pill" data-status="${c.status === "error" ? "error" : "saved"}">Vista pública</span><button type="button" class="link-btn" data-act="cloud-login">Iniciar sesión</button>`;
  if (bar.dataset.html !== html) { bar.innerHTML = html; bar.dataset.html = html; }
  if (c.message && (c.status === "error" || c.status === "pending") && bar.dataset.msg !== c.message) { bar.dataset.msg = c.message; toast(c.message); }
  if (c.status === "saved") bar.dataset.msg = "";
  if (note) note.innerHTML = c.role === "admin"
    ? "Los datos se guardan en la base central: los ves iguales en cualquier dispositivo al iniciar sesión."
    : "";
}

function openLogin() {
  openForm({
    title: "Iniciar sesión",
    intro: "Acceso del administrador. Los visitantes ven el itinerario y las ofertas sin iniciar sesión.",
    submitLabel: "Entrar",
    fields: [
      { name: "email", label: "Correo", type: "email", required: true, full: true, autocomplete: "username", maxlength: 120 },
      { name: "password", label: "Contraseña", type: "password", required: true, full: true, autocomplete: "current-password", maxlength: 200 }
    ],
    async onSubmit(v) {
      const res = await Sync.login(String(v.email || "").trim(), String(v.password || ""));
      if (res.error) return res.error;
      toast("Sesión iniciada: los cambios se guardan en la base central");
      return null;
    }
  });
}

async function doLogout() {
  let res = await Sync.logout();
  if (res.error) {
    if (!window.confirm(`${res.error}\n\n¿Salir igual?`)) return;
    res = await Sync.logout({ force: true });
  }
  toast("Sesión cerrada. Los datos privados se borraron de este navegador.");
}

function buildBottomNav() {
  const target = document.getElementById("bottomNav");
  if (!target) return;
  const link = (route, ico, label, cls = "") => `<a href="#/${route}" data-route="${route}"${cls ? ` class="${cls}"` : ""}><span class="nav-icon" aria-hidden="true">${icon(ico, 20)}</span><span class="nav-label">${label}</span></a>`;
  target.innerHTML = link("inicio", "inicio", "Inicio") + link("viajes", "viajes", "Viajes")
    + link("viaje/itinerario", "itinerario", "Itinerario") + link("ofertas", "ofertas", "Ofertas") + link("menu", "menu", "Menú");
}

/* Datos del viaje, eliminar viaje y respaldo ---------------------------- */

function openTripForm() {
  const entry = state.tripIndex.find((t) => t.id === state.activeTripId) || {};
  const cloud = Sync.cloudMode();
  openForm({
    title: "Datos del viaje",
    submitLabel: "Guardar",
    fields: [
      { name: "destination", label: "Destino", value: state.meta.destination, required: true, full: true, maxlength: 80 },
      { name: "country", label: "País", value: state.meta.country, maxlength: 60 },
      { name: "style", label: "Estilo", type: "select", options: STYLES, value: state.meta.style },
      { name: "startDate", label: "Fecha de inicio", type: "date", value: state.meta.startDate || "", hint: "Con fecha, el itinerario abre en el día de hoy mientras dura el viaje." },
      ...(cloud ? [{ name: "isPublic", label: "Visible para los visitantes (itinerario, mapa y lugares)", type: "checkbox", full: true, value: Boolean(entry.isPublic) }] : [])
    ],
    onSubmit(v) {
      if (v.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(v.startDate)) return "Revisa la fecha.";
      const wasPublic = Boolean(entry.isPublic);
      S.updateTripInfo({ destination: v.destination, country: v.country, style: v.style, startDate: v.startDate || "", isPublic: cloud ? v.isPublic : undefined });
      if (cloud && v.isPublic !== wasPublic) Sync.onVisibilityChange(state.activeTripId);
      toast("Datos del viaje guardados", undoAction);
      return null;
    }
  });
}

function confirmDeleteTrip(id) {
  const t = state.tripIndex.find((x) => x.id === id);
  if (!t) return;
  openDialog({
    title: "Eliminar viaje",
    body: `<p>Se eliminará <strong>${e(t.destination)}</strong> con su itinerario, reservas, documentos, gastos y pendientes${Sync.cloudMode() ? ", también de la base central" : ""}. No se puede deshacer.</p>`,
    footer: `<span class="spacer"></span><button type="button" class="btn" data-close>Cancelar</button><button type="button" class="btn btn-danger" data-confirm>Eliminar viaje</button>`,
    mount(root, close) {
      root.querySelector("[data-confirm]").addEventListener("click", async () => {
        close();
        if (S.deleteTrip(id)) {
          await Sync.deleteTripRemote(id);
          Sync.applyCache();
          toast(`Viaje a ${t.destination} eliminado`);
          applyHash({ scroll: false });
        }
      });
    }
  });
}

function downloadBackup() {
  const keys = {};
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("ba_") && k !== "ba_cloud_session_v1").forEach((k) => { keys[k] = localStorage.getItem(k); });
  } catch { toast("No se pudo leer el almacenamiento de este navegador."); return; }
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
  const blob = new Blob([JSON.stringify({ app: "ruta-ba", version: 2, exportedAt: new Date().toISOString(), keys }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `ruta-ba-respaldo-${day}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast("Respaldo descargado");
}

async function restoreBackup(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast("El archivo no es un respaldo válido."); return; }
  if (!data || data.app !== "ruta-ba" || typeof data.keys !== "object") { toast("El archivo no es un respaldo de Travel OS."); return; }
  const entries = Object.entries(data.keys).filter(([k, v]) => /^ba_[\w@-]{1,80}$/.test(k) && typeof v === "string" && k !== "ba_cloud_session_v1");
  if (!window.confirm(`Se reemplazarán los datos de este navegador con ${entries.length} secciones del respaldo. ¿Continuar?`)) return;
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("ba_") && k !== "ba_cloud_session_v1").forEach((k) => localStorage.removeItem(k));
    entries.forEach(([k, v]) => localStorage.setItem(k, v));
  } catch { toast("No se pudo escribir en este navegador."); return; }
  location.reload();
}

async function init() {
  S.loadState();
  const share = readShareHash();
  if (share === "ok") {
    state.travelMode = false;
    state.route = "compartido";
    document.body.classList.add("share-mode");
    document.getElementById("shareBanner").hidden = false;
  }
  applyTheme(state.theme, false);
  // Enlaces "inicio" relativos a donde esté alojada la app (Vercel, artifact, subcarpeta).
  document.querySelectorAll("a[data-home]").forEach((a) => { a.href = location.pathname + location.search; });
  buildBottomNav();
  initDashboard(go);

  S.subscribe((event) => {
    if (event.type === "error") { toast(event.message); return; }
    if (event.type === "commit" && event.render === false) { renderHistory(); return; }
    renderApp();
    renderCloudBar();
  });
  // Base central: decide rol (visitante/administrador) antes del primer render; la descarga sigue en segundo plano.
  const cloudReady = Sync.startCloud(() => { applyHash({ scroll: false }); renderApp(); renderCloudBar(); });
  applyHash({ scroll: false });

  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  document.addEventListener("change", onChange);
  document.addEventListener("input", onInput);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("error", onImageError, true);
  window.addEventListener("hashchange", () => {
    if (location.hash.startsWith("#share=") !== state.shareMode) { location.reload(); return; }
    applyHash();
  });

  renderApp();
  renderCloudBar();
  document.body.classList.add("is-ready");

  if (share === "invalid") toast("El enlace compartido no es válido. Se muestra tu viaje.");

  if (!state.shareMode) {
    const search = document.getElementById("dealSearch");
    if (search) search.value = state.dealFilter.q;
    if (state.dealSettings.feedUrl) D.syncFeed({ silent: true });
    if (!Sync.cloudMode()) {
      // Modo local: imágenes y archivos viven en IndexedDB de este navegador.
      const ids = new Set(state.trips.flatMap((d) => d.items.map((p) => p.id)));
      await loadStoredImages(ids);
      renderApp();
    } else {
      await cloudReady;
    }
  }
  updateWeather();
}

init();
