// Renderizado: una sola función por vista, siempre desde el estado central.
import { icon } from "./icons.js";
import { renderDashboardShell } from "./views-dash.js";
import {
  state, history, orderedItems, totalPlaces, budgetTotals, computeDebts, PROMOTE_AT, tripTiming
} from "./store.js";
import {
  CAT_SLUG, PERIODS, PRIORITIES, CATEGORIES, CURRENCIES, EXPENSE_CATEGORIES,
  escapeHtml as e, mapsSearchUrl, mapsDirUrl, wazeUrl, placeholderSvg, fmtMoney,
  fmtDateTime, fmtBytes, safeHttpUrl, hasCoords
} from "./util.js";
import { imageSrc } from "./media.js";
import { renderMap } from "./map.js";
import { renderDeals } from "./deals-view.js";
import { renderControl } from "./views-control.js";

const lastHtml = new Map();
function setHTML(id, html) {
  const el = document.getElementById(id);
  if (!el || lastHtml.get(id) === html) return;
  lastHtml.set(id, html);
  el.innerHTML = html;
}
function setText(id, text) {
  const el = document.getElementById(id);
  if (el && el.textContent !== String(text)) el.textContent = text;
}

// Estado transitorio de la franja del día (clima y Plan B; no se persiste).
export const todayInfo = { weatherKey: "", weather: { status: "idle" }, planB: null };

const PERIOD_GLYPH = { "Mañana": "☀", "Tarde": "◐", "Noche": "☾" };
const PRIORITY_SLUG = { Imprescindible: "must", Alta: "high", Media: "mid", Normal: "normal" };
const dest = () => state.meta.destination;
const isCollapsed = (id) => state.collapsed.includes(id);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ------------------------------------------------------------------ */
/* Piezas reutilizables                                                */
/* ------------------------------------------------------------------ */

export function thumb(p, size, editable = true) {
  const ph = placeholderSvg(p.name, p.category);
  return `<div class="thumb-wrap" style="--thumb:${size}px">
    <button type="button" class="thumb" data-act="img-view" data-id="${p.id}" aria-label="Ver imagen de ${e(p.name)}">
      <img src="${e(imageSrc(p))}" data-ph="${e(ph)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">
    </button>
    ${editable ? `<button type="button" class="thumb-edit admin" data-act="img-edit" data-id="${p.id}" data-fk="img-${p.id}" aria-label="Cambiar imagen de ${e(p.name)}" title="Cambiar imagen">✎</button>` : ""}
  </div>`;
}

export function nameLink(p) {
  return `<a href="${e(mapsSearchUrl(p, dest()))}" target="_blank" rel="noopener">${e(p.name)}</a>`;
}

export function catBadge(category) {
  return `<span class="badge" data-cat="${CAT_SLUG[category]}">${e(category)}</span>`;
}

export function quickLinks(p, big = false, fkSuffix = big ? "-t" : "") {
  const done = Boolean(state.doneItems[p.id]);
  const cls = big ? "chip-link chip-big" : "chip-link";
  return `<div class="quick-links">
    <a class="${cls}" href="${e(mapsDirUrl(p, dest()))}" target="_blank" rel="noopener">Cómo llegar</a>
    <a class="${cls}" href="${e(wazeUrl(p, dest()))}" target="_blank" rel="noopener">Waze</a>
    <button type="button" class="${cls} done-btn admin" data-act="done" data-id="${p.id}" data-fk="done-${p.id}${fkSuffix}" aria-pressed="${done}">
      ${done ? "↶ Reabrir" : "✓ Hecho"}</button>
  </div>`;
}

/* Itinerario en tabla ------------------------------------------------- */

const COLS = 9;
function rowActions(p, menuSuffix) {
  const btns = (sfx) => `
    <button type="button" class="icon-btn" data-act="move" data-dir="-1" data-id="${p.id}" data-fk="up-${p.id}${sfx}" aria-label="Subir ${e(p.name)}" title="Subir">↑</button>
    <button type="button" class="icon-btn" data-act="move" data-dir="1" data-id="${p.id}" data-fk="down-${p.id}${sfx}" aria-label="Bajar ${e(p.name)}" title="Bajar">↓</button>
    <button type="button" class="icon-btn" data-act="place-edit" data-id="${p.id}" data-fk="edit-${p.id}${sfx}" aria-label="Editar ${e(p.name)}" title="Editar">✎</button>
    <button type="button" class="icon-btn" data-act="img-edit" data-id="${p.id}" data-fk="img-${p.id}${sfx}" aria-label="Cambiar imagen de ${e(p.name)}" title="Cambiar imagen">▣</button>
    <button type="button" class="icon-btn danger" data-act="place-delete" data-id="${p.id}" aria-label="Eliminar ${e(p.name)}" title="Eliminar">×</button>`;
  return `<div class="act-links">
      <a class="icon-btn" href="${e(mapsDirUrl(p, dest()))}" target="_blank" rel="noopener" aria-label="Cómo llegar a ${e(p.name)} (Google Maps)" title="Cómo llegar">⌖</a>
      <a class="icon-btn act-waze" href="${e(wazeUrl(p, dest()))}" target="_blank" rel="noopener" aria-label="Abrir ${e(p.name)} en Waze" title="Waze">W</a>
      <details class="act-menu admin"><summary aria-label="Acciones de ${e(p.name)}" title="Mover, editar o eliminar">⋯</summary><div class="act-menu-list" role="group" aria-label="Acciones de ${e(p.name)}">${btns(menuSuffix)}</div></details>
    </div>`;
}

function itinRow(p, n, dayIndex, nextId, { compact = false } = {}) {
  const done = Boolean(state.doneItems[p.id]);
  const note = state.notes[p.id] || "";
  const time = p.time ? `${e(p.time)}${p.fixedTime ? ` <span class="fixed" title="Hora fija">●</span>` : ""}` : `<span class="muted">—</span>`;
  const meta = [p.category, p.duration, p.transport, p.priority].filter(Boolean).map(e).join(" · ");
  return `<tr class="itin-row${done ? " is-done" : ""}${p.id === nextId ? " is-next" : ""}" id="card-${p.id}" data-cat="${CAT_SLUG[p.category]}">
    <td class="c-num">${n}</td>
    <td class="c-time">${time}</td>
    <td class="c-place">
      <div class="place-cell">
        ${thumb(p, 40, false)}
        <div class="place-text">
          <p class="place-name">${p.id === nextId ? `<span class="next-badge">Ahora</span>` : ""}${nameLink(p)}</p>
          ${p.context ? `<p class="place-context">${e(p.context)}</p>` : ""}
          <p class="place-meta-m">${meta}</p>
          ${!compact && note ? `<p class="place-note">${e(note)}</p>` : ""}
          ${compact ? "" : `<details class="note-edit admin"${note ? "" : ""}><summary>${note ? "Editar observación" : "+ Observación"}</summary>
            <textarea class="input" rows="2" data-note="${p.id}" data-day="${dayIndex}" maxlength="2000" aria-label="Observaciones de ${e(p.name)}"
              placeholder="Ej.: entrada comprada, llegar 15 min antes">${e(note)}</textarea></details>`}
        </div>
      </div>
    </td>
    <td class="c-cat">${catBadge(p.category)}</td>
    <td class="c-dur">${e(p.duration || "—")}</td>
    <td class="c-tr">${e(p.transport || "—")}</td>
    <td class="c-prio"><span class="prio" data-prio="${PRIORITY_SLUG[p.priority]}">${e(p.priority)}</span></td>
    <td class="c-done">
      <button type="button" class="done-toggle admin" data-act="done" data-id="${p.id}" data-fk="done-${p.id}${compact ? "-h" : ""}" aria-pressed="${done}" aria-label="${done ? "Reabrir" : "Marcar como hecho"}: ${e(p.name)}" title="${done ? "Reabrir" : "Marcar como hecho"}">${done ? "✓" : ""}</button>
      <span class="done-text viewer-only">${done ? "✓" : ""}</span>
    </td>
    <td class="c-act">${rowActions(p, compact ? "-hm" : "-m")}</td>
  </tr>`;
}

/** Tabla de un día: una fila por panorama, agrupada por bloque (mañana / tarde / noche). */
export function itineraryTable(dayIndex, { compact = false } = {}) {
  const day = state.trips[dayIndex];
  if (!day) return "";
  const items = orderedItems(day);
  const nextId = items.find((p) => !state.doneItems[p.id])?.id;
  let n = 0;
  const body = PERIODS.map((period) => {
    const list = items.filter((p) => p.period === period);
    return `<tbody class="period" data-period="${period}">
      <tr class="period-row"><th colspan="${COLS}" scope="rowgroup">
        <span aria-hidden="true">${PERIOD_GLYPH[period]}</span> ${period} <span class="count">${list.length}</span>
        <button type="button" class="link-btn admin" data-act="add-place" data-day="${dayIndex}" data-period="${period}" aria-label="Agregar a la ${period.toLowerCase()}">+ Agregar</button>
      </th></tr>
      ${list.length ? list.map((p) => itinRow(p, ++n, dayIndex, nextId, { compact })).join("")
        : `<tr class="empty-row"><td colspan="${COLS}">Nada planeado para la ${period.toLowerCase()}.</td></tr>`}
    </tbody>`;
  }).join("");
  return `<div class="table-wrap"><table class="itin-table${compact ? " is-compact" : ""}">
    <caption class="visually-hidden">Itinerario del día ${dayIndex + 1}: ${e(day.name)}</caption>
    <thead><tr>
      <th scope="col" class="c-num">#</th><th scope="col" class="c-time">Hora</th><th scope="col" class="c-place">Lugar</th>
      <th scope="col" class="c-cat">Categoría</th><th scope="col" class="c-dur">Duración</th><th scope="col" class="c-tr">Traslado</th>
      <th scope="col" class="c-prio">Prioridad</th><th scope="col" class="c-done">Hecho</th><th scope="col" class="c-act"><span class="visually-hidden">Acciones</span></th>
    </tr></thead>${body}</table></div>`;
}

function emptyState(text, action = "") {
  return `<div class="empty"><p>${text}</p>${action}</div>`;
}

/* ------------------------------------------------------------------ */
/* Cabecera, historial y estructura                                    */
/* ------------------------------------------------------------------ */

export function renderHeader() {
  const days = state.trips.length;
  const places = totalPlaces();
  setText("tripKicker", `Viaje · ${state.meta.country || state.meta.destination}`);
  const entry = state.tripIndex.find((t) => t.id === state.activeTripId);
  const timing = entry ? tripTiming(entry) : null;
  const fmtD = (iso) => new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  setText("tripDates", state.meta.startDate && timing?.endDate ? `${fmtD(state.meta.startDate)} – ${fmtD(timing.endDate)} · ${timing.label}` : "Sin fecha de inicio: agrégala en ✎ Datos del viaje para ver la cuenta regresiva y abrir el itinerario en el día de hoy");
  setText("tripTitle", state.meta.destination);
  setText("tripDaysCount", plural(days, "día", "días"));
  setText("tripPlacesCount", plural(places, "lugar", "lugares"));
  setText("tripStyle", `Estilo ${state.meta.style.toLowerCase()}`);
  const demo = document.getElementById("demoBadge");
  if (demo) demo.hidden = !state.meta.isDemo || state.shareMode;
  document.title = state.shareMode
    ? `${state.meta.destination} · Itinerario compartido — Travel OS`
    : document.title;
}

export function renderHistory() {
  const u = document.getElementById("undoBtn");
  const r = document.getElementById("redoBtn");
  if (!u || !r) return;
  const lastU = history.undo[history.undo.length - 1];
  const lastR = history.redo[history.redo.length - 1];
  u.disabled = !lastU;
  r.disabled = !lastR;
  u.title = lastU ? `Deshacer: ${lastU.label} (Ctrl+Z)` : "Nada para deshacer";
  r.title = lastR ? `Rehacer: ${lastR.label} (Ctrl+Y)` : "Nada para rehacer";
  u.setAttribute("aria-label", u.title);
  r.setAttribute("aria-label", r.title);
  setText("historyLabel", lastU ? `Último cambio: ${lastU.label}` : "Sin cambios en esta sesión");
}

export function renderSections() {
  document.querySelectorAll(".section[data-section]").forEach((sec) => {
    const id = sec.dataset.section;
    const collapsed = isCollapsed(id);
    const body = sec.querySelector(".section-body");
    const btn = sec.querySelector("[data-act='collapse']");
    sec.classList.toggle("is-collapsed", collapsed);
    if (body) body.hidden = collapsed;
    if (btn) {
      btn.setAttribute("aria-expanded", String(!collapsed));
      const name = sec.querySelector("h2")?.textContent || "";
      btn.setAttribute("aria-label", `${collapsed ? "Desplegar" : "Contraer"} ${name}`);
      btn.title = collapsed ? "Desplegar" : "Contraer";
      btn.textContent = collapsed ? "⌄" : "⌃";
    }
  });
  document.body.classList.toggle("travel-mode", state.travelMode);
}

/* ------------------------------------------------------------------ */
/* Resumen                                                             */
/* ------------------------------------------------------------------ */

export function renderDashboard() {
  const all = state.trips.flatMap((d) => d.items);
  const total = all.length;
  const scheduled = all.filter((p) => p.time).length;
  const pct = total ? Math.round((scheduled / total) * 100) : 0;
  const musts = all.filter((p) => p.priority === "Imprescindible");
  const mustDays = new Set(state.trips.map((d, i) => (d.items.some((p) => p.priority === "Imprescindible") ? i : -1)).filter((i) => i >= 0)).size;
  const activeRes = state.reservations.filter((r) => r.status !== "Cancelada");
  const confirmed = activeRes.filter((r) => r.status === "Confirmada").length;
  const pendingRes = activeRes.filter((r) => r.status === "Pendiente").length;
  const b = budgetTotals();
  const open = state.pending.filter((p) => !p.done).length;
  const doneCount = all.filter((p) => state.doneItems[p.id]).length;

  const usedPct = b.base + b.added > 0 ? Math.round((b.spent / (b.base + b.added)) * 100) : 0;
  const stat = (tone, ico, label, value, badge, badgeTone, sub, extra = "", valueCls = "") => `
    <div class="stat" data-tone="${tone}">
      <div class="stat-top"><span class="stat-icon">${icon(ico, 20)}</span><p class="stat-label">${label}</p></div>
      <div class="stat-row"><p class="stat-value${valueCls}">${value}</p>${badge ? `<span class="stat-badge" data-tone="${badgeTone}">${badge}</span>` : ""}</div>
      ${extra}<p class="stat-sub">${sub}</p>
    </div>`;
  setHTML("dashboard",
    stat("plan", "clock", "Planificación", `${pct}%`, `${doneCount} hechos`, "ok", `${scheduled} de ${total} con horario`,
      `<div class="meter" role="progressbar" aria-label="Panoramas con horario" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>`)
    + stat("places", "star", "Imprescindibles", musts.length, musts.length ? plural(mustDays, "día", "días") : "", "info",
      musts.length ? `repartidos en ${plural(mustDays, "día", "días")}` : "Marca con prioridad “Imprescindible” lo que no te puedes perder")
    + stat("reservations", "reservas", "Reservas", `${confirmed} / ${activeRes.length}`, pendingRes ? `${pendingRes} por confirmar` : activeRes.length ? "Al día" : "", pendingRes ? "warn" : "ok",
      pendingRes ? `${plural(pendingRes, "pendiente", "pendientes")} de confirmar` : activeRes.length ? "Todo confirmado" : "Sin reservas registradas")
    + stat("budget", "presupuesto", "Presupuesto disponible", e(fmtMoney(b.available, b.currency)), `${usedPct}% usado`, b.available < 0 ? "bad" : usedPct >= 80 ? "warn" : "ok",
      `Gastado ${e(fmtMoney(b.spent, b.currency))} de ${e(fmtMoney(b.base + b.added, b.currency))}`, "", b.available < 0 ? " is-negative" : ""));
  const entry = state.tripIndex.find((t) => t.id === state.activeTripId);
  const timing = entry ? tripTiming(entry) : null;
  setText("resumenTrip", state.meta.destination);
  setText("sub-resumen", `${timing && timing.key !== "nodate" ? `${timing.label} · ` : ""}${plural(open, "pendiente abierto", "pendientes abiertos")} · ${doneCount} de ${total} panoramas hechos`);
}

/* ------------------------------------------------------------------ */
/* Acciones pendientes                                                 */
/* ------------------------------------------------------------------ */

export function renderPending() {
  const f = state.pendingFilter;
  const open = state.pending.filter((p) => !p.done);
  const done = state.pending.filter((p) => p.done);
  const list = f === "open" ? open : f === "done" ? done : state.pending;
  const sorted = [...list].sort((a, b) => Number(a.done) - Number(b.done) || (a.priority === "Importante" ? -1 : 0) - (b.priority === "Importante" ? -1 : 0));
  const tab = (key, label) => `<button type="button" role="tab" class="tab" data-act="pending-filter" data-filter="${key}" data-fk="pf-${key}" aria-selected="${f === key}">${label}</button>`;
  setHTML("pendingTabs", `${tab("open", `Pendientes · ${open.length}`)}${tab("all", `Todas · ${state.pending.length}`)}${tab("done", `Completadas · ${done.length}`)}`);
  setHTML("pendingList", sorted.length ? `<ul class="rows">${sorted.map((p) => `
    <li class="row${p.done ? " is-done" : ""}">
      <button type="button" class="check" data-act="pending-toggle" data-id="${p.id}" data-fk="pt-${p.id}" aria-pressed="${p.done}" aria-label="${p.done ? "Reabrir" : "Completar"}: ${e(p.text)}" title="${p.done ? "Reabrir" : "Completar"}">${p.done ? "✓" : ""}</button>
      <span class="row-text">${e(p.text)}</span>
      ${p.priority === "Importante" ? `<span class="badge badge-alert">Importante</span>` : ""}
      <span class="row-actions">
        <button type="button" class="icon-btn" data-act="pending-edit" data-id="${p.id}" data-fk="pe-${p.id}" aria-label="Editar pendiente" title="Editar">✎</button>
        <button type="button" class="icon-btn danger" data-act="pending-delete" data-id="${p.id}" aria-label="Eliminar pendiente" title="Eliminar">×</button>
      </span>
    </li>`).join("")}</ul>`
    : emptyState(f === "done" ? "Aún no completas ninguna acción." : "No hay acciones pendientes. Agrega lo que falta resolver antes del viaje."));
  setText("sub-pendientes", open.length ? `${plural(open.length, "acción abierta", "acciones abiertas")}` : "Todo al día");
}

/* ------------------------------------------------------------------ */
/* Hoy                                                                 */
/* ------------------------------------------------------------------ */

/** Franja "en ruta" del Itinerario: clima, Plan B, progreso y siguiente panorama del día activo. */
export function renderTodayStrip() {
  const strip = document.getElementById("todayStrip");
  if (!strip) return;
  const dayIndex = state.activeDay;
  const items = orderedItems(state.trips[dayIndex]);
  const doneN = items.filter((p) => state.doneItems[p.id]).length;
  const next = items.find((p) => !state.doneItems[p.id]);
  const w = todayInfo.weather;
  let weatherText = "Plan alternativo disponible si llueve o algo está cerrado.";
  if (w.status === "loading") weatherText = "Consultando el clima…";
  if (w.status === "ok") weatherText = w.rain
    ? "Lluvia detectada: conviene considerar un panorama bajo techo."
    : `Sin lluvia en este momento${Number.isFinite(w.temp) ? ` · ${Math.round(w.temp)} °C` : ""}.`;
  const planB = todayInfo.planB && todayInfo.planB.dayIndex === dayIndex ? todayInfo.planB.html : "";
  setHTML("todayStrip", items.length ? `
    <div class="today-status${w.status === "ok" && w.rain ? " is-rain" : ""}">
      <div class="today-status-text">
        <p class="today-progress"><strong>${doneN} de ${items.length} hechos</strong>${next ? ` · Siguiente: <button type="button" class="link-btn" data-act="goto-next" data-id="${next.id}">${e(next.name)}</button>` : " · Día completo"}</p>
        <p class="today-weather">${e(weatherText)}</p>
      </div>
      <button type="button" class="btn btn-sm" data-act="plan-b" data-fk="planb">☂ Algo cerca y bajo techo</button>
    </div>
    ${planB ? `<div class="planb" role="status">${planB}</div>` : ""}` : "");
}

/* ------------------------------------------------------------------ */
/* Itinerario (día por bloques) + Todos los destinos                   */
/* ------------------------------------------------------------------ */

export function renderItinerary() {
  const a = state.activeDay;
  const day = state.trips[a];
  setText("sub-itinerario", `${state.meta.destination} · Día ${a + 1} de ${state.trips.length} · ${day.name} · ${plural(day.items.length, "panorama", "panoramas")}`);
  setHTML("dayTabs", state.trips.map((d, i) => `<button type="button" role="tab" class="tab" data-act="day" data-day="${i}" data-fk="day-${i}" aria-selected="${i === a}" title="${e(d.name)}">Día ${i + 1}</button>`).join("")
    + `<button type="button" class="tab tab-add admin" data-act="day-add" data-fk="day-add" aria-label="Agregar día">+ Día</button>`);
  setHTML("itineraryBody", `<div class="day-head">
      <h3 class="day-title">${e(day.name)}</h3>
      <div class="day-tools admin">
        <button type="button" class="icon-btn" data-act="day-rename" data-fk="dh-rename" aria-label="Renombrar ${e(day.name)}" title="Renombrar día">✎</button>
        ${state.trips.length > 1 ? `<button type="button" class="icon-btn danger" data-act="day-delete" aria-label="Eliminar ${e(day.name)}" title="Eliminar día">×</button>` : ""}
      </div>
    </div>${itineraryTable(a)}`);
}

/** Todos los lugares del viaje en una tabla (día, bloque, hora, lugar…). */
export function renderAllDestinations() {
  const total = totalPlaces();
  setText("sub-lugares", `${plural(total, "lugar", "lugares")} en ${plural(state.trips.length, "día", "días")}`);
  if (!total) { setHTML("lugaresBody", emptyState("Todavía no hay lugares. Agrégalos desde el itinerario.")); return; }
  const rows = state.trips.flatMap((day, d) => orderedItems(day).map((p) => `
    <tr class="${state.doneItems[p.id] ? "is-done" : ""}" data-cat="${CAT_SLUG[p.category]}">
      <td class="c-num">${d + 1}</td>
      <td class="c-time">${e(p.period)}${p.time ? ` · ${e(p.time)}` : ""}</td>
      <td class="c-place"><p class="place-name">${nameLink(p)}</p>${p.context ? `<p class="place-context">${e(p.context)}</p>` : ""}
        <p class="place-meta-m">${[p.category, p.duration].filter(Boolean).map(e).join(" · ")}</p></td>
      <td class="c-cat">${catBadge(p.category)}</td>
      <td class="c-dur">${e(p.duration || "—")}</td>
      <td class="c-act"><div class="act-links">
        <button type="button" class="icon-btn" data-act="goto" data-day="${d}" data-id="${p.id}" data-fk="goto-${p.id}" aria-label="Ver ${e(p.name)} en el itinerario" title="Ver en itinerario">→</button>
        <a class="icon-btn" href="${e(mapsDirUrl(p, dest()))}" target="_blank" rel="noopener" aria-label="Cómo llegar a ${e(p.name)}" title="Cómo llegar">⌖</a></div></td>
    </tr>`).join("")).join("");
  setHTML("lugaresBody", `<div class="table-wrap"><table class="itin-table places-table">
    <caption class="visually-hidden">Todos los lugares del viaje</caption>
    <thead><tr><th scope="col" class="c-num">Día</th><th scope="col" class="c-time">Bloque</th><th scope="col" class="c-place">Lugar</th>
      <th scope="col" class="c-cat">Categoría</th><th scope="col" class="c-dur">Duración</th><th scope="col" class="c-act"><span class="visually-hidden">Acciones</span></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`);
}

/* ------------------------------------------------------------------ */
/* Mapa                                                                */
/* ------------------------------------------------------------------ */

function tripCenter() {
  const pts = state.trips.flatMap((d) => d.items).filter(hasCoords);
  if (!pts.length) return null;
  return [pts.reduce((s, p) => s + p.lat, 0) / pts.length, pts.reduce((s, p) => s + p.lng, 0) / pts.length];
}

export function renderMapSection() {
  const a = state.activeDay;
  const day = state.trips[a];
  const items = orderedItems(day);
  setText("sub-mapa", `Día ${a + 1} · ${day.name} · ${plural(items.filter(hasCoords).length, "punto", "puntos")}`);
  setHTML("mapDayTabs", state.trips.map((d, i) => `<button type="button" role="tab" class="tab" data-act="day" data-day="${i}" data-fk="md-${i}" aria-selected="${i === a}" title="${e(d.name)}">Día ${i + 1}</button>`).join(""));
  document.querySelectorAll("[data-act='map-layer']").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.layer === state.mapLayer)));
  const fallbackList = items.length ? `<ol class="map-list">${items.map((p, i) => `
    <li data-cat="${CAT_SLUG[p.category]}"><span class="pin-num">${i + 1}</span>${nameLink(p)}
      <span class="muted">${e([p.fixedTime && p.time ? p.time : p.period, p.duration].filter(Boolean).join(" · "))}</span></li>`).join("")}</ol>` : "";
  renderMap({
    items, layer: state.mapLayer, destination: dest(),
    visible: ["viaje/mapa", "compartido"].includes(state.route), fallbackCenter: tripCenter(), fallbackList
  });
}

/* ------------------------------------------------------------------ */
/* Bolsa de ideas                                                      */
/* ------------------------------------------------------------------ */

export function renderIdeas() {
  const daySelect = document.getElementById("ideaDay");
  if (daySelect) {
    const html = state.trips.map((d, i) => `<option value="${i}">Día ${i + 1} · ${e(d.name)}</option>`).join("");
    if (lastHtml.get("ideaDay") !== html) {
      const prev = daySelect.value;
      daySelect.innerHTML = html;
      lastHtml.set("ideaDay", html);
      if (prev && Number(prev) < state.trips.length) daySelect.value = prev;
    }
  }
  const ideas = [...state.ideas].sort((a, b) => Number(a.promoted) - Number(b.promoted) || b.votes - a.votes);
  setText("sub-ideas", `${plural(state.ideas.filter((i) => !i.promoted).length, "idea en votación", "ideas en votación")} · pasan al itinerario con ${PROMOTE_AT} votos`);
  setHTML("ideasList", ideas.length ? `<ul class="idea-grid">${ideas.map((i) => {
    const dayName = state.trips[i.targetDay] ? `Día ${i.targetDay + 1}` : "Último día";
    return `<li class="idea-card${i.promoted ? " is-promoted" : ""}" data-cat="${CAT_SLUG[i.category]}">
      <div class="idea-top">
        <h3 class="idea-name">${e(i.name)}</h3>
        <button type="button" class="icon-btn danger" data-act="idea-delete" data-id="${i.id}" aria-label="Eliminar idea ${e(i.name)}" title="Eliminar">×</button>
      </div>
      <p class="idea-meta">${catBadge(i.category)} <span>${dayName}</span></p>
      ${i.context ? `<p class="idea-context">${e(i.context)}</p>` : ""}
      ${i.promoted ? `<p class="idea-promoted">✓ En itinerario</p>` : `
      <div class="vote" role="group" aria-label="Votos para ${e(i.name)}">
        <button type="button" class="vote-btn" data-act="vote" data-dir="1" data-id="${i.id}" data-fk="vote-${i.id}" aria-label="Votar por ${e(i.name)}">♥</button>
        <span class="vote-count" aria-live="polite">${i.votes} / ${PROMOTE_AT}</span>
        <button type="button" class="vote-btn" data-act="vote" data-dir="-1" data-id="${i.id}" data-fk="unvote-${i.id}" aria-label="Quitar voto a ${e(i.name)}" ${i.votes ? "" : "disabled"}>−</button>
        <span class="vote-bar" aria-hidden="true"><span style="width:${Math.min(100, (i.votes / PROMOTE_AT) * 100)}%"></span></span>
      </div>`}
    </li>`;
  }).join("")}</ul>` : emptyState("Guarda aquí lugares que te recomendaron. Con 3 votos pasan solos al itinerario."));
}

/* ------------------------------------------------------------------ */
/* Reservas                                                            */
/* ------------------------------------------------------------------ */

const STATUS_SLUG = { Pendiente: "pending", Confirmada: "ok", Cancelada: "cancel" };
export function renderReservations() {
  const list = [...state.reservations].sort((a, b) => (a.datetime || "9999").localeCompare(b.datetime || "9999"));
  setText("sub-reservas", plural(state.reservations.length, "registro", "registros"));
  setHTML("reservationsList", list.length ? `<ul class="rows">${list.map((r) => `
    <li class="row row-card">
      <div class="row-main">
        <p class="row-title">${e(r.name)} <span class="status" data-status="${STATUS_SLUG[r.status]}">${e(r.status)}</span></p>
        <p class="row-meta">${e(fmtDateTime(r.datetime))}${r.code ? ` · Código <code>${e(r.code)}</code>` : ""}</p>
        ${r.notes ? `<p class="row-notes">${e(r.notes)}</p>` : ""}
      </div>
      <span class="row-actions">
        <button type="button" class="icon-btn" data-act="res-edit" data-id="${r.id}" data-fk="re-${r.id}" aria-label="Editar reserva ${e(r.name)}" title="Editar">✎</button>
        <button type="button" class="icon-btn danger" data-act="res-delete" data-id="${r.id}" aria-label="Eliminar reserva ${e(r.name)}" title="Eliminar">×</button>
      </span>
    </li>`).join("")}</ul>` : emptyState("Sin reservas. Registra vuelos, alojamiento, entradas o restaurantes."));
}

/* ------------------------------------------------------------------ */
/* Presupuesto y gastos compartidos                                    */
/* ------------------------------------------------------------------ */

export function renderBudget() {
  const b = budgetTotals();
  const cur = document.getElementById("budgetCurrency");
  if (cur && document.activeElement !== cur && cur.value !== b.currency) cur.value = b.currency;
  const other = Object.entries(b.other).filter(([, v]) => v !== 0);
  setHTML("budgetSummary", `
    <div class="budget-hero${b.available < 0 ? " is-negative" : ""}">
      <p class="stat-label">Disponible</p>
      <p class="budget-amount">${e(fmtMoney(b.available, b.currency))}</p>
    </div>
    <dl class="budget-facts">
      <div><dt>Presupuesto inicial</dt><dd>${e(fmtMoney(b.base, b.currency))}
        <button type="button" class="link-btn admin" data-act="budget-base" data-fk="bb">Editar</button></dd></div>
      <div><dt>Agregado</dt><dd>${e(fmtMoney(b.added, b.currency))}</dd></div>
      <div><dt>Gastado</dt><dd>${e(fmtMoney(b.spent, b.currency))}</dd></div>
    </dl>
    ${other.length ? `<p class="muted small">Movimientos en otras monedas (no se convierten): ${other.map(([c, v]) => e(fmtMoney(v, c))).join(" · ")}</p>` : ""}`);
  const moves = state.budget.moves;
  setHTML("budgetMoves", moves.length ? `<ul class="rows rows-compact">${moves.slice(0, 12).map((m) => `
    <li class="row">
      <span class="move-sign ${m.type === "add" ? "is-add" : "is-expense"}" aria-hidden="true">${m.type === "add" ? "+" : "−"}</span>
      <span class="row-text">${e(m.concept)}</span>
      <span class="row-amount">${m.type === "add" ? "+" : "−"}${e(fmtMoney(m.amount, m.currency))}</span>
      <button type="button" class="icon-btn danger" data-act="move-delete" data-id="${m.id}" aria-label="Eliminar movimiento ${e(m.concept)}" title="Eliminar">×</button>
    </li>`).join("")}</ul>${moves.length > 12 ? `<p class="muted small">Mostrando los 12 movimientos más recientes de ${moves.length}.</p>` : ""}`
    : `<p class="muted small">Sin movimientos todavía.</p>`);
}

export function renderGroupExpenses() {
  const people = state.people;
  const nameOf = (id) => people.find((p) => p.id === id)?.name || "—";
  const code = state.budget.currency;
  setHTML("peopleChips", people.map((p) => `<span class="person-chip">${e(p.name)}${people.length > 1 ? `<button type="button" class="chip-x admin" data-act="person-remove" data-id="${p.id}" aria-label="Quitar a ${e(p.name)}" title="Quitar">×</button>` : ""}</span>`).join(""));

  const payer = document.getElementById("gxPayer");
  const payerHtml = people.map((p) => `<option value="${p.id}">${e(p.name)}</option>`).join("");
  if (payer && lastHtml.get("gxPayer") !== payerHtml) {
    const prev = payer.value;
    payer.innerHTML = payerHtml;
    lastHtml.set("gxPayer", payerHtml);
    if (people.some((p) => p.id === prev)) payer.value = prev;
  }
  setHTML("gxParticipants", people.map((p) => `<label class="check-chip"><input type="checkbox" name="participants" value="${p.id}" checked> ${e(p.name)}</label>`).join(""));

  const { transfers } = computeDebts();
  setHTML("debts", transfers.length ? `<ul class="debt-list">${transfers.map((t) => `<li><strong>${e(nameOf(t.from))}</strong> debe <strong>${e(fmtMoney(t.amount, code))}</strong> a <strong>${e(nameOf(t.to))}</strong></li>`).join("")}</ul>`
    : `<p class="muted small">${state.groupExpenses.length ? "Las cuentas están saldadas." : "Registra un gasto para calcular quién debe a quién."}</p>`);

  const byCat = EXPENSE_CATEGORIES.map((c) => ({ c, v: state.groupExpenses.filter((g) => g.category === c).reduce((s, g) => s + g.amount, 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const max = Math.max(1, ...byCat.map((x) => x.v));
  const total = byCat.reduce((s, x) => s + x.v, 0);
  setHTML("expenseChart", byCat.length ? `<p class="chart-total">Total grupal: <strong>${e(fmtMoney(total, code))}</strong></p>
    <ul class="bars" aria-label="Gastos por categoría">${byCat.map((x) => `
    <li><span class="bar-label">${e(x.c)}</span><span class="bar-track"><span class="bar-fill" data-exp="${e(x.c)}" style="width:${Math.max(4, (x.v / max) * 100)}%"></span></span><span class="bar-value">${e(fmtMoney(x.v, code))}</span></li>`).join("")}</ul>` : "");

  setHTML("gxList", state.groupExpenses.length ? `<ul class="rows rows-compact">${state.groupExpenses.map((g) => `
    <li class="row">
      <span class="row-text"><strong>${e(g.concept)}</strong> <span class="muted">· ${e(g.category)} · pagó ${e(nameOf(g.payerId))} · entre ${g.participantIds.length}</span></span>
      <span class="row-amount">${e(fmtMoney(g.amount, code))}</span>
      <button type="button" class="icon-btn danger" data-act="gx-delete" data-id="${g.id}" aria-label="Eliminar gasto ${e(g.concept)}" title="Eliminar">×</button>
    </li>`).join("")}</ul>` : "");
  setText("sub-gastos", `${fmtMoney(budgetTotals().available, code)} disponibles · ${plural(people.length, "viajero", "viajeros")}`);
}

/* ------------------------------------------------------------------ */
/* Documentos                                                          */
/* ------------------------------------------------------------------ */

const DOC_ICON = { Pasaje: "✈", Alojamiento: "⌂", Entrada: "◇", Seguro: "✚", "Identificación": "◉", Otro: "▤" };
export function renderDocuments() {
  setText("sub-documentos", plural(state.documents.length, "documento", "documentos"));
  setHTML("documentsList", state.documents.length ? `<ul class="doc-grid">${state.documents.map((d) => {
    const url = safeHttpUrl(d.url);
    const canOpen = Boolean(d.fileKey || url);
    const source = d.fileKey ? `${d.fileCloud ? "Archivo en la base central" : "Archivo en este navegador"}: ${e(d.fileName || "archivo")}${d.fileSize ? ` (${fmtBytes(d.fileSize)})` : ""}`
      : url ? `Enlace: ${e(new URL(url).hostname)}` : "Sin archivo ni enlace todavía";
    return `<li class="doc-card">
      <span class="doc-icon" aria-hidden="true">${DOC_ICON[d.category] || "▤"}</span>
      <div class="doc-main">
        <h3 class="doc-name">${e(d.name)}</h3>
        <p class="doc-meta"><span class="badge badge-neutral">${e(d.category)}</span> ${source}</p>
        ${d.notes ? `<p class="row-notes">${e(d.notes)}</p>` : ""}
        <div class="doc-actions">
          <button type="button" class="btn btn-sm" data-act="doc-open" data-id="${d.id}" ${canOpen ? "" : "disabled"}>Abrir</button>
          <button type="button" class="btn btn-sm" data-act="doc-edit" data-id="${d.id}" data-fk="de-${d.id}">✎ Editar</button>
          <button type="button" class="btn btn-sm btn-danger" data-act="doc-delete" data-id="${d.id}">× Eliminar</button>
        </div>
      </div>
    </li>`;
  }).join("")}</ul>` : emptyState("Guarda pasajes, reservas de alojamiento, entradas o seguros para tenerlos a mano."));
}

/* ------------------------------------------------------------------ */
/* Orquestador                                                         */
/* ------------------------------------------------------------------ */

export function renderApp() {
  const active = document.activeElement;
  const fk = active?.dataset?.fk;
  renderSections();
  renderHeader();
  renderHistory();
  renderDashboard();
  renderPending();
  renderTodayStrip();
  renderItinerary();
  renderAllDestinations();
  renderMapSection();
  renderIdeas();
  renderReservations();
  renderBudget();
  renderGroupExpenses();
  renderDocuments();
  renderDeals();
  renderControl();
  renderDashboardShell();
  if (fk && (!active.isConnected || document.activeElement === document.body)) {
    const target = document.querySelector(`[data-fk="${CSS.escape(fk)}"]`);
    if (target) target.focus({ preventScroll: true });
  }
}

export { PRIORITIES, CATEGORIES, CURRENCIES };
