// Vistas del módulo Ofertas. Mismo patrón que views.js: estado → HTML, sin mutar estado.
import { state } from "./store.js";
import {
  DEAL_TYPES, SOURCE_KINDS, NEWS_IMPACT, TOOLS, scoreDeal, dealStatus, matchesDestination,
  computeAlerts, realSaving, SEED_VERIFIED_LABEL
} from "./deals-core.js";
import { escapeHtml as e, fmtMoney } from "./util.js";
import { buildReportModel, buildEmailSummary, mailtoHref, realSavingLabel } from "./deals-report.js";

const lastHtml = new Map();
function setHTML(id, html) {
  const el = document.getElementById(id);
  if (!el || lastHtml.get(id) === html) return;
  lastHtml.set(id, html);
  el.innerHTML = html;
}
const clp = (n) => fmtMoney(n, "CLP").replace("CLP$ ", "$");
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00-03:00` : iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Santiago" }).format(d);
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const TABS = [
  ["ofertas", "Ofertas"], ["informe", "Informe del día"], ["alertas", "Alertas"], ["noticias", "Noticias"], ["herramientas", "Herramientas"], ["datos", "Actualizar datos"]
];

export function evaluatedDeals(now = new Date()) {
  return state.deals.map((deal) => ({ deal, ev: scoreDeal(deal, state.dealSettings, now), mine: matchesDestination(deal, state.meta.destination) }));
}

function filtered(list) {
  const f = state.dealFilter;
  const q = f.q.trim().toLowerCase();
  return list.filter(({ deal, ev, mine }) => {
    if (f.type !== "all" && deal.type !== f.type) return false;
    if (f.status === "live" && ev.status.key === "expired") return false;
    if (f.status === "expired" && ev.status.key !== "expired") return false;
    if (f.mine && !mine) return false;
    if (q && ![deal.title, deal.provider, deal.origin, deal.destination].join(" ").toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => {
    const rank = { active: 0, upcoming: 1, expired: 2 };
    return rank[a.ev.status.key] - rank[b.ev.status.key] || Number(b.mine) - Number(a.mine) || (b.ev.score ?? -1) - (a.ev.score ?? -1);
  });
}

/* ------------------------------------------------------------------ */

function scoreRing(ev) {
  if (ev.score == null) return `<div class="score-ring is-empty" aria-label="${e(ev.label)}"><span>—</span></div>`;
  const tone = ev.score >= 75 ? "great" : ev.score >= 60 ? "good" : ev.score >= 40 ? "mid" : "low";
  return `<div class="score-ring" data-tone="${tone}" style="--pct:${ev.score}" role="img" aria-label="Puntaje ${ev.score} de 100: ${e(ev.label)}"><span>${ev.score}</span></div>`;
}

function priceBlock(deal) {
  if (deal.price == null) {
    return deal.discountPct != null
      ? `<p class="deal-price deal-price-text">${deal.discountPct === 100 ? "Gratis" : `Hasta ${deal.discountPct}%`}</p><p class="deal-price-basis">Beneficio sin precio de pasaje asociado</p>`
      : `<p class="deal-price deal-price-text">Sin precio publicado</p>`;
  }
  const real = realSaving(deal);
  return `<p class="deal-price">${e(clp(deal.price))}${deal.referencePrice ? ` <s>${e(clp(deal.referencePrice))}</s>` : ""}</p>
    <p class="deal-price-basis">${e(deal.priceBasis || (deal.priceIncludesTaxes ? "Con tasas" : "Sin tasas"))}</p>
    ${real != null ? `<p class="deal-saving">Ahorro real ${String(real).replace(".", ",")}%${deal.discountPct ? ` · declarado hasta ${deal.discountPct}%` : ""}</p>`
      : deal.discountPct != null ? `<p class="deal-saving is-declared">Descuento declarado ${deal.discountPct}%</p>` : ""}`;
}

function dealCard({ deal, ev, mine }) {
  const st = ev.status.key;
  const conds = deal.conditions;
  return `<article class="deal-card" data-status="${st}" data-dtype="${deal.type}" id="deal-${deal.id}">
    <header class="deal-head">
      <span class="deal-type">${e(DEAL_TYPES[deal.type])}</span>
      <span class="deal-provider">${e(deal.provider)}</span>
      ${mine ? `<span class="deal-mine">Para tu viaje</span>` : ""}
      <span class="deal-status" data-status="${st}">${e(ev.status.label)}</span>
    </header>
    <div class="deal-body">
      <div class="deal-main">
        <h3 class="deal-title">${e(deal.title)}</h3>
        ${priceBlock(deal)}
      </div>
      <div class="deal-score">
        ${scoreRing(ev)}
        <p class="deal-score-label">${e(ev.label)}</p>
      </div>
    </div>
    ${ev.parts.length ? `<details class="deal-why"><summary>Por qué este puntaje</summary>
      <ul>${ev.parts.map((p) => `<li><span>${e(p.label)}</span><span class="muted">${e(p.note)}</span><strong>${p.pts > 0 && p.max ? `${p.pts}/${p.max}` : p.pts}</strong></li>`).join("")}</ul>
      ${ev.capped ? `<p class="small muted">Tope de 74: el ahorro se mide contra una referencia del propio proveedor, no contra un historial independiente.</p>` : ""}
    </details>` : ""}
    ${conds.length ? `<ul class="deal-conds">${conds.slice(0, 2).map((c) => `<li>${e(c)}</li>`).join("")}</ul>
      ${conds.length > 2 ? `<details class="deal-more"><summary>${plural(conds.length - 2, "condición más", "condiciones más")}</summary><ul class="deal-conds">${conds.slice(2).map((c) => `<li>${e(c)}</li>`).join("")}</ul></details>` : ""}` : ""}
    ${deal.notes ? `<p class="deal-notes">${e(deal.notes)}</p>` : ""}
    ${deal.travelDate ? `<p class="deal-notes">Fecha cotizada: ${e(fmtDate(deal.travelDate))}</p>` : ""}
    <p class="deal-source">${e(SOURCE_KINDS[deal.sourceKind])}${deal.sourceName ? ` · ${deal.sourceUrl ? `<a href="${e(deal.sourceUrl)}" target="_blank" rel="noopener">${e(deal.sourceName)}</a>` : e(deal.sourceName)}` : ""}${deal.verifiedAt ? ` · verificada ${e(fmtDate(deal.verifiedAt))}` : ""}${deal.travelUntil ? ` · volar hasta ${e(fmtDate(deal.travelUntil))}` : ""}${deal.fromFeed ? " · desde tu fuente automática" : ""}</p>
    <div class="deal-actions">
      ${st !== "expired" && deal.type !== "evento" ? `<button type="button" class="btn btn-sm admin" data-act="deal-reserve" data-id="${deal.id}">Guardar en reservas</button>` : ""}
      <button type="button" class="btn btn-sm" data-act="deal-analyze" data-id="${deal.id}">Copiar análisis</button>
      <span class="spacer"></span>
      <button type="button" class="icon-btn admin" data-act="deal-edit" data-id="${deal.id}" data-fk="dle-${deal.id}" aria-label="Editar oferta ${e(deal.title)}" title="Editar">✎</button>
      <button type="button" class="icon-btn danger admin" data-act="deal-delete" data-id="${deal.id}" aria-label="Eliminar oferta ${e(deal.title)}" title="Eliminar">×</button>
    </div>
  </article>`;
}

/* ------------------------------------------------------------------ */

function renderOffers(list) {
  const live = list.filter((x) => x.ev.status.key === "active");
  const upcoming = list.filter((x) => x.ev.status.key === "upcoming");
  const scored = list.filter((x) => x.ev.score != null).sort((a, b) => b.ev.score - a.ev.score);
  const mine = list.filter((x) => x.mine && x.ev.status.key !== "expired");
  const f = state.dealFilter;
  const typeChip = (key, label) => `<button type="button" class="chip" data-act="deal-type" data-type="${key}" aria-pressed="${f.type === key}">${label}</button>`;
  const shown = filtered(list);
  setHTML("dealKpis", `
    <div class="deal-kpi"><span class="deal-kpi-value">${live.length}</span><span>vigentes</span></div>
    <div class="deal-kpi"><span class="deal-kpi-value">${upcoming.length}</span><span>por empezar</span></div>
    <div class="deal-kpi"><span class="deal-kpi-value">${scored[0] ? scored[0].ev.score : "—"}</span><span>mejor puntaje</span></div>
    <div class="deal-kpi"><span class="deal-kpi-value">${mine.length}</span><span>para ${e(state.meta.destination)}</span></div>`);
  setHTML("dealChips", `${typeChip("all", "Todas")}${Object.entries(DEAL_TYPES).map(([k, v]) => typeChip(k, v)).join("")}`);
  const statusSel = document.getElementById("dealStatus");
  if (statusSel && statusSel.value !== f.status) statusSel.value = f.status;
  const mineBox = document.getElementById("dealMine");
  if (mineBox) { mineBox.checked = f.mine; mineBox.nextElementSibling.textContent = `Solo para ${state.meta.destination}`; }
  setHTML("dealList", shown.length ? `<div class="deal-grid">${shown.map(dealCard).join("")}</div>`
    : `<div class="empty"><p>No hay ofertas con estos filtros.</p><button type="button" class="btn btn-sm" data-act="deal-tab" data-tab="datos">Actualizar ofertas con Claude</button></div>`);
}

function renderAlerts(list) {
  const s = state.dealSettings;
  const alerts = computeAlerts(state.deals, s, state.meta.destination);
  const sw = (key, label, hint) => `<label class="switch-row"><input type="checkbox" data-deal-alert="${key}" ${s.alerts[key] ? "checked" : ""}><span class="switch" aria-hidden="true"></span><span><strong>${label}</strong><small>${hint}</small></span></label>`;
  setHTML("dp-alertas", `
    <div class="split">
      <div class="panel">
        <h3 class="panel-title">Alertas activas · ${alerts.length}</h3>
        ${alerts.length ? `<ul class="alert-list">${alerts.map((a) => `<li class="alert-item" data-type="${a.type}">
            <span class="alert-tag">${e(a.tag)}</span>
            <span class="alert-text">${e(a.text)}</span>
            <button type="button" class="link-btn" data-act="deal-goto" data-id="${a.deal.id}">Ver oferta</button></li>`).join("")}</ul>`
          : `<p class="muted">Ninguna oferta cumple hoy tus reglas de alerta.</p>`}
      </div>
      <div class="panel admin">
        <h3 class="panel-title">Reglas</h3>
        <form class="alert-rules" data-form="deal-rules" novalidate>
          ${sw("destination", `Ofertas para ${e(state.meta.destination)}`, "Destino del viaje activo")}
          ${sw("promo", "Promoción verificada", "Bases oficiales con ahorro de 15% o más")}
          ${sw("lastMinute", "Último minuto", "Cierra o empieza dentro de la ventana elegida")}
          ${sw("target", "Precio objetivo", "Precio por debajo de tu objetivo")}
          ${sw("exceptional", "Oferta excepcional", "Puntaje de 90 o más")}
          <div class="inline-form inline-form-tight rules-fields">
            <label class="field"><span>Precio objetivo (CLP)</span><input class="input" name="targetPrice" type="number" min="1000" step="1000" value="${s.targetPrice}"></label>
            <label class="field"><span>Ventana de último minuto</span>
              <select class="input" name="lastMinuteDays">${[3, 7, 14].map((d) => `<option value="${d}" ${s.lastMinuteDays === d ? "selected" : ""}>${d === 3 ? "72 horas" : `${d} días`}</option>`).join("")}</select></label>
            <div class="form-actions"><button type="submit" class="btn btn-primary">Guardar reglas</button></div>
            <p class="form-error" role="alert" hidden></p>
          </div>
        </form>
        <p class="small muted">Las alertas se calculan al abrir la app con los datos guardados. Para recibirlas sin abrirla hace falta la fuente automática (pestaña Actualizar datos) y un servicio que envíe avisos.</p>
      </div>
    </div>`);
  return alerts.length;
}

function renderNews() {
  const items = [...state.dealNews].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  setHTML("dp-noticias", `
    <div class="panel-bar"><p class="muted small">Solo noticias que cambian precios o disponibilidad, con fuente.</p>
      <button type="button" class="btn btn-sm admin" data-act="news-add">+ Agregar noticia</button></div>
    ${items.length ? `<ul class="news-list">${items.map((n) => `<li class="news-item">
        <div class="news-main">
          <p class="news-meta"><span class="badge badge-neutral" data-impact="${n.impact}">${e(NEWS_IMPACT[n.impact])}</span> ${e(n.source)}${n.date ? ` · ${e(fmtDate(n.date))}` : ""}</p>
          <p class="news-title">${n.url ? `<a href="${e(n.url)}" target="_blank" rel="noopener">${e(n.title)}</a>` : e(n.title)}</p>
        </div>
        <span class="row-actions admin">
          <button type="button" class="icon-btn" data-act="news-edit" data-id="${n.id}" aria-label="Editar noticia" title="Editar">✎</button>
          <button type="button" class="icon-btn danger" data-act="news-delete" data-id="${n.id}" aria-label="Eliminar noticia" title="Eliminar">×</button>
        </span></li>`).join("")}</ul>` : `<div class="empty"><p>Sin noticias registradas.</p></div>`}`);
}

function toolField(tool, [key, label, kind, extra]) {
  const id = `tool-${tool.id}-${key}`;
  const s = state.dealSettings;
  const value = kind === "origin" ? s.homeCity : kind === "destination" ? state.meta.destination : kind === "budget" ? s.targetPrice : kind === "number" ? extra : "";
  if (kind === "textarea") return `<label class="field field-wide" for="${id}"><span>${label}</span><textarea class="input" id="${id}" name="${key}" rows="3" placeholder="${e(extra || "")}"></textarea></label>`;
  const type = kind === "date" ? "date" : kind === "number" || kind === "budget" ? "number" : "text";
  const ph = kind === "origin" ? "Ej.: Santiago" : kind === "text" ? extra : "";
  return `<label class="field" for="${id}"><span>${label}</span><input class="input" id="${id}" name="${key}" type="${type}" value="${e(value ?? "")}" ${ph ? `placeholder="${e(ph)}"` : ""} ${type === "number" ? 'min="0"' : ""}></label>`;
}

function renderTools() {
  setHTML("dp-herramientas", `
    <p class="muted small tools-intro">Cada herramienta arma una instrucción precisa. Cópiala y pégala en tu chat con Claude para que busque y razone con datos en vivo.</p>
    <div class="tools-grid">${TOOLS.map((t, i) => `
      <form class="tool-card" data-form="deal-tool" data-tool="${t.id}" novalidate>
        <h3 class="tool-title"><span class="tool-num">${i + 1}</span>${e(t.title)}</h3>
        <p class="tool-desc">${e(t.desc)}</p>
        <div class="tool-fields">${t.fields.map((f) => toolField(t, f)).join("")}</div>
        <div class="form-actions"><button type="submit" class="btn btn-sm btn-primary">Generar instrucción</button></div>
        <p class="form-error" role="alert" hidden></p>
        <div class="tool-out" hidden>
          <label class="visually-hidden" for="out-${t.id}">Instrucción generada</label>
          <textarea class="input" id="out-${t.id}" rows="5" readonly></textarea>
          <button type="button" class="btn btn-sm" data-act="tool-copy" data-tool="${t.id}">Copiar</button>
        </div>
      </form>`).join("")}</div>`);
}

function renderData() {
  const s = state.dealSettings;
  setHTML("dp-datos", `
    <div class="split">
      <div class="panel">
        <h3 class="panel-title">Actualizar con Claude (sin costo)</h3>
        <ol class="steps">
          <li>Copia la instrucción de búsqueda.</li>
          <li>Pégala en tu chat con Claude: busca en vivo y responde con un bloque JSON.</li>
          <li>Pega ese JSON aquí e importa. Las ofertas repetidas se actualizan, no se duplican.</li>
        </ol>
        <div class="form-actions"><button type="button" class="btn btn-primary btn-sm" data-act="deal-refresh-prompt">Copiar instrucción de búsqueda</button></div>
        <form data-form="deal-import" novalidate>
          <label class="field field-wide" for="dealImport"><span>JSON con ofertas</span>
            <textarea class="input" id="dealImport" name="json" rows="6" placeholder='{"version":1,"deals":[…],"news":[…]}'></textarea></label>
          <div class="form-actions"><button type="submit" class="btn btn-sm">Importar ofertas</button></div>
          <p class="form-error" role="alert" hidden></p>
        </form>
        <p class="small muted">${s.lastSync ? `Última actualización: ${e(new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s.lastSync)))}` : `Datos iniciales verificados el ${SEED_VERIFIED_LABEL} (hora de Chile).`}</p>
      </div>
      <div class="panel">
        <h3 class="panel-title">Fuente automática (opcional)</h3>
        <p class="small muted">Si publicas un JSON con el mismo formato (por ejemplo, una hoja de Google con Apps Script programado), la app lo lee cada vez que se abre y reemplaza las ofertas de esa fuente.</p>
        <form class="inline-form inline-form-tight" data-form="deal-feed" novalidate>
          <label class="field field-wide" for="dealFeedUrl"><span>URL del JSON</span><input class="input" id="dealFeedUrl" name="feedUrl" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="${e(s.feedUrl)}"></label>
          <label class="field" for="dealHome"><span>Ciudad de origen habitual</span><input class="input" id="dealHome" name="homeCity" maxlength="60" placeholder="Ej.: Santiago" value="${e(s.homeCity)}"></label>
          <label class="field" for="dealEmail"><span>Correo para el informe</span><input class="input" id="dealEmail" name="reportEmail" type="email" maxlength="120" placeholder="tu@correo.cl" value="${e(s.reportEmail)}" autocomplete="email"></label>
          <div class="form-actions">
            <button type="submit" class="btn btn-sm btn-primary">Guardar</button>
            <button type="button" class="btn btn-sm" data-act="deal-sync" ${s.feedUrl ? "" : "disabled"}>Sincronizar ahora</button>
          </div>
          <p class="form-error" role="alert" hidden></p>
        </form>
        <h3 class="panel-title">Exportar y limpiar</h3>
        <div class="form-actions">
          <button type="button" class="btn btn-sm" data-act="deal-export">Copiar JSON de mis ofertas</button>
          <button type="button" class="btn btn-sm btn-ghost" data-act="deal-purge">Eliminar ofertas vencidas</button>
        </div>
      </div>
    </div>`);
}

/* ------------------------------------------------------------------ */
/* Informe del día (Travel Deal Analyst)                               */
/* ------------------------------------------------------------------ */

export function reportModel(now = new Date()) {
  return buildReportModel({
    deals: state.deals, news: state.dealNews, discarded: state.dealDiscarded,
    settings: state.dealSettings, destination: state.meta.destination
  }, now);
}

function renderReport() {
  const model = reportModel();
  const email = buildEmailSummary(model);
  const scope = state.reportScope;
  const flights = model.flights.filter((r) => scope === "all" || r.scope === scope);
  const scopeChip = (key, label) => `<button type="button" class="chip" data-act="report-scope" data-scope="${key}" aria-pressed="${scope === key}">${label}</button>`;
  const to = state.dealSettings.reportEmail;
  const srcLink = (d) => (d.sourceUrl ? `<a href="${e(d.sourceUrl)}" target="_blank" rel="noopener">${e(d.sourceName || SOURCE_KINDS[d.sourceKind])}</a>` : e(d.sourceName || SOURCE_KINDS[d.sourceKind]));
  setHTML("dp-informe", `
    <div class="panel-bar report-bar">
      <p class="muted small">Verificado: <strong>${e(model.stamp)}</strong> (hora de Chile) · fuentes: LATAM, SKY, JetSMART, Despegar, Booking y prensa</p>
      <div class="form-actions">
        <button type="button" class="btn btn-sm btn-primary" data-act="report-download">Descargar dashboard</button>
        <button type="button" class="btn btn-sm admin" data-act="deal-refresh-prompt">Nueva corrida con Claude</button>
      </div>
    </div>
    <div class="deal-kpis report-kpis">${model.kpis.map((k) => `<div class="deal-kpi"><span class="deal-kpi-value">${e(k.value)}</span><span>${e(k.label)}</span></div>`).join("")}</div>

    <div class="panel report-mail admin">
      <h3 class="panel-title">Correo de actualización</h3>
      <p class="small"><strong>Asunto:</strong> <span id="reportSubject">${e(email.subject)}</span></p>
      <ol class="report-lines" id="reportLines">${email.lines.map((l) => `<li>${e(l)}</li>`).join("")}</ol>
      <div class="form-actions">
        <button type="button" class="btn btn-sm" data-act="report-copy-mail">Copiar asunto y resumen</button>
        <a class="btn btn-sm" id="reportMailto" href="${e(mailtoHref(to, email))}">Abrir en mi correo${to ? ` (${e(to)})` : ""}</a>
      </div>
      <p class="small muted">${to ? "" : "Guarda tu correo en “Actualizar datos” para completar el destinatario. "}El correo abre con el asunto y el resumen; adjunta el dashboard descargado (${e(email.filename)}).</p>
    </div>

    <div class="panel">
      <h3 class="panel-title">Comparador de vuelos · ${flights.length}</h3>
      <div class="chips" role="group" aria-label="Alcance">${scopeChip("all", "Todos")}${scopeChip("nacional", "Nacional")}${scopeChip("internacional", "Internacional")}</div>
      ${flights.length ? `<div class="table-wrap"><table class="report-table" id="reportFlights">
        <thead><tr><th scope="col">Ruta</th><th scope="col">Canal</th><th scope="col">Precio</th><th scope="col">Estado</th><th scope="col">Puntaje</th><th scope="col">Fuente</th></tr></thead>
        <tbody>${flights.map((r) => `<tr data-scope="${r.scope}">
          <td><button type="button" class="link-btn" data-act="deal-goto" data-id="${r.deal.id}">${e(r.deal.title)}</button></td>
          <td>${e(r.deal.provider)}</td>
          <td class="num"><strong>${e(clp(r.deal.price))}</strong><small>${e(r.deal.priceIncludesTaxes ? "con tasas" : "sin tasas")}</small></td>
          <td>${e(r.ev.status.label)}</td>
          <td class="num">${r.ev.score ?? "—"}</td>
          <td>${srcLink(r.deal)}</td></tr>`).join("")}</tbody></table></div>`
        : `<p class="muted">Sin tarifas de vuelo verificables para este filtro.</p>`}
    </div>

    <div class="panel">
      <h3 class="panel-title">Alojamiento · ${model.stays.length}</h3>
      ${model.stays.length ? `<div class="table-wrap"><table class="report-table" id="reportStays">
        <thead><tr><th scope="col">Hotel</th><th scope="col">Precio</th><th scope="col">Antes</th><th scope="col">Ahorro</th><th scope="col">Estado</th><th scope="col">Fuente</th></tr></thead>
        <tbody>${model.stays.map((r) => `<tr>
          <td><button type="button" class="link-btn" data-act="deal-goto" data-id="${r.deal.id}">${e(r.deal.title)}</button></td>
          <td class="num"><strong>${e(clp(r.deal.price))}</strong><small>${e(r.deal.priceBasis)}</small></td>
          <td class="num">${r.deal.referencePrice ? e(clp(r.deal.referencePrice)) : "—"}</td>
          <td class="num">${e(realSavingLabel(r.deal))}</td>
          <td>${e(r.ev.status.label)}</td>
          <td>${srcLink(r.deal)}</td></tr>`).join("")}</tbody></table></div>`
        : `<p class="muted">Sin alojamiento verificable en la última corrida.</p>`}
    </div>

    <div class="split">
      <div class="panel">
        <h3 class="panel-title">Cobertura por fuente</h3>
        <ul class="coverage-list">${model.coverage.map((c) => `<li data-empty="${c.count === 0}"><strong>${e(c.name)}</strong>
          <span>${c.count ? `${plural(c.count, "oferta vigente", "ofertas vigentes")}${c.direct ? ` · ${c.direct} de fuente oficial` : " · vía agregador o prensa"}` : "Sin hallazgos verificables"}</span></li>`).join("")}</ul>
      </div>
      <div class="panel">
        <div class="panel-bar"><h3 class="panel-title">Descartados · ${model.discarded.length}</h3>
          ${model.discarded.length ? `<button type="button" class="btn btn-sm btn-ghost admin" data-act="discarded-clear">Limpiar</button>` : ""}</div>
        ${model.discarded.length ? `<ul class="discard-list">${model.discarded.map((d) => `<li>
          <div><p class="discard-title">${d.url ? `<a href="${e(d.url)}" target="_blank" rel="noopener">${e(d.title)}</a>` : e(d.title)}</p>
          <p class="small muted">${e(d.reason)}${d.source ? ` · ${e(d.source)}` : ""}${d.date ? ` · ${e(fmtDate(d.date))}` : ""}</p></div>
          <button type="button" class="icon-btn danger admin" data-act="discarded-delete" data-id="${d.id}" aria-label="Quitar ${e(d.title)}" title="Quitar">×</button></li>`).join("")}</ul>`
          : `<p class="muted small">Nada descartado en la última corrida.</p>`}
      </div>
    </div>`);
}

export function renderDeals() {
  if (state.shareMode) return;
  const list = evaluatedDeals();
  const alertsCount = computeAlerts(state.deals, state.dealSettings, state.meta.destination).length;
  const ADMIN_TABS = ["herramientas", "datos"];
  const tab = state.readOnly && ADMIN_TABS.includes(state.dealsTab) ? "ofertas" : state.dealsTab;
  setHTML("dealsTabs", TABS.map(([k, label]) => `<button type="button" role="tab" class="tab${ADMIN_TABS.includes(k) ? " admin" : ""}" data-act="deal-tab" data-tab="${k}" data-fk="dt-${k}" aria-selected="${tab === k}" aria-controls="dp-${k}">${label}${k === "alertas" ? ` · ${alertsCount}` : k === "ofertas" ? ` · ${list.filter((x) => x.ev.status.key !== "expired").length}` : ""}</button>`).join(""));
  TABS.forEach(([k]) => { const el = document.getElementById(`dp-${k}`); if (el) el.hidden = k !== tab; });
  renderOffers(list);
  renderReport();
  renderAlerts(list);
  renderNews();
  renderTools();
  renderData();
  const live = list.filter((x) => x.ev.status.key === "active").length;
  const sub = document.getElementById("sub-ofertas");
  if (sub) sub.textContent = `${plural(live, "oferta vigente", "ofertas vigentes")} · ${plural(alertsCount, "alerta", "alertas")} · precios en CLP`;
}
