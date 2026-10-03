# Travel OS (control de viajes)

Control de viajes con **varios viajes**, cada uno con su itinerario en **tabla** (día por día, agrupado en mañana / tarde / noche), mapa Leaflet, lugares e ideas con votos, reservas, documentos, presupuesto (y gastos compartidos) y pendientes. El itinerario incluye el progreso del día, el clima y el Plan B, y está el módulo **Ofertas de viaje en Chile (Travel Deal Analyst)**. Sitio estático (HTML + CSS + JavaScript sin framework) para GitHub Pages o Vercel, con **base de datos central en Supabase**: el administrador inicia sesión y ve lo mismo en cualquier dispositivo; los visitantes solo ven los viajes que él publica y las ofertas.

Viene con un viaje de ejemplo de 5 días a Buenos Aires (**Datos de ejemplo**). **✦ Nuevo viaje** crea otro viaje (los demás no cambian).

## Estructura del sitio

| Ruta | Pantalla | Visitante |
|---|---|---|
| `#/inicio` | Panel del viaje abierto (sin itinerario ni mapa): 4 indicadores (planificación, imprescindibles, reservas, presupuesto), gráfico "Ritmo del viaje", donut de categorías, barra de avance, pendientes, ofertas y alertas; en escritorio (≥ 1280 px) columna derecha con calendario, próximos viajes y estado de reservas | Panel del viaje público, viajes publicados y mejores ofertas |
| `#/viajes` | Tabla de viajes: fechas, días, lugares, estado (en curso / próximo / terminado), visibilidad; crear y eliminar | Solo viajes públicos |
| `#/viajes/<id>/itinerario` | Progreso del día, siguiente panorama ("Ahora"), clima y Plan B; **tabla** por día: #, hora, lugar (con contexto y observación), categoría, duración, traslado, prioridad, hecho, acciones (Cómo llegar, Waze y menú ⋯ para mover, editar, cambiar imagen o eliminar) | Solo lectura |
| `#/viajes/<id>/mapa` | Mapa con la ruta del día; capa **Calles** por defecto (también Satélite y Terreno) | Sí |
| `#/viajes/<id>/lugares` | Todos los lugares del viaje en una tabla + bolsa de ideas | Tabla (sin ideas) |
| `#/viajes/<id>/reservas` · `documentos` · `presupuesto` · `pendientes` | Una pantalla por tarea | — |
| `#/viajes/<id>/compartir` | Enlace de solo lectura y "visible para visitantes" | — |
| `#/ofertas` | Ofertas, Informe del día, Alertas, Noticias (+ Herramientas y Actualizar datos para el administrador) | Sin herramientas ni datos |
| `#/ajustes` | Cuenta, apariencia, respaldo (descargar / restaurar) | — |
| `#/menu` | Todas las secciones (pensado para el celular) | Secciones públicas |

Las URLs son enlazables y se mantienen al recargar. En el celular, barra inferior: Inicio, Viajes, Itinerario, Ofertas y Menú. Si el viaje tiene fecha de inicio y está en curso, el itinerario abre en el día de hoy. Las rutas privadas no se abren sin sesión (redirigen a Inicio). En móvil la tabla del itinerario muestra las columnas esenciales y lleva categoría, duración, traslado y prioridad bajo el nombre.

## Ver la app sin publicar

- **`ruta-ba-vista-previa.html`**: un solo archivo con todo incrustado. Ábrelo con doble clic en el computador o desde el celular; funciona sin servidor (modo local, datos en ese navegador). Se regenera con `npm run preview`.
- **`index.html` no se puede abrir con doble clic**: los navegadores bloquean los módulos JavaScript en `file://`, así que la interfaz no arranca (la página lo avisa). Usa la vista previa, `npm start` o la versión publicada en GitHub Pages.

## Ejecutar en local

```bash
npm run build          # genera /dist (sin dependencias)
npx serve dist         # o cualquier servidor estático
```

Pruebas end-to-end (Chromium headless con reloj fijo en el 01/10/2026), 255 comprobaciones (187 en modo local y 68 en modo base central): modo local (rutas, panel de Inicio, itinerario en tabla, varios viajes, CRUD, ofertas, informe del día, respaldo, migración de datos, móvil, compartir y SEO) y en modo base central con un Supabase simulado (visitante, inicio de sesión, permisos, sincronización entre dispositivos, sin conexión, archivos, datos manipulados, cierre de sesión):

```bash
pip install playwright && python -m playwright install chromium
npm i --prefix /tmp/leafletpkg leaflet@1.9.4   # Leaflet local para no depender del CDN
npm test
```

## Publicar en GitHub Pages (recomendado)

El repositorio incluye `.github/workflows/pages.yml`: en cada push a `main` ejecuta el build y publica `dist/` en GitHub Pages. No hay que subir `dist/` (está en `.gitignore`).

1. Crea un repositorio en GitHub, por ejemplo `travel-os` (público: GitHub Pages gratis requiere repositorio público; tus viajes, gastos y reservas viven en tu navegador, no en el repo).
2. Sube el contenido de esta carpeta a la rama `main` (arrastrando los archivos en github.com → *Add file → Upload files*, o con `git push`). Ojo: al arrastrar, los navegadores suelen omitir la carpeta oculta `.github`. Si después de subir no aparece en el repositorio, créala con *Add file → Create new file*, escribe como nombre `.github/workflows/pages.yml` y pega el contenido de ese archivo.
3. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Abre la pestaña **Actions**: el flujo "Publicar en GitHub Pages" corre solo (o ejecútalo con *Run workflow*). Al terminar, el sitio queda en `https://TU-USUARIO.github.io/travel-os/`.

El build toma la URL que entrega Pages y ajusta `canonical`, `og:url`, `og:image`, JSON-LD, `sitemap.xml`, `robots.txt` y todas las rutas de assets a la subruta del repositorio (por ejemplo `/travel-os/`) (verificado sirviendo el build bajo esa subruta: 0 errores, 0 recursos 404).

**Dominio propio (opcional)**: en **Settings → Pages → Custom domain** escribe el dominio (por ejemplo `viajes.tudominio.cl`), crea en tu DNS el registro CNAME hacia `TU-USUARIO.github.io` y marca **Enforce HTTPS**. Luego, en **Settings → Secrets and variables → Actions → Variables**, crea `SITE_URL` = `https://viajes.tudominio.cl` y vuelve a ejecutar el flujo para que canonical y sitemap usen el dominio definitivo.

**Diferencias con Vercel**: GitHub Pages no aplica los encabezados ni las redirecciones de `vercel.json` (no afectan a la app) y no crea URLs de vista previa. En un sitio de proyecto (`usuario.github.io/travel-os`) los buscadores solo leen el `robots.txt` de la raíz del dominio, no el de la subruta: no bloquea nada, pero el sitemap debe enviarse a mano en Search Console. Con dominio propio, `robots.txt` y sitemap quedan en la raíz y funcionan completos.

### Alternativa: Vercel

`vercel.json` sigue incluido. Importa el mismo repositorio en Vercel (o `npx vercel --prod`), define `SITE_URL` en **Settings → Environment Variables** y deja un solo dominio principal; el resto, como redirección permanente. En Vercel las vistas previas salen con `noindex` automáticamente.

### Qué hace el build

- reemplaza el dominio (con subruta si la hay) en `canonical`, `og:url`, `og:image`, JSON-LD, `sitemap.xml`, `robots.txt` y en las rutas de `index.html` y `404.html`;
- en producción deja `index, follow`; en Preview/Development (`VERCEL_ENV` o `DEPLOY_ENV` distinto de `production`) pone `noindex, nofollow` y `robots.txt` con `Disallow: /`;
- versiona CSS y módulos JS con un hash de contenido (cache-busting), agrega `.nojekyll` y falla si queda algún marcador sin reemplazar.

## Base de datos central (Supabase)

Sin configurar, la app funciona en **modo local** (datos en el navegador, como antes). Con Supabase pasa a **modo base central**:

| Quién | Qué ve | Qué puede hacer |
|---|---|---|
| Visitante (sin sesión) | Los viajes que publiques (itinerario, mapa, lugares, imágenes) y Ofertas (lista, informe, alertas, noticias) | Solo mirar. No ve viajes privados, gastos, reservas, documentos, pendientes, ideas, observaciones ni el correo del informe |
| Administrador (correo y contraseña) | Todo | Editar todo; cada cambio se guarda en la base y aparece en sus otros dispositivos |

La seguridad no depende del navegador: la imponen las reglas RLS de la base (`supabase/schema.sql`). Las secciones privadas nunca se envían a un visitante, y solo los usuarios de la tabla `admins` pueden escribir.

### Configurar (una vez, ~10 minutos)

1. Crea una cuenta y un proyecto en [supabase.com](https://supabase.com) (plan Free). Región sugerida: São Paulo.
2. **SQL Editor → New query**: pega el contenido de `supabase/schema.sql` y pulsa **Run**. Crea las tablas, las reglas de acceso y los buckets de archivos (`media` público para imágenes, `documents` privado).
3. **Authentication → Sign In / Providers → Email**: deja Email activado y **desactiva "Allow new users to sign up"** (nadie más podrá registrarse).
4. **Authentication → Users → Add user → Create new user**: tu correo y una contraseña segura, con *Auto Confirm User* marcado.
5. Vuelve al **SQL Editor** y ejecuta (con tu correo):
   ```sql
   insert into public.admins (user_id, email)
     select id, email from auth.users where email = 'tu@correo.cl'
     on conflict (user_id) do nothing;
   ```
6. **Project Settings → API Keys**: copia la **Project URL** y la clave **anon / publishable**. Nunca uses la `service_role` / `secret` (el build la rechaza).
7. En GitHub: **Settings → Secrets and variables → Actions → Variables**, crea `SUPABASE_URL` y `SUPABASE_ANON_KEY` con esos valores y vuelve a ejecutar el flujo de Pages.
8. Abre el sitio, pulsa **Iniciar sesión** (arriba) y entra. La primera vez, si la base está vacía, se sube lo que tengas en ese navegador; desde ahí la base manda.

### Cómo funciona

- Al abrir, la app muestra la última copia guardada en el navegador y descarga la base (la base es la fuente de verdad). Al volver a la pestaña se vuelve a leer.
- Cada cambio del administrador se sube a los 0,7 s, solo las secciones que cambiaron, con una foto tomada al momento del cambio (cambiar de viaje antes de que suba no mezcla datos entre viajes).
- Un viaje nuevo es privado. En **Compartir** (o ✎ Datos del viaje) se marca "visible para visitantes"; al eliminar un viaje se borran sus filas de la base. Indicador arriba: *Guardando… / Guardado en la base · hh:mm / Cambios pendientes*.
- Sin conexión, los cambios quedan pendientes y se suben solos al volver la red (y cada 30 s), sin reintentar en bucle. Si intentas cerrar la pestaña con cambios pendientes, el navegador avisa.
- Tema, sección contraída, día activo y filtros son preferencias de cada dispositivo: no se suben.
- Imágenes subidas → bucket público `media`; documentos → bucket privado `documents` (solo el administrador los descarga). Las imágenes que tenías guardadas solo en el navegador (modo local) hay que volver a subirlas una vez.
- **Salir** borra de ese navegador los datos privados y la sesión.
- La sesión se renueva sola; si vence o se revoca, la app lo indica y los cambios siguen pendientes hasta volver a entrar.

### Tablas

| Tabla | Contenido |
|---|---|
| `app_state` | Una fila por sección: globales (`deals`, `dealNews`, `dealDiscarded`, `publicTrips`, `dealSettings`, `tripIndex`) y por viaje (`trips@<id>`, `budget@<id>`…; el primer viaje sin sufijo). `data` (JSON), `is_public`, `updated_at`, `updated_by`. Lista blanca de claves; ofertas y `publicTrips` siempre públicas; itinerario/datos/imágenes de un viaje públicos solo si el administrador lo publica; todo lo demás siempre privado (lo impone la base) |
| `admins` | Usuarios con permiso de edición |
| `storage.objects` | Archivos de `media` y `documents` |

## Arquitectura

```
index.html            Estructura semántica, metadatos SEO, contenedores de cada sección
assets/css/app.css    Estilos por capas; la última es la de temas (UI por defecto, UI oscuro, Claro, Noche, Arena, Factory, Seline, Steep)
assets/js/
  deals-core.js       Ofertas: datos verificados, vigencia, scoring 0–100, alertas, prompts, importación (lógica pura)
  deals.js            Ofertas: acciones de estado (CRUD, importar, fuente remota, pasar a Reservas)
  config.js           URL y clave pública de Supabase (las inyecta el build; vacías = modo local)
  cloud.js            Cliente mínimo de Supabase con fetch: sesión, tablas y archivos (sin dependencias)
  sync.js             Sincronización: rol visitante/administrador, subida por sección, reintentos, inicio y cierre de sesión
  views-control.js    Rutas y pantallas del control: Inicio, Viajes, Compartir, Ajustes, Menú
  deals-report.js     Informe del día: KPIs, comparador, cobertura por fuente, resumen de correo y dashboard HTML (lógica pura)
  deals-view.js       Ofertas: pestañas Ofertas / Informe del día / Alertas / Noticias / Herramientas / Actualizar datos
  util.js             Constantes, escapeHtml, URLs de Google Maps/Waze, placeholders SVG
  store.js            Estado único, datos iniciales, validación, persistencia, undo/redo, acciones
  views.js            Un renderizador por vista; renderApp() orquesta todo
  views-dash.js       Barra superior (título, buscador, luna/sol, campana, cuenta) y widgets del panel de Inicio
  mymaps.js           Exporta el viaje a KML para importarlo en Google My Maps
  map.js              Leaflet con carga diferida, 3 capas (Calles, Terreno, Satélite), marcadores numerados, ruta, fallback
  media.js            Imágenes (URL → localStorage, archivo → IndexedDB) y archivos de documentos
  idb.js              Envoltorio mínimo de IndexedDB
  ui.js               Diálogo modal accesible, formularios por esquema, avisos con "Deshacer"
  main.js             Arranque, router, eventos delegados (data-act), temas (applyTheme), asistente, compartir, clima y Plan B
  icons.js            Íconos Lucide (ISC) incrustados
supabase/schema.sql   Tablas, reglas RLS y buckets de la base central
scripts/build.mjs     Build estático
tests/e2e.py          Pruebas end-to-end (modo local)
tests/e2e_cloud.py    Pruebas end-to-end con un Supabase simulado (visitante, administrador, sincronización, archivos, seguridad)
```

Flujo de datos: **acción → `commit()` (instantánea para deshacer) → muta estado → persiste → `renderApp()`**. No hay escrituras al DOM fuera de `views.js`. El mapa solo se redibuja si cambian los puntos del día; editar una observación no reconstruye nada.

Equivalencias con la especificación: `render(dayIndex)` = `renderItinerary()` (usa `state.activeDay`) y `renderDestinations()` = `renderAllDestinations()`.

### Claves de almacenamiento

Las secciones de cada viaje (meta, días, imágenes, presupuesto, pendientes, reservas, documentos, ideas, viajeros, gastos, observaciones, hechos) se guardan por viaje como `<clave>@<id del viaje>`. El primer viaje (`viaje_1`) usa las claves sin sufijo, así los datos de versiones anteriores siguen funcionando sin migración.

| Clave | Contenido |
|---|---|
| `ba_trip_index_v1` | Lista de viajes (resumen: destino, fechas, días, lugares, visibilidad) |
| `ba_trips_admin_v1` | Días y panoramas |
| `ba_trip_meta_v1` | Destino, país, estilo |
| `ba_panorama_notes_v1` | Observaciones por panorama |
| `ba_done_items_v1` | Panoramas hechos |
| `ba_destination_image_urls_v2` | URLs de imágenes |
| `ba_pending_admin_v1` / `ba_reservations_admin_v1` / `ba_documents_admin_v1` | CRUD administrativos |
| `ba_trip_budget_v2` | `{ base, currency, moves }` |
| `ba_ideas_v1` / `ba_people_v1` / `ba_group_expenses_v1` | Ideas, viajeros, gastos compartidos |
| `ba_deals_v1` / `ba_deal_news_v1` / `ba_deal_settings_v1` | Ofertas, noticias, reglas de alerta, correo del informe y versión de datos |
| `ba_deal_discarded_v1` | Descartados por vencidos o no verificables (auditoría de cada corrida) |
| `ba_collapsed_sections_v1` | Secciones contraídas (reemplaza a `ba_hidden_sections_v1`, que se elimina al cargar) |
| `ba_trip_theme` / `ba_travel_mode_v1` / `ba_today_day_v1` / `ba_map_view` / `ba_ui_v1` | Preferencias de interfaz |

IndexedDB: `ruta_ba_images_v2` (store `images`) y `ruta_ba_documents_v1` (store `files`). Los archivos pertenecen solo al navegador actual; no están en la nube. Al cargar se eliminan archivos huérfanos.

### Evolución del backend

La base central guarda cada sección del estado como un documento JSON (`app_state`), lo que mantiene intactas las acciones y las vistas. Si más adelante hay varios administradores editando a la vez o se necesitan reportes por SQL, el paso siguiente es normalizar en tablas (`trips, days, places, ideas, votes, reservations, expenses, documents`) sin cambiar la interfaz.

## Módulo Ofertas de viaje (Travel Deal Analyst)

Integra el sistema maestro de ofertas y la corrida diaria del **Travel Deal Analyst** dentro del planificador. Seis pestañas:

- **Ofertas**: vuelos, estadías, paquetes, beneficios bancarios y eventos de venta, con filtros por tipo, vigencia, texto y "solo para mi destino". Cada tarjeta muestra precio final, precio habitual, ahorro real, fuente con enlace, fecha de verificación, condiciones y estado calculado en hora de Chile (vigente, por empezar, vencida, o "compra solo miércoles · próxima: …"). Botones: **Guardar en reservas** (crea una reserva pendiente con precio, condiciones y fuente) y **Copiar análisis** (instrucción lista para pegar en Claude).
- **Informe del día** (la corrida del Travel Deal Analyst dentro de la app): fecha y hora de verificación; 5 KPIs (vigentes, tramo nacional e internacional más barato, mayor descuento hotelero, próximo evento); **comparador de vuelos** ordenado por precio con filtro Nacional / Internacional; **alojamiento** con precio, precio anterior y ahorro; **cobertura por fuente** (LATAM, SKY, JetSMART, Despegar, Booking: dice explícitamente cuál no tuvo hallazgos verificables); **descartados** con su motivo; **correo de actualización** con asunto `Travel Deal Analyst — actualización AAAA-MM-DD` y resumen de 3 líneas con el mejor hallazgo (copiar o abrir en tu correo), y **Descargar dashboard**: genera el HTML autocontenido (navegación lateral, KPIs, comparador, alojamiento, cobertura, noticias, alertas, descartados) para adjuntarlo.
- **Alertas**: tu viaje, promoción verificada (≥ 15 % con bases oficiales), último minuto (72 h / 7 / 14 días), precio objetivo y oferta excepcional (≥ 90). Reglas editables.
- **Noticias**: solo las que afectan precios o disponibilidad, con fuente.
- **Herramientas**: las 8 instrucciones (fechas óptimas, vuelos ocultos, escalas inteligentes, ofertas verificadas, desglose de cargos, email para negociar, flexibilidad y riesgo, destino oculto), prellenadas con el destino del viaje.
- **Actualizar datos**: copiar instrucción de búsqueda (es la misma del Travel Deal Analyst: LATAM, SKY, JetSMART, Despegar, Booking y noticias; verificar vencimiento y fuente; descartar y registrar lo caducado) → Claude responde con JSON → pegar e importar (se actualizan las repetidas y se registran los descartes). Correo para el informe, fuente automática opcional por URL y exportación.

**Vigencia de tarifas del día**: una tarifa cotizada para una fecha puntual (`travelDate`) vence sola cuando esa fecha pasa; una tarifa sin fecha de término publicada se marca "reverificar" pasados 3 días desde su verificación.

**Envío por correo**: la app es estática y no envía correos sola. "Abrir en mi correo" prepara asunto y cuerpo; el dashboard se adjunta a mano. Para envío automático diario hace falta un servicio externo (por ejemplo Apps Script con Gmail, o una tarea programada de Claude con Gmail conectado) que lea la fuente automática.

### Puntaje 0–100

| Componente | Máx. | Regla |
|---|---|---|
| Ahorro | 40 | Ahorro real sobre precio final × 0,8; si solo hay descuento declarado, × 0,6 con tope 30 |
| Precio vs objetivo | 25 | 25 si cuesta ≤ 25 % del objetivo, 10 al llegar al objetivo, baja por encima; −4 si no incluye tasas |
| Fuente | 20 | Bases legales 20 · sitio oficial 16 · prensa 12 · agregador 8 · ingresada por ti 6 |
| Ventana de compra | 15 | Comprable hoy 15 · cierra en < 3 días 13 · vigente pero no hoy 12 · por empezar 8 |
| Penalizaciones | — | Requiere banco/tarjeta −5 · stock limitado −3 |

Tope de **74** si el ahorro se mide contra una referencia del propio proveedor (no contra un historial independiente). Etiquetas: ≥ 90 excepcional, 75–89 muy buena, 60–74 buena, 40–59 regular, < 40 esperar. Beneficios y eventos no se puntúan; las ofertas vencidas quedan solo como referencia histórica.

### Datos iniciales (verificados el 01/10/2026 07:11, hora de Chile)

- JetSMART × BCI/MACHBANK: hasta 30 % (crédito) solo los miércoles hasta el 30/12/2026, 14 días de anticipación. Santiago → Buenos Aires estimado $64.320 por tramo con tasas (habitual $81.600), Santiago → Mendoza y Concepción → Santiago. Fuente: bases legales del 30/09/2026.
- JetSMART × BancoEstado: maleta de bodega gratis con CuentaRUT hasta el 09/10/2026 (stock 2.000).
- CyberMonday 2026: 5 al 7 de octubre; sin precios publicados aún.
- Referencias históricas vencidas: Escapada Primaveral JetSMART (sep 2026), Travel Sale SKY (sep 2026), Cyber 2025 de SKY y LATAM.
- Corrida Travel Deal Analyst (18 ofertas): tarifas oficiales JetSMART nacionales desde $16.900 y $18.900 por tramo sin tasas (La Serena–Calama, Santiago–Antofagasta, Santiago–Calama, Calama–Santiago, Santiago–Concepción, con fecha cotizada) e internacionales desde $63.492 (Trujillo), $65.416 (Buenos Aires, Mendoza) y $76.960 (Lima, Montevideo); Despegar: Santiago ⇄ Calama y ⇄ Antofagasta $55.485 ida y vuelta, Santiago ⇄ Florianópolis (SKY) $256.958; hoteles Director Vitacura $75.782 (−43%), Icon $85.987 (−38%), Noi Casa Atacama $317.515 (−12%), Andes Plaza Bogotá $50.973 (−29%), Cartagena Plaza $120.081 (−20%).
- Noticias: tráfico aéreo de agosto (−2,1%, cierre de la base de JetSMART en Concepción), puntualidad 91,2%, stopover en Santiago, campaña "ChileNos Encanta", 27 empresas de turismo en el CyberMonday.
- Descartados (6): Travel Sale SKY vencido, Booking "Late Escape" vencido, Norus Providencia con fecha pasada, notas de prensa de 2019 y 2024, y LATAM/SKY sin tarifas verificables en sus páginas.
- Quien ya usaba la app recibe la corrida nueva al abrirla (`seedVersion` 2): se agregan las ofertas, noticias y descartes que falten, sin pisar ni duplicar los suyos.

### Formato JSON (importación y fuente automática)

```json
{
  "version": 1,
  "deals": [{
    "type": "vuelo", "title": "Santiago → Buenos Aires", "provider": "Aerolínea",
    "origin": "Santiago", "destination": "Buenos Aires",
    "price": 64320, "priceIncludesTaxes": true, "priceBasis": "Por tramo con tasas",
    "referencePrice": 81600, "referenceSource": "proveedor",
    "discountPct": 30, "discountBasis": "declarado",
    "sourceKind": "bases", "sourceName": "Bases legales", "sourceUrl": "https://…",
    "verifiedAt": "2026-10-05",
    "validFrom": "2026-10-05T00:00:00-03:00", "validUntil": "2026-10-07T23:59:00-03:00",
    "buyDays": [], "travelUntil": "2027-03-31",
    "travelDate": "", "scope": "internacional",
    "requiresCard": false, "stockLimited": true, "conditions": ["…"], "notes": ""
  }],
  "news": [{ "date": "2026-10-05", "source": "Medio", "title": "…", "url": "https://…", "impact": "precios" }],
  "discarded": [{ "date": "2026-10-05", "source": "Fuente", "title": "Oferta descartada", "reason": "Vencida el …", "url": "https://…" }]
}
```

`type`: vuelo · estadia · paquete · beneficio · evento. `sourceKind`: bases · oficial · prensa · agregador · usuario. `scope`: nacional · internacional (si falta, se deduce de origen y destino). `travelDate`: fecha para la que se cotizó el precio. `buyDays`: días de la semana (0 = domingo). Todo se valida al importar; lo inválido se descarta sin romper la app.

**Fuente automática**: cualquier URL que devuelva ese JSON con CORS habilitado (por ejemplo, una hoja de Google con Apps Script publicado como aplicación web y un activador programado). La app la lee al abrir y reemplaza solo las ofertas de esa fuente. Sin esa fuente, la actualización es bajo demanda con Claude.

## Seguridad y privacidad

- Todo texto de usuario (y todo lo que llega de la base) pasa por `escapeHtml()` antes de `innerHTML`; las URLs se limitan a `http(s)`.
- Base central: la clave publicable de Supabase es pública por diseño; la protección real son las reglas RLS (lectura pública solo de las 6 secciones públicas; lectura privada y toda escritura solo para `admins`). El build rechaza claves `service_role`/`secret`. Registro de usuarios desactivado.
- El enlace **↗ Compartir** codifica solo destino e itinerario (`#share=…`). No incluye gastos, reservas, documentos, ofertas, descartados, correo del informe, observaciones ni imágenes locales.
- El dashboard descargado escapa todo el texto importado y lleva `noindex, nofollow`. El contenido del hash se valida y normaliza antes de usarlo; si es inválido, se ignora.
- La vista compartida no guarda nada en el navegador de quien la abre.

## SEO técnico

| Comprobación | Estado |
|---|---|
| HTTPS | GitHub Pages y Vercel lo entregan por defecto (en Pages con dominio propio: marcar *Enforce HTTPS*) |
| `sitemap.xml` | Generado en el build, URL absoluta canónica, 200 |
| `robots.txt` | `Allow: /` + `Sitemap:` en producción; bloqueo total solo en previews. En Pages de proyecto, sitemap enviado a mano en Search Console |
| `noindex` | Solo en previews y en `404.html` |
| Canonical | URL absoluta del dominio definitivo |
| Title / description | Únicos y descriptivos |
| Open Graph / X Cards | Con imagen 1200×630 |
| Datos estructurados | `WebApplication` (corresponde al contenido visible) |
| 404 | `404.html` con código 404 real |
| Móvil | Sin scroll horizontal a 390 px, barra inferior, controles ≥ 40 px |
| Contenido rastreable | `h1`, `h2` de cada sección y texto descriptivo en el HTML inicial; navegación con enlaces `<a href>` |

Nota: es una aplicación de una sola URL indexable (`/`). Los datos del usuario y la vista compartida (`#share=`) no son páginas indexables, por diseño.

### Pendiente en Google Search Console (requiere acceso del propietario)

1. Agregar la propiedad:
   - con dominio propio: propiedad de **dominio** (registro TXT en el DNS);
   - en `usuario.github.io/travel-os`: propiedad de **prefijo de URL** `https://TU-USUARIO.github.io/travel-os/`, verificada con la etiqueta HTML (se pega en `index.html`, se hace push y se pulsa Verificar).
2. Enviar la URL del sitemap (`…/sitemap.xml`) en **Sitemaps** y confirmar estado "Correcto".
3. **Inspección de URLs** → URL principal → "Probar URL publicada" → revisar captura renderizada → **Solicitar indexación**.
4. A los días, revisar **Páginas** (indexadas / no indexadas), **Mejoras** (datos estructurados) y que la canónica elegida por Google coincida con la declarada.
5. Si cambia el dominio: actualizar `SITE_URL`, redirigir el anterior y reenviar el sitemap.
