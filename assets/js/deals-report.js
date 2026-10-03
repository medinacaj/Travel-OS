// Informe Travel Deal Analyst: KPIs, comparador de vuelos, alojamiento, cobertura por fuente,
// descartados, resumen para correo y dashboard HTML descargable. Lógica pura (sin DOM ni estado).
import {
  scoreDeal, realSaving, computeAlerts, ANALYST_SOURCES, SOURCE_KINDS, SEED_VERIFIED_LABEL, NEWS_IMPACT
} from "./deals-core.js";
import { escapeHtml as e } from "./util.js";

const CHILE_PLACES = [
  "chile", "santiago", "arica", "iquique", "calama", "antofagasta", "copiapo", "la serena", "coquimbo", "valparaiso",
  "vina del mar", "rancagua", "talca", "chillan", "concepcion", "temuco", "valdivia", "osorno", "puerto montt",
  "castro", "chiloe", "balmaceda", "coyhaique", "punta arenas", "puerto natales", "isla de pascua", "rapa nui",
  "san pedro de atacama", "atacama", "pucon", "puerto varas", "rutas nacionales"
];
const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const isChile = (place) => { const p = fold(place); return !p || CHILE_PLACES.some((c) => p.includes(c)); };

/** nacional / internacional: usa el campo si existe; si no, lo deduce de origen y destino. */
export function dealScope(deal) {
  if (deal.scope) return deal.scope;
  return isChile(deal.origin) && isChile(deal.destination) ? "nacional" : "internacional";
}

export function realSavingLabel(deal) {
  const r = realSaving(deal);
  return r != null ? `${String(r).replace(".", ",")}%` : deal.discountPct ? `${deal.discountPct}%` : "—";
}

export const clp = (n) => `$${Math.round(n).toLocaleString("es-CL")}`;
const fmtDay = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00-03:00` : iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Santiago" }).format(d);
};
const fmtStamp = (date) => new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" }).format(date);
export const isoDayChile = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(date);

/** Cuántas ofertas vigentes aporta cada fuente revisada. */
export function sourceCoverage(rows) {
  return ANALYST_SOURCES.map((name) => {
    const hits = rows.filter(({ deal }) => fold(`${deal.provider} ${deal.sourceName}`).includes(fold(name)));
    return { name, count: hits.length, direct: hits.filter(({ deal }) => deal.sourceKind === "bases" || deal.sourceKind === "oficial").length };
  });
}

/**
 * Modelo del informe a partir del estado. `now` permite pruebas deterministas.
 * @returns {{stamp, flights, stays, events, kpis, best, coverage, alerts, news, discarded, liveCount}}
 */
export function buildReportModel({ deals, news, discarded, settings, destination }, now = new Date()) {
  const rows = deals.map((deal) => ({ deal, ev: scoreDeal(deal, settings, now), scope: dealScope(deal) }));
  const live = rows.filter((r) => r.ev.status.key !== "expired");
  const active = live.filter((r) => r.ev.status.key === "active");
  const flights = live.filter((r) => (r.deal.type === "vuelo" || r.deal.type === "paquete") && r.deal.price != null)
    .sort((a, b) => a.deal.price - b.deal.price);
  const stays = live.filter((r) => r.deal.type === "estadia" && r.deal.price != null)
    .sort((a, b) => (realSaving(b.deal) ?? b.deal.discountPct ?? 0) - (realSaving(a.deal) ?? a.deal.discountPct ?? 0));
  const events = live.filter((r) => r.deal.type === "evento" || r.deal.type === "beneficio");
  const cheapest = (scope) => flights.filter((r) => r.scope === scope && !/⇄/.test(r.deal.title))[0];
  const topStay = stays[0];
  const best = active.filter((r) => r.ev.score != null)
    .sort((a, b) => b.ev.score - a.ev.score || (realSaving(b.deal) ?? 0) - (realSaving(a.deal) ?? 0))[0] || null;
  const nextEvent = events.filter((r) => r.deal.type === "evento").sort((a, b) => (a.deal.validFrom || "").localeCompare(b.deal.validFrom || ""))[0];
  const stamp = settings.lastSync ? fmtStamp(new Date(settings.lastSync)) : SEED_VERIFIED_LABEL;
  return {
    stamp,
    generated: fmtStamp(now),
    destination,
    liveCount: live.length,
    flights, stays, events, best,
    kpis: [
      { value: String(active.length), label: "ofertas vigentes hoy" },
      cheapest("nacional") ? { value: clp(cheapest("nacional").deal.price), label: `tramo nacional más barato · ${cheapest("nacional").deal.title}${cheapest("nacional").deal.priceIncludesTaxes ? "" : " (sin tasas)"}` } : { value: "—", label: "sin tramo nacional verificado" },
      cheapest("internacional") ? { value: clp(cheapest("internacional").deal.price), label: `tramo internacional más barato · ${cheapest("internacional").deal.title}${cheapest("internacional").deal.priceIncludesTaxes ? "" : " (sin tasas)"}` } : { value: "—", label: "sin tramo internacional verificado" },
      topStay ? { value: `${Math.round(realSaving(topStay.deal) ?? topStay.deal.discountPct ?? 0)}%`, label: `mayor descuento hotelero · ${topStay.deal.title}` } : { value: "—", label: "sin alojamiento verificado" },
      nextEvent ? { value: nextEvent.ev.status.key === "upcoming" ? fmtDay(nextEvent.deal.validFrom).replace(/ de \d{4}$| \d{4}$/, "") : "En curso", label: nextEvent.deal.title } : { value: "—", label: "sin eventos de venta próximos" }
    ],
    coverage: sourceCoverage(live),
    alerts: computeAlerts(deals, settings, destination, now),
    news: [...news].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 8),
    discarded
  };
}

/** Asunto y cuerpo de 3 líneas (más pie) para enviar el informe por correo. */
export function buildEmailSummary(model, now = new Date()) {
  const day = isoDayChile(now);
  const subject = `Travel Deal Analyst — actualización ${day}`;
  const b = model.best;
  const line1 = b
    ? `Mejor hallazgo: ${b.deal.title} (${b.deal.provider}) a ${clp(b.deal.price)}${b.deal.priceIncludesTaxes ? "" : " sin tasas"}${realSaving(b.deal) != null ? `, ${String(realSaving(b.deal)).replace(".", ",")}% bajo el precio publicado antes` : ""} · ${b.ev.score}/100 · fuente: ${b.deal.sourceName || SOURCE_KINDS[b.deal.sourceKind]}.`
    : "Mejor hallazgo: ninguna oferta vigente con precio verificable hoy.";
  const vuelos = model.flights.filter((r) => r.ev.status.key === "active").length;
  const event = model.events.find((r) => r.deal.type === "evento");
  const line2 = `Vigentes: ${vuelos} ${vuelos === 1 ? "tarifa de vuelo" : "tarifas de vuelo"} y ${model.stays.length} ${model.stays.length === 1 ? "alojamiento" : "alojamientos"}${event ? `; próximo evento: ${event.deal.title}, ${event.ev.status.label.toLowerCase()}` : ""}.`;
  const empty = model.coverage.filter((c) => c.count === 0).map((c) => c.name);
  const line3 = empty.length
    ? `Sin hallazgos verificables hoy en: ${empty.join(", ")}.${model.discarded.length ? ` ${model.discarded.length} descartados por vencidos o no verificables.` : ""}`
    : `Todas las fuentes revisadas tienen hallazgos verificables.${model.discarded.length ? ` ${model.discarded.length} descartados.` : ""}`;
  const body = [line1, line2, line3, "", `Verificado: ${model.stamp} (hora de Chile). Dashboard adjunto: travel-deal-analyst-${day}.html`].join("\n");
  return { subject, body, lines: [line1, line2, line3], filename: `travel-deal-analyst-${day}.html` };
}

export function mailtoHref(to, { subject, body }) {
  return `mailto:${encodeURIComponent(to || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ------------------------------------------------------------------ */
/* Dashboard HTML autocontenido (adjunto del correo)                   */
/* ------------------------------------------------------------------ */

const link = (url, text) => (url ? `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(text)}</a>` : e(text));

export function buildReportHtml(model, email) {
  const flightRows = model.flights.map((r) => `<tr data-c="${r.scope === "nacional" ? "nac" : "int"}">
      <td>${e(r.deal.title)}</td><td>${e(r.deal.provider)}</td><td data-v="${r.deal.price}">${e(clp(r.deal.price))}</td>
      <td>${e(r.deal.priceBasis)}</td><td>${e(r.ev.status.label)}</td><td>${r.ev.score ?? "—"}</td>
      <td>${link(r.deal.sourceUrl, r.deal.sourceName || SOURCE_KINDS[r.deal.sourceKind])}</td></tr>`).join("");
  const stayRows = model.stays.map((r) => `<tr><td>${e(r.deal.title)}</td><td>${e(clp(r.deal.price))}</td>
      <td>${r.deal.referencePrice ? e(clp(r.deal.referencePrice)) : "—"}</td><td><b>${realSaving(r.deal) != null ? `${String(realSaving(r.deal)).replace(".", ",")}%` : r.deal.discountPct ? `${r.deal.discountPct}%` : "—"}</b></td>
      <td>${e(r.ev.status.label)}</td><td>${link(r.deal.sourceUrl, r.deal.sourceName)}</td></tr>`).join("");
  const cov = model.coverage.map((c) => `<li><b>${e(c.name)}</b>: ${c.count ? `${c.count} ${c.count === 1 ? "oferta vigente" : "ofertas vigentes"}${c.direct ? ` (${c.direct} de fuente oficial)` : " (vía agregador o prensa)"}` : `<span class="bad">sin hallazgos verificables hoy</span>`}</li>`).join("");
  const news = model.news.map((n) => `<li><b>${e(fmtDay(n.date) || "s/f")}</b> · ${e(NEWS_IMPACT[n.impact])} — ${link(n.url, n.title)} <span class="meta">(${e(n.source)})</span></li>`).join("");
  const alerts = model.alerts.slice(0, 10).map((a) => `<div class="alert"><b>${e(a.tag)}:</b> ${e(a.text)}</div>`).join("");
  const disc = model.discarded.map((d) => `<li>${link(d.url, d.title)} — ${e(d.reason)}${d.source ? ` <span class="meta">(${e(d.source)})</span>` : ""}</li>`).join("");
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Travel Deal Analyst — ${e(email.subject.split("— ")[1] || "")}</title>
<style>
:root{--bg:#f6f7f9;--panel:#fff;--ink:#16202c;--mute:#5d6b7a;--line:#e3e7ec;--acc:#0b6bcb;--bad:#b42318;--warn:#b26a00;--side:#0f1b2a;--sideink:#c9d4e0}
@media (prefers-color-scheme:dark){:root{--bg:#0d1218;--panel:#151c25;--ink:#e6edf3;--mute:#93a1b0;--line:#26313d;--acc:#5aa9ff;--bad:#ff7a6e;--warn:#f0b04a;--side:#0a0f14;--sideink:#a9b7c6}}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--ink)}
.app{display:flex;min-height:100vh}nav{width:220px;background:var(--side);color:var(--sideink);padding:20px 14px;position:sticky;top:0;height:100vh;flex-shrink:0}
nav h1{font-size:16px;color:#fff;margin:0 0 4px}nav small{display:block;margin-bottom:18px;opacity:.8}
nav a{display:block;color:var(--sideink);text-decoration:none;padding:8px 10px;border-radius:6px}nav a:hover{background:rgba(255,255,255,.08);color:#fff}
main{flex:1;padding:24px;max-width:1100px;min-width:0}section{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px;margin-bottom:18px}
h2{margin:0 0 12px;font-size:18px}.meta{color:var(--mute);font-size:13px}.bad{color:var(--bad)}a{color:var(--acc)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.kpi{border:1px solid var(--line);border-radius:8px;padding:12px}.kpi b{display:block;font-size:24px}.kpi span{color:var(--mute);font-size:13px}
.tw{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--mute);font-weight:600;white-space:nowrap}th[data-k]{cursor:pointer}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.filters button{border:1px solid var(--line);background:var(--panel);color:var(--ink);padding:6px 12px;border-radius:99px;cursor:pointer}.filters button.on{background:var(--acc);color:#fff;border-color:var(--acc)}
ul{padding-left:18px;margin:0}li{margin-bottom:8px}.alert{border-left:4px solid var(--warn);padding:8px 12px;margin-bottom:10px;background:rgba(178,106,0,.07);border-radius:4px}
.mail{white-space:pre-wrap;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:12px;font-size:14px}
@media(max-width:760px){.app{display:block}nav{width:auto;height:auto;position:static;padding:12px 16px}nav a{display:inline-block}main{padding:16px}}
</style></head><body><div class="app">
<nav><h1>Travel Deal Analyst</h1><small>Verificado: ${e(model.stamp)} (hora de Chile)</small>
<a href="#kpis">Resumen</a><a href="#vuelos">Comparador de vuelos</a><a href="#hoteles">Alojamiento</a><a href="#cobertura">Cobertura</a><a href="#noticias">Noticias</a><a href="#alertas">Alertas</a><a href="#descartes">Descartados</a></nav>
<main>
<section id="kpis"><h2>Resumen</h2><p class="meta">Generado desde Travel OS el ${e(model.generated)}. Solo ofertas con fuente y fecha de verificación; no se inventan precios ni descuentos.</p>
<div class="kpis">${model.kpis.map((k) => `<div class="kpi"><b>${e(k.value)}</b><span>${e(k.label)}</span></div>`).join("")}</div>
<h3>Resumen del correo</h3><div class="mail">${e(email.lines.join("\n"))}</div></section>
<section id="vuelos"><h2>Comparador de vuelos</h2>
${model.flights.length ? `<div class="filters" id="vf"><button class="on" data-f="all">Todos</button><button data-f="nac">Nacional</button><button data-f="int">Internacional</button></div>
<div class="tw"><table id="vt"><thead><tr><th data-k="0">Ruta</th><th data-k="1">Aerolínea / canal</th><th data-k="2">Precio CLP</th><th>Detalle</th><th>Estado</th><th data-k="5">Puntaje</th><th>Fuente</th></tr></thead><tbody>${flightRows}</tbody></table></div>`
    : `<p class="bad">Sin tarifas de vuelo verificables en esta corrida.</p>`}</section>
<section id="hoteles"><h2>Alojamiento</h2>
${model.stays.length ? `<div class="tw"><table><thead><tr><th>Hotel</th><th>Precio</th><th>Antes</th><th>Ahorro</th><th>Estado</th><th>Fuente</th></tr></thead><tbody>${stayRows}</tbody></table></div>`
    : `<p class="bad">Sin alojamiento verificable en esta corrida.</p>`}</section>
<section id="cobertura"><h2>Cobertura por fuente</h2><ul>${cov}</ul></section>
<section id="noticias"><h2>Noticias de la industria</h2>${news ? `<ul>${news}</ul>` : `<p class="bad">Sin noticias verificables en esta corrida.</p>`}</section>
<section id="alertas"><h2>Alertas</h2>${alerts || `<p class="meta">Ninguna oferta cumple hoy las reglas de alerta.</p>`}</section>
<section id="descartes"><h2>Descartados por vencidos o no verificables</h2>${disc ? `<ul class="meta">${disc}</ul>` : `<p class="meta">Nada descartado en esta corrida.</p>`}</section>
</main></div>
<script>
document.querySelectorAll('#vf button').forEach(function(b){b.onclick=function(){document.querySelectorAll('#vf button').forEach(function(x){x.classList.remove('on')});b.classList.add('on');var f=b.dataset.f;document.querySelectorAll('#vt tbody tr').forEach(function(r){r.style.display=(f==='all'||r.dataset.c===f)?'':'none'})}});
var asc=true;document.querySelectorAll('#vt th[data-k]').forEach(function(th){th.onclick=function(){var k=+th.dataset.k,tb=document.querySelector('#vt tbody'),rows=[].slice.call(tb.rows);rows.sort(function(a,b){var A=a.cells[k],B=b.cells[k],va=A.dataset.v?+A.dataset.v:(isNaN(+A.textContent)?A.textContent:+A.textContent),vb=B.dataset.v?+B.dataset.v:(isNaN(+B.textContent)?B.textContent:+B.textContent);return (va>vb?1:va<vb?-1:0)*(asc?1:-1)});asc=!asc;rows.forEach(function(r){tb.appendChild(r)})}});
</script></body></html>`;
}
