// Sincronización con la base central (Supabase). La base es la fuente de verdad:
// al abrir se descarga; cada cambio del administrador se sube (solo las secciones que cambiaron).
// Sin conexión, los cambios quedan pendientes y se reintentan solos.
//
// Nombres en la base: las secciones de un viaje se guardan como "<clave>@<id del viaje>"
// (el primer viaje usa la clave sin sufijo). "publicTrips" es la lista pública de viajes
// visibles para visitantes; "tripIndex" (privado) es la lista completa del administrador.
import * as C from "./cloud.js";
import {
  state, applyRemoteState, clearPrivateState, setPersistHook, TRIP_KEYS, LEGACY_TRIP_ID, tripSuffix
} from "./store.js";

const GLOBAL_PUBLIC = ["deals", "dealNews", "dealDiscarded", "publicTrips"];
const GLOBAL_PRIVATE = ["dealSettings", "tripIndex"];
const TRIP_PUBLIC = ["meta", "trips", "imageUrls"];

const lastPushed = new Map(); // clave en la base → JSON subido o recibido
const pending = new Map();    // clave en la base → { data, json, isPublic } (foto tomada al cambiar)
let timer = null;
let pushing = false;
let notify = () => {};

const cloudKey = (k, tripId = state.activeTripId) => (TRIP_KEYS.includes(k) ? `${k}${tripSuffix(tripId)}` : k);
function parseKey(key) {
  const [base, trip] = key.split("@");
  return { base, trip: TRIP_KEYS.includes(base) ? (trip || LEGACY_TRIP_ID) : null };
}
const tripIsPublic = (id) => Boolean(state.tripIndex.find((t) => t.id === id)?.isPublic);
const publicTripsValue = () => state.tripIndex.filter((t) => t.isPublic);
function isPublicKey(key) {
  const { base, trip } = parseKey(key);
  if (GLOBAL_PUBLIC.includes(base)) return true;
  if (TRIP_PUBLIC.includes(base)) return tripIsPublic(trip);
  return false;
}

function setStatus(status, message = "") {
  state.cloud = { ...state.cloud, status, message, ...(status === "saved" ? { lastSync: new Date().toISOString() } : {}) };
  notify();
}
function setRole(role) {
  state.cloud = { ...state.cloud, role, user: role === "admin" ? (C.currentUser()?.email || "") : "" };
  state.readOnly = role !== "admin";
  document.body.classList.toggle("viewer-mode", role !== "admin");
}

export const cloudMode = () => state.cloud.mode === "cloud";
export const isAdmin = () => !cloudMode() || state.cloud.role === "admin";
export const hasPending = () => pending.size > 0 || pushing;

/** Prepara una clave para subir. Devuelve true si hay algo nuevo (evita reintentos en bucle sin cambios). */
function stage(key, value, { force = false } = {}) {
  const json = JSON.stringify(value);
  const prev = pending.get(key);
  if (!force && (prev ? prev.json === json : lastPushed.get(key) === json)) return false;
  pending.set(key, { data: value, json, isPublic: isPublicKey(key) });
  return true;
}

function queuePush(keys) {
  if (!cloudMode() || state.cloud.role !== "admin") return;
  let changed = false;
  keys.forEach((k) => {
    if (TRIP_KEYS.includes(k)) changed = stage(cloudKey(k), state[k]) || changed;
    else if (k === "tripIndex") { changed = stage("tripIndex", state.tripIndex) || changed; changed = stage("publicTrips", publicTripsValue()) || changed; }
    else if ([...GLOBAL_PUBLIC, ...GLOBAL_PRIVATE].includes(k)) changed = stage(k, state[k]) || changed;
  });
  // Sin cambios nuevos no se reprograma: los pendientes por falta de red se reintentan al volver la red o cada 30 s.
  if (changed) schedule();
}
function schedule() {
  if (!pending.size) return;
  if (state.cloud.status !== "saving") setStatus("saving");
  clearTimeout(timer);
  timer = setTimeout(flush, 700);
}

export async function flush() {
  clearTimeout(timer);
  if (pushing || !pending.size || state.cloud.role !== "admin") return;
  pushing = true;
  const batch = [...pending.entries()];
  pending.clear();
  try {
    await C.pushState(batch.map(([key, e]) => ({ key, data: e.data, isPublic: e.isPublic })));
    batch.forEach(([key, e]) => lastPushed.set(key, e.json));
    pushing = false;
    if (pending.size) { flush(); return; }
    setStatus("saved");
  } catch (err) {
    pushing = false;
    batch.forEach(([key, e]) => { if (!pending.has(key)) pending.set(key, e); });
    if (err.status === 401 || err.status === 403) {
      setStatus("error", "La sesión venció o no tiene permisos. Vuelve a iniciar sesión; los cambios siguen en este navegador.");
    } else {
      setStatus("pending", "Sin conexión: los cambios se guardarán en la base cuando vuelva la red.");
    }
  }
}

/** Cambió la visibilidad de un viaje: se vuelven a subir su itinerario (con el nuevo is_public) y la lista pública. */
export function onVisibilityChange(tripId) {
  if (!cloudMode() || state.cloud.role !== "admin") return;
  if (tripId === state.activeTripId) TRIP_PUBLIC.forEach((k) => stage(cloudKey(k), state[k], { force: true }));
  else TRIP_PUBLIC.forEach((k) => { const key = cloudKey(k, tripId); if (lastCache.has(key)) stage(key, lastCache.get(key), { force: true }); });
  stage("tripIndex", state.tripIndex);
  stage("publicTrips", publicTripsValue(), { force: true });
  schedule();
}

/** Borra de la base las secciones de un viaje eliminado. */
export async function deleteTripRemote(tripId) {
  if (!cloudMode() || state.cloud.role !== "admin" || tripId === LEGACY_TRIP_ID) return;
  const keys = TRIP_KEYS.map((k) => cloudKey(k, tripId));
  keys.forEach((k) => { pending.delete(k); lastPushed.delete(k); lastCache.delete(k); });
  try { await C.deleteState(keys); } catch { /* quedan huérfanas; no afectan a la app */ }
  queuePush(["tripIndex"]);
}

const lastCache = new Map(); // última copia leída de la base (para cambiar de viaje sin otra descarga)

/** Descarga la base y aplica lo global y el viaje abierto. Primera sesión con base vacía: sube lo local. */
export async function pull() {
  if (!cloudMode()) return;
  if (hasPending()) { await flush(); if (hasPending()) return; }
  setStatus("loading");
  try {
    const remote = await C.fetchState();
    lastCache.clear();
    Object.entries(remote).forEach(([k, v]) => { lastCache.set(k, v.data); lastPushed.set(k, JSON.stringify(v.data)); });
    applyCache();
    if (state.cloud.role === "admin") {
      // Lo que aún no existe en la base (base nueva, viaje nuevo o sección nueva) se sube.
      TRIP_KEYS.forEach((k) => { if (!lastCache.has(cloudKey(k))) stage(cloudKey(k), state[k]); });
      [...GLOBAL_PUBLIC, ...GLOBAL_PRIVATE].forEach((k) => {
        if (!lastCache.has(k)) stage(k, k === "publicTrips" ? publicTripsValue() : state[k]);
      });
      if (pending.size) { await flush(); return; }
    }
    setStatus("saved");
  } catch (err) {
    setStatus("error", `No se pudo leer la base de datos (${err.message}). Se muestra la última copia guardada en este navegador.`);
  }
}

/** Aplica la copia de la base al estado: lo global y las secciones del viaje abierto. */
export function applyCache() {
  if (!lastCache.size) return;
  const data = {};
  const admin = state.cloud.role === "admin";
  ["deals", "dealNews", "dealDiscarded", "dealSettings"].forEach((k) => { if (lastCache.has(k)) data[k] = lastCache.get(k); });
  if (admin && lastCache.has("tripIndex")) data.tripIndex = lastCache.get("tripIndex");
  if (!admin) data.tripIndex = lastCache.get("publicTrips") || [];
  // El visitante solo puede abrir viajes públicos: si el abierto no lo es, se pasa al primero público.
  const index = Array.isArray(data.tripIndex) ? data.tripIndex : state.tripIndex;
  if (!admin && index.length && !index.some((t) => t && t.id === state.activeTripId)) state.activeTripId = index[0].id;
  TRIP_KEYS.forEach((k) => { const key = cloudKey(k); if (lastCache.has(key)) data[k] = lastCache.get(key); });
  const applied = applyRemoteState(data);
  applied.forEach((k) => { if (TRIP_KEYS.includes(k)) lastPushed.set(cloudKey(k), JSON.stringify(state[k])); });
}

export async function login(email, password) {
  const r = await C.signIn(email, password);
  if (r.error) return r;
  let admin = false;
  try { admin = await C.checkAdmin(); } catch (err) { await C.signOut(); return { error: `No se pudo verificar la cuenta: ${err.message}` }; }
  if (!admin) { await C.signOut(); return { error: "Esta cuenta no tiene permisos de administrador." }; }
  setRole("admin");
  await pull();
  return { ok: true };
}

export async function logout({ force = false } = {}) {
  await flush();
  if (hasPending() && !force) return { error: "Hay cambios que aún no llegan a la base (sin conexión). Si sales ahora se pierden." };
  await C.signOut();
  pending.clear();
  setRole("visitor");
  clearPrivateState();
  await pull();
  return { ok: true };
}

/** Arranque: decide el modo y el rol, engancha la subida automática y descarga la base. */
export async function startCloud(onChange) {
  notify = onChange || notify;
  if (!C.cloudEnabled || state.shareMode) {
    state.cloud = { ...state.cloud, mode: "local", role: "admin", status: "idle" };
    state.readOnly = state.shareMode;
    return;
  }
  state.cloud = { ...state.cloud, mode: "cloud" };
  setRole("visitor");
  setPersistHook(queuePush);
  if (C.hasSession()) {
    try {
      if (await C.checkAdmin()) setRole("admin");
      else await C.signOut();
    } catch (err) {
      if (err.status >= 400 && err.status < 500) await C.signOut();
      else setStatus("error", "Sin conexión: no se pudo verificar la sesión. Modo lectura hasta que vuelva la red.");
    }
  }
  await pull();
  window.addEventListener("online", () => (hasPending() ? flush() : pull()));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !hasPending()) pull(); });
  window.addEventListener("beforeunload", (ev) => { if (hasPending()) { flush(); ev.preventDefault(); ev.returnValue = ""; } });
  setInterval(() => { if (pending.size) flush(); }, 30000);
}
