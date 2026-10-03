// Exportación del viaje a Google My Maps. My Maps no tiene una API pública para crear mapas,
// así que se genera un archivo KML (una carpeta por día, un punto por lugar y la ruta del día)
// y se guía al usuario para importarlo en "Crear un mapa nuevo → Importar".
import { state, orderedItems } from "./store.js";
import { CAT_HEX, hasCoords, mapsSearchUrl, escapeHtml as e } from "./util.js";
import { openDialog } from "./ui.js";

const MY_MAPS_URL = "https://www.google.com/maps/d/";
const xml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cdata = (s) => `<![CDATA[${String(s ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
// KML usa el color en orden aabbggrr.
const kmlColor = (hex, alpha = "ff") => { const h = hex.replace("#", ""); return `${alpha}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`; };
const slug = (s) => String(s || "viaje").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "viaje";

function dayDate(i) {
  const entry = state.tripIndex.find((t) => t.id === state.activeTripId);
  if (!entry?.startDate) return "";
  const d = new Date(new Date(`${entry.startDate}T12:00:00Z`).getTime() + i * 86400000);
  return new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

/** KML del viaje abierto. Devuelve { kml, points, skipped } (skipped = lugares sin coordenadas). */
export function buildTripKml() {
  const dest = state.meta.destination || "Viaje";
  const styles = Object.entries(CAT_HEX).map(([cat, hex]) => `
    <Style id="cat-${slug(cat)}"><IconStyle><color>${kmlColor(hex)}</color><scale>1.1</scale>
      <Icon><href>https://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href></Icon></IconStyle>
      <LabelStyle><scale>0.8</scale></LabelStyle></Style>`).join("");
  let points = 0; const skipped = [];
  const folders = state.trips.map((day, di) => {
    const items = orderedItems(day);
    const label = `Día ${di + 1}${dayDate(di) ? ` (${dayDate(di)})` : ""} · ${day.name}`;
    const marks = items.map((p, k) => {
      if (!hasCoords(p)) { skipped.push(`${p.name} (día ${di + 1})`); return ""; }
      points++;
      const lines = [
        [p.time, p.period].filter(Boolean).join(" · "),
        [p.category, p.duration, p.transport].filter(Boolean).join(" · "),
        p.priority && p.priority !== "Normal" ? `Prioridad: ${p.priority}` : "",
        p.context,
        mapsSearchUrl(p, dest)
      ].filter(Boolean);
      const data = [["Día", `Día ${di + 1}`], ["Orden", k + 1], ["Hora", p.time || "Sin horario"], ["Categoría", p.category], ["Prioridad", p.priority]]
        .map(([n, v]) => `<Data name="${xml(n)}"><value>${xml(v)}</value></Data>`).join("");
      return `
      <Placemark><name>${xml(`${k + 1}. ${p.time ? `${p.time} ` : ""}${p.name}`)}</name>
        <description>${cdata(lines.join("\n"))}</description>
        <styleUrl>#cat-${slug(p.category)}</styleUrl>
        <ExtendedData>${data}</ExtendedData>
        <Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>`;
    }).join("");
    const coords = items.filter(hasCoords).map((p) => `${p.lng},${p.lat},0`);
    const route = coords.length > 1 ? `
      <Placemark><name>${xml(`Ruta día ${di + 1}`)}</name><styleUrl>#ruta</styleUrl>
        <LineString><tessellate>1</tessellate><coordinates>${coords.join(" ")}</coordinates></LineString></Placemark>` : "";
    return `
    <Folder><name>${xml(label)}</name>${marks}${route}
    </Folder>`;
  }).join("");
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${xml(`${dest} — Travel OS`)}</name>
    <description>${xml(`Itinerario de ${dest} exportado desde Travel OS (${state.trips.length} días).`)}</description>${styles}
    <Style id="ruta"><LineStyle><color>${kmlColor("#7c3aed", "cc")}</color><width>4</width></LineStyle></Style>${folders}
  </Document>
</kml>
`;
  return { kml, points, skipped, filename: `${slug(dest)}-travel-os.kml` };
}

function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/vnd.google-earth.kml+xml" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Botón "Crear en Google My Maps": descarga el KML y muestra los pasos para importarlo. */
export function exportToMyMaps(toast) {
  const { kml, points, skipped, filename } = buildTripKml();
  if (!points) { toast("Este viaje no tiene lugares con ubicación en el mapa para exportar."); return; }
  download(kml, filename);
  const days = state.trips.length;
  openDialog({
    title: "Crear el mapa en Google My Maps",
    size: "md",
    body: `
      <p class="mymaps-ok">Se descargó <strong>${e(filename)}</strong> con ${points} ${points === 1 ? "lugar" : "lugares"} y la ruta de cada día.</p>
      <ol class="mymaps-steps">
        <li>Abre Google My Maps con tu cuenta de Google.</li>
        <li>Pulsa <strong>+ Crear un mapa nuevo</strong>.</li>
        <li>En la capa “Capa sin título”, pulsa <strong>Importar</strong> y elige el archivo descargado.</li>
        <li>Cambia el nombre del mapa (por ejemplo, “${e(state.meta.destination)}”) y compártelo con <strong>Compartir</strong>.</li>
      </ol>
      <p class="small muted">Cada lugar trae su día, hora, categoría y prioridad. En My Maps puedes usar <em>Estilo uniforme → Agrupar lugares por “Día”</em> para ver cada día en su color.${days > 10 ? " My Maps admite hasta 10 capas por mapa." : ""}</p>
      ${skipped.length ? `<p class="small mymaps-skip">Sin ubicación, no se incluyeron: ${skipped.slice(0, 6).map(e).join(", ")}${skipped.length > 6 ? ` y ${skipped.length - 6} más` : ""}.</p>` : ""}
      <p class="small muted">Google no permite crear mapas de My Maps automáticamente desde otra app; por eso se importa el archivo. Si cambias el itinerario, vuelve a exportarlo e impórtalo en un mapa nuevo o en una capa nueva.</p>`,
    footer: `<button type="button" class="btn" data-close>Cerrar</button>
      <button type="button" class="btn" data-mymaps-again>Descargar de nuevo</button>
      <a class="btn btn-primary" href="${MY_MAPS_URL}" target="_blank" rel="noopener">Abrir Google My Maps ↗</a>`,
    mount(dlg) {
      const again = dlg.querySelector("[data-mymaps-again]");
      if (again) again.addEventListener("click", () => download(kml, filename));
    }
  });
  toast("Archivo para My Maps descargado");
}
