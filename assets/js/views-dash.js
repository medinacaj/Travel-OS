// Panel estilo "dashboard": barra superior (título, buscador, alertas, cuenta) y los widgets de Inicio
// (ritmo del viaje, categorías, avance, calendario y próximos viajes). Solo datos reales del viaje:
// si no hay datos, el widget lo dice en vez de inventar cifras.
import { state, tripTiming, setUi } from "./store.js";
import { escapeHtml as e, CATEGORIES, CAT_SLUG } from "./util.js";
import { computeAlerts } from "./deals-core.js";
import { icon } from "./icons.js";

const lastHtml = new Map();
function setHTML(id, html) {
  const el = document.getElementById(id);
  if (!el || lastHtml.get(id) === html) return;
  lastHtml.set(id, html);
  el.innerHTML = html;
}
const setText = (id, t) => { const el = document.getElementById(id); if (el && el.textContent !== String(t)) el.textContent = t; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fmtShort = (iso) => new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
const addDays = (iso, n) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

// Estado local de los widgets (no se guarda: es solo de la vista).
const ui = { metric: "hours", monthShift: 0, monthKey: "" };

/* Barra superior --------------------------------------------------------- */

const ROUTE_TITLES = {
  inicio: "Inicio", viajes: "Viajes", ofertas: "Ofertas", ajustes: "Ajustes", menu: "Menú", compartido: "Viaje compartido",
  "viaje/itinerario": "Itinerario", "viaje/mapa": "Mapa", "viaje/lugares": "Lugares e ideas", "viaje/reservas": "Reservas",
  "viaje/documentos": "Documentos", "viaje/presupuesto": "Presupuesto", "viaje/pendientes": "Pendientes", "viaje/compartir": "Compartir"
};

function initials(text) {
  const parts = String(text || "").replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

function renderTopbar() {
  const route = state.route || "inicio";
  setText("pageTitle", ROUTE_TITLES[route] || "Inicio");
  const sub = route === "inicio" ? new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Santiago" }).format(new Date())
    : route.startsWith("viaje/") ? `Viaje: ${state.meta.destination}` : "";
  setText("pageSub", sub ? sub[0].toUpperCase() + sub.slice(1) : "");

  // Alertas: ofertas que coinciden con el destino o las alertas configuradas.
  let alerts = 0;
  try { alerts = computeAlerts(state.deals, state.dealSettings, state.meta.destination).length; } catch { alerts = 0; }
  const bell = document.getElementById("topBell");
  if (bell) {
    const label = alerts ? `${plural(alerts, "alerta", "alertas")} de ofertas` : "Sin alertas de ofertas";
    if (bell.getAttribute("aria-label") !== label) { bell.setAttribute("aria-label", label); bell.title = label; }
    const dot = document.getElementById("bellDot");
    if (dot) dot.hidden = !alerts;
  }

  const cloud = state.cloud || {};
  let name; let role;
  if (state.shareMode) { name = "Invitado"; role = "Solo lectura"; }
  else if (cloud.mode === "cloud" && cloud.role === "admin") { name = (cloud.user || "Administrador").replace(/@.*/, ""); role = "Administrador"; }
  else if (cloud.mode === "cloud") { name = "Visitante"; role = "Solo lectura"; }
  else { name = "Mi planificador"; role = "Este navegador"; }
  const href = state.readOnly ? "#/menu" : "#/ajustes";
  setHTML("topUser", `<a class="top-user-link" href="${href}" aria-label="Cuenta: ${e(name)}, ${e(role)}">
    <span class="avatar" aria-hidden="true">${e(initials(name))}</span>
    <span class="top-user-text"><strong>${e(name)}</strong><small>${e(role)}</small></span></a>`);
}

/* Buscador global --------------------------------------------------------- */

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function searchResults(q) {
  const n = norm(q).trim();
  if (n.length < 2) return [];
  const out = [];
  state.trips.forEach((d, di) => d.items.forEach((p) => {
    if (norm(`${p.name} ${p.category} ${p.notes || ""}`).includes(n)) out.push({ kind: "place", id: p.id, day: di, title: p.name, sub: `Día ${di + 1} · ${d.name}` });
  }));
  state.tripIndex.forEach((t) => {
    if (norm(`${t.destination} ${t.country}`).includes(n)) out.push({ kind: "trip", id: t.id, title: t.destination, sub: t.country || "Viaje" });
  });
  return out.slice(0, 8);
}

function renderSearch() {
  const input = document.getElementById("globalSearch");
  const box = document.getElementById("searchResults");
  if (!input || !box) return;
  const q = input.value;
  const res = searchResults(q);
  const open = norm(q).trim().length >= 2;
  box.hidden = !open;
  input.setAttribute("aria-expanded", String(open));
  box.innerHTML = !open ? "" : res.length
    ? res.map((r, i) => `<button type="button" class="search-item" role="option" data-search="${r.kind}" data-id="${e(r.id)}" data-day="${r.day ?? ""}" id="sr-${i}">
        <span class="search-ico">${icon(r.kind === "trip" ? "viajes" : "lugares", 16)}</span>
        <span><strong>${e(r.title)}</strong><small>${e(r.sub)}</small></span></button>`).join("")
    : `<p class="search-empty">Sin resultados para “${e(q.trim())}”.</p>`;
}

function pickSearch(btn, go) {
  const input = document.getElementById("globalSearch");
  if (input) input.value = "";
  renderSearch();
  if (btn.dataset.search === "trip") { location.hash = `#/viajes/${encodeURIComponent(btn.dataset.id)}/itinerario`; return; }
  const day = Number(btn.dataset.day);
  setUi({ activeDay: day });
  go("viaje/itinerario");
  requestAnimationFrame(() => setTimeout(() => {
    const row = document.getElementById(`card-${btn.dataset.id}`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("is-flash");
    setTimeout(() => row.classList.remove("is-flash"), 1600);
  }, 60));
}

/** Engancha el buscador y los controles de los widgets. `go` navega a una ruta (de main.js). */
export function initDashboard(go) {
  const input = document.getElementById("globalSearch");
  const box = document.getElementById("searchResults");
  if (input && box) {
    input.addEventListener("input", renderSearch);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") { input.value = ""; renderSearch(); }
      if (ev.key === "Enter") { const first = box.querySelector(".search-item"); if (first) { ev.preventDefault(); pickSearch(first, go); } }
      if (ev.key === "ArrowDown") { const first = box.querySelector(".search-item"); if (first) { ev.preventDefault(); first.focus(); } }
    });
    box.addEventListener("click", (ev) => { const b = ev.target.closest(".search-item"); if (b) pickSearch(b, go); });
    box.addEventListener("keydown", (ev) => {
      const items = [...box.querySelectorAll(".search-item")];
      const i = items.indexOf(document.activeElement);
      if (ev.key === "ArrowDown" && i < items.length - 1) { ev.preventDefault(); items[i + 1].focus(); }
      if (ev.key === "ArrowUp") { ev.preventDefault(); (i > 0 ? items[i - 1] : input).focus(); }
      if (ev.key === "Escape") { input.value = ""; renderSearch(); input.focus(); }
    });
    document.addEventListener("click", (ev) => { if (!ev.target.closest(".top-search")) { if (!box.hidden) { box.hidden = true; input.setAttribute("aria-expanded", "false"); } } });
    input.addEventListener("focus", renderSearch);
  }
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-dash]");
    if (!b) return;
    const act = b.dataset.dash;
    if (act === "metric") ui.metric = b.dataset.metric;
    else if (act === "month") ui.monthShift += Number(b.dataset.step);
    else if (act === "cal-day") { setUi({ activeDay: Number(b.dataset.day) }); go("viaje/itinerario"); return; }
    else if (act === "chart-day") { setUi({ activeDay: Number(b.dataset.day) }); return; }
    renderDashWidgets();
  });
}

/* Widgets de Inicio --------------------------------------------------------- */

function minutesOf(text) {
  const s = String(text || "").toLowerCase();
  let m = 0;
  const h = s.match(/(\d+(?:[.,]\d+)?)\s*h/);
  if (h) m += parseFloat(h[1].replace(",", ".")) * 60;
  const mi = s.match(/(\d+)\s*min/);
  if (mi) m += Number(mi[1]);
  if (!h && !mi && /^\d+$/.test(s.trim())) m = Number(s);
  return m;
}

/** Curva suave (Catmull-Rom → Bézier) por los puntos. */
function splinePath(pts) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function rhythmWidget() {
  const days = state.trips;
  const metric = ui.metric;
  const values = days.map((d) => (metric === "hours" ? Math.round((d.items.reduce((s, p) => s + minutesOf(p.duration), 0) / 60) * 10) / 10 : d.items.length));
  const unit = metric === "hours" ? "h" : "";
  const toggle = `<div class="pill-switch" role="group" aria-label="Medida">
    <button type="button" class="pill" data-dash="metric" data-metric="hours" aria-pressed="${metric === "hours"}">Horas</button>
    <button type="button" class="pill" data-dash="metric" data-metric="places" aria-pressed="${metric === "places"}">Lugares</button></div>`;
  const head = `<div class="widget-head"><div><h3 class="widget-title">Ritmo del viaje</h3><p class="widget-sub">${metric === "hours" ? "Horas planificadas por día" : "Lugares por día"}</p></div>${toggle}</div>`;
  if (days.length < 2 || !values.some((v) => v > 0)) {
    return `${head}<p class="widget-empty">Agrega lugares${metric === "hours" ? " con duración" : ""} en al menos dos días para ver el ritmo del viaje.</p>`;
  }
  const W = 480; const H = 210; const padL = 34; const padR = 16; const padT = 26; const padB = 30;
  const max = Math.max(...values); const top = metric === "hours" ? Math.max(2, Math.ceil(max / 2) * 2) : Math.max(2, Math.ceil(max));
  const x = (i) => padL + (i * (W - padL - padR)) / (days.length - 1);
  const y = (v) => padT + (1 - v / top) * (H - padT - padB);
  const pts = values.map((v, i) => [x(i), y(v)]);
  const line = splinePath(pts);
  const area = `${line} L${x(days.length - 1)},${H - padB} L${x(0)},${H - padB} Z`;
  const ticks = [0, top / 2, top];
  const a = Math.min(state.activeDay || 0, days.length - 1);
  const tipX = Math.min(Math.max(pts[a][0], padL + 46), W - padR - 46);
  const svg = `<svg class="spline" viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(`${metric === "hours" ? "Horas" : "Lugares"} por día: ${values.map((v, i) => `día ${i + 1} ${v}${unit}`).join(", ")}`)}">
    <defs><linearGradient id="splineStroke" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="var(--grad-a)"/><stop offset="1" stop-color="var(--grad-b)"/></linearGradient><linearGradient id="splineFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--grad-b)" stop-opacity=".22"/><stop offset="1" stop-color="var(--grad-a)" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((t) => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${t}${unit}</text>`).join("")}
    ${days.map((d, i) => `<text class="axis" x="${x(i)}" y="${H - 8}" text-anchor="middle">Día ${i + 1}</text>`).join("")}
    <path class="area" d="${area}" fill="url(#splineFill)"/>
    <path class="line" d="${line}" stroke="url(#splineStroke)"/>
    <line class="guide" x1="${pts[a][0]}" x2="${pts[a][0]}" y1="${padT - 6}" y2="${H - padB}"/>
    ${pts.map((p, i) => `<g class="pt${i === a ? " is-active" : ""}" data-dash="chart-day" data-day="${i}" tabindex="0" role="button" aria-label="Día ${i + 1}: ${values[i]}${unit}"><circle class="hit" cx="${p[0]}" cy="${p[1]}" r="16"/><circle class="dot" cx="${p[0]}" cy="${p[1]}" r="${i === a ? 6 : 4}"/></g>`).join("")}
    <g class="tip" transform="translate(${tipX},${Math.max(pts[a][1] - 40, 4)})"><rect x="-44" y="0" width="88" height="28" rx="8"/><text x="0" y="18" text-anchor="middle">${values[a]}${unit} · Día ${a + 1}</text></g>
  </svg>`;
  return `${head}<div class="spline-wrap">${svg}</div>`;
}

const catColor = (c) => `var(--c-${CAT_SLUG[c] || "musts"})`;
function categoriesWidget() {
  const all = state.trips.flatMap((d) => d.items);
  const head = `<div class="widget-head"><div><h3 class="widget-title">Categorías</h3><p class="widget-sub">Lugares del viaje por tipo</p></div></div>`;
  if (!all.length) return `${head}<p class="widget-empty">Aún no hay lugares en el itinerario.</p>`;
  const rows = CATEGORIES.map((c) => ({ c, n: all.filter((p) => p.category === c).length })).filter((r) => r.n).sort((a, b) => b.n - a.n);
  const total = all.length; const R = 54; const C = 2 * Math.PI * R;
  let off = 0;
  const arcs = rows.map((r, i) => {
    const len = (r.n / total) * C;
    const seg = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${catColor(r.c)}" stroke-width="22" stroke-dasharray="${Math.max(len - 2, 0.1)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`;
    off += len; return seg;
  }).join("");
  return `${head}<div class="donut-wrap">
    <svg class="donut" viewBox="0 0 140 140" role="img" aria-label="${e(rows.map((r) => `${r.c} ${Math.round((r.n / total) * 100)}%`).join(", "))}">${arcs}
      <text x="70" y="68" text-anchor="middle" class="donut-num">${total}</text><text x="70" y="86" text-anchor="middle" class="donut-lbl">lugares</text></svg>
    <ul class="legend">${rows.map((r, i) => `<li><span class="sw" style="background:${catColor(r.c)}"></span><span class="lg-name">${e(r.c)}</span><span class="lg-pct">${Math.round((r.n / total) * 100)}%</span><span class="lg-n">${r.n}</span></li>`).join("")}</ul>
  </div>`;
}

function progressWidget() {
  const all = state.trips.flatMap((d) => d.items);
  const done = all.filter((p) => state.doneItems[p.id]).length;
  const timed = all.filter((p) => !state.doneItems[p.id] && p.time).length;
  const loose = all.length - done - timed;
  const head = `<div class="widget-head"><div><h3 class="widget-title">Avance del viaje</h3><p class="widget-sub">${plural(all.length, "lugar", "lugares")} en ${plural(state.trips.length, "día", "días")}</p></div></div>`;
  if (!all.length) return `${head}<p class="widget-empty">Sin lugares todavía.</p>`;
  const seg = [["Hechos", done, "s1"], ["Con horario", timed, "s2"], ["Sin horario", loose, "s3"]];
  return `${head}<div class="segbar" role="img" aria-label="${e(seg.map(([l, n]) => `${l}: ${n}`).join(", "))}">${seg.filter(([, n]) => n).map(([l, n, c]) => `<span class="${c}" style="flex:${n}" title="${l}: ${n}"></span>`).join("")}</div>
    <ul class="seg-legend">${seg.map(([l, n, c]) => `<li><span class="sw ${c}"></span>${l}<strong>${n}</strong></li>`).join("")}</ul>`;
}

/* Calendario --------------------------------------------------------------- */

function tripRanges() {
  return state.tripIndex.filter((t) => t.startDate).map((t) => {
    const days = t.id === state.activeTripId ? state.trips.length : (t.days || 1);
    return { id: t.id, start: t.startDate, end: addDays(t.startDate, Math.max(days, 1) - 1), name: t.destination, active: t.id === state.activeTripId };
  });
}

function calendarWidget() {
  const today = todayIso();
  const active = state.tripIndex.find((t) => t.id === state.activeTripId);
  const anchor = active?.startDate || today;
  // Si cambia el viaje abierto, el calendario vuelve a su mes.
  const key = `${state.activeTripId}|${anchor}`;
  if (ui.monthKey !== key) { ui.monthKey = key; ui.monthShift = 0; }
  const base = new Date(`${anchor.slice(0, 7)}-01T12:00:00Z`);
  base.setUTCMonth(base.getUTCMonth() + ui.monthShift);
  const yr = base.getUTCFullYear(); const mo = base.getUTCMonth();
  const first = (new Date(Date.UTC(yr, mo, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const len = new Date(Date.UTC(yr, mo + 1, 0)).getUTCDate();
  const ranges = tripRanges();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(`<span class="cal-cell is-blank"></span>`);
  for (let d = 1; d <= len; d++) {
    const iso = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const r = ranges.find((x) => iso >= x.start && iso <= x.end);
    const cls = ["cal-cell"];
    if (r) { cls.push(r.active ? "in-trip" : "in-other"); if (iso === r.start) cls.push("r-start"); if (iso === r.end) cls.push("r-end"); }
    if (iso === today) cls.push("is-today");
    const label = `${d} de ${MONTHS[mo]}${r ? ` · ${r.name}` : ""}${iso === today ? " · hoy" : ""}`;
    if (r && r.active) {
      const di = Math.round((new Date(`${iso}T12:00:00Z`) - new Date(`${r.start}T12:00:00Z`)) / 86400000);
      cells.push(`<button type="button" class="${cls.join(" ")}" data-dash="cal-day" data-day="${di}" aria-label="${e(label)}, ver día ${di + 1}">${d}</button>`);
    } else cells.push(`<span class="${cls.join(" ")}" aria-label="${e(label)}">${d}</span>`);
  }
  const noDate = active && !active.startDate;
  return `<div class="widget-head cal-head">
      <button type="button" class="icon-btn icon-btn-sm" data-dash="month" data-step="-1" aria-label="Mes anterior">${icon("left", 16)}</button>
      <h3 class="widget-title">${MONTHS[mo][0].toUpperCase() + MONTHS[mo].slice(1)} ${yr}</h3>
      <button type="button" class="icon-btn icon-btn-sm" data-dash="month" data-step="1" aria-label="Mes siguiente">${icon("right", 16)}</button></div>
    <div class="cal-grid" role="group" aria-label="Calendario de ${MONTHS[mo]} ${yr}">
      ${["L", "M", "M", "J", "V", "S", "D"].map((w) => `<span class="cal-wd" aria-hidden="true">${w}</span>`).join("")}
      ${cells.join("")}
    </div>
    ${noDate ? `<p class="widget-note">Este viaje no tiene fecha de inicio: agrégala en “Datos del viaje” para verlo en el calendario.</p>` : ""}`;
}

/* Próximos viajes ------------------------------------------------------------ */

function upcomingWidget() {
  const rows = state.tripIndex.map((t) => ({ t: t.id === state.activeTripId ? { ...t, days: state.trips.length } : t })).map((r) => ({ ...r, timing: tripTiming(r.t) }));
  const rank = { current: 0, upcoming: 1, nodate: 2, past: 3 };
  rows.sort((a, b) => rank[a.timing.key] - rank[b.timing.key] || String(a.t.startDate).localeCompare(String(b.t.startDate)));
  const list = rows.slice(0, 4);
  const people = !state.readOnly ? state.people : [];
  const head = `<div class="widget-head"><div><h3 class="widget-title">Próximos viajes</h3></div><a class="widget-link" href="#/viajes">Ver todos</a></div>`;
  if (!list.length) return `${head}<p class="widget-empty">Aún no hay viajes.</p>`;
  return `${head}<ul class="trip-list">${list.map(({ t, timing }) => {
    const active = t.id === state.activeTripId;
    const range = t.startDate ? `${fmtShort(t.startDate)} – ${fmtShort(addDays(t.startDate, Math.max(t.days || 1, 1) - 1))}` : "Sin fecha";
    const avatars = active && people.length ? `<span class="stack" aria-label="${plural(people.length, "viajero", "viajeros")}">${people.slice(0, 3).map((p) => `<span class="avatar avatar-xs" title="${e(p.name)}">${e(initials(p.name))}</span>`).join("")}${people.length > 3 ? `<span class="avatar avatar-xs avatar-more">+${people.length - 3}</span>` : ""}</span>` : "";
    return `<li class="trip-item${active ? " is-active" : ""}">
      <a href="#/viajes/${e(t.id)}/itinerario" class="trip-item-link">
        <span class="trip-thumb" data-grad="${[...String(t.destination)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 4}" aria-hidden="true">${e(initials(t.destination))}</span>
        <span class="trip-item-body">
          <span class="tag">${e(t.style || "Viaje")}</span>
          <strong>${e(t.destination)}${t.country ? `, ${e(t.country)}` : ""}</strong>
          <span class="trip-item-meta">${icon("calendar", 14)} ${t.startDate ? `${e(range)} · ${e(timing.label)}` : "Sin fecha"}</span>
        </span>
      </a>${avatars}</li>`;
  }).join("")}</ul>`;
}

function reservationsWidget() {
  const list = state.reservations.filter((r) => r.status !== "Cancelada");
  const conf = list.filter((r) => r.status === "Confirmada").length;
  const pend = list.length - conf;
  const canc = state.reservations.length - list.length;
  const head = `<div class="widget-head"><div><h3 class="widget-title">Reservas</h3><p class="widget-sub">${plural(state.reservations.length, "registrada", "registradas")}</p></div><a class="widget-link" href="#/viaje/reservas">Ver</a></div>`;
  if (!state.reservations.length) return `${head}<p class="widget-empty">Sin reservas registradas.</p>`;
  const seg = [["Confirmadas", conf, "s1"], ["Pendientes", pend, "s2"], ["Canceladas", canc, "s3"]];
  return `${head}<div class="segbar" role="img" aria-label="${e(seg.map(([l, n]) => `${l}: ${n}`).join(", "))}">${seg.filter(([, n]) => n).map(([l, n, c]) => `<span class="${c}" style="flex:${n}" title="${l}: ${n}"></span>`).join("")}</div>
    <ul class="seg-legend">${seg.map(([l, n, c]) => `<li><span class="sw ${c}"></span>${l}<strong>${n}</strong></li>`).join("")}</ul>`;
}

function renderDashWidgets() {
  if (state.shareMode) return;
  setHTML("wRhythm", rhythmWidget());
  setHTML("wCategories", categoriesWidget());
  setHTML("wProgress", progressWidget());
  setHTML("wCalendar", calendarWidget());
  setHTML("wUpcoming", upcomingWidget());
  if (!state.readOnly) setHTML("wReservations", reservationsWidget());
}

export function renderDashboardShell() {
  renderTopbar();
  if (state.route === "inicio") renderDashWidgets();
}
