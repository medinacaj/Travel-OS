// Módulo Ofertas de viaje (Travel Deal Analyst) — lógica pura, sin DOM ni estado.
// Reglas de veracidad: nunca se inventan precios, descuentos ni disponibilidad.
// Todo dato lleva fuente, fecha de verificación y vigencia; lo vencido se marca como tal.

import { str, toNumber, uid, safeHttpUrl } from "./util.js";

export const DEAL_TYPES = {
  vuelo: "Vuelo", estadia: "Estadía", paquete: "Paquete", beneficio: "Beneficio", evento: "Evento"
};
export const SCORED_TYPES = new Set(["vuelo", "estadia", "paquete"]);
export const SOURCE_KINDS = {
  bases: "Bases legales oficiales", oficial: "Sitio oficial", prensa: "Prensa",
  agregador: "Agregador / comparador", usuario: "Ingresada por ti"
};
export const NEWS_IMPACT = { precios: "Afecta precios", disponibilidad: "Afecta disponibilidad", informativo: "Informativo" };
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/* ------------------------------------------------------------------ */
/* Datos iniciales verificados el 01/10/2026                           */
/* ------------------------------------------------------------------ */

const BCI_URL = "https://assets-us-01.kc-usercontent.com/b2956330-c34f-0064-2c6f-27bd5c0147fc/7bee48c9-ec6d-4f38-9331-ae00f681b3be/BBLL_JS_BCI_MACHBANK_DOM_INTER_30_9_2026_CL.pdf";
const BCI_CONDITIONS = [
  "Compra solo los miércoles en jetsmart.com, del 30/09/2026 al 30/12/2026 o hasta agotar stock",
  "Código BCIMACHC (crédito, hasta 30%) o BCIMACHD (débito, hasta 20%) y pago con tarjeta BCI o MACHBANK",
  "Descuento solo sobre la tarifa: no rebaja tasas ni servicios; máximo en tarifa T, hasta 10% en tarifas promocionales U/X/W, no aplica a Promo Flash (V)",
  "Comprar con 14 días o más de anticipación; volar hasta el 20/06/2027",
  "Fechas excluidas: 29/10–02/11, 04–08/12, 23/12–03/01, 25/01–14/02, 24–28/03 y 20–23/05",
  "Tarifa incluye solo bolso de mano 10 kg; sin derecho a retracto"
];
function bciDeal(id, origin, destination, fare, fareTaxes) {
  const taxes = fareTaxes - fare;
  const estimate = Math.round(fare * 0.7) + taxes;
  return {
    id, type: "vuelo", provider: "JetSMART × BCI / MACHBANK",
    title: `${origin} → ${destination} con hasta 30% (tarjeta de crédito)`,
    origin, destination,
    price: estimate, priceIncludesTaxes: true,
    priceBasis: `Estimado por tramo: tarifa T $${fare.toLocaleString("es-CL")} −30% + tasas $${taxes.toLocaleString("es-CL")}`,
    referencePrice: fareTaxes, referenceSource: "proveedor",
    discountPct: 30, discountBasis: "declarado",
    sourceKind: "bases", sourceName: "Bases legales JetSMART Chile (30/09/2026)", sourceUrl: BCI_URL,
    verifiedAt: "2026-10-01",
    validFrom: "2026-09-30T00:01:00-03:00", validUntil: "2026-12-30T23:59:00-03:00", buyDays: [3],
    travelUntil: "2027-06-20", requiresCard: true, stockLimited: true,
    conditions: BCI_CONDITIONS,
    notes: "El precio es una estimación con el descuento máximo sobre la tarifa T publicada; el valor final depende de la tarifa disponible el día de compra."
  };
}

export function seedDeals() {
  return [
    bciDeal("deal_bci_scl_bue", "Santiago", "Buenos Aires", 57600, 81600),
    bciDeal("deal_bci_scl_mdz", "Santiago", "Mendoza", 57600, 65840),
    bciDeal("deal_bci_ccp_scl", "Concepción", "Santiago", 24900, 32934),
    {
      id: "deal_js_cuentarut", type: "beneficio", provider: "JetSMART × BancoEstado",
      title: "Maleta de bodega gratis pagando con CuentaRUT", origin: "Chile", destination: "Rutas nacionales e internacionales",
      price: null, priceIncludesTaxes: false, priceBasis: "", referencePrice: null, referenceSource: "",
      discountPct: 100, discountBasis: "declarado",
      sourceKind: "bases", sourceName: "Bases legales JetSMART Chile (21/09/2026)",
      sourceUrl: "https://assets-us-01.kc-usercontent.com/b2956330-c34f-0064-2c6f-27bd5c0147fc/59fb641e-06fe-451e-9fa2-0f736270ee8e/BBLL_JetSMART_BE_Maleta_Gratis_CuentaRUT_21_09_2026_VF.pdf",
      verifiedAt: "2026-10-01",
      validFrom: "2026-09-21T09:00:00-03:00", validUntil: "2026-10-09T23:59:00-03:00", buyDays: [],
      travelUntil: "2027-07-31", requiresCard: true, stockLimited: true,
      conditions: [
        "Código promocional: los primeros 6 dígitos de la tarjeta CuentaRUT, pagando con esa misma tarjeta",
        "Elegir plan Basic y agregar la maleta de bodega en la compra inicial",
        "Solo 1 maleta y solo para el pasajero N.º 1 de la reserva",
        "Stock total de 2.000; volar hasta el 31/07/2027"
      ],
      notes: "Se combina bien con una tarifa base baja: suma valor sin cambiar el precio del pasaje."
    },
    {
      id: "deal_cybermonday_2026", type: "evento", provider: "Cámara de Comercio de Santiago (cyber.cl)",
      title: "CyberMonday 2026", origin: "Chile", destination: "Varios",
      price: null, priceIncludesTaxes: false, priceBasis: "", referencePrice: null, referenceSource: "",
      discountPct: null, discountBasis: "desconocido",
      sourceKind: "prensa", sourceName: "Pauta / El Mostrador (septiembre 2026)",
      sourceUrl: "https://www.pauta.cl/dato-en-pauta/2026/09/23/cuando-es-el-cybermonday-2026-fecha-y-hora-de-inicio-de-las-ofertas.html",
      verifiedAt: "2026-10-01",
      validFrom: "2026-10-05T00:00:00-03:00", validUntil: "2026-10-07T23:59:00-03:00", buyDays: [],
      travelUntil: "", requiresCard: false, stockLimited: false,
      conditions: [
        "Las aerolíneas y agencias publican sus precios recién al inicio del evento",
        "Entrar a las tiendas desde cyber.cl",
        "Turismo inscrito (27 empresas): LATAM, Iberia, Despegar, Atrápalo, MSC, Royal Caribbean, Celebrity, Club Med, Termas de Chillán y Radisson Puerto Varas, entre otras",
        "Comparar contra las referencias históricas de abajo antes de comprar"
      ],
      notes: "Aún no hay precios publicados: no se puede puntuar hasta que el evento empiece."
    },
    {
      id: "deal_js_escapada", type: "vuelo", provider: "JetSMART",
      title: "Escapada Primaveral: La Serena → Santiago", origin: "La Serena", destination: "Santiago",
      price: 23934, priceIncludesTaxes: true, priceBasis: "Por tramo, tarifa $16.900 + tasas",
      referencePrice: null, referenceSource: "", discountPct: null, discountBasis: "desconocido",
      sourceKind: "bases", sourceName: "Bases legales JetSMART Chile (22/09/2026)",
      sourceUrl: "https://assets-us-01.kc-usercontent.com/b2956330-c34f-0064-2c6f-27bd5c0147fc/77a5746d-97f3-45d3-83c5-b8c98efcdbfa/BBLL_ESCAPADA%20PRIMAVERAL_DOM_22_9_2026_CL.pdf",
      verifiedAt: "2026-10-01",
      validFrom: "2026-09-22T10:00:00-03:00", validUntil: "2026-09-24T10:00:00-03:00", buyDays: [],
      travelUntil: "2027-03-31", requiresCard: false, stockLimited: true,
      conditions: ["Otras rutas de la misma campaña: Concepción–Santiago $26.934 y Concepción–Puerto Montt $27.934 por tramo con tasas"],
      notes: "Referencia histórica: sirve para juzgar si un precio nacional futuro es realmente bueno."
    },
    {
      id: "deal_sky_travelsale", type: "vuelo", provider: "SKY Airline",
      title: "Travel Sale 2026: Santiago → La Serena", origin: "Santiago", destination: "La Serena",
      price: 20090, priceIncludesTaxes: true, priceBasis: "Por tramo, precio final",
      referencePrice: null, referenceSource: "", discountPct: 45, discountBasis: "declarado",
      sourceKind: "prensa", sourceName: "Página 7 (01/09/2026)",
      sourceUrl: "https://www.pagina7.cl/actualidad/travel-sale-conoce-los-descuentos-de-sky-para-viajar-dentro-y-fuera-de-chile/",
      verifiedAt: "2026-10-01",
      validFrom: "2026-08-31T00:00:00-04:00", validUntil: "2026-09-02T23:59:00-04:00", buyDays: [],
      travelUntil: "2026-12-31", requiresCard: false, stockLimited: true,
      conditions: ["En la misma campaña: Concepción $21.090 (−54%) y Antofagasta $24.090 (−60%) por tramo"],
      notes: "Referencia histórica del último gran evento de ventas."
    },
    {
      id: "deal_sky_cyber2025", type: "vuelo", provider: "SKY Airline",
      title: "Cyber 2025: Santiago → Concepción", origin: "Santiago", destination: "Concepción",
      price: 16690, priceIncludesTaxes: true, priceBasis: "Por tramo con tasas",
      referencePrice: null, referenceSource: "", discountPct: null, discountBasis: "desconocido",
      sourceKind: "prensa", sourceName: "Tally Ho (octubre 2025)",
      sourceUrl: "https://tallyho.cl/sky-en-cyber-lanza-descuentos-de-hasta-71-en-vuelos-nacionales-e-internacionales/",
      verifiedAt: "2026-10-01",
      validFrom: "2025-10-06T00:00:00-03:00", validUntil: "2025-10-08T23:59:00-03:00", buyDays: [],
      travelUntil: "", requiresCard: false, stockLimited: true,
      conditions: ["En el mismo evento: Calama y La Serena $17.690, Cancún o Punta Cana ida y vuelta $412.990 con tasas"],
      notes: "Referencia histórica: precio a superar en el CyberMonday 2026."
    },
    {
      id: "deal_latam_cyber2025", type: "vuelo", provider: "LATAM",
      title: "Cyber LATAM 2025: tramos nacionales", origin: "Santiago", destination: "Calama / Antofagasta",
      price: 9990, priceIncludesTaxes: false, priceBasis: "Por tramo, sin tasas de embarque",
      referencePrice: null, referenceSource: "", discountPct: 71, discountBasis: "declarado",
      sourceKind: "prensa", sourceName: "Chócale (06/10/2025)",
      sourceUrl: "https://chocale.cl/2025/10/cyber-latam-descuentos-y-ofertas-vuelos-baratos-en-cybermonday-2025/",
      verifiedAt: "2026-10-01",
      validFrom: "2025-10-06T00:00:00-03:00", validUntil: "2025-10-08T23:59:00-03:00", buyDays: [],
      travelUntil: "", requiresCard: false, stockLimited: true,
      conditions: ["También Concepción y Balmaceda → Puerto Montt en la misma campaña"],
      notes: "Referencia histórica: el precio no incluye tasas, compáralo sumándolas."
    },
    ...analystRun20261001()
  ].map(normalizeDeal);
}

/* ------------------------------------------------------------------ */
/* Corrida Travel Deal Analyst del 01/10/2026 07:11 (hora de Chile)    */
/* Fuentes revisadas: LATAM, SKY, JetSMART, Despegar, Booking + prensa */
/* ------------------------------------------------------------------ */

export const SEED_VERSION = 2;
export const SEED_VERIFIED_LABEL = "01/10/2026 07:11";
const JS_NAC_URL = "https://jetsmart.com/ofertas/es-cl/vuelos-nacionales-chile";
const JS_INT_URL = "https://jetsmart.com/ofertas/es-cl/vuelos-internacionales-chile";
const DESPEGAR_URL = "https://www.despegar.cl/ofertas-de-viajes";
const DESPEGAR_HOTELS_URL = "https://www.despegar.cl/ofertas-viajes/EM-HOTELS";
const JS_CONDS = ["Precio publicado sin tasas ni impuestos: el total puede variar", "Tarifa del día sujeta a disponibilidad; JetSMART no publica fecha de término"];

function jsFare(id, origin, destination, price, travelDate, scope) {
  const intl = scope === "internacional";
  return {
    id, type: "vuelo", provider: "JetSMART", scope,
    title: `${origin} → ${destination}`, origin, destination,
    price, priceIncludesTaxes: false, priceBasis: intl ? "Desde, por tramo, sin tasas (salidas oct 2026 – mar 2027)" : "Por tramo, sin tasas",
    referencePrice: null, referenceSource: "", discountPct: null, discountBasis: "desconocido",
    sourceKind: "oficial", sourceName: intl ? "JetSMART · vuelos internacionales desde Chile" : "JetSMART · vuelos nacionales Chile",
    sourceUrl: intl ? JS_INT_URL : JS_NAC_URL, verifiedAt: "2026-10-01",
    validFrom: "", validUntil: "", buyDays: [], travelUntil: intl ? "2027-03-31" : "", travelDate: intl ? "" : travelDate,
    requiresCard: false, stockLimited: true, conditions: JS_CONDS,
    notes: intl ? "" : "Precio para la fecha indicada; otras fechas pueden costar distinto."
  };
}
function despegarTrip(id, provider, origin, destination, price, from, to, scope) {
  return {
    id, type: "vuelo", provider: `${provider} vía Despegar`, scope,
    title: `${origin} ⇄ ${destination} (ida y vuelta)`, origin, destination,
    price, priceIncludesTaxes: false, priceBasis: `Ida y vuelta por persona, vuelo directo, ${from.slice(8, 10)}/${from.slice(5, 7)} – ${to.slice(8, 10)}/${to.slice(5, 7)}`,
    referencePrice: null, referenceSource: "", discountPct: null, discountBasis: "desconocido",
    sourceKind: "agregador", sourceName: "Despegar Chile · ofertas", sourceUrl: DESPEGAR_URL, verifiedAt: "2026-10-01",
    validFrom: "", validUntil: "", buyDays: [], travelUntil: to, travelDate: from,
    requiresCard: false, stockLimited: true,
    conditions: ["Precio publicado en la portada de ofertas; confirma en el checkout si incluye tasas y cargos"],
    notes: ""
  };
}
function despegarHotel(id, name, city, price, reference, stayDate, scope, url = DESPEGAR_URL, basis = "Por noche, precio publicado en Despegar") {
  return {
    id, type: "estadia", provider: "Despegar", scope,
    title: `${name} (${city})`, origin: "", destination: city,
    price, priceIncludesTaxes: false, priceBasis: basis,
    referencePrice: reference, referenceSource: "proveedor",
    discountPct: Math.round((1 - price / reference) * 100), discountBasis: "declarado",
    sourceKind: "agregador", sourceName: url === DESPEGAR_URL ? "Despegar Chile · ofertas" : "Despegar Chile · hoteles en oferta",
    sourceUrl: url, verifiedAt: "2026-10-01",
    validFrom: "", validUntil: "", buyDays: [], travelUntil: "", travelDate: stayDate,
    requiresCard: false, stockLimited: true,
    conditions: [`Tarifa cotizada para la noche del ${stayDate.slice(8, 10)}/${stayDate.slice(5, 7)}/${stayDate.slice(0, 4)}`, "El precio “antes” lo publica Despegar: no es un historial independiente"],
    notes: ""
  };
}

function analystRun20261001() {
  return [
    jsFare("tda_js_scl_anf", "Santiago", "Antofagasta", 18900, "2026-11-25", "nacional"),
    jsFare("tda_js_scl_cjc", "Santiago", "Calama", 18900, "2026-12-10", "nacional"),
    jsFare("tda_js_cjc_scl", "Calama", "Santiago", 18900, "2026-10-23", "nacional"),
    jsFare("tda_js_scl_ccp", "Santiago", "Concepción", 18900, "2027-03-03", "nacional"),
    jsFare("tda_js_lsc_cjc", "La Serena", "Calama", 16900, "2026-11-11", "nacional"),
    jsFare("tda_js_scl_tru", "Santiago", "Trujillo", 63492, "", "internacional"),
    jsFare("tda_js_scl_bue", "Santiago", "Buenos Aires", 65416, "", "internacional"),
    jsFare("tda_js_scl_mdz", "Santiago", "Mendoza", 65416, "", "internacional"),
    jsFare("tda_js_scl_lim", "Santiago", "Lima", 76960, "", "internacional"),
    jsFare("tda_js_scl_mvd", "Santiago", "Montevideo", 76960, "", "internacional"),
    despegarTrip("tda_dsp_scl_cjc", "JetSMART", "Santiago", "Calama", 55485, "2026-10-28", "2026-11-02", "nacional"),
    despegarTrip("tda_dsp_scl_anf", "JetSMART", "Santiago", "Antofagasta", 55485, "2026-12-24", "2026-12-28", "nacional"),
    despegarTrip("tda_dsp_scl_fln", "SKY", "Santiago", "Florianópolis", 256958, "2026-12-07", "2026-12-12", "internacional"),
    despegarHotel("tda_dsp_director", "Hotel Director Vitacura", "Santiago", 75782, 132951, "2026-12-15", "nacional"),
    despegarHotel("tda_dsp_icon", "Icon Hotel", "Santiago", 85987, 138688, "2026-12-20", "nacional"),
    despegarHotel("tda_dsp_noi", "Noi Casa Atacama", "San Pedro de Atacama", 317515, 360813, "2026-10-02", "nacional"),
    despegarHotel("tda_dsp_andes", "Hotel Andes Plaza", "Bogotá", 50973, 71793, "2026-10-25", "internacional", DESPEGAR_HOTELS_URL, "Por noche, 2 personas"),
    despegarHotel("tda_dsp_cartagena", "Hotel Cartagena Plaza", "Cartagena de Indias", 120081, 150101, "2026-12-22", "internacional", DESPEGAR_HOTELS_URL, "Por noche, 2 personas")
  ];
}

/** Lo que la corrida descartó por vencido o no verificable (queda como registro de auditoría). */
export function seedDiscarded() {
  return [
    { id: "dis_sky_travelsale", date: "2026-10-01", source: "SKY Airline", url: "https://www.skyairline.com/flights/es-cl/travelsale", title: "SKY Travel Sale 2026", reason: "Vencida: el sitio oficial indica vigencia del 31/08 al 06/09/2026" },
    { id: "dis_booking_late", date: "2026-10-01", source: "Booking.com", url: "https://www.booking.com/dealspage.html", title: "Booking “Late Escape Deals” (15% o más)", reason: "Vencida el 07/01/2026; no hay otra promoción de Booking verificable para Chile" },
    { id: "dis_norus", date: "2026-10-01", source: "Despegar", url: DESPEGAR_URL, title: "Apartamentos Norus Providencia (−29%)", reason: "La fecha cotizada (30/09/2026) ya pasó" },
    { id: "dis_aviacionline", date: "2026-10-01", source: "Aviacionline", url: "https://www.aviacionline.com/ofertas-cyber-latam-sky-y-jetsmart-lanzan-ofertas-en-chile", title: "“Ofertas Cyber hasta 85%” de LATAM, SKY y JetSMART", reason: "Nota de 2024: no corresponde a una promoción actual" },
    { id: "dis_cnn_500", date: "2026-10-01", source: "CNN Chile", url: "https://www.cnnchile.com/tendencias/pasajes-baratos-chile-jetsamart/", title: "Pasajes JetSMART a $500", reason: "Nota de 2019: campaña terminada" },
    { id: "dis_latam_sky_web", date: "2026-10-01", source: "LATAM / SKY", url: "", title: "Tarifas en las páginas de ofertas de LATAM y SKY", reason: "No verificable: las páginas no muestran precios legibles y no hay comunicado de campaña vigente" }
  ].map(normalizeDiscarded);
}

export function normalizeDiscarded(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = str(raw.title, 160);
  if (!title) return null;
  return {
    id: typeof raw.id === "string" && /^[\w-]{1,64}$/.test(raw.id) ? raw.id : uid("dis"),
    date: isoOrEmpty(raw.date),
    source: str(raw.source, 80),
    title,
    reason: str(raw.reason, 240) || "Sin motivo indicado",
    url: safeHttpUrl(raw.url)
  };
}

export function seedNews() {
  return [
    {
      id: "news_cyber_fecha", date: "2026-09-23", source: "Pauta",
      title: "CyberMonday 2026 se realizará del lunes 5 al miércoles 7 de octubre (00:00 a 23:59)",
      url: "https://www.pauta.cl/dato-en-pauta/2026/09/23/cuando-es-el-cybermonday-2026-fecha-y-hora-de-inicio-de-las-ofertas.html",
      impact: "precios"
    },
    {
      id: "news_cyber_viajes", date: "", source: "Redimin",
      title: "Turismo y viajes concentraron el 25% de las ventas del CyberMonday 2025 (4,4 millones de transacciones)",
      url: "https://www.redimin.cl/cybermonday-2026-ya-tiene-fecha-para-sus-tres-jornadas-de-ventas-online",
      impact: "disponibilidad"
    },
    {
      id: "news_js_bci", date: "2026-09-30", source: "JetSMART (bases legales)",
      title: "JetSMART publica descuento de hasta 30% para clientes BCI y MACHBANK, solo los miércoles hasta el 30/12",
      url: BCI_URL, impact: "precios"
    },
    {
      id: "news_js_escapada", date: "2026-09-24", source: "JetSMART (bases legales)",
      title: "Cerró la Escapada Primaveral de JetSMART: tramos nacionales desde $23.934 con tasas para volar oct–mar",
      url: "https://jetsmart.com/cl/es/minisitios/legales", impact: "informativo"
    },
    {
      id: "news_trafico_agosto", date: "2026-09-28", source: "El Aéreo",
      title: "Tráfico aéreo de Chile cumple un año a la baja: 2.188.070 pasajeros en agosto (−2,1%); JetSMART cerró su base en Concepción y American y United recortan capacidad",
      url: "https://elaereo.com/2026/09/trafico-aereo-de-pasajeros-en-chile-entra-a-su-segundo-ano-en-rojo-colocando-mas-presion-a-aerolineas-y-aeropuertos/",
      impact: "disponibilidad"
    },
    {
      id: "news_stopover_scl", date: "2026-09-26", source: "Ladevi",
      title: "Chile prepara un programa de stopover en Santiago para convertir en turistas a 800 mil pasajeros en conexión",
      url: "https://argentina.ladevi.info/actualidad/chile-quiere-convertir-turistas-800-mil-pasajeros-que-hoy-solo-hacen-escala-santiago-n106522",
      impact: "informativo"
    },
    {
      id: "news_puntualidad", date: "2026-09-22", source: "Ladevi",
      title: "Santiago–La Serena crece 28,8% y la puntualidad del segundo trimestre sube a 91,2% (+5,2 puntos)",
      url: "https://chile.ladevi.info/actualidad/tras-cifras-agosto-trafico-aereo-chile-completa-un-ano-la-baja-pero-aerolineas-mejoran-servicios-n106228",
      impact: "disponibilidad"
    },
    {
      id: "news_chilenos_encanta", date: "2026-09-18", source: "El Aéreo",
      title: "Gobierno lanza “ChileNos Encanta” y prioriza atraer aerolíneas desde China y Europa",
      url: "https://elaereo.com/2026/09/mientras-mas-aviones-mejor-presidente-kast-menciono-a-la-conectividad-aerea-para-impulsar-el-turismo-de-chile/",
      impact: "informativo"
    },
    {
      id: "news_cyber_turismo", date: "2026-09-29", source: "Ladevi",
      title: "CyberMonday 2026: 27 empresas de turismo inscritas, entre ellas LATAM, Iberia, Despegar, Atrápalo, Termas de Chillán y Radisson Puerto Varas",
      url: "https://chile.ladevi.info/actualidad/ccs-confirma-fechas-cybermonday-2026-revisa-las-marcas-turismo-que-participan-n106817",
      impact: "precios"
    }
  ].map(normalizeNews);
}

export function defaultDealSettings() {
  return {
    targetPrice: 350000, lastMinuteDays: 3, homeCity: "", feedUrl: "", lastSync: "", reportEmail: "", seedVersion: SEED_VERSION,
    alerts: { promo: true, lastMinute: true, target: true, exceptional: true, destination: true }
  };
}

/* ------------------------------------------------------------------ */
/* Normalización (también para importación y fuente remota)            */
/* ------------------------------------------------------------------ */

const ISO_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
const isoOrEmpty = (v) => (typeof v === "string" && ISO_RE.test(v.trim()) && !Number.isNaN(Date.parse(v)) ? v.trim() : "");
const numOrNull = (v) => { const n = toNumber(v); return Number.isFinite(n) && n >= 0 ? Math.round(n) : null; };

export function normalizeDeal(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = str(raw.title, 140);
  if (!title) return null;
  const pct = toNumber(raw.discountPct);
  return {
    id: typeof raw.id === "string" && /^[\w-]{1,64}$/.test(raw.id) ? raw.id : uid("deal"),
    type: DEAL_TYPES[raw.type] ? raw.type : "vuelo",
    title,
    provider: str(raw.provider, 80),
    origin: str(raw.origin, 80),
    destination: str(raw.destination, 80),
    price: numOrNull(raw.price),
    priceIncludesTaxes: Boolean(raw.priceIncludesTaxes),
    priceBasis: str(raw.priceBasis, 200),
    referencePrice: numOrNull(raw.referencePrice),
    referenceSource: raw.referenceSource === "independiente" ? "independiente" : raw.referenceSource === "proveedor" ? "proveedor" : "",
    discountPct: Number.isFinite(pct) && pct > 0 && pct <= 100 ? Math.round(pct) : null,
    discountBasis: ["real", "declarado"].includes(raw.discountBasis) ? raw.discountBasis : "desconocido",
    sourceKind: SOURCE_KINDS[raw.sourceKind] ? raw.sourceKind : "usuario",
    sourceName: str(raw.sourceName, 120),
    sourceUrl: safeHttpUrl(raw.sourceUrl),
    verifiedAt: isoOrEmpty(raw.verifiedAt),
    validFrom: isoOrEmpty(raw.validFrom),
    validUntil: isoOrEmpty(raw.validUntil),
    buyDays: Array.isArray(raw.buyDays) ? [...new Set(raw.buyDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : [],
    travelUntil: isoOrEmpty(raw.travelUntil),
    requiresCard: Boolean(raw.requiresCard),
    stockLimited: Boolean(raw.stockLimited),
    conditions: (Array.isArray(raw.conditions) ? raw.conditions : []).map((c) => str(c, 300)).filter(Boolean).slice(0, 12),
    notes: str(raw.notes, 500),
    scope: ["nacional", "internacional"].includes(raw.scope) ? raw.scope : "",
    travelDate: isoOrEmpty(raw.travelDate),
    fromFeed: raw.fromFeed === true
  };
}

export function normalizeNews(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = str(raw.title, 220);
  if (!title) return null;
  return {
    id: typeof raw.id === "string" && /^[\w-]{1,64}$/.test(raw.id) ? raw.id : uid("news"),
    date: isoOrEmpty(raw.date),
    source: str(raw.source, 80),
    title,
    url: safeHttpUrl(raw.url),
    impact: NEWS_IMPACT[raw.impact] ? raw.impact : "informativo"
  };
}

export function normalizeDealSettings(raw) {
  const d = defaultDealSettings();
  if (!raw || typeof raw !== "object") return d;
  const target = numOrNull(raw.targetPrice);
  const alerts = raw.alerts && typeof raw.alerts === "object" ? raw.alerts : {};
  return {
    targetPrice: target && target > 0 ? target : d.targetPrice,
    lastMinuteDays: [3, 7, 14].includes(raw.lastMinuteDays) ? raw.lastMinuteDays : d.lastMinuteDays,
    homeCity: str(raw.homeCity, 60),
    feedUrl: safeHttpUrl(raw.feedUrl),
    lastSync: isoOrEmpty(raw.lastSync),
    reportEmail: /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(String(raw.reportEmail || "").trim()) ? String(raw.reportEmail).trim().slice(0, 120) : "",
    seedVersion: Number.isInteger(raw.seedVersion) && raw.seedVersion > 0 ? raw.seedVersion : 1,
    alerts: Object.fromEntries(Object.keys(d.alerts).map((k) => [k, typeof alerts[k] === "boolean" ? alerts[k] : d.alerts[k]]))
  };
}

/* ------------------------------------------------------------------ */
/* Vigencia                                                            */
/* ------------------------------------------------------------------ */

const DAY = 86400000;
/** Una tarifa sin fecha de término se considera "por reverificar" pasados estos días. */
export const STALE_DAYS = 3;
function fmtShort(date) {
  return new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Santiago" }).format(date);
}
function santiagoWeekday(date) {
  const name = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Santiago" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

const endOfDay = (iso) => new Date(iso.length === 10 ? `${iso}T23:59:59-03:00` : iso);
/** Días desde la verificación (null si no hay fecha). */
export function daysSinceVerified(deal, now = new Date()) {
  if (!deal.verifiedAt) return null;
  return Math.floor((now - new Date(`${deal.verifiedAt.slice(0, 10)}T12:00:00-03:00`)) / DAY);
}

export function dealStatus(deal, now = new Date()) {
  const from = deal.validFrom ? new Date(deal.validFrom) : null;
  const until = deal.validUntil ? new Date(deal.validUntil) : null;
  if (until && now > until) {
    return { key: "expired", label: `Vencida el ${fmtShort(until)}`, buyableToday: false };
  }
  // Tarifa cotizada para una fecha puntual: si esa fecha ya pasó, el precio deja de servir.
  if (deal.travelDate && now > endOfDay(deal.travelDate)) {
    return { key: "expired", label: `Fecha cotizada ya pasó (${fmtShort(endOfDay(deal.travelDate))})`, buyableToday: false };
  }
  if (from && now < from) {
    const days = Math.ceil((from - now) / DAY);
    return { key: "upcoming", label: days <= 1 ? "Empieza mañana" : `Empieza en ${days} días (${fmtShort(from)})`, buyableToday: false, startsIn: from - now };
  }
  const msLeft = until ? until - now : Infinity;
  const age = daysSinceVerified(deal, now);
  let label = until ? (msLeft < DAY ? "Vence hoy" : `Vence en ${Math.ceil(msLeft / DAY)} días`)
    : age != null && age > STALE_DAYS ? `Precio del ${fmtShort(new Date(`${deal.verifiedAt.slice(0, 10)}T12:00:00-03:00`))}: reverificar`
    : deal.travelDate ? `Tarifa para el ${fmtShort(endOfDay(deal.travelDate))}`
    : "Sin fecha de término publicada";
  let buyableToday = true;
  let nextBuy = null;
  if (deal.buyDays.length) {
    const today = santiagoWeekday(now);
    buyableToday = deal.buyDays.includes(today);
    for (let i = 0; i <= 7 && !nextBuy; i++) {
      const d = new Date(now.getTime() + i * DAY);
      if (deal.buyDays.includes(santiagoWeekday(d)) && (!until || d <= until) && (i > 0 || buyableToday)) nextBuy = d;
    }
    const names = deal.buyDays.map((d) => WEEKDAYS[d]).join(" y ");
    label = buyableToday ? `Hoy se puede comprar (solo ${names})` : `Compra solo ${names} · próxima: ${nextBuy ? fmtShort(nextBuy) : "sin fechas restantes"}`;
  }
  return { key: "active", label, buyableToday, msLeft, nextBuy };
}

/* ------------------------------------------------------------------ */
/* Motor de scoring 0–100 (transparente)                               */
/* ------------------------------------------------------------------ */

export function realSaving(deal) {
  if (deal.price != null && deal.referencePrice && deal.referencePrice > deal.price) {
    return Math.round((1 - deal.price / deal.referencePrice) * 1000) / 10;
  }
  return null;
}

export function scoreLabel(score) {
  if (score == null) return "Sin puntaje";
  if (score >= 90) return "Oferta excepcional";
  if (score >= 75) return "Muy buena compra";
  if (score >= 60) return "Buena compra";
  if (score >= 40) return "Regular";
  return "Mejor esperar";
}

export function scoreDeal(deal, settings, now = new Date()) {
  const status = dealStatus(deal, now);
  if (!SCORED_TYPES.has(deal.type)) {
    return { score: null, label: deal.type === "evento" ? "Evento: sin precios aún" : "Complemento: suma valor a otra compra", parts: [], status };
  }
  if (status.key === "expired") return { score: null, label: "Vencida: solo referencia", parts: [], status };

  const parts = [];
  const real = realSaving(deal);
  // A. Ahorro (máx. 40)
  let a = 0; let aNote;
  if (real != null) { a = Math.min(40, real * 0.8); aNote = `Ahorro real sobre precio final: ${real}%`; }
  else if (deal.discountPct != null) { a = Math.min(30, deal.discountPct * 0.6); aNote = `Descuento declarado ${deal.discountPct}% (sin comparar con precio final)`; }
  else aNote = "Sin descuento verificable";
  parts.push({ label: "Ahorro", pts: Math.round(a), max: 40, note: aNote });
  // B. Precio vs objetivo (máx. 25)
  let b = 0; let bNote;
  if (deal.price == null) bNote = "Sin precio publicado";
  else {
    const ratio = deal.price / settings.targetPrice;
    b = ratio <= 1 ? Math.min(25, 10 + (15 * (1 - ratio)) / 0.75) : Math.max(0, 10 - (ratio - 1) * 20);
    bNote = `${Math.round(ratio * 100)}% de tu precio objetivo${deal.priceIncludesTaxes ? "" : " (sin tasas)"}`;
    if (!deal.priceIncludesTaxes) b = Math.max(0, b - 4);
  }
  parts.push({ label: "Precio vs objetivo", pts: Math.round(b), max: 25, note: bNote });
  // C. Fuente (máx. 20)
  const c = { bases: 20, oficial: 16, prensa: 12, agregador: 8, usuario: 6 }[deal.sourceKind];
  parts.push({ label: "Fuente", pts: c, max: 20, note: SOURCE_KINDS[deal.sourceKind] });
  // D. Ventana de compra (máx. 15)
  let d; let dNote;
  if (status.key === "upcoming") { d = 8; dNote = "Aún no empieza"; }
  else if (!status.buyableToday) { d = 12; dNote = "Vigente, pero no se puede comprar hoy"; }
  else if (status.msLeft < 3 * DAY) { d = 13; dNote = "Vigente, cierra pronto"; }
  else { d = 15; dNote = "Vigente y comprable hoy"; }
  parts.push({ label: "Ventana de compra", pts: d, max: 15, note: dNote });
  // Penalizaciones
  let penalty = 0;
  if (deal.requiresCard) { penalty += 5; parts.push({ label: "Requiere tarjeta o banco específico", pts: -5, max: 0, note: "No aplica a todos" }); }
  if (deal.stockLimited) { penalty += 3; parts.push({ label: "Stock limitado", pts: -3, max: 0, note: "Puede agotarse antes del cierre" }); }

  let score = Math.round(a + b + c + d - penalty);
  score = Math.max(0, Math.min(100, score));
  // Condición de veracidad: sin referencia independiente, no puede ser "muy buena" ni "excepcional".
  let capped = false;
  if (deal.referenceSource !== "independiente" && score > 74) { score = 74; capped = true; }
  return { score, label: scoreLabel(score), parts, status, capped, real };
}

/* ------------------------------------------------------------------ */
/* Coincidencia con el destino del viaje y alertas                     */
/* ------------------------------------------------------------------ */

const fold = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export function matchesDestination(deal, destination) {
  const d = fold(destination);
  if (!d) return false;
  return fold(deal.destination).includes(d) || fold(deal.title).includes(d);
}

export function computeAlerts(deals, settings, destination, now = new Date()) {
  const out = [];
  const on = settings.alerts;
  deals.forEach((deal) => {
    const s = scoreDeal(deal, settings, now);
    if (s.status.key === "expired") return;
    const real = realSaving(deal);
    if (on.destination && matchesDestination(deal, destination)) {
      out.push({ type: "destination", tag: "Tu viaje", deal, text: `Oferta para ${destination}: ${deal.title}` });
    }
    if (on.promo && deal.sourceKind === "bases" && ((real != null && real >= 15) || (real == null && deal.discountPct >= 15))) {
      out.push({ type: "promo", tag: "Promoción verificada", deal, text: `${deal.provider}: ${real != null ? `${real}% de ahorro real` : `hasta ${deal.discountPct}% según bases`} · ${deal.title}` });
    }
    if (on.lastMinute && s.status.key === "active" && s.status.msLeft <= settings.lastMinuteDays * DAY) {
      out.push({ type: "lastMinute", tag: "Último minuto", deal, text: `${deal.title}: ${s.status.label.toLowerCase()}` });
    }
    if (on.lastMinute && s.status.key === "upcoming" && s.status.startsIn <= settings.lastMinuteDays * DAY) {
      out.push({ type: "lastMinute", tag: "Por empezar", deal, text: `${deal.title}: ${s.status.label.toLowerCase()}` });
    }
    if (on.target && deal.price != null && SCORED_TYPES.has(deal.type) && deal.price <= settings.targetPrice) {
      out.push({ type: "target", tag: "Precio objetivo", deal, text: `${deal.title}: $${deal.price.toLocaleString("es-CL")} ≤ objetivo $${settings.targetPrice.toLocaleString("es-CL")}` });
    }
    if (on.exceptional && s.score != null && s.score >= 90) {
      out.push({ type: "exceptional", tag: "Oferta excepcional", deal, text: `${deal.title}: ${s.score}/100` });
    }
  });
  const order = { lastMinute: 0, destination: 1, exceptional: 2, promo: 3, target: 4 };
  return out.sort((x, y) => order[x.type] - order[y.type]);
}

/* ------------------------------------------------------------------ */
/* Herramientas (prompts para analizar en vivo con Claude)             */
/* ------------------------------------------------------------------ */

export const VERACITY = "Reglas: responde en español de Chile; precios en CLP con tasas incluidas y precio final real; cita cada fuente con enlace y fecha de verificación; no inventes precios, disponibilidad ni descuentos; marca como “no verificable” lo que no puedas confirmar hoy.";

export const TOOLS = [
  {
    id: "fechas", title: "Fechas óptimas",
    desc: "Compara combinaciones de ida y vuelta alrededor de una fecha y justifica las 3 mejores.",
    fields: [["origen", "Origen", "origin"], ["destino", "Destino", "destination"], ["fecha", "Fecha objetivo", "date"], ["dias", "Rango (± días)", "number", "3"]],
    build: (v) => `Analiza las fechas de ida y vuelta más económicas de ${v.origen} a ${v.destino} dentro de un intervalo de ±${v.dias} días alrededor del ${v.fecha}. Compara las combinaciones y justifica cuáles son las 3 mejores opciones con un razonamiento detallado.`
  },
  {
    id: "ocultos", title: "Vuelos ocultos",
    desc: "Todos los vuelos, incluidas low cost, regionales y conexiones poco conocidas, por precio total real.",
    fields: [["origen", "Origen", "origin"], ["destino", "Destino", "destination"], ["semanas", "Próximas semanas", "number", "4"]],
    build: (v) => `Lista todos los vuelos de ${v.origen} a ${v.destino} durante las próximas ${v.semanas} semanas, incluyendo aerolíneas low cost, regionales y conexiones menos conocidas. Ordénalos por el precio total real, no por la tarifa base.`
  },
  {
    id: "escalas", title: "Escalas inteligentes",
    desc: "Rutas con 1 o 2 escalas bajo un presupuesto, evitando tránsitos caros o largos.",
    fields: [["origen", "Origen", "origin"], ["destino", "Destino", "destination"], ["presupuesto", "Presupuesto (CLP)", "budget"], ["horas", "Máx. horas de escala", "number", "4"]],
    build: (v) => `Diseña rutas alternativas con 1 o 2 escalas desde ${v.origen} hasta ${v.destino} por menos de ${v.presupuesto} CLP. Prioriza escalas de menos de ${v.horas} horas y aeropuertos sin tarifas de tránsito elevadas.`
  },
  {
    id: "promos", title: "Ofertas verificadas",
    desc: "Códigos y ventas flash activos, con vencimiento y fuente; descarta lo caducado.",
    fields: [["aerolineas", "Aerolíneas o agencias", "text", "LATAM, SKY, JetSMART"]],
    build: (v) => `Encuentra códigos promocionales activos, ventas flash y descuentos para vuelos con ${v.aerolineas} en Chile. Verifica la fecha de vencimiento y la fuente (idealmente las bases legales). Descarta los que estén caducados o no puedan verificarse.`
  },
  {
    id: "cargos", title: "Desglose de cargos",
    desc: "Equipaje, asientos y embarque prioritario, con formas legales de evitarlos.",
    fields: [["vuelo", "Detalle del vuelo", "textarea", "Ej.: JetSMART Santiago–Buenos Aires, tarifa Basic, 2 adultos"]],
    build: (v) => `Desglosa todos los cargos adicionales de este vuelo: ${v.vuelo}. Incluye equipaje, asientos y embarque prioritario. Sugiere estrategias legales para evitar o reducir cada uno, basándote en las regulaciones y tarifas vigentes.`
  },
  {
    id: "email", title: "Email para negociar",
    desc: "Correo para pedir igualar el precio de un competidor o un descuento.",
    fields: [["empresa", "Empresa", "text", "Aerolínea, hotel o agencia"], ["precio", "Precio alternativo encontrado", "text", "Ej.: $64.320 en JetSMART"], ["fidelidad", "Tu historial como cliente", "textarea", "Ej.: socio LATAM Pass Gold, 6 vuelos este año"]],
    build: (v) => `Redacta un email profesional y persuasivo para ${v.empresa} solicitando igualar el precio de un competidor o aplicar un descuento. Precio alternativo encontrado: ${v.precio}. Fidelidad del cliente: ${v.fidelidad}. Menciona las políticas de precios actuales de la empresa y argumenta con datos verificables.`
  },
  {
    id: "riesgo", title: "Flexibilidad y riesgo",
    desc: "Compara cambios, cancelación y reembolso; señala cláusulas que pasan desapercibidas.",
    fields: [["vuelos", "Vuelos a comparar", "textarea", "Pega aerolínea, tarifa, fechas y precio de cada opción"]],
    build: (v) => `Analiza las políticas de cambio, cancelación y reembolso de estos vuelos:\n${v.vuelos}\nIdentifica cuál ofrece el menor riesgo financiero si cambian los planes. Señala cualquier cláusula relevante que pueda pasar desapercibida (incluido el derecho a retracto en Chile).`
  },
  {
    id: "oculto", title: "Destino oculto",
    desc: "Evalúa si un billete con destino oculto baja el costo, con sus riesgos reales.",
    fields: [["origen", "Origen", "origin"], ["destino", "Destino real", "destination"]],
    build: (v) => `Evalúa si los billetes con destino oculto pueden reducir el costo de ${v.origen} a ${v.destino}. Explica los riesgos reales, las políticas de las aerolíneas que operan la ruta y en qué casos concretos merece la pena asumir el riesgo.`
  }
];

export function buildToolPrompt(tool, values) {
  const missing = tool.fields.find(([key]) => !String(values[key] || "").trim());
  if (missing) return { error: `Completa “${missing[1]}”.` };
  return { prompt: `${tool.build(values)}\n\n${VERACITY}` };
}

export function buildAnalyzePrompt(deal) {
  return [
    "Actúa como Travel Deal Analyst y evalúa esta oferta para decidir si comprar, esperar o descartar.",
    `Oferta: ${deal.title} (${deal.provider}).`,
    deal.price != null ? `Precio registrado: $${deal.price.toLocaleString("es-CL")} CLP ${deal.priceIncludesTaxes ? "con tasas" : "sin tasas"} — ${deal.priceBasis}.` : "Sin precio registrado.",
    deal.discountPct != null ? `Descuento declarado: ${deal.discountPct}%.` : "",
    `Vigencia: ${deal.validFrom || "?"} a ${deal.validUntil || "?"}.`,
    deal.conditions.length ? `Condiciones: ${deal.conditions.join("; ")}.` : "",
    deal.sourceUrl ? `Fuente: ${deal.sourceUrl}` : "",
    "Verifica en vivo que siga vigente, calcula el precio final real y el ahorro real contra el precio habitual de la ruta, y entrega un puntaje 0–100 con su justificación.",
    VERACITY
  ].filter(Boolean).join("\n");
}

export const IMPORT_SCHEMA_EXAMPLE = {
  version: 1,
  generatedAt: "2026-10-05T09:00:00-03:00",
  deals: [{
    type: "vuelo", title: "Santiago → Buenos Aires", provider: "Aerolínea", origin: "Santiago", destination: "Buenos Aires",
    price: 64320, priceIncludesTaxes: true, priceBasis: "Por tramo con tasas",
    referencePrice: 81600, referenceSource: "proveedor", discountPct: 30, discountBasis: "declarado",
    sourceKind: "bases", sourceName: "Bases legales", sourceUrl: "https://…", verifiedAt: "2026-10-05",
    validFrom: "2026-10-05T00:00:00-03:00", validUntil: "2026-10-07T23:59:00-03:00", buyDays: [],
    travelUntil: "2027-03-31", travelDate: "", scope: "internacional",
    requiresCard: false, stockLimited: true, conditions: ["…"], notes: ""
  }],
  news: [{ date: "2026-10-05", source: "Medio", title: "…", url: "https://…", impact: "precios" }],
  discarded: [{ date: "2026-10-05", source: "Fuente", title: "Oferta descartada", reason: "Vencida el …", url: "https://…" }]
};

/** Fuentes que revisa cada corrida del Travel Deal Analyst. */
export const ANALYST_SOURCES = ["LATAM", "SKY", "JetSMART", "Despegar", "Booking"];

export function buildRefreshPrompt(settings, destination) {
  return [
    "Actúa como Travel Deal Analyst. Cada vez que corras:",
    `1. Busca en la web promociones activas de vuelos y hoteles en Chile (${ANALYST_SOURCES.join(", ")}) y noticias recientes de la industria de viajes en Chile.`,
    "2. Verifica la fecha de vencimiento y la fuente de cada oferta. Descarta lo caducado o no verificable y regístralo en “discarded” con el motivo.",
    `3. Prioriza ofertas con destino ${destination}${settings.homeCity ? ` y salida desde ${settings.homeCity}` : ""}, y luego las mejores generales. Mi precio objetivo es $${settings.targetPrice.toLocaleString("es-CL")} CLP por persona.`,
    "4. Usa como fuente preferente las bases legales o el sitio oficial; si solo hay prensa o un agregador, indícalo en sourceKind. Marca scope (nacional / internacional) y, si el precio es para una fecha puntual, travelDate.",
    "5. Si en alguna fuente no encuentras nada verificable, dilo explícitamente en “discarded”.",
    VERACITY,
    "Entrega al final SOLO un bloque JSON válido con este formato (sin comentarios), para importarlo en Travel OS:",
    JSON.stringify(IMPORT_SCHEMA_EXAMPLE, null, 2)
  ].join("\n");
}

/** Interpreta JSON importado o de la fuente remota. Nunca lanza: devuelve errores. */
export function parseImport(text) {
  let data;
  try {
    data = typeof text === "string" ? JSON.parse(text.trim().replace(/^```(?:json)?|```$/g, "").trim()) : text;
  } catch {
    return { deals: [], news: [], discarded: [], error: "El texto no es JSON válido. Copia solo el bloque JSON." };
  }
  const list = Array.isArray(data) ? data : data && Array.isArray(data.deals) ? data.deals : null;
  if (!list) return { deals: [], news: [], discarded: [], error: "No encontré una lista “deals” en el JSON." };
  const deals = list.slice(0, 200).map(normalizeDeal).filter(Boolean);
  const news = (data && Array.isArray(data.news) ? data.news : []).slice(0, 100).map(normalizeNews).filter(Boolean);
  const discarded = (data && Array.isArray(data.discarded) ? data.discarded : []).slice(0, 100).map(normalizeDiscarded).filter(Boolean);
  const skipped = list.length - deals.length;
  return { deals, news, discarded, skipped, error: deals.length || news.length || discarded.length ? null : "No hay ofertas válidas: cada una necesita al menos “title”." };
}
