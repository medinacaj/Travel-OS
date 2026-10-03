// Pantallas del control de viajes: navegación por rutas, Inicio, Viajes, Compartir, Ajustes y Menú.
// Mismo patrón que views.js: estado → HTML, sin mutar el estado.
import { state, tripTiming, sharePayload, budgetTotals } from "./store.js";
import { escapeHtml as e, encodeShare, fmtMoney, fmtDateTime, STYLES } from "./util.js";
import { scoreDeal, computeAlerts } from "./deals-core.js";
import { catBadge } from "./views.js";

const lastHtml = new Map();
function setHTML(id, html) {
  const el = document.getElementById(id);
  if (!el || lastHtml.get(id) === html) return;
  lastHtml.set(id, html);
  el.innerHTML = html;
}
const setText = (id, t) => { const el = document.getElementById(id); if (el && el.textContent !== String(t)) el.textContent = t; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const fmtDay = (iso) => (iso ? new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`)) : "");
const clp = (n) => `$${Math.round(n).toLocaleString("es-CL")}`;
const isAdmin = () => !state.readOnly;
const THEME_LABELS = { ui: "UI", "ui-noche": "UI oscuro", claro: "Claro", noche: "Noche", arena: "Arena", factory: "Factory", seline: "Seline", steep: "Steep" };

/* Rutas ---------------------------------------------------------------- */

export const TRIP_TABS = [
  ["itinerario", "Itinerario", false], ["mapa", "Mapa", false], ["lugares", "Lugares e ideas", false],
  ["reservas", "Reservas", true], ["documentos", "Documentos", true], ["presupuesto", "Presupuesto", true], ["pendientes", "Pendientes", true],
  ["compartir", "Compartir", true]
];
const PUBLIC_ROUTES = ["inicio", "viajes", "viaje/itinerario", "viaje/mapa", "viaje/lugares", "ofertas", "menu"];
export const ALL_ROUTES = ["inicio", "viajes", "ofertas", "ajustes", "menu", ...TRIP_TABS.map(([k]) => `viaje/${k}`)];

/** Ruta permitida para el rol actual (un visitante no entra a rutas privadas). */
export function allowedRoute(route) {
  if (state.shareMode) return "compartido";
  if (!ALL_ROUTES.includes(route)) return "inicio";
  if (state.readOnly && !PUBLIC_ROUTES.includes(route)) return "inicio";
  return route;
}

function routeMatches(spec, route) {
  return spec.split(/\s+/).some((r) => r === route || (r.endsWith("/*") && route.startsWith(r.slice(0, -1))));
}

/** Muestra solo las secciones de la ruta actual y marca la navegación. */
export function renderRoute() {
  const route = state.route;
  document.querySelectorAll("[data-routes]").forEach((el) => {
    const show = routeMatches(el.dataset.routes, route);
    if (el.hidden === show) el.hidden = !show;
  });
  document.body.dataset.route = route;
  document.querySelectorAll("a[data-route]").forEach((a) => {
    if (a.dataset.route === route || (a.dataset.route === "menu" && false)) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

/* Navegación y pestañas del viaje ---------------------------------------- */

function renderNav() {
  setText("navTripName", state.meta.destination);
  const sel = document.getElementById("tripSwitch");
  if (sel) {
    const html = state.tripIndex.map((t) => `<option value="${e(t.id)}">${e(t.destination)}${t.startDate ? ` · ${e(fmtDay(t.startDate))}` : ""}</option>`).join("");
    if (lastHtml.get("tripSwitch") !== html) { sel.innerHTML = html; lastHtml.set("tripSwitch", html); }
    if (sel.value !== state.activeTripId) sel.value = state.activeTripId;
    sel.hidden = state.tripIndex.length < 2;
  }
  const tab = state.route.startsWith("viaje/") ? state.route.slice(6) : "";
  setHTML("tripTabs", TRIP_TABS.map(([k, label, priv]) => `<a class="tab${priv ? " admin" : ""}" href="#/viaje/${k}" data-route="viaje/${k}" ${tab === k ? 'aria-current="page"' : ""}>${label}</a>`).join(""));
  // Menú (móvil): misma navegación que la barra lateral.
  const side = document.querySelector(".sidebar .nav");
  if (side) setHTML("menuNav", side.innerHTML.replace(/id="(tripSwitch|navTripName|navTripLabel)"/g, 'data-x="$1"').replace(/aria-labelledby="navTripLabel"/, ""));
}

/* Inicio ------------------------------------------------------------------ */

function tripRow(t) {
  const timing = tripTiming(t);
  return { t, timing };
}

function topDeals(n = 3) {
  return state.deals.map((deal) => ({ deal, ev: scoreDeal(deal, state.dealSettings) }))
    .filter((x) => x.ev.status.key === "active" && x.ev.score != null).sort((a, b) => b.ev.score - a.ev.score).slice(0, n);
}

function renderInicio() {
  const rows = state.tripIndex.map(tripRow);
  const current = rows.find((r) => r.timing.key === "current");
  const upcoming = rows.filter((r) => r.timing.key === "upcoming").sort((a, b) => a.timing.daysLeft - b.timing.daysLeft)[0];
  const focus = current || upcoming;
  setText("h-inicio", isAdmin() ? "Ofertas y alertas" : "Viajes y ofertas");
  setText("sub-inicio", isAdmin() ? `${plural(state.tripIndex.length, "viaje", "viajes")} · ${current ? "hay un viaje en curso" : upcoming ? `próximo: ${upcoming.t.destination}` : "sin viajes con fecha próxima"}` : "Itinerarios y ofertas de viaje verificadas en Chile");
  const deals = topDeals(3);
  const dealsHtml = `<div class="panel home-panel" data-tone="deals">
      <div class="panel-bar"><h3 class="panel-title">Mejores ofertas vigentes</h3><a class="link-btn" href="#/ofertas">Ver todas</a></div>
      ${deals.length ? `<table class="mini-table"><tbody>${deals.map(({ deal, ev }) => `<tr>
        <td><a class="link-btn" href="#/ofertas" data-goto-deal="${e(deal.id)}">${e(deal.title)}</a><span class="muted small"> · ${e(deal.provider)}</span></td>
        <td class="num">${deal.price != null ? e(clp(deal.price)) : "—"}</td><td class="num">${ev.score}/100</td></tr>`).join("")}</tbody></table>`
        : `<p class="muted small">Sin ofertas vigentes con puntaje.</p>`}
    </div>`;
  if (!isAdmin()) {
    setHTML("inicioBody", `<div class="home-grid">
      <div class="panel home-panel" data-tone="places">
        <div class="panel-bar"><h3 class="panel-title">Viajes publicados</h3><a class="link-btn" href="#/viajes">Ver todos</a></div>
        ${rows.length ? `<ul class="home-trips">${rows.map(({ t }) => `<li><a href="#/viajes/${e(t.id)}/itinerario">${e(t.destination)}</a> <span class="muted small">${plural(t.days, "día", "días")} · ${plural(t.places, "lugar", "lugares")}</span></li>`).join("")}</ul>`
          : `<p class="muted small">Todavía no hay viajes publicados.</p>`}
      </div>${dealsHtml}</div>`);
    return;
  }
  // Administrador: el resumen del viaje (indicadores) va en su sección; aquí, aviso de otro viaje, alertas y ofertas.
  const alerts = computeAlerts(state.deals, state.dealSettings, state.meta.destination).filter((a) => a.type === "destination" || a.type === "lastMinute").slice(0, 4);
  setText("sub-inicio", `Para ${state.meta.destination} y vigentes en Chile`);
  setHTML("tripNotice", focus && focus.t.id !== state.activeTripId ? `<div class="trip-notice" data-state="${focus.timing.key}">
      <p><strong>${focus.timing.key === "current" ? "Viaje en curso" : "Próximo viaje"}: ${e(focus.t.destination)}</strong> · ${e(focus.timing.label.toLowerCase())}</p>
      <a class="btn btn-sm" href="#/viajes/${e(focus.t.id)}/itinerario">Abrir</a></div>` : "");
  setHTML("inicioBody", `<div class="home-grid">
      <div class="panel home-panel" data-tone="today">
        <div class="panel-bar"><h3 class="panel-title">Alertas de ofertas</h3><a class="link-btn" href="#/ofertas">Ofertas</a></div>
        ${alerts.length ? `<ul class="home-list">${alerts.map((a) => `<li><span class="alert-tag">${e(a.tag)}</span> ${e(a.text)}</li>`).join("")}</ul>` : `<p class="muted small">Sin alertas para ${e(state.meta.destination)} ni ofertas por cerrar.</p>`}
      </div>
      ${dealsHtml}
    </div>`);
}

/* Viajes ------------------------------------------------------------------- */

const TIMING_ORDER = { current: 0, upcoming: 1, nodate: 2, past: 3 };
function renderViajes() {
  const rows = state.tripIndex.map(tripRow).sort((a, b) => TIMING_ORDER[a.timing.key] - TIMING_ORDER[b.timing.key] || (a.t.startDate || "9").localeCompare(b.t.startDate || "9"));
  setText("sub-viajes", isAdmin() ? `${plural(rows.length, "viaje", "viajes")} · ${plural(rows.filter((r) => r.t.isPublic).length, "público", "públicos")}` : "Itinerarios publicados");
  setHTML("viajesBody", rows.length ? `<div class="table-wrap"><table class="data-table trips-table">
    <caption class="visually-hidden">Lista de viajes</caption>
    <thead><tr><th scope="col">Destino</th><th scope="col">Fechas</th><th scope="col" class="num">Días</th><th scope="col" class="num">Lugares</th>
      <th scope="col">Estado</th><th scope="col" class="admin">Visibilidad</th><th scope="col"><span class="visually-hidden">Acciones</span></th></tr></thead>
    <tbody>${rows.map(({ t, timing }) => `<tr class="${t.id === state.activeTripId ? "is-active" : ""}" data-trip="${e(t.id)}">
      <td><a href="#/viajes/${e(t.id)}/itinerario"><strong>${e(t.destination)}</strong></a>${t.country ? `<span class="muted small"> · ${e(t.country)}</span>` : ""}${t.isDemo ? ` <span class="demo-badge">Ejemplo</span>` : ""}</td>
      <td>${t.startDate ? `${e(fmtDay(t.startDate))} – ${e(fmtDay(timing.endDate))}` : `<span class="muted">Sin fecha</span>`}</td>
      <td class="num">${t.days}</td><td class="num">${t.places}</td>
      <td><span class="trip-state" data-state="${timing.key}">${e(timing.label)}</span></td>
      <td class="admin"><span class="badge ${t.isPublic ? "badge-ok" : "badge-neutral"}">${t.isPublic ? "Público" : "Privado"}</span></td>
      <td class="c-act"><div class="act-links">
        <a class="btn btn-sm" href="#/viajes/${e(t.id)}/itinerario">Abrir</a>
        ${isAdmin() && state.tripIndex.length > 1 ? `<button type="button" class="icon-btn danger" data-act="trip-delete" data-trip="${e(t.id)}" aria-label="Eliminar viaje ${e(t.destination)}" title="Eliminar viaje">×</button>` : ""}
      </div></td>
    </tr>`).join("")}</tbody></table></div>`
    : `<div class="empty"><p>${isAdmin() ? "Aún no hay viajes." : "Todavía no hay viajes publicados."}</p></div>`);
}

/* Compartir ------------------------------------------------------------------ */

function renderCompartir() {
  if (!isAdmin()) return;
  const entry = state.tripIndex.find((t) => t.id === state.activeTripId) || {};
  const cloud = state.cloud.mode === "cloud";
  const link = `${location.origin}${location.pathname}#share=${encodeShare(sharePayload())}`;
  setText("sub-compartir", state.meta.destination);
  setHTML("compartirBody", `<div class="split">
    <div class="panel">
      <h3 class="panel-title">Enlace de solo lectura</h3>
      <p class="small">Quien abra este enlace ve el itinerario y el mapa de <strong>${e(state.meta.destination)}</strong>, sin registrarse. No incluye reservas, gastos, documentos, pendientes ni observaciones.</p>
      <label class="field field-wide" for="shareLinkInput"><span>Enlace</span><input class="input" id="shareLinkInput" readonly value="${e(link)}"></label>
      <div class="form-actions"><button type="button" class="btn btn-primary btn-sm" data-act="share-copy">Copiar enlace</button>
        <a class="btn btn-sm" href="${e(link)}" target="_blank" rel="noopener">Ver como invitado</a>
        <button type="button" class="btn btn-sm btn-mymaps" data-act="mymaps">Crear en Google My Maps</button></div>
      <p class="muted small">El enlace lleva una copia del itinerario de este momento: si cambias algo, copia uno nuevo.</p>
    </div>
    <div class="panel">
      <h3 class="panel-title">Visible en el sitio</h3>
      <label class="switch-row"><input type="checkbox" data-act="trip-public" ${entry.isPublic ? "checked" : ""} ${cloud ? "" : "disabled"}><span class="switch" aria-hidden="true"></span>
        <span><strong>Mostrar este viaje a los visitantes</strong><small>${cloud ? "Itinerario, mapa y lugares quedan visibles sin iniciar sesión. Lo privado sigue privado." : "Disponible con la base de datos central (Supabase)."}</small></span></label>
    </div></div>`);
}

/* Ajustes ---------------------------------------------------------------------- */

function renderAjustes() {
  if (!isAdmin()) return;
  const c = state.cloud;
  setHTML("ajustesBody", `<div class="split">
    <div class="panel">
      <h3 class="panel-title">Cuenta y datos</h3>
      ${c.mode === "cloud"
        ? `<p class="small">Base de datos central activa. Sesión: <strong>${e(c.user || "—")}</strong>.</p>
           <div class="form-actions"><button type="button" class="btn btn-sm" data-act="cloud-logout">Cerrar sesión</button></div>`
        : `<p class="small">Modo local: los datos viven solo en este navegador. Para usarlos en varios dispositivos configura la base central (README, sección Supabase).</p>`}
      <h3 class="panel-title">Respaldo</h3>
      <p class="small muted">Descarga todos tus viajes, ofertas y ajustes en un archivo JSON.${c.mode === "cloud" ? "" : " Puedes restaurarlo en otro navegador."}</p>
      <div class="form-actions">
        <button type="button" class="btn btn-sm" data-act="backup-export">Descargar respaldo</button>
        ${c.mode === "cloud" ? "" : `<label class="btn btn-sm btn-ghost file-btn">Restaurar respaldo<input type="file" accept="application/json,.json" data-act-change="backup-import" hidden></label>`}
      </div>
    </div>
    <div class="panel">
      <h3 class="panel-title">Apariencia</h3>
      <div class="appearance appearance-inline" role="group" aria-label="Tema">
        ${Object.entries(THEME_LABELS).map(([t, label]) => `<button type="button" class="seg" data-act="theme" data-theme="${t}" aria-pressed="${state.theme === t}">${label}</button>`).join("")}
      </div>
      <h3 class="panel-title">Ofertas</h3>
      <p class="small"><a href="#/ofertas" data-deals-tab="datos">Correo del informe, ciudad de origen y fuente automática</a> · <a href="#/ofertas" data-deals-tab="alertas">Reglas de alerta</a></p>
      <p class="muted small">Estilos de viaje disponibles: ${STYLES.map(e).join(", ")}.</p>
    </div></div>`);
}

/* Orquestador ------------------------------------------------------------------- */

export function renderControl() {
  if (state.shareMode) { renderRoute(); return; }
  renderNav();
  renderInicio();
  renderViajes();
  renderCompartir();
  renderAjustes();
  const note = document.getElementById("docsStorageNote");
  if (note) note.textContent = state.cloud.mode === "cloud"
    ? "Los archivos se guardan en la base central (privados: solo el administrador los ve)."
    : "Los archivos se guardan en IndexedDB y pertenecen solo a este navegador: no están en la nube ni se comparten.";
  renderRoute();
}

export { catBadge };
