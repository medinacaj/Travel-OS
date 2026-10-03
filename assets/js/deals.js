// Acciones del módulo Ofertas: siempre mutan el estado central vía commit/setUi.
import { state, commit, setUi, saveReservation } from "./store.js";
import { normalizeDeal, normalizeNews, normalizeDealSettings, parseImport, dealStatus } from "./deals-core.js";
import { uid, fmtMoney } from "./util.js";

const dedupeKey = (d) => `${d.provider}|${d.title}|${d.validUntil}`.toLowerCase();

export function saveDeal(data, id) {
  const deal = normalizeDeal({ ...data, id: id || uid("deal") });
  if (!deal) return false;
  return commit(id ? `Editar oferta “${deal.title}”` : `Agregar oferta “${deal.title}”`, () => {
    const i = state.deals.findIndex((d) => d.id === id);
    if (i === -1) state.deals.unshift(deal); else state.deals[i] = { ...deal, fromFeed: state.deals[i].fromFeed };
  });
}

export function deleteDeal(id) {
  const deal = state.deals.find((d) => d.id === id);
  if (!deal) return false;
  return commit(`Eliminar oferta “${deal.title}”`, () => { state.deals = state.deals.filter((d) => d.id !== id); });
}

export function deleteExpiredDeals() {
  const now = new Date();
  const expired = state.deals.filter((d) => dealStatus(d, now).key === "expired");
  if (!expired.length) return 0;
  commit(`Eliminar ${expired.length} ofertas vencidas`, () => {
    const ids = new Set(expired.map((d) => d.id));
    state.deals = state.deals.filter((d) => !ids.has(d.id));
  });
  return expired.length;
}

/** Importa ofertas/noticias pegadas (JSON). Devuelve un resumen o un error. */
export function importDealsText(text) {
  const parsed = parseImport(text);
  if (parsed.error) return { error: parsed.error };
  let added = 0; let updated = 0; let newsAdded = 0; let discardedAdded = 0;
  commit(`Importar ${parsed.deals.length} ofertas`, () => {
    const byKey = new Map(state.deals.map((d) => [dedupeKey(d), d]));
    parsed.deals.forEach((d) => {
      const existing = state.deals.find((x) => x.id === d.id) || byKey.get(dedupeKey(d));
      if (existing) { Object.assign(existing, { ...d, id: existing.id }); updated++; }
      else { state.deals.unshift(d); added++; }
    });
    const titles = new Set(state.dealNews.map((n) => n.title.toLowerCase()));
    parsed.news.forEach((n) => { if (!titles.has(n.title.toLowerCase())) { state.dealNews.unshift(n); newsAdded++; } });
    const seen = new Set(state.dealDiscarded.map((x) => `${x.title}|${x.reason}`.toLowerCase()));
    parsed.discarded.forEach((x) => { if (!seen.has(`${x.title}|${x.reason}`.toLowerCase())) { state.dealDiscarded.unshift(x); discardedAdded++; } });
  });
  setUi({ dealSettings: { ...state.dealSettings, lastSync: new Date().toISOString() } }, { render: false });
  return { added, updated, newsAdded, discardedAdded, skipped: parsed.skipped || 0 };
}

/** Fuente remota opcional (p. ej. JSON publicado por Google Apps Script). Reemplaza las ofertas de la fuente. */
export async function syncFeed({ silent = false } = {}) {
  const url = state.dealSettings.feedUrl;
  if (!url || state.shareMode) return { error: "No hay una fuente configurada." };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = parseImport(await res.text());
    if (parsed.error) return { error: parsed.error };
    const feedDeals = parsed.deals.map((d) => ({ ...d, fromFeed: true }));
    const titles = new Set(state.dealNews.map((n) => n.title.toLowerCase()));
    setUi({
      deals: [...feedDeals, ...state.deals.filter((d) => !d.fromFeed)],
      dealNews: [...parsed.news.filter((n) => !titles.has(n.title.toLowerCase())), ...state.dealNews],
      dealDiscarded: parsed.discarded.length ? parsed.discarded : state.dealDiscarded,
      dealSettings: { ...state.dealSettings, lastSync: new Date().toISOString() }
    }, { keys: ["deals", "dealNews", "dealDiscarded", "dealSettings"] });
    return { count: feedDeals.length };
  } catch (err) {
    return { error: silent ? "" : `No se pudo leer la fuente (${err.name === "AbortError" ? "tiempo agotado" : err.message}). Revisa la URL y que permita CORS.` };
  } finally {
    clearTimeout(timer);
  }
}

export function setDealSettings(patch) {
  setUi({ dealSettings: normalizeDealSettings({ ...state.dealSettings, ...patch, alerts: { ...state.dealSettings.alerts, ...(patch.alerts || {}) } }) });
}

export function setDealFilter(patch) {
  setUi({ dealFilter: { ...state.dealFilter, ...patch } });
}

export function saveNews(data, id) {
  const item = normalizeNews({ ...data, id: id || uid("news") });
  if (!item) return false;
  return commit(id ? "Editar noticia" : "Agregar noticia", () => {
    const i = state.dealNews.findIndex((n) => n.id === id);
    if (i === -1) state.dealNews.unshift(item); else state.dealNews[i] = item;
  });
}
export function deleteNews(id) {
  return commit("Eliminar noticia", () => { state.dealNews = state.dealNews.filter((n) => n.id !== id); });
}

/** Lleva una oferta a Reservas como pendiente, con precio, condiciones y fuente en las notas. */
export function dealToReservation(id) {
  const d = state.deals.find((x) => x.id === id);
  if (!d) return false;
  const lines = [
    d.price != null ? `Precio: ${fmtMoney(d.price, "CLP")} ${d.priceIncludesTaxes ? "con tasas" : "sin tasas"}${d.priceBasis ? ` (${d.priceBasis})` : ""}` : "",
    d.conditions.length ? `Condiciones: ${d.conditions.join(" · ")}` : "",
    d.sourceUrl ? `Fuente: ${d.sourceUrl}` : ""
  ].filter(Boolean);
  return saveReservation({ name: `${d.provider}: ${d.title}`.slice(0, 120), status: "Pendiente", datetime: "", code: "", notes: lines.join("\n").slice(0, 500) });
}

export function deleteDiscarded(id) {
  return commit("Quitar descartado", () => { state.dealDiscarded = state.dealDiscarded.filter((x) => x.id !== id); });
}
export function clearDiscarded() {
  if (!state.dealDiscarded.length) return false;
  return commit(`Limpiar ${state.dealDiscarded.length} descartados`, () => { state.dealDiscarded = []; });
}
