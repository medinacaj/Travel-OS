// Utilidades puras (sin acceso al DOM ni al estado).

export const CATEGORIES = ["Comida", "Transporte", "Naturaleza", "Cultura", "Compras", "Imperdible"];
export const CAT_SLUG = {
  Comida: "food", Transporte: "transport", Naturaleza: "nature",
  Cultura: "culture", Compras: "shopping", Imperdible: "musts"
};
// Colores sólidos para SVG y marcadores del mapa (los temas usan variables CSS).
export const CAT_HEX = {
  Comida: "#e2620a", Transporte: "#2563eb", Naturaleza: "#16a34a",
  Cultura: "#7c3aed", Compras: "#db2777", Imperdible: "#0d9488"
};
export const PERIODS = ["Mañana", "Tarde", "Noche"];
export const PRIORITIES = ["Imprescindible", "Alta", "Media", "Normal"];
export const RES_STATUS = ["Pendiente", "Confirmada", "Cancelada"];
export const DOC_CATEGORIES = ["Pasaje", "Alojamiento", "Entrada", "Seguro", "Identificación", "Otro"];
export const EXPENSE_CATEGORIES = ["Comida", "Alojamiento", "Transporte", "Entradas", "Compras", "Otros"];
export const STYLES = ["Relax", "Gastronómico", "Aventura", "Cultural", "Mixto"];
export const CURRENCIES = { USD: "US$", ARS: "AR$", CLP: "CLP$", EUR: "€" };

const HTML_ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESC[c]);
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function str(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function toNumber(value) {
  if (value === "" || value === null || value === undefined) return NaN;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export const isValidLat = (v) => Number.isFinite(v) && v >= -90 && v <= 90;
export const isValidLng = (v) => Number.isFinite(v) && v >= -180 && v <= 180;
export const hasCoords = (p) => isValidLat(p?.lat) && isValidLng(p?.lng);

function placeQuery(p, destination) {
  return encodeURIComponent([p.name, destination].filter(Boolean).join(", "));
}
export function mapsSearchUrl(p, destination) {
  return hasCoords(p)
    ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${placeQuery(p, destination)}`;
}
export function mapsDirUrl(p, destination) {
  return hasCoords(p)
    ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${placeQuery(p, destination)}`;
}
export function wazeUrl(p, destination) {
  return hasCoords(p)
    ? `https://www.waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`
    : `https://www.waze.com/ul?q=${placeQuery(p, destination)}&navigate=yes`;
}

export function safeHttpUrl(value) {
  try {
    const u = new URL(String(value || "").trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch {
    return "";
  }
}

export function initials(name) {
  const words = String(name || "?").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const stop = new Set(["de", "del", "la", "las", "el", "los", "y", "en"]);
  const main = words.filter((w) => !stop.has(w.toLowerCase()));
  const pick = (main.length ? main : words).slice(0, 2).map((w) => w[0]).join("");
  return (pick || "?").toUpperCase();
}

const phCache = new Map();
export function placeholderSvg(name, category) {
  const key = `${name}|${category}`;
  if (phCache.has(key)) return phCache.get(key);
  const color = CAT_HEX[category] || "#64748b";
  const ini = escapeHtml(initials(name));
  const label = escapeHtml(String(name || "").slice(0, 22));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="${color}"/><circle cx="132" cy="28" r="58" fill="#ffffff" fill-opacity="0.12"/><text x="80" y="88" text-anchor="middle" font-family="Georgia,serif" font-size="54" fill="#ffffff">${ini}</text><text x="80" y="128" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#ffffff" fill-opacity="0.9">${label}</text></svg>`;
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  phCache.set(key, uri);
  return uri;
}

export function fmtMoney(amount, code = "USD") {
  const symbol = CURRENCIES[code] || code;
  const digits = code === "CLP" || code === "ARS" ? 0 : 2;
  const n = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(amount || 0);
  return `${symbol} ${n}`;
}

export function fmtDateTime(value) {
  if (!value) return "Sin fecha";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function fmtBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// base64url para el enlace compartido (UTF-8 seguro).
export function encodeShare(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodeShare(text) {
  const b64 = String(text).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
