// Mapa real con Leaflet (carga diferida). Si Leaflet o las teselas fallan, la app sigue funcionando.
import { CAT_HEX, escapeHtml, hasCoords, mapsDirUrl, mapsSearchUrl } from "./util.js";

const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
const LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";

export const LAYERS = {
  streets: {
    label: "Calles",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: { maxZoom: 19, attribution: "&copy; colaboradores de OpenStreetMap" }
  },
  terrain: {
    label: "Terreno",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    options: { maxZoom: 17, subdomains: "abc", attribution: "Datos &copy; OpenStreetMap, SRTM · Estilo &copy; OpenTopoMap (CC-BY-SA)" }
  },
  satellite: {
    label: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: { maxZoom: 19, attribution: "Teselas &copy; Esri — Esri, Maxar, Earthstar Geographics y la comunidad GIS" }
  }
};

let loadPromise = null;
let map = null;
let tileLayer = null;
let currentLayer = null;
let routeGroup = null;
let lastSignature = "";
let tileErrors = 0;
let failed = false;
let fallbackList = "";

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = LEAFLET_CSS;
      css.crossOrigin = "anonymous";
      document.head.appendChild(css);
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.crossOrigin = "anonymous";
    const timer = setTimeout(() => reject(new Error("timeout")), 15000);
    script.onload = () => { clearTimeout(timer); window.L ? resolve(window.L) : reject(new Error("Leaflet no disponible")); };
    script.onerror = () => { clearTimeout(timer); reject(new Error("No se pudo cargar Leaflet")); };
    document.head.appendChild(script);
  });
  return loadPromise;
}

function setStatus(text) {
  const el = document.getElementById("mapStatus");
  if (el) { el.textContent = text; el.hidden = !text; }
}

function showFallback() {
  failed = true;
  const el = document.getElementById("map");
  if (el) {
    el.classList.add("map-fallback");
    el.innerHTML = `<div><p>El mapa no pudo cargarse. Los destinos del día siguen disponibles en Google Maps:</p>${fallbackList}</div>`;
  }
}

function applyLayer(key) {
  const L = window.L;
  const def = LAYERS[key] || LAYERS.streets;
  if (tileLayer) map.removeLayer(tileLayer);
  tileErrors = 0;
  tileLayer = L.tileLayer(def.url, def.options);
  tileLayer.on("tileerror", () => {
    tileErrors += 1;
    if (tileErrors === 6) setStatus("No cargó el fondo del mapa (conexión o entorno con restricciones). Los puntos, la ruta y los enlaces a Google Maps siguen funcionando.");
  });
  tileLayer.on("load", () => { if (tileErrors < 6) setStatus(""); });
  tileLayer.addTo(map);
  currentLayer = key;
}

function popupHtml(p, n, destination) {
  return `<div class="map-popup">
    <strong>${n}. <a href="${mapsSearchUrl(p, destination)}" target="_blank" rel="noopener">${escapeHtml(p.name)}</a></strong>
    <span>${escapeHtml([p.fixedTime && p.time ? p.time : p.period, p.duration, p.transport].filter(Boolean).join(" · "))}</span>
    <a href="${mapsDirUrl(p, destination)}" target="_blank" rel="noopener">Cómo llegar en Google Maps</a>
  </div>`;
}

function draw(items, destination, fallbackCenter) {
  const L = window.L;
  routeGroup.clearLayers();
  const points = [];
  items.forEach((p, i) => {
    if (!hasCoords(p)) return;
    const n = i + 1;
    const color = CAT_HEX[p.category] || "#475569";
    const icon = L.divIcon({
      className: "map-pin",
      html: `<span style="background:${color}">${n}</span>`,
      iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14]
    });
    L.marker([p.lat, p.lng], { icon, title: `${n}. ${p.name}`, alt: `${n}. ${p.name}`, keyboard: true })
      .bindPopup(popupHtml(p, n, destination))
      .addTo(routeGroup);
    points.push([p.lat, p.lng]);
  });
  if (points.length > 1) {
    L.polyline(points, { color: getComputedStyle(document.documentElement).getPropertyValue("--t-map").trim() || "#0e9384", weight: 4, opacity: 0.85, dashArray: "2 8", lineCap: "round" }).addTo(routeGroup);
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 16 });
  } else if (points.length === 1) {
    map.setView(points[0], 15);
  }
  if (!points.length) {
    if (fallbackCenter) map.setView(fallbackCenter, 12);
    setStatus(items.length
      ? "Los panoramas de este día no tienen coordenadas. Edítalos (✎) para ubicarlos en el mapa."
      : "Este día todavía no tiene panoramas.");
  } else if (points.length < items.length) {
    setStatus(`${items.length - points.length} panorama(s) sin coordenadas no aparecen en el mapa.`);
  } else if (tileErrors < 6) {
    setStatus("");
  }
}

/**
 * Renderiza el mapa solo si cambió la firma (puntos, capa o destino).
 * No reconstruye el mapa por cambios ajenos (observaciones, gastos, etc.).
 */
export function renderMap({ items, layer, destination, visible, fallbackCenter, fallbackList: list = "" }) {
  fallbackList = list;
  if (failed) { showFallback(); return; }
  if (!visible) return;
  const signature = JSON.stringify([items.map((p) => [p.id, p.lat, p.lng, p.name, p.category, p.period, p.time, p.fixedTime, p.duration, p.transport]), destination]);
  const el = document.getElementById("map");
  if (!el) return;
  if (!map) setStatus("Cargando mapa…");
  loadLeaflet().then((L) => {
    if (!map) {
      map = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
      map.setView(fallbackCenter || [-34.6037, -58.3816], 12);
      routeGroup = L.layerGroup().addTo(map);
      map.on("focus click", () => map.scrollWheelZoom.enable());
      map.on("blur mouseout", () => map.scrollWheelZoom.disable());
      applyLayer(layer);
      lastSignature = "";
    }
    if (currentLayer !== layer) applyLayer(layer);
    map.invalidateSize();
    if (signature === lastSignature) return;
    lastSignature = signature;
    draw(items, destination, fallbackCenter);
  }).catch(showFallback);
}

export function refreshMapSize() {
  if (map) setTimeout(() => map.invalidateSize(), 60);
}
