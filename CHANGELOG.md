# Cambios

## 3.9.1 — 2026-10-03
- Solo documentación (la app no cambia). README: Inicio descrito como panel (sin itinerario ni mapa), mapa con 3 capas, temas actuales, `views-dash.js`, `mymaps.js` e `icons.js` en la arquitectura, 255 comprobaciones y repositorio de ejemplo `travel-os`. CHANGELOG 3.9.0: corregida la descripción del tema por defecto.

## 3.9.0 — 2026-10-02
- **UI es el tema por defecto**. La app abre siempre en UI claro (no sigue el modo oscuro del sistema); el oscuro se elige con el botón luna/sol y se recuerda.
- **Nuevo tema UI oscuro**: misma estructura shadcn y mismos colores sobre fondo #0a0a0a, tarjetas #171717 y bordes blancos al 10 %.
- **Botón luna/sol** en la barra superior para pasar de claro a oscuro desde cualquier pantalla.

## 3.8.0 — 2026-10-02
- **Tema UI con los colores de Travel OS**: se mantiene la estructura shadcn (lienzo #f5f5f5, barra lateral #fafafa, tarjetas blancas radio 24 con borde fino y sombra mínima, controles radio 18, pestañas tipo interruptor, entradas grises, Geist y etiquetas en mayúsculas) y se suman los colores de Claro: degradado azul → violeta → rosa en el menú activo, botones, cabecera del viaje y encabezado de Inicio; un color por indicador; categorías multicolor; borde de color por sección.

## 3.7.0 — 2026-10-02
- **Tema Steep** (design-steep.md): lienzo blanco, tarjetas niebla #f2f2f3 de radio 24 sin sombra, titulares serif 400 (Source Serif 4, sustituto libre de Signifier) con una frase en cursiva, texto Inter, botones píldora negros #17191c y contorno, piezas de datos como artefactos blancos flotantes y un único acento durazno #fbe1d1 con tinta siena #5d2a1a (Inicio o la cabecera del viaje).
- **Tema UI (shadcn)** (design-ui.md): acromático, lienzo #f5f5f5, barra lateral #fafafa, tarjetas blancas de radio 24 con borde #e5e5e5 y sombra mínima, controles de radio 18, botón principal negro #0a0a0a, entradas grises, Geist 400/600 con tracking ajustado, etiquetas en mayúsculas 12 px; el rojo #e7000b solo en acciones de borrar.
- Ajustes muestra los 7 temas con su nombre; muestras `ruta-ba-muestra-<tema>.html` para factory, seline, steep y ui.

## 3.6.0 — 2026-10-02
- **Tema Seline** (Ajustes → Apariencia), según design-seline.md: lienzo piedra cálida #fafaf9, tarjetas blancas con borde #e8e6e5 y sombra suave, Inicio como "vista previa flotante" (única sombra profunda), títulos Inter Tight 400 con tracking negativo (sustituto libre de Roobert) y texto Inter 14 px, controles en píldora, pestaña activa en #1c1917 y un solo color: cian #3ba6f1 (acción principal, gráficos, calendario y el resaltado del destino en el titular de Inicio). La acción principal usa texto oscuro sobre cian para cumplir contraste AA.

## 3.5.0 — 2026-10-02
- **Tema Factory** (Ajustes → Apariencia), según la guía design-factory.md: lienzo negro #101010, texto #eeeeee, cabecera del viaje e indicadores de Inicio como tarjeta clara #eeeeee sobre el fondo oscuro, Geist 400 con tracking negativo y Geist Mono en mayúsculas para etiquetas, radios 3/10/20 px, sin sombras ni degradados; naranja #ee6018 y verde #a0ca92 solo para estado y datos (pulso del menú activo, gráficos, reservas, vigencia de ofertas). Las fuentes Geist se cargan solo al elegir este tema. Los temas Claro, Noche y Arena no cambian.

## 3.4.0 — 2026-10-02
- **Más vitalidad en todas las pantallas**: barra lateral índigo profundo con el elemento activo en degradado; cabecera del viaje y de Inicio en degradado azul → violeta → rosa; cada sección con su color (itinerario azul, mapa turquesa, lugares violeta, reservas verde, presupuesto verde, pendientes ámbar, ideas rosa, ofertas naranja) en el borde, el título y el encabezado de las tablas; indicadores de ofertas en tarjetas de color; saldo del presupuesto en verde; fondo con brillos de color.

## 3.3.0 — 2026-10-02
- **Crear en Google My Maps** (en Mapa y en Compartir): descarga el viaje como KML (una carpeta por día, un punto por lugar con color por categoría, la ruta de cada día y los campos Día, Orden, Hora, Categoría y Prioridad) y muestra los pasos para importarlo en My Maps. Google no ofrece una API para crear mapas de My Maps automáticamente. Las notas privadas no se incluyen en el archivo.

## 3.2.0 — 2026-10-02
- **Marca Travel OS**: logo nuevo (avión blanco sobre degradado azul → violeta), nombre en la barra lateral y en la barra superior del celular; título, Open Graph, datos estructurados, favicon, ícono de inicio en iPhone e imagen para redes actualizados. Los datos guardados y los respaldos siguen siendo compatibles.
- **Más color**: primario en degradado azul → violeta, encabezado de Inicio en degradado, un color por indicador (azul, ámbar, verde, violeta), categorías multicolor en el donut, línea del gráfico en degradado, barras de avance y reservas en verde/azul/ámbar/rosa y miniaturas de viajes en distintos degradados.
- **Contraste corregido**: el texto blanco sobre el azul pasa de 2,8:1 a 5,2:1 (WCAG AA); textos secundarios más oscuros.
- Tema Noche con fondo oscuro correcto.

## 3.1.0 — 2026-10-02
- Inicio deja de mostrar el itinerario y el mapa (siguen en sus pestañas del viaje). Inicio queda como panel: indicadores, ritmo del viaje, categorías, avance, pendientes, ofertas y la columna de calendario, próximos viajes y reservas.
- Al agregar un lugar siempre se abre el itinerario para verlo.

## 3.0.0 — 2026-10-02
- **Diseño tipo panel (referencia Travelie)**: monocromático azul (#3B9EF5 sobre fondo #F0F4F8), tarjetas blancas sin sombras fuertes, radios de 12–16 px, tipografía Poppins e íconos de línea (Lucide, ISC) en toda la navegación.
- **Barra superior**: título de la página, buscador de lugares y viajes (con teclado), campana con punto cuando hay alertas de ofertas y cuenta (avatar, nombre y rol).
- **Inicio en 2/3 + 1/3** (escritorio ≥ 1280 px): indicadores con ícono en cuadro celeste y badge de estado; gráfico de líneas "Ritmo del viaje" (horas o lugares por día, punto activo con tooltip); donut de categorías; barra segmentada de avance; columna derecha con calendario (rango del viaje resaltado, hoy subrayado), próximos viajes y estado de reservas. En móvil y tablet todo va en una columna.
- El selector de apariencia (Claro/Noche/Arena) queda en Ajustes.
- Solo datos reales: no se muestran variaciones porcentuales, ingresos ni mensajes porque la app no tiene esos datos.

## 2.4.0 — 2026-10-02
- **Nuevo estilo visual** (solo estilo; mismas pantallas y orden): panel moderno con fondo suave, barra lateral blanca con elemento activo en píldora verde, tarjetas blancas redondeadas con sombra suave, indicadores con icono redondo, tablas limpias con etiquetas tipo píldora y tipografía Plus Jakarta Sans.
- Paleta verde bosque, dorado y crema (temas Claro, Noche y Arena).
- Móvil: indicadores en 2 columnas; cabecera del viaje sin el borde punteado.

## 2.3.0 — 2026-10-02
- **Inicio y Resumen unificados**: se quita la pestaña Resumen del viaje. Inicio muestra, en orden: aviso del viaje en curso o próximo (solo si es otro viaje), los 4 indicadores del viaje, itinerario, mapa, pendientes, y alertas y mejores ofertas. Se eliminan los paneles repetidos de reservas y presupuesto.
- Los enlaces antiguos a `#/viajes/<id>/resumen` llevan a Inicio. El viaje tiene 8 pestañas.

## 2.2.1 — 2026-10-02
- Se quita el bloque de ofertas del Resumen del viaje (las ofertas siguen en Ofertas y en Inicio).
- El mapa vuelve a abrir en **Calles** por defecto (Satélite y Terreno siguen disponibles en los botones).

## 2.2.0 — 2026-10-02
- "Dinero" pasa a llamarse **Presupuesto** (`#/viajes/<id>/presupuesto`; los enlaces antiguos a `dinero` siguen funcionando).
- **Inicio**: itinerario, mapa y **pendientes** (editables) del viaje, y debajo el resumen general.
- Mapa en **Satélite** por defecto; se quita la capa Oscuro (quedan Satélite, Calles y Terreno).
- **Nuevo diseño visual** con más contraste: fondo de color en vez de blanco, barra lateral y barra inferior oscuras, cabecera del viaje en degradado, cada sección como tarjeta con franja superior y encabezado teñidos de su color, tablas con encabezado y filas alternadas, paneles con borde de color. Aplicado a los temas Claro, Noche y Arena.

## 2.1.0 — 2026-10-02
- **Inicio** vuelve a mostrar el **itinerario** (tabla) y el **mapa** del viaje abierto, y debajo el resumen general (viaje en curso o próximo, pendientes, reservas por confirmar, alertas, presupuesto y ofertas).
- Se quita la pantalla **Hoy**: el progreso del día, el siguiente panorama, el clima y el Plan B están en el Itinerario. Con un viaje en curso, el itinerario abre en el día de hoy.
- El mapa abre en la capa **Terreno** por defecto.
- Barra inferior en el celular: Inicio, Viajes, Itinerario, Ofertas y Menú.

## 2.0.0 — 2026-10-01
- **Control de viajes** con estructura por pantallas y URLs propias (`#/inicio`, `#/hoy`, `#/viajes`, `#/viajes/<id>/<sección>`, `#/ofertas`, `#/ajustes`, `#/menu`).
- **Varios viajes**: crear (con fecha de inicio), cambiar, editar datos, publicar o dejar privado y eliminar. Cada viaje guarda por separado itinerario, reservas, documentos, dinero, ideas y pendientes. El primer viaje conserva los datos anteriores sin migración.
- **Itinerario en tabla** (antes tarjetas): hora, lugar, categoría, duración, traslado, prioridad, hecho y acciones; agrupado por mañana / tarde / noche; versión móvil con columnas esenciales. "Todos los lugares" también en tabla.
- **Inicio**: viaje en curso o próximo con cuenta regresiva, pendientes, reservas por confirmar, alertas, presupuesto y mejores ofertas.
- **Hoy** como pantalla propia: panorama "Ahora" con Cómo llegar / Waze / Hecho, clima, Plan B y tabla compacta; con fecha de inicio elige solo el día del viaje. Reemplaza el "modo viaje".
- **Compartir** por viaje y **Ajustes** (cuenta, apariencia, respaldo descargable y restaurable).
- Base central: claves por viaje (`<clave>@<id>`), `tripIndex` privado y `publicTrips` público; reglas de la base actualizadas (validadas en PostgreSQL 16). Corregido un reintento en bucle cuando no hay red.
- Suite: 230 comprobaciones (local + Supabase simulado).

## 1.4.1 — 2026-10-01
- `index.html` usa rutas relativas (`assets/…`): funciona igual en la raíz de un dominio, en `usuario.github.io/ruta-ba/` y con cualquier servidor local.
- Nueva **vista previa en un solo archivo** (`ruta-ba-vista-previa.html`, `npm run preview`): se abre con doble clic o en el celular, sin servidor; `noindex` y sin canonical.
- Si `index.html` se abre directamente como archivo (los navegadores bloquean los módulos en `file://`), la página muestra cómo abrirla en vez de quedar a medio cargar.

## 1.4.0 — 2026-10-01
- **Base de datos central (Supabase)**: modelo público + administrador.
  - Visitantes sin sesión: itinerario, mapa, lugares, imágenes y ofertas en solo lectura; sin datos privados.
  - Administrador con correo y contraseña: edita todo y ve lo mismo en cualquier dispositivo.
  - `supabase/schema.sql`: tabla `app_state` (una fila por sección, lista blanca de claves y visibilidad fijada por la base), `admins`, función `is_admin()`, reglas RLS y buckets `media` (público) y `documents` (privado). Validado en PostgreSQL 16 con roles anon/authenticated simulados.
  - Sincronización: la base manda; subida por sección con espera de 0,7 s, cambios pendientes sin conexión con reintento, relectura al volver a la pestaña, indicador de estado.
  - Imágenes y documentos subidos van a Supabase Storage.
  - Cerrar sesión borra datos privados y sesión del navegador.
- El build inyecta `SUPABASE_URL` y `SUPABASE_ANON_KEY` (rechaza claves secretas); sin ellas, modo local como antes. `OUT_DIR` opcional.
- Nueva suite `tests/e2e_cloud.py` (44 comprobaciones con Supabase simulado). Total: 169.

## 1.3.1 — 2026-10-01
- Publicación en **GitHub Pages**: flujo `.github/workflows/pages.yml` (build + despliegue en cada push a `main`).
- El build admite `SITE_URL` con subruta (`https://usuario.github.io/ruta-ba`): canonical, sitemap, robots, JSON-LD y rutas de assets de `index.html` y `404.html` se ajustan solos. Agrega `.nojekyll`; acepta `DEPLOY_ENV` fuera de Vercel.
- `.gitignore` para no subir `dist/`. README con pasos de GitHub Pages, dominio propio y Search Console.

## 1.3.0 — 2026-10-01
- Integrada la corrida diaria del **Travel Deal Analyst** como pestaña **Informe del día** del módulo Ofertas:
  - KPIs, comparador de vuelos (precio ascendente, filtro Nacional / Internacional, enlace a cada oferta), alojamiento con ahorro, cobertura por fuente (LATAM, SKY, JetSMART, Despegar, Booking) y descartados con motivo;
  - correo de actualización: asunto `Travel Deal Analyst — actualización AAAA-MM-DD` + resumen de 3 líneas con el mejor hallazgo; copiar o abrir en el correo (destinatario configurable);
  - **Descargar dashboard**: HTML autocontenido para adjuntar.
- Datos de la corrida del 01/10/2026 07:11: 18 ofertas verificadas (JetSMART oficial, Despegar), 5 noticias y 6 descartes.
- Nuevos campos `scope` y `travelDate`; las tarifas cotizadas para una fecha vencen solas y las tarifas sin término se marcan "reverificar" a los 3 días.
- Instrucción de búsqueda alineada con el Travel Deal Analyst; la importación y la fuente automática aceptan `discarded`.
- Migración: quien ya tenía datos guardados recibe la corrida nueva sin perder ni duplicar lo suyo (`seedVersion`).
- Suite end-to-end con reloj fijo: 125 comprobaciones.

## 1.2.0 — 2026-10-01
- La sección **Hoy** se integró al **Itinerario** (repetía las mismas tarjetas). Lo que solo tenía Hoy ahora vive en el Itinerario:
  - franja del día con progreso ("2 de 5 hechos"), enlace al siguiente panorama, clima (Open-Meteo) y botón ☂ Plan B;
  - el siguiente panorama pendiente se marca con "Ahora" dentro de su bloque;
  - **Modo viaje** pasa al encabezado del Itinerario: lo pone primero al abrir y compacta las tarjetas (oculta datos, observaciones y detalle de lo ya hecho).
- Navegación sin la entrada "Hoy". Suite: 98 comprobaciones.

## 1.1.1 — 2026-10-01
- Eliminadas secciones casi duplicadas: "Plan completo" (repetía "Todos los destinos") y la lista bajo el mapa (repetía el itinerario; ahora solo aparece si el mapa no carga).
- Quitados "+ Lugar" y "↕ Ordenar día" del encabezado del día: ya están en la cabecera del viaje.
- Hoy rediseñado como vista rápida distinta del itinerario: "Ahora" destacado, "Después" en filas compactas y "Hechos" plegados.
- Ajustes móviles en encabezados de sección y filas de pendientes. Suite: 95 comprobaciones.

## 1.1.0 — 2026-10-01
- Nuevo módulo **Ofertas de viaje** (Travel Deal Analyst) integrado al estado central: ofertas, alertas, noticias, 8 herramientas de análisis y actualización de datos.
- Motor de puntaje 0–100 transparente, con desglose por componente y tope por veracidad.
- Vigencia calculada en hora de Chile, incluidas promociones de días específicos (solo miércoles).
- Importación JSON validada (acepta el bloque con cercas ```json), exportación y fuente automática opcional por URL.
- Ofertas → Reservas con un clic; destacado de la mejor oferta en el Resumen; alertas para el destino del viaje.
- Datos iniciales reales verificados el 01/10/2026 (bases legales JetSMART, CyberMonday 2026) y referencias históricas vencidas.
- Deshacer/rehacer cubre ofertas y noticias; el modo compartido no expone ofertas.
- Suite end-to-end ampliada a 94 comprobaciones.

## 1.0.0 — 2026-10-01
- Primera versión completa reconstruida desde la especificación maestra.
- Estado único + renderizadores únicos (sin duplicados); sincronización inmediata entre Itinerario, Todos los destinos, mapa, resumen y Hoy.
- CRUD de panoramas, días, pendientes, reservas, documentos, ideas, viajeros y gastos; deshacer/rehacer (40 pasos, Ctrl/Cmd+Z, Ctrl+Y, Cmd+Shift+Z).
- Mapa Leaflet con capas Calles/Terreno/Satélite/Oscuro, marcadores numerados y ruta; fallback si el CDN falla.
- Vista Hoy con modo viaje, clima Open-Meteo y Plan B bajo techo.
- Enlace compartido de solo lectura validado.
- Build para Vercel con dominio canónico, robots por entorno, sitemap y cache-busting.
- Suite end-to-end (73 comprobaciones).
