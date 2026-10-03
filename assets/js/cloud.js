// Cliente mínimo de Supabase (Auth + PostgREST + Storage) con fetch, sin dependencias.
// Solo habla con la URL configurada; la sesión del administrador se guarda en este navegador.
import { CONFIG } from "./config.js";

export const cloudEnabled = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseKey);
const BASE = CONFIG.supabaseUrl;
const SESSION_KEY = "ba_cloud_session_v1";
const TIMEOUT = 12000;

let session = readSession();

function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return s && typeof s.access_token === "string" && typeof s.refresh_token === "string" ? s : null;
  } catch { return null; }
}
function writeSession(s) {
  session = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* sin almacenamiento: la sesión dura lo que la pestaña */ }
}

export const currentUser = () => (session ? session.user || null : null);
export const hasSession = () => Boolean(session);

class CloudError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function request(path, { method = "GET", body, headers = {}, auth = true, raw = false } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  const h = { apikey: CONFIG.supabaseKey, ...headers };
  if (auth && session) h.Authorization = `Bearer ${session.access_token}`;
  if (body !== undefined && !(body instanceof Blob) && !h["Content-Type"]) h["Content-Type"] = "application/json";
  try {
    const res = await fetch(`${BASE}${path}`, {
      method, headers: h, signal: ctrl.signal, cache: "no-store",
      body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body)
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.error_description || j.msg || j.message || j.error || msg; } catch { /* sin cuerpo */ }
      throw new CloudError(msg, res.status);
    }
    if (raw) return res;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    if (err instanceof CloudError) throw err;
    throw new CloudError(err.name === "AbortError" ? "Tiempo de espera agotado" : "Sin conexión con la base de datos", 0);
  } finally {
    clearTimeout(timer);
  }
}

function storeTokenResponse(r) {
  const expiresAt = r.expires_at || Math.floor(Date.now() / 1000) + (r.expires_in || 3600);
  writeSession({ access_token: r.access_token, refresh_token: r.refresh_token, expires_at: expiresAt, user: r.user ? { id: r.user.id, email: r.user.email } : null });
}

/** Renueva el token si vence en menos de un minuto. Si la renovación es rechazada, cierra la sesión. */
async function ensureFresh() {
  if (!session) return;
  if (session.expires_at - 60 > Date.now() / 1000) return;
  try {
    const r = await request("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: session.refresh_token }, auth: false });
    storeTokenResponse(r);
  } catch (err) {
    if (err.status >= 400 && err.status < 500) writeSession(null);
    throw err;
  }
}

async function authed(path, opts) {
  await ensureFresh();
  try {
    return await request(path, opts);
  } catch (err) {
    if (err.status === 401 && session) { // token revocado o vencido: un reintento tras renovar
      session.expires_at = 0;
      await ensureFresh();
      return request(path, opts);
    }
    throw err;
  }
}

/* Autenticación ------------------------------------------------------ */

export async function signIn(email, password) {
  try {
    const r = await request("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password }, auth: false });
    storeTokenResponse(r);
    return { user: currentUser() };
  } catch (err) {
    return { error: err.status === 400 ? "Correo o contraseña incorrectos." : err.message };
  }
}

export async function signOut() {
  if (session) { try { await request("/auth/v1/logout", { method: "POST", body: {} }); } catch { /* igual se cierra local */ } }
  writeSession(null);
}

/** true solo si el usuario de la sesión está en la tabla admins (protegida por RLS). */
export async function checkAdmin() {
  const user = currentUser();
  if (!user) return false;
  const rows = await authed(`/rest/v1/admins?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`);
  return Array.isArray(rows) && rows.length > 0;
}

/* Datos -------------------------------------------------------------- */

/** Devuelve { key: { data, updatedAt } } con lo que este usuario puede leer según RLS. */
export async function fetchState() {
  const rows = await authed("/rest/v1/app_state?select=key,data,updated_at");
  const out = {};
  (rows || []).forEach((r) => { out[r.key] = { data: r.data, updatedAt: r.updated_at }; });
  return out;
}

/** Inserta o actualiza varias claves en una sola llamada. */
export async function pushState(entries) {
  if (!entries.length) return;
  await authed("/rest/v1/app_state?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: entries.map(({ key, data, isPublic }) => ({ key, data, is_public: isPublic }))
  });
}

/** Borra claves (por ejemplo, las secciones de un viaje eliminado). */
export async function deleteState(keys) {
  if (!keys.length) return;
  const list = keys.map((k) => `"${k.replace(/"/g, "")}"`).join(",");
  await authed(`/rest/v1/app_state?key=in.(${encodeURIComponent(list)})`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

/* Archivos ----------------------------------------------------------- */

const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");

export async function uploadFile(bucket, path, blob) {
  await authed(`/storage/v1/object/${bucket}/${encPath(path)}`, {
    method: "POST", body: blob, headers: { "Content-Type": blob.type || "application/octet-stream", "x-upsert": "true", "cache-control": "3600" }
  });
  return path;
}
export const publicFileUrl = (bucket, path) => `${BASE}/storage/v1/object/public/${bucket}/${encPath(path)}`;
export async function downloadFile(bucket, path) {
  const res = await authed(`/storage/v1/object/authenticated/${bucket}/${encPath(path)}`, { raw: true });
  return res.blob();
}
export async function removeFiles(bucket, paths) {
  if (!paths.length) return;
  await authed(`/storage/v1/object/${bucket}`, { method: "DELETE", body: { prefixes: paths } });
}
export const isOwnPublicUrl = (url) => typeof url === "string" && url.startsWith(`${BASE}/storage/v1/object/public/`);
