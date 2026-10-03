// Estado único de la aplicación + persistencia + historial + acciones.
// Para migrar a backend: reemplazar readSlice/persist por llamadas a la API
// manteniendo la misma forma del estado y las mismas acciones.

import { seedDeals, seedNews, seedDiscarded, defaultDealSettings, normalizeDeal, normalizeNews, normalizeDiscarded, normalizeDealSettings, SEED_VERSION } from "./deals-core.js";
import {
  CATEGORIES, PERIODS, PRIORITIES, RES_STATUS, DOC_CATEGORIES, EXPENSE_CATEGORIES,
  STYLES, CURRENCIES, uid, str, toNumber, isValidLat, isValidLng
} from "./util.js";

/* ------------------------------------------------------------------ */
/* Datos iniciales (viaje de ejemplo a Buenos Aires)                   */
/* ------------------------------------------------------------------ */

// [hora, nombre, lat, lng, duración, traslado, prioridad, categoría, contexto, bloque, horaFija]
const SEED_DAYS = [
  { name: "Centro histórico", items: [
    ["08:15", "Café Tortoni", -34.6081, -58.3783, "60 min", "A pie", "Alta", "Comida", "Café histórico de Avenida de Mayo • Ideal para la mañana", "Mañana", false],
    ["09:30", "Plaza de Mayo", -34.6084, -58.3712, "30 min", "A pie", "Alta", "Imperdible", "Gratis • A 10 min a pie del café", "Mañana", false],
    ["10:05", "Catedral Metropolitana", -34.6075, -58.3731, "40 min", "A pie", "Media", "Cultura", "Gratis • Frente a la plaza • Bajo techo", "Mañana", false],
    ["10:50", "Casa Rosada", -34.6080, -58.3703, "60 min", "A pie", "Imprescindible", "Cultura", "Visita guiada con turno • Llevar documento", "Mañana", true],
    ["14:00", "Obelisco", -34.6037, -58.3816, "30 min", "Subte", "Alta", "Imperdible", "Gratis • Buen punto para fotos de tarde", "Tarde", false]
  ]},
  { name: "Recoleta y arte", items: [
    ["09:30", "El Ateneo Grand Splendid", -34.5962, -58.3941, "45 min", "Colectivo", "Alta", "Compras", "Librería en un antiguo teatro • Bajo techo", "Mañana", false],
    ["10:30", "Cementerio de Recoleta", -34.5875, -58.3930, "90 min", "A pie", "Imprescindible", "Cultura", "Entrada pagada • Ir con calzado cómodo", "Mañana", false],
    ["", "Basílica del Pilar", -34.5871, -58.3924, "30 min", "A pie", "Media", "Cultura", "Junto al cementerio • Bajo techo", "Tarde", false],
    ["15:00", "Museo Nacional de Bellas Artes", -34.5839, -58.3926, "120 min", "A pie", "Alta", "Cultura", "A 10 min a pie • Ideal para la tarde", "Tarde", false],
    ["18:30", "Floralis Genérica", -34.5815, -58.3937, "30 min", "A pie", "Media", "Imperdible", "Escultura monumental • Lindo al atardecer", "Tarde", false]
  ]},
  { name: "La Boca + San Telmo", items: [
    ["10:00", "Caminito", -34.6391, -58.3628, "60 min", "Taxi", "Imprescindible", "Imperdible", "Ir de día • Recorrer solo la zona turística", "Mañana", false],
    ["11:30", "Fundación Proa", -34.6383, -58.3622, "60 min", "A pie", "Media", "Cultura", "Arte contemporáneo • Bajo techo", "Mañana", false],
    ["14:00", "Mercado de San Telmo", -34.6215, -58.3717, "75 min", "Taxi", "Alta", "Comida", "Almuerzo y antigüedades • Bajo techo", "Tarde", false],
    ["", "Mafalda", -34.6212, -58.3714, "15 min", "A pie", "Normal", "Imperdible", "Estatua para foto • A pasos del mercado", "Tarde", false],
    ["17:00", "Plaza Dorrego", -34.6214, -58.3731, "45 min", "A pie", "Media", "Compras", "Feria de antigüedades los domingos", "Tarde", false]
  ]},
  { name: "Palermo", items: [
    ["09:30", "Jardín Botánico", -34.5827, -58.4185, "60 min", "Subte", "Media", "Naturaleza", "Gratis • Mejor temprano", "Mañana", false],
    ["11:00", "Jardín Japonés", -34.5753, -58.4095, "60 min", "A pie", "Alta", "Naturaleza", "Entrada pagada • Paseo tranquilo", "Mañana", false],
    ["15:00", "MALBA", -34.5768, -58.4033, "120 min", "A pie", "Imprescindible", "Cultura", "Arte latinoamericano • Ideal si llueve", "Tarde", false],
    ["", "Plaza Armenia", -34.5882, -58.4261, "45 min", "Taxi", "Normal", "Compras", "Diseño local y cafés alrededor", "Tarde", false],
    ["20:30", "Plaza Serrano", -34.5889, -58.4301, "120 min", "A pie", "Alta", "Comida", "Bares y cena en Palermo Soho", "Noche", false]
  ]},
  { name: "Costanera, Puerto Madero y Centro", items: [
    ["09:00", "Reserva Ecológica Costanera Sur", -34.6132, -58.3500, "90 min", "Taxi", "Media", "Naturaleza", "Gratis • Llevar agua y protector", "Mañana", false],
    ["11:30", "Puente de la Mujer", -34.6079, -58.3657, "30 min", "A pie", "Alta", "Imperdible", "Paseo por los diques • Gratis", "Mañana", false],
    ["13:30", "Galerías Pacífico", -34.5984, -58.3744, "60 min", "Subte", "Normal", "Compras", "Cúpula con murales • Bajo techo", "Tarde", false],
    ["15:00", "Teatro Colón", -34.6011, -58.3832, "60 min", "A pie", "Imprescindible", "Cultura", "Visita guiada con horario • Reserva recomendada", "Tarde", true],
    ["", "Avenida Corrientes", -34.6031, -58.3846, "60 min", "A pie", "Media", "Cultura", "Teatros y librerías abiertas de noche", "Noche", false],
    ["21:00", "Pizzería Güerrín", -34.6033, -58.3859, "60 min", "A pie", "Alta", "Comida", "Pizza al molde clásica • Puede haber fila", "Noche", false]
  ]}
];

function seedTrips() {
  return SEED_DAYS.map((day, d) => ({
    id: `day_${d + 1}`,
    name: day.name,
    items: day.items.map((row, i) => normalizePlace({ ...arrayToPlace(row), id: `p${d + 1}_${i + 1}` }))
  }));
}

function seedState() {
  const people = [
    { id: "per_juan", name: "Juan" },
    { id: "per_maria", name: "María" },
    { id: "per_pedro", name: "Pedro" }
  ];
  const all = people.map((p) => p.id);
  return {
    meta: { destination: "Buenos Aires", country: "Argentina", style: "Mixto", isDemo: true },
    trips: seedTrips(),
    budget: { base: 500, currency: "USD", moves: [] },
    pending: [
      { id: "pen_1", text: "Contratar seguro de viaje", priority: "Importante", done: false },
      { id: "pen_2", text: "Revisar si la tarjeta funciona en Argentina", priority: "Normal", done: false },
      { id: "pen_3", text: "Descargar mapa sin conexión de Buenos Aires", priority: "Normal", done: false }
    ],
    reservations: [
      { id: "res_1", name: "Vuelo de ida", datetime: "", status: "Confirmada", code: "", notes: "Datos de ejemplo: completar fecha y localizador" },
      { id: "res_2", name: "Alojamiento en San Telmo", datetime: "", status: "Confirmada", code: "", notes: "" },
      { id: "res_3", name: "Visita guiada Teatro Colón", datetime: "", status: "Pendiente", code: "", notes: "Comprar en el sitio oficial del teatro" },
      { id: "res_4", name: "Visita guiada Casa Rosada", datetime: "", status: "Pendiente", code: "", notes: "Requiere turno previo" },
      { id: "res_5", name: "Vuelo de regreso", datetime: "", status: "Confirmada", code: "", notes: "" }
    ],
    documents: [
      { id: "doc_1", name: "Póliza de seguro de viaje", category: "Seguro", url: "", fileKey: "", fileName: "", fileSize: 0, notes: "Ejemplo: sube aquí el PDF de la póliza" }
    ],
    ideas: [
      { id: "idea_1", name: "Feria de Mataderos", category: "Cultura", targetDay: 3, context: "Solo fines de semana • Folklore y comida", votes: 2, promoted: false },
      { id: "idea_2", name: "Café de los Angelitos", category: "Comida", targetDay: 0, context: "Café notable • Cerca del Congreso", votes: 1, promoted: false }
    ],
    people,
    groupExpenses: [
      { id: "gx_1", concept: "Cena en Güerrín", amount: 60, category: "Comida", payerId: "per_juan", participantIds: all },
      { id: "gx_2", concept: "Taxi a La Boca", amount: 24, category: "Transporte", payerId: "per_maria", participantIds: all },
      { id: "gx_3", concept: "Entradas MALBA", amount: 45, category: "Entradas", payerId: "per_pedro", participantIds: ["per_juan", "per_pedro"] }
    ],
    notes: {},
    doneItems: {}
  };
}

/* ------------------------------------------------------------------ */
/* Normalización y validación (también se usa para el enlace compartido) */
/* ------------------------------------------------------------------ */

function arrayToPlace(r) {
  return {
    time: r[0], name: r[1], lat: r[2], lng: r[3], duration: r[4], transport: r[5],
    priority: r[6], category: r[7], context: r[8], period: r[9], fixedTime: r[10]
  };
}

const ID_RE = /^[\w-]{1,64}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizePlace(raw) {
  const r = Array.isArray(raw) ? arrayToPlace(raw) : raw;
  if (!r || typeof r !== "object") return null;
  const name = str(r.name, 120);
  if (!name) return null;
  let lat = toNumber(r.lat ?? r.coordinates?.lat);
  let lng = toNumber(r.lng ?? r.coordinates?.lng);
  if (!isValidLat(lat) || !isValidLng(lng)) { lat = null; lng = null; }
  const time = TIME_RE.test(r.time) ? r.time : "";
  return {
    id: typeof r.id === "string" && ID_RE.test(r.id) ? r.id : uid("pl"),
    time,
    name,
    lat,
    lng,
    duration: str(r.duration, 40),
    transport: str(r.transport, 40),
    priority: PRIORITIES.includes(r.priority) ? r.priority : "Normal",
    category: CATEGORIES.includes(r.category) ? r.category : "Imperdible",
    context: str(r.context, 160),
    period: PERIODS.includes(r.period) ? r.period : "Tarde",
    fixedTime: Boolean(r.fixedTime) && Boolean(time)
  };
}

export function normalizeTrips(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const seen = new Set();
  const days = raw.slice(0, 30).map((d, i) => {
    const items = (Array.isArray(d?.items) ? d.items : []).slice(0, 60).map(normalizePlace).filter(Boolean);
    items.forEach((p) => { if (seen.has(p.id)) p.id = uid("pl"); seen.add(p.id); });
    return {
      id: typeof d?.id === "string" && ID_RE.test(d.id) ? d.id : uid("day"),
      name: str(d?.name, 80) || `Día ${i + 1}`,
      items
    };
  });
  return days;
}

export function normalizeMeta(raw) {
  const m = raw && typeof raw === "object" ? raw : {};
  return {
    destination: str(m.destination, 80) || "Mi viaje",
    country: str(m.country, 60),
    style: STYLES.includes(m.style) ? m.style : "Mixto",
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(m.startDate || "") && !Number.isNaN(Date.parse(m.startDate)) ? m.startDate : "",
    isDemo: Boolean(m.isDemo)
  };
}

const arr = (v) => (Array.isArray(v) ? v : null);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);

function normalizeBudget(b) {
  const o = obj(b);
  if (!o) return null;
  const base = toNumber(o.base);
  return {
    base: Number.isFinite(base) && base >= 0 ? base : 500,
    currency: CURRENCIES[o.currency] ? o.currency : "USD",
    moves: (arr(o.moves) || []).filter((m) => m && Number.isFinite(m.amount) && m.amount > 0).map((m) => ({
      id: typeof m.id === "string" ? m.id : uid("mv"),
      type: m.type === "add" ? "add" : "expense",
      amount: m.amount,
      concept: str(m.concept, 80),
      currency: CURRENCIES[m.currency] ? m.currency : "USD",
      at: str(m.at, 40)
    }))
  };
}

/* ------------------------------------------------------------------ */
/* Estado                                                              */
/* ------------------------------------------------------------------ */

export const STORAGE = {
  theme: "ba_trip_theme",
  budget: "ba_trip_budget_v2",
  collapsed: "ba_collapsed_sections_v1",
  notes: "ba_panorama_notes_v1",
  imageUrls: "ba_destination_image_urls_v2",
  trips: "ba_trips_admin_v1",
  pending: "ba_pending_admin_v1",
  reservations: "ba_reservations_admin_v1",
  documents: "ba_documents_admin_v1",
  meta: "ba_trip_meta_v1",
  travelMode: "ba_travel_mode_v1",
  todayDay: "ba_today_day_v1",
  doneItems: "ba_done_items_v1",
  ideas: "ba_ideas_v1",
  people: "ba_people_v1",
  groupExpenses: "ba_group_expenses_v1",
  mapLayer: "ba_map_layer_v4",
  deals: "ba_deals_v1",
  dealNews: "ba_deal_news_v1",
  dealSettings: "ba_deal_settings_v1",
  dealDiscarded: "ba_deal_discarded_v1",
  tripIndex: "ba_trip_index_v1",
  ui: "ba_ui_v1"
};

/* Varios viajes: estas secciones pertenecen a un viaje. El primer viaje (LEGACY_TRIP_ID) usa las
   claves históricas sin sufijo, así los datos de versiones anteriores siguen funcionando sin migrar;
   los demás viajes guardan cada sección como "<clave>@<id del viaje>". */
export const TRIP_KEYS = ["meta", "trips", "imageUrls", "budget", "pending", "reservations", "documents", "ideas", "people", "groupExpenses", "notes", "doneItems"];
export const LEGACY_TRIP_ID = "viaje_1";
const TRIP_ID_RE = /^[a-z0-9_-]{1,40}$/i;
export const tripSuffix = (id) => (id === LEGACY_TRIP_ID ? "" : `@${id}`);
const skey = (k, id = state.activeTripId) => (TRIP_KEYS.includes(k) ? `${STORAGE[k]}${tripSuffix(id)}` : STORAGE[k]);
const OBSOLETE_KEYS = ["ba_hidden_sections_v1", "ba_map_view", "ba_map_layer_v2", "ba_map_layer_v3"];

export const state = {
  meta: {},
  trips: [],
  activeDay: 0,
  itineraryView: "day",
  theme: "ui",
  budget: { base: 500, currency: "USD", moves: [] },
  pending: [],
  pendingFilter: "open",
  reservations: [],
  documents: [],
  ideas: [],
  people: [],
  groupExpenses: [],
  doneItems: {},
  notes: {},
  imageUrls: {},
  travelMode: false,
  todayDay: 0,
  collapsed: [],
  mapLayer: "streets",
  deals: [],
  dealNews: [],
  dealSettings: defaultDealSettings(),
  dealDiscarded: [],
  dealsTab: "ofertas",
  dealFilter: { type: "all", status: "live", q: "", mine: false },
  reportScope: "all",
  // Varios viajes: índice con el resumen de cada viaje y el viaje abierto.
  tripIndex: [],
  activeTripId: LEGACY_TRIP_ID,
  route: "inicio",
  // Base central: mode "local" (solo este navegador) o "cloud"; role "visitor" (solo lectura) o "admin".
  cloud: { mode: "local", role: "admin", status: "idle", user: "", lastSync: "", message: "" },
  readOnly: false,
  shareMode: false
};

let storageOk = true;
function readSlice(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function loadState() {
  try { OBSOLETE_KEYS.forEach((k) => localStorage.removeItem(k)); } catch { storageOk = false; }
  const ui0 = obj(readSlice(STORAGE.ui)) || {};
  state.tripIndex = normalizeTripIndex(readSlice(STORAGE.tripIndex));
  const wanted = typeof ui0.activeTripId === "string" && TRIP_ID_RE.test(ui0.activeTripId) ? ui0.activeTripId : LEGACY_TRIP_ID;
  state.activeTripId = state.tripIndex.some((t) => t.id === wanted) ? wanted : (state.tripIndex[0]?.id || LEGACY_TRIP_ID);
  loadTripSlices(state.activeTripId);
  state.collapsed = (arr(readSlice(STORAGE.collapsed)) || []).filter((s) => typeof s === "string");
  const theme = readSlice(STORAGE.theme);
  state.theme = ["claro", "noche", "arena", "factory", "seline", "steep", "ui", "ui-noche"].includes(theme) ? theme : document.documentElement.dataset.theme || "ui";
  state.travelMode = readSlice(STORAGE.travelMode) === true;
  state.todayDay = Number.isInteger(readSlice(STORAGE.todayDay)) ? readSlice(STORAGE.todayDay) : 0;
  const layer = readSlice(STORAGE.mapLayer);
  state.mapLayer = ["streets", "terrain", "satellite"].includes(layer) ? layer : "streets";
  ensureIndexEntry();
  state.deals = cleanList(readSlice(STORAGE.deals), seedDeals(), normalizeDeal);
  state.dealNews = cleanList(readSlice(STORAGE.dealNews), seedNews(), normalizeNews);
  state.dealDiscarded = cleanList(readSlice(STORAGE.dealDiscarded), seedDiscarded(), normalizeDiscarded);
  const rawSettings = readSlice(STORAGE.dealSettings);
  state.dealSettings = normalizeDealSettings(rawSettings);
  const fresh = rawSettings === undefined && readSlice(STORAGE.deals) === undefined;
  mergeNewSeeds(fresh ? SEED_VERSION : Number.isInteger(rawSettings?.seedVersion) ? rawSettings.seedVersion : 1);
  const ui = obj(readSlice(STORAGE.ui)) || {};
  state.activeDay = Number.isInteger(ui.activeDay) ? ui.activeDay : 0;
  state.itineraryView = ui.itineraryView === "all" ? "all" : "day";
  state.pendingFilter = ["open", "all", "done"].includes(ui.pendingFilter) ? ui.pendingFilter : "open";
  state.dealsTab = DEAL_TABS.includes(ui.dealsTab) ? ui.dealsTab : "ofertas";
  state.reportScope = ["all", "nacional", "internacional"].includes(ui.reportScope) ? ui.reportScope : "all";
  state.route = typeof ui.route === "string" ? ui.route.slice(0, 40) : "inicio";
  const df = obj(ui.dealFilter) || {};
  state.dealFilter = {
    type: ["all", "vuelo", "estadia", "paquete", "beneficio", "evento"].includes(df.type) ? df.type : "all",
    status: ["live", "all", "expired"].includes(df.status) ? df.status : "live",
    q: str(df.q, 60),
    mine: df.mine === true
  };
  clampDays();
}

export const DEAL_TABS = ["ofertas", "informe", "alertas", "noticias", "herramientas", "datos"];

/**
 * Quien ya usaba la app conserva sus ofertas: al subir SEED_VERSION solo se agregan
 * las ofertas, noticias y descartes nuevos (por id), sin pisar ediciones ni duplicar.
 */
function mergeNewSeeds(storedVersion) {
  if (storedVersion >= SEED_VERSION) {
    state.dealSettings.seedVersion = SEED_VERSION;
    return;
  }
  const add = (list, seeds) => {
    const ids = new Set(list.map((x) => x.id));
    return [...seeds.filter((x) => !ids.has(x.id)), ...list];
  };
  state.deals = add(state.deals, seedDeals());
  state.dealNews = add(state.dealNews, seedNews());
  state.dealDiscarded = add(state.dealDiscarded, seedDiscarded());
  state.dealSettings.seedVersion = SEED_VERSION;
  persist(["deals", "dealNews", "dealDiscarded", "dealSettings"]);
}

/** Lee del navegador las secciones de un viaje. El primer viaje usa el ejemplo de Buenos Aires si no hay nada guardado. */
function loadTripSlices(id) {
  const legacy = id === LEGACY_TRIP_ID;
  const seed = legacy ? seedState() : emptyTripState();
  const trips = normalizeTrips(readSlice(skey("trips", id)));
  state.trips = trips || seed.trips;
  state.meta = trips ? normalizeMeta(readSlice(skey("meta", id))) : seed.meta;
  state.budget = normalizeBudget(readSlice(skey("budget", id))) || seed.budget;
  state.pending = cleanList(readSlice(skey("pending", id)), seed.pending, normalizePending);
  state.reservations = cleanList(readSlice(skey("reservations", id)), seed.reservations, normalizeReservation);
  state.documents = cleanList(readSlice(skey("documents", id)), seed.documents, normalizeDocument);
  state.ideas = cleanList(readSlice(skey("ideas", id)), seed.ideas, normalizeIdea);
  state.people = cleanList(readSlice(skey("people", id)), seed.people, normalizePerson);
  if (!state.people.length) state.people = [{ id: uid("per"), name: "Yo" }];
  state.groupExpenses = cleanList(readSlice(skey("groupExpenses", id)), seed.groupExpenses, normalizeGroupExpense);
  state.notes = obj(readSlice(skey("notes", id))) || {};
  state.doneItems = obj(readSlice(skey("doneItems", id))) || {};
  state.imageUrls = obj(readSlice(skey("imageUrls", id))) || {};
  state.activeDay = 0;
  // Viaje en curso: el itinerario abre en el día de hoy.
  const entry = state.tripIndex.find((t) => t.id === id);
  const timing = entry && entry.startDate ? tripTiming({ ...entry, days: state.trips.length }) : null;
  if (timing && timing.key === "current") state.activeDay = Math.min(timing.dayIndex, state.trips.length - 1);
}

function emptyTripState() {
  return {
    meta: normalizeMeta({ destination: "Nuevo viaje" }),
    trips: [{ id: uid("day"), name: "Día 1", items: [] }],
    budget: { base: 0, currency: "USD", moves: [] },
    pending: [], reservations: [], documents: [], ideas: [],
    people: [{ id: uid("per"), name: "Yo" }], groupExpenses: [], notes: {}, doneItems: {}
  };
}

/* Índice de viajes ---------------------------------------------------- */

function normalizeTripEntry(t) {
  if (!t || typeof t !== "object" || typeof t.id !== "string" || !TRIP_ID_RE.test(t.id)) return null;
  const m = normalizeMeta(t);
  const n = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
  return {
    id: t.id, destination: m.destination, country: m.country, style: m.style, startDate: m.startDate,
    days: n(t.days), places: n(t.places), isPublic: t.isPublic === true, isDemo: m.isDemo,
    updatedAt: typeof t.updatedAt === "string" ? t.updatedAt.slice(0, 30) : ""
  };
}
export function normalizeTripIndex(raw) {
  const seen = new Set();
  return (arr(raw) || []).map(normalizeTripEntry).filter((t) => t && !seen.has(t.id) && seen.add(t.id)).slice(0, 100);
}

/** Resumen del viaje abierto, calculado desde su estado. */
function currentEntry(prev = {}) {
  return normalizeTripEntry({
    id: state.activeTripId, ...state.meta,
    days: state.trips.length, places: state.trips.reduce((s, d) => s + d.items.length, 0),
    isPublic: prev.isPublic ?? state.activeTripId === LEGACY_TRIP_ID,
    updatedAt: prev.updatedAt || new Date().toISOString()
  });
}
/** Mantiene al día la fila del viaje abierto en el índice. Devuelve true si cambió. */
function ensureIndexEntry() {
  const i = state.tripIndex.findIndex((t) => t.id === state.activeTripId);
  const prev = i === -1 ? {} : state.tripIndex[i];
  const next = currentEntry(prev);
  const same = i !== -1 && JSON.stringify({ ...prev, updatedAt: "" }) === JSON.stringify({ ...next, updatedAt: "" });
  if (same) return false;
  next.updatedAt = new Date().toISOString();
  if (i === -1) state.tripIndex = [...state.tripIndex, next];
  else state.tripIndex = state.tripIndex.map((t, k) => (k === i ? next : t));
  return true;
}

/** Fechas y estado (próximo, en curso, pasado) de un viaje del índice, en hora de Chile. */
export function tripTiming(t, now = new Date()) {
  if (!t.startDate) return { key: "nodate", label: "Sin fecha", dayIndex: -1 };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(now);
  const start = new Date(`${t.startDate}T12:00:00Z`);
  const end = new Date(start.getTime() + Math.max(0, t.days - 1) * 86400000);
  const todayD = new Date(`${today}T12:00:00Z`);
  const diff = Math.round((start - todayD) / 86400000);
  const endIso = end.toISOString().slice(0, 10);
  if (diff > 0) return { key: "upcoming", label: diff === 1 ? "Empieza mañana" : `Empieza en ${diff} días`, dayIndex: -1, endDate: endIso, daysLeft: diff };
  if (todayD <= end) return { key: "current", label: `En curso · día ${-diff + 1} de ${t.days}`, dayIndex: -diff, endDate: endIso };
  return { key: "past", label: "Terminado", dayIndex: -1, endDate: endIso };
}

function cleanList(raw, fallback, normalizer) {
  const list = arr(raw);
  if (!list) return fallback;
  return list.map(normalizer).filter(Boolean);
}

function normalizePending(p) {
  const text = str(p?.text, 200);
  if (!text) return null;
  return { id: typeof p.id === "string" ? p.id : uid("pen"), text, priority: p.priority === "Importante" ? "Importante" : "Normal", done: Boolean(p.done) };
}
function normalizeReservation(r) {
  const name = str(r?.name, 120);
  if (!name) return null;
  return {
    id: typeof r.id === "string" ? r.id : uid("res"), name,
    datetime: str(r.datetime, 20), status: RES_STATUS.includes(r.status) ? r.status : "Pendiente",
    code: str(r.code, 60), notes: str(r.notes, 500)
  };
}
function normalizeDocument(d) {
  const name = str(d?.name, 120);
  if (!name) return null;
  return {
    id: typeof d.id === "string" ? d.id : uid("doc"), name,
    category: DOC_CATEGORIES.includes(d.category) ? d.category : "Otro",
    url: str(d.url, 1000), fileKey: str(d.fileKey, 80), fileName: str(d.fileName, 160),
    fileSize: Number.isFinite(d.fileSize) ? d.fileSize : 0, fileCloud: d.fileCloud === true, notes: str(d.notes, 500)
  };
}
function normalizeIdea(i) {
  const name = str(i?.name, 120);
  if (!name) return null;
  return {
    id: typeof i.id === "string" ? i.id : uid("idea"), name,
    category: CATEGORIES.includes(i.category) ? i.category : "Imperdible",
    targetDay: Number.isInteger(i.targetDay) ? i.targetDay : 0,
    context: str(i.context, 160), votes: Number.isInteger(i.votes) && i.votes > 0 ? i.votes : 0,
    promoted: Boolean(i.promoted)
  };
}
function normalizePerson(p) {
  const name = str(p?.name, 40);
  if (!name) return null;
  return { id: typeof p.id === "string" ? p.id : uid("per"), name };
}
function normalizeGroupExpense(g) {
  if (!g || !Number.isFinite(g.amount) || g.amount <= 0 || !Array.isArray(g.participantIds) || !g.participantIds.length) return null;
  return {
    id: typeof g.id === "string" ? g.id : uid("gx"), concept: str(g.concept, 80) || "Gasto",
    amount: g.amount, category: EXPENSE_CATEGORIES.includes(g.category) ? g.category : "Otros",
    payerId: String(g.payerId), participantIds: g.participantIds.map(String)
  };
}

function clampDays() {
  const max = state.trips.length - 1;
  state.activeDay = Math.min(Math.max(0, state.activeDay), max);
  state.todayDay = Math.min(Math.max(0, state.todayDay), max);
}

/* ------------------------------------------------------------------ */
/* Persistencia                                                        */
/* ------------------------------------------------------------------ */

const PERSISTED = ["tripIndex", "meta", "trips", "budget", "pending", "reservations", "documents", "ideas", "people", "groupExpenses", "notes", "doneItems", "imageUrls", "collapsed", "theme", "travelMode", "mapLayer", "deals", "dealNews", "dealSettings", "dealDiscarded"];
let storageWarned = false;

/* Claves que viven en la base central. Las públicas las lee cualquiera; el resto, solo el administrador. */
export const PUBLIC_KEYS = ["meta", "trips", "imageUrls", "deals", "dealNews", "dealDiscarded"];
export const PRIVATE_KEYS = ["budget", "pending", "reservations", "documents", "ideas", "people", "groupExpenses", "notes", "doneItems", "dealSettings", "tripIndex"];
export const CLOUD_KEYS = [...PUBLIC_KEYS, ...PRIVATE_KEYS];

let persistHook = null;
/** La capa de sincronización se engancha aquí para subir los cambios a la base central. */
export function setPersistHook(fn) { persistHook = fn; }

export function persist(keys = PERSISTED) {
  if (state.shareMode) return;
  if (keys.some((k) => TRIP_KEYS.includes(k)) && !state.readOnly && ensureIndexEntry() && !keys.includes("tripIndex")) keys = [...keys, "tripIndex"];
  if (persistHook) persistHook(keys);
  if (!storageOk) return;
  try {
    keys.forEach((k) => localStorage.setItem(skey(k), JSON.stringify(state[k])));
    localStorage.setItem(STORAGE.ui, JSON.stringify({
      activeDay: state.activeDay, itineraryView: state.itineraryView, pendingFilter: state.pendingFilter,
      dealsTab: state.dealsTab, dealFilter: state.dealFilter, reportScope: state.reportScope,
      activeTripId: state.activeTripId, route: state.route
    }));
  } catch (err) {
    if (!storageWarned) {
      storageWarned = true;
      emit({ type: "error", message: "No se pudo guardar en este navegador (almacenamiento lleno o bloqueado)." });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Suscripción y cambios                                               */
/* ------------------------------------------------------------------ */

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(event) { listeners.forEach((fn) => fn(event)); }

// Cambios de interfaz (no se deshacen): día activo, vista, filtros, tema, etc.
export function setUi(patch, { render = true, keys } = {}) {
  Object.assign(state, patch);
  clampDays();
  persist(keys || Object.keys(patch).filter((k) => PERSISTED.includes(k)));
  if (render) emit({ type: "ui", patch });
}

/* ------------------------------------------------------------------ */
/* Historial deshacer / rehacer                                        */
/* ------------------------------------------------------------------ */

const UNDOABLE = ["meta", "trips", "budget", "pending", "reservations", "documents", "ideas", "people", "groupExpenses", "notes", "deals", "dealNews", "dealDiscarded"];
const HISTORY_LIMIT = 40;
export const history = { undo: [], redo: [] };

export function snapshot() {
  return JSON.stringify(UNDOABLE.reduce((acc, k) => { acc[k] = state[k]; return acc; }, {}));
}
function restore(snap) {
  Object.assign(state, JSON.parse(snap));
  clampDays();
}

function pushHistory(label, before) {
  history.undo.push({ label, data: before });
  if (history.undo.length > HISTORY_LIMIT) history.undo.shift();
  history.redo.length = 0;
}

/**
 * Aplica una mutación administrativa: guarda instantánea, muta, persiste y notifica.
 * Si fn devuelve false no se registra nada.
 */
export function commit(label, fn, { render = true } = {}) {
  if (state.shareMode || state.readOnly) return false;
  const before = snapshot();
  const result = fn();
  if (result === false) return false;
  pushHistory(label, before);
  persist();
  emit({ type: "commit", label, render });
  return result === undefined ? true : result;
}

// Para ediciones de texto en vivo (observaciones): la instantánea se toma al enfocar.
export function commitWithSnapshot(label, before, fn) {
  if (state.shareMode || state.readOnly) return;
  fn();
  if (snapshot() === before) return;
  pushHistory(label, before);
  persist();
  emit({ type: "commit", label, render: false });
}

export function undo() {
  const entry = history.undo.pop();
  if (!entry) return null;
  history.redo.push({ label: entry.label, data: snapshot() });
  restore(entry.data);
  persist();
  emit({ type: "history", label: entry.label, direction: "undo" });
  return entry.label;
}
export function redo() {
  const entry = history.redo.pop();
  if (!entry) return null;
  history.undo.push({ label: entry.label, data: snapshot() });
  restore(entry.data);
  persist();
  emit({ type: "history", label: entry.label, direction: "redo" });
  return entry.label;
}

/* ------------------------------------------------------------------ */
/* Selectores                                                          */
/* ------------------------------------------------------------------ */

export const periodIndex = (p) => Math.max(0, PERIODS.indexOf(p.period));

// Orden visible: por bloque (Mañana/Tarde/Noche) y, dentro del bloque, orden manual.
export function orderedItems(day) {
  return day.items.map((p, i) => ({ p, i })).sort((a, b) => periodIndex(a.p) - periodIndex(b.p) || a.i - b.i).map((x) => x.p);
}

export const totalPlaces = () => state.trips.reduce((sum, day) => sum + day.items.length, 0);

export function findPlace(id) {
  for (let d = 0; d < state.trips.length; d++) {
    const i = state.trips[d].items.findIndex((p) => p.id === id);
    if (i !== -1) return { place: state.trips[d].items[i], dayIndex: d, index: i };
  }
  return null;
}

export function budgetTotals() {
  const { base, currency, moves } = state.budget;
  let added = 0; let spent = 0; const other = {};
  moves.forEach((m) => {
    if (m.currency !== currency) {
      other[m.currency] = (other[m.currency] || 0) + (m.type === "add" ? m.amount : -m.amount);
      return;
    }
    if (m.type === "add") added += m.amount; else spent += m.amount;
  });
  return { base, added, spent, available: base + added - spent, currency, other };
}

export function computeDebts() {
  const balance = new Map(state.people.map((p) => [p.id, 0]));
  state.groupExpenses.forEach((g) => {
    const parts = g.participantIds.filter((id) => balance.has(id));
    if (!parts.length || !balance.has(g.payerId)) return;
    const share = g.amount / parts.length;
    balance.set(g.payerId, balance.get(g.payerId) + g.amount);
    parts.forEach((id) => balance.set(id, balance.get(id) - share));
  });
  const round = (n) => Math.round(n * 100) / 100;
  const debtors = []; const creditors = [];
  balance.forEach((v, id) => {
    if (v < -0.005) debtors.push({ id, amount: -v });
    else if (v > 0.005) creditors.push({ id, amount: v });
  });
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);
  const transfers = [];
  let i = 0; let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0.005) transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: round(amount) });
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount < 0.005) i++;
    if (creditors[j].amount < 0.005) j++;
  }
  return { transfers, balance };
}

/* ------------------------------------------------------------------ */
/* Acciones: panoramas                                                 */
/* ------------------------------------------------------------------ */

export function addPlace(dayIndex, data) {
  const place = normalizePlace({ ...data, id: uid("pl") });
  if (!place || !state.trips[dayIndex]) return false;
  return commit(`Agregar “${place.name}”`, () => {
    state.trips[dayIndex].items.push(place);
    return place.id;
  });
}

export function updatePlace(id, data, targetDay) {
  const found = findPlace(id);
  if (!found) return false;
  const next = normalizePlace({ ...found.place, ...data, id });
  if (!next) return false;
  return commit(`Editar “${next.name}”`, () => {
    const day = state.trips[found.dayIndex];
    if (Number.isInteger(targetDay) && targetDay !== found.dayIndex && state.trips[targetDay]) {
      day.items.splice(found.index, 1);
      state.trips[targetDay].items.push(next);
    } else {
      day.items[found.index] = next;
    }
  });
}

export function deletePlace(id) {
  const found = findPlace(id);
  if (!found) return false;
  return commit(`Eliminar “${found.place.name}”`, () => {
    state.trips[found.dayIndex].items.splice(found.index, 1);
  });
}

/** Mueve dentro del orden visible; al cruzar el borde de un bloque pasa al bloque contiguo. */
export function movePlace(id, dir) {
  const found = findPlace(id);
  if (!found) return false;
  const day = state.trips[found.dayIndex];
  const visible = orderedItems(day);
  const pos = visible.findIndex((p) => p.id === id);
  const neighbor = visible[pos + dir];
  const place = found.place;
  const pIdx = periodIndex(place);
  return commit(`Mover “${place.name}”`, () => {
    if (neighbor && periodIndex(neighbor) === pIdx) {
      const a = day.items.indexOf(place);
      const b = day.items.indexOf(neighbor);
      [day.items[a], day.items[b]] = [day.items[b], day.items[a]];
      return true;
    }
    const nextPeriod = pIdx + dir;
    if (nextPeriod < 0 || nextPeriod >= PERIODS.length) return false;
    place.period = PERIODS[nextPeriod];
    const from = day.items.indexOf(place);
    day.items.splice(from, 1);
    if (dir < 0) day.items.push(place); else day.items.unshift(place);
    return true;
  });
}

export function sortDay(dayIndex) {
  const day = state.trips[dayIndex];
  if (!day || day.items.length < 2) return false;
  return commit(`Ordenar ${day.name}`, () => {
    day.items = day.items.map((p, i) => ({ p, i })).sort((a, b) =>
      periodIndex(a.p) - periodIndex(b.p) ||
      (a.p.time && b.p.time ? a.p.time.localeCompare(b.p.time) : a.p.time ? -1 : b.p.time ? 1 : 0) ||
      a.i - b.i
    ).map((x) => x.p);
  });
}

export function toggleDone(id) {
  if (state.shareMode) return;
  const doneItems = { ...state.doneItems };
  if (doneItems[id]) delete doneItems[id]; else doneItems[id] = true;
  setUi({ doneItems });
}

export function setNote(id, text, before) {
  commitWithSnapshot("Editar observación", before, () => {
    const notes = { ...state.notes };
    const clean = String(text).slice(0, 2000);
    if (clean.trim()) notes[id] = clean; else delete notes[id];
    state.notes = notes;
  });
}

/* Días */
export function addDay(name) {
  return commit("Agregar día", () => {
    state.trips.push({ id: uid("day"), name: str(name, 80) || `Día ${state.trips.length + 1}`, items: [] });
    state.activeDay = state.trips.length - 1;
  });
}
export function renameDay(index, name) {
  const clean = str(name, 80);
  if (!clean || !state.trips[index]) return false;
  return commit("Renombrar día", () => { state.trips[index].name = clean; });
}
export function deleteDay(index) {
  if (state.trips.length < 2 || !state.trips[index]) return false;
  return commit(`Eliminar ${state.trips[index].name}`, () => {
    state.trips.splice(index, 1);
    state.ideas.forEach((i) => { if (i.targetDay >= state.trips.length) i.targetDay = state.trips.length - 1; });
    clampDays();
  });
}

/* Borrador automático */
const DRAFTS = {
  Relax: [
    ["Desayuno sin apuro", "Comida", "Sin horario fijo • Cerca del alojamiento"],
    ["Parque o paseo tranquilo", "Naturaleza", "Ritmo lento • Ideal para la tarde"],
    ["Cena relajada", "Comida", "Reserva opcional • Cerca del alojamiento"]
  ],
  "Gastronómico": [
    ["Café de especialidad", "Comida", "Ideal para empezar el día"],
    ["Mercado o almuerzo típico", "Comida", "Probar platos locales"],
    ["Restaurante destacado", "Comida", "Reserva recomendada"]
  ],
  Aventura: [
    ["Caminata o ruta al aire libre", "Naturaleza", "Salir temprano • Llevar agua"],
    ["Actividad principal del día", "Imperdible", "Revisar clima antes de salir"],
    ["Cena de recuperación", "Comida", "Algo contundente"]
  ],
  Cultural: [
    ["Museo principal", "Cultura", "Bajo techo • Revisar horarios"],
    ["Centro histórico", "Cultura", "Recorrido a pie"],
    ["Teatro, música o espectáculo", "Cultura", "Comprar entradas con tiempo"]
  ],
  Mixto: [
    ["Café y primer paseo", "Comida", "Sin apuro • Ideal para la mañana"],
    ["Panorama principal del día", "Imperdible", "El plan fuerte de la jornada"],
    ["Barrio, cena o paseo nocturno", "Comida", "Cerrar el día sin traslados largos"]
  ]
};
const COUNTRY_HINT = { "buenos aires": "Argentina", mendoza: "Argentina", santiago: "Chile", "valparaíso": "Chile", montevideo: "Uruguay" };

/* ------------------------------------------------------------------ */
/* Varios viajes: crear, abrir, editar y eliminar                      */
/* ------------------------------------------------------------------ */

const DAY_MS = 86400000;
function draftDays(dest, n, style) {
  const tpl = DRAFTS[style];
  return Array.from({ length: n }, (_, d) => ({
    id: uid("day"),
    name: d === 0 ? "Llegada y primer recorrido" : d === n - 1 && n > 1 ? "Último día" : `Día ${d + 1} en ${dest}`,
    items: PERIODS.map((period, k) => normalizePlace({
      name: tpl[k][0], category: tpl[k][1], context: tpl[k][2], period,
      priority: k === 1 ? "Alta" : "Normal", duration: k === 1 ? "120 min" : "60 min", transport: "Por definir"
    }))
  }));
}

/** Guarda el viaje abierto y abre otro (sus datos salen del navegador; la base central los refresca después). */
export function switchTrip(id) {
  if (id === state.activeTripId || !state.tripIndex.some((t) => t.id === id)) return false;
  persist(TRIP_KEYS);
  state.activeTripId = id;
  loadTripSlices(id);
  if (!state.readOnly && ensureIndexEntry()) persist(["tripIndex"]);
  history.undo.length = 0; history.redo.length = 0;
  persist([]);
  emit({ type: "trip", id });
  return true;
}

/** Crea un viaje nuevo con borrador por estilo y lo abre. Los viajeros se copian del viaje actual. */
export function createTrip({ destination, days, style, startDate = "", isPublic = false }) {
  const dest = str(destination, 80);
  const n = Math.round(toNumber(days));
  if (state.readOnly || !dest || !Number.isInteger(n) || n < 1 || n > 30 || !STYLES.includes(style)) return null;
  persist(TRIP_KEYS);
  const people = state.people.map((p) => ({ ...p }));
  const id = uid("viaje").toLowerCase();
  state.activeTripId = id;
  const base = emptyTripState();
  Object.assign(state, base, {
    meta: normalizeMeta({ destination: dest, country: COUNTRY_HINT[dest.toLowerCase()] || "", style, startDate }),
    trips: draftDays(dest, n, style), people: people.length ? people : base.people,
    budget: { base: 0, currency: state.budget?.currency || "USD", moves: [] }, activeDay: 0, todayDay: 0
  });
  state.tripIndex = [...state.tripIndex, { ...currentEntry({ isPublic }), isPublic }];
  history.undo.length = 0; history.redo.length = 0;
  persist([...TRIP_KEYS, "tripIndex"]);
  emit({ type: "trip", id });
  return id;
}

/** Edita los datos generales del viaje abierto (nombre, país, estilo, fecha de inicio, visibilidad). */
export function updateTripInfo({ destination, country, style, startDate, isPublic }) {
  const dest = str(destination, 80);
  if (!dest) return false;
  const ok = commit("Editar datos del viaje", () => {
    state.meta = normalizeMeta({ ...state.meta, destination: dest, country, style, startDate, isDemo: false });
  });
  if (ok && typeof isPublic === "boolean") setTripPublic(state.activeTripId, isPublic);
  return ok;
}

export function setTripPublic(id, isPublic) {
  if (state.readOnly) return false;
  state.tripIndex = state.tripIndex.map((t) => (t.id === id ? { ...t, isPublic, updatedAt: new Date().toISOString() } : t));
  persist(["tripIndex"]);
  emit({ type: "visibility", id, isPublic });
  return true;
}

/** Elimina un viaje (no el último). Borra sus datos de este navegador; la sincronización borra los de la base. */
export function deleteTrip(id) {
  if (state.readOnly || state.tripIndex.length < 2 || !state.tripIndex.some((t) => t.id === id)) return false;
  if (id === state.activeTripId) switchTrip(state.tripIndex.find((t) => t.id !== id).id);
  state.tripIndex = state.tripIndex.filter((t) => t.id !== id);
  try { TRIP_KEYS.forEach((k) => localStorage.removeItem(skey(k, id))); } catch { /* sin almacenamiento */ }
  persist(["tripIndex"]);
  emit({ type: "trip-deleted", id });
  return true;
}

export function generateDraft({ destination, days, style, clearExtras }) {
  const dest = str(destination, 80);
  const n = Math.round(toNumber(days));
  if (!dest || !Number.isInteger(n) || n < 1 || n > 14 || !STYLES.includes(style)) return false;
  const tpl = DRAFTS[style];
  return commit(`Generar borrador de ${dest}`, () => {
    state.meta = { destination: dest, country: COUNTRY_HINT[dest.toLowerCase()] || "", style, isDemo: false };
    state.trips = Array.from({ length: n }, (_, d) => ({
      id: uid("day"),
      name: d === 0 ? "Llegada y primer recorrido" : d === n - 1 && n > 1 ? "Último día" : `Día ${d + 1} en ${dest}`,
      items: PERIODS.map((period, k) => normalizePlace({
        name: tpl[k][0], category: tpl[k][1], context: tpl[k][2], period,
        priority: k === 1 ? "Alta" : "Normal", duration: k === 1 ? "120 min" : "60 min", transport: "Por definir"
      }))
    }));
    state.activeDay = 0;
    state.todayDay = 0;
    state.itineraryView = "day";
    state.ideas.forEach((i) => { if (i.targetDay >= n) i.targetDay = n - 1; });
    if (clearExtras) {
      state.pending = []; state.reservations = []; state.ideas = []; state.groupExpenses = [];
      state.budget = { ...state.budget, moves: [] };
    }
  });
}

/* ------------------------------------------------------------------ */
/* Acciones: pendientes, reservas, documentos                          */
/* ------------------------------------------------------------------ */

export function savePending(data, id) {
  const item = normalizePending({ ...data, id: id || data.id || uid("pen") });
  if (!item) return false;
  return commit(id ? "Editar pendiente" : "Agregar pendiente", () => {
    const i = state.pending.findIndex((p) => p.id === id);
    if (i === -1) state.pending.unshift(item); else state.pending[i] = { ...state.pending[i], ...item };
  });
}
export function togglePending(id) {
  const item = state.pending.find((p) => p.id === id);
  if (!item) return false;
  return commit(item.done ? "Reabrir pendiente" : "Completar pendiente", () => { item.done = !item.done; });
}
export function deletePending(id) {
  return commit("Eliminar pendiente", () => {
    const before = state.pending.length;
    state.pending = state.pending.filter((p) => p.id !== id);
    return state.pending.length !== before;
  });
}

export function saveReservation(data, id) {
  const item = normalizeReservation({ ...data, id: id || data.id || uid("res") });
  if (!item) return false;
  return commit(id ? "Editar reserva" : "Agregar reserva", () => {
    const i = state.reservations.findIndex((r) => r.id === id);
    if (i === -1) state.reservations.push(item); else state.reservations[i] = item;
  });
}
export function deleteReservation(id) {
  return commit("Eliminar reserva", () => { state.reservations = state.reservations.filter((r) => r.id !== id); });
}

export function saveDocument(data, id) {
  const item = normalizeDocument({ ...data, id: id || data.id || uid("doc") });
  if (!item) return false;
  return commit(id ? "Editar documento" : "Agregar documento", () => {
    const i = state.documents.findIndex((d) => d.id === id);
    if (i === -1) state.documents.push(item); else state.documents[i] = item;
  });
}
export function deleteDocument(id) {
  return commit("Eliminar documento", () => { state.documents = state.documents.filter((d) => d.id !== id); });
}

/* ------------------------------------------------------------------ */
/* Acciones: presupuesto                                               */
/* ------------------------------------------------------------------ */

export function addBudgetMove(type, amount, concept, currency) {
  const n = toNumber(amount);
  if (!Number.isFinite(n) || n <= 0) return false;
  const cur = CURRENCIES[currency] ? currency : state.budget.currency;
  return commit(type === "add" ? "Agregar al presupuesto" : "Registrar gasto", () => {
    state.budget.moves.unshift({
      id: uid("mv"), type: type === "add" ? "add" : "expense", amount: Math.round(n * 100) / 100,
      concept: str(concept, 80) || (type === "add" ? "Aporte" : "Gasto"), currency: cur, at: new Date().toISOString()
    });
  });
}
export function deleteBudgetMove(id) {
  return commit("Eliminar movimiento", () => { state.budget.moves = state.budget.moves.filter((m) => m.id !== id); });
}
export function setBudgetBase(amount, currency) {
  const n = toNumber(amount);
  if (!Number.isFinite(n) || n < 0) return false;
  return commit("Editar presupuesto inicial", () => {
    state.budget.base = Math.round(n * 100) / 100;
    if (CURRENCIES[currency]) state.budget.currency = currency;
  });
}
export function resetBudget() {
  return commit("Reiniciar presupuesto", () => { state.budget = { base: 500, currency: state.budget.currency, moves: [] }; });
}

/* ------------------------------------------------------------------ */
/* Acciones: bolsa de ideas                                            */
/* ------------------------------------------------------------------ */

export const PROMOTE_AT = 3;

export function addIdea(data) {
  const idea = normalizeIdea({ ...data, id: uid("idea"), votes: 0, promoted: false });
  if (!idea) return false;
  if (idea.targetDay < 0 || idea.targetDay >= state.trips.length) return false;
  return commit(`Agregar idea “${idea.name}”`, () => { state.ideas.unshift(idea); });
}
export function deleteIdea(id) {
  return commit("Eliminar idea", () => { state.ideas = state.ideas.filter((i) => i.id !== id); });
}
export function voteIdea(id, delta) {
  const idea = state.ideas.find((i) => i.id === id);
  if (!idea || idea.promoted) return false;
  if (delta < 0 && idea.votes === 0) return false;
  return commit(delta > 0 ? `Votar “${idea.name}”` : `Quitar voto a “${idea.name}”`, () => {
    idea.votes = Math.max(0, idea.votes + (delta > 0 ? 1 : -1));
    if (idea.votes >= PROMOTE_AT) {
      const day = state.trips[Math.min(idea.targetDay, state.trips.length - 1)];
      day.items.push(normalizePlace({
        name: idea.name, category: idea.category, context: idea.context,
        period: "Tarde", priority: "Media", duration: "60 min", transport: "Por definir"
      }));
      idea.promoted = true;
      return "promoted";
    }
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Acciones: gastos compartidos                                        */
/* ------------------------------------------------------------------ */

export function addPerson(name) {
  const clean = str(name, 40);
  if (!clean) return false;
  if (state.people.some((p) => p.name.toLowerCase() === clean.toLowerCase())) return false;
  return commit(`Agregar viajero ${clean}`, () => { state.people.push({ id: uid("per"), name: clean }); });
}
export function removePerson(id) {
  if (state.people.length < 2) return "last";
  if (state.groupExpenses.some((g) => g.payerId === id || g.participantIds.includes(id))) return "in-use";
  return commit("Quitar viajero", () => { state.people = state.people.filter((p) => p.id !== id); });
}
export function addGroupExpense({ concept, amount, category, payerId, participantIds }) {
  const n = toNumber(amount);
  const ids = new Set(state.people.map((p) => p.id));
  const parts = (participantIds || []).filter((id) => ids.has(id));
  if (!Number.isFinite(n) || n <= 0 || !ids.has(payerId) || !parts.length) return false;
  return commit("Registrar gasto compartido", () => {
    state.groupExpenses.unshift({
      id: uid("gx"), concept: str(concept, 80) || "Gasto", amount: Math.round(n * 100) / 100,
      category: EXPENSE_CATEGORIES.includes(category) ? category : "Otros", payerId, participantIds: parts
    });
  });
}
export function deleteGroupExpense(id) {
  return commit("Eliminar gasto compartido", () => { state.groupExpenses = state.groupExpenses.filter((g) => g.id !== id); });
}

/* ------------------------------------------------------------------ */
/* Enlace compartido (solo itinerario y destino)                       */
/* ------------------------------------------------------------------ */

export function sharePayload() {
  return {
    v: 1,
    meta: { destination: state.meta.destination, country: state.meta.country, style: state.meta.style },
    trips: state.trips.map((d) => ({
      name: d.name,
      items: d.items.map((p) => ({
        id: p.id, time: p.time, name: p.name, lat: p.lat, lng: p.lng, duration: p.duration,
        transport: p.transport, priority: p.priority, category: p.category, context: p.context,
        period: p.period, fixedTime: p.fixedTime
      }))
    }))
  };
}

/** Valida un payload no confiable. Devuelve true si se cargó en memoria. */
export function loadSharedPayload(payload) {
  if (!payload || payload.v !== 1 || !Array.isArray(payload.trips)) return false;
  const trips = normalizeTrips(payload.trips);
  if (!trips) return false;
  state.shareMode = true;
  state.meta = normalizeMeta(payload.meta);
  state.trips = trips;
  state.pending = []; state.reservations = []; state.documents = []; state.ideas = [];
  state.groupExpenses = []; state.notes = {}; state.doneItems = {}; state.imageUrls = {};
  state.budget = { base: 0, currency: "USD", moves: [] };
  state.deals = []; state.dealNews = []; state.dealDiscarded = []; state.travelMode = false;
  state.activeDay = 0; state.todayDay = 0; state.itineraryView = "day"; state.collapsed = [];
  return true;
}

/* ------------------------------------------------------------------ */
/* Base central                                                        */
/* ------------------------------------------------------------------ */

const objOr = (v, d) => obj(v) || d;
const REMOTE_NORMALIZERS = {
  meta: (v) => normalizeMeta(v),
  trips: (v) => normalizeTrips(v),
  imageUrls: (v) => objOr(v, {}),
  deals: (v) => cleanList(v, [], normalizeDeal),
  dealNews: (v) => cleanList(v, [], normalizeNews),
  dealDiscarded: (v) => cleanList(v, [], normalizeDiscarded),
  budget: (v) => normalizeBudget(v),
  pending: (v) => cleanList(v, [], normalizePending),
  reservations: (v) => cleanList(v, [], normalizeReservation),
  documents: (v) => cleanList(v, [], normalizeDocument),
  ideas: (v) => cleanList(v, [], normalizeIdea),
  people: (v) => { const l = cleanList(v, [], normalizePerson); return l.length ? l : null; },
  groupExpenses: (v) => cleanList(v, [], normalizeGroupExpense),
  notes: (v) => objOr(v, {}),
  doneItems: (v) => objOr(v, {}),
  dealSettings: (v) => normalizeDealSettings(v),
  tripIndex: (v) => normalizeTripIndex(v)
};

/**
 * Reemplaza las secciones recibidas de la base central (datos no confiables: se normalizan igual
 * que lo guardado en el navegador). Devuelve las claves aplicadas. Limpia el historial de deshacer.
 */
export function applyRemoteState(remote) {
  const applied = [];
  Object.entries(remote || {}).forEach(([key, value]) => {
    const norm = REMOTE_NORMALIZERS[key];
    if (!norm) return;
    const v = norm(value);
    if (v == null) return;
    state[key] = v;
    applied.push(key);
  });
  if (!applied.length) return applied;
  if (applied.includes("trips") && !applied.includes("meta")) state.meta = normalizeMeta(state.meta);
  clampDays();
  history.undo.length = 0; history.redo.length = 0;
  const hook = persistHook; persistHook = null; // guardar copia local sin volver a subirla
  persist(applied);
  persistHook = hook;
  emit({ type: "remote", keys: applied });
  return applied;
}

/** Al cerrar sesión: borra de este navegador lo privado (gastos, reservas, documentos…). */
export function clearPrivateState() {
  state.budget = { base: 0, currency: "USD", moves: [] };
  state.pending = []; state.reservations = []; state.documents = []; state.ideas = [];
  state.people = [{ id: uid("per"), name: "Yo" }]; state.groupExpenses = [];
  state.notes = {}; state.doneItems = {};
  state.dealSettings = defaultDealSettings();
  history.undo.length = 0; history.redo.length = 0;
  const hook = persistHook; persistHook = null;
  persist(PRIVATE_KEYS.filter((k) => k !== "tripIndex"));
  persistHook = hook;
  // Copias privadas de los otros viajes guardadas en este navegador.
  try {
    const prefixes = PRIVATE_KEYS.filter((k) => TRIP_KEYS.includes(k)).map((k) => `${STORAGE[k]}@`);
    Object.keys(localStorage).filter((k) => prefixes.some((p) => k.startsWith(p))).forEach((k) => localStorage.removeItem(k));
  } catch { /* sin almacenamiento */ }
}
