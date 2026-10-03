"""Pruebas de la base central con un Supabase simulado (Auth + PostgREST + Storage en memoria).
Reproduce las reglas RLS de supabase/schema.sql: lo público lo lee cualquiera; lo privado y
toda escritura, solo el administrador."""
import datetime, json, os, re, subprocess, threading, http.server, socketserver, functools, urllib.parse
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = "/tmp/ruta-ba-dist-cloud"
SB = "https://fake.supabase.co"
PORT = int(os.environ.get("E2E_CLOUD_PORT", "8793"))
LEAFLET = os.environ.get("LEAFLET_DIR", "/tmp/leafletpkg/node_modules/leaflet/dist")
SHOTS = os.environ.get("SHOTS", "/tmp/shots"); os.makedirs(SHOTS, exist_ok=True)
NOW = datetime.datetime(2026, 10, 1, 10, 30, tzinfo=datetime.timezone.utc)

env = {**os.environ, "OUT_DIR": OUT, "SUPABASE_URL": SB, "SUPABASE_ANON_KEY": "sb_publishable_test123", "SITE_URL": "https://example.github.io/ruta-ba"}
subprocess.run(["node", "scripts/build.mjs"], cwd=ROOT, env=env, check=True, stdout=subprocess.DEVNULL)

# Sirve el build bajo /ruta-ba/ (como GitHub Pages de proyecto).
socketserver.TCPServer.allow_reuse_address = True
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def translate_path(self, path):
        path = path.split("?")[0]
        if path.startswith("/ruta-ba"): path = path[len("/ruta-ba"):] or "/"
        return super().translate_path(path)
httpd = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(H, directory=OUT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}/ruta-ba/"

ALWAYS_PUBLIC = {"deals", "dealNews", "dealDiscarded", "publicTrips"}
MAYBE_PUBLIC = {"meta", "trips", "imageUrls"}
def public_ok(key, is_public):
    base = key.split("@")[0]
    if base in ALWAYS_PUBLIC: return is_public
    if base in MAYBE_PUBLIC: return True
    return not is_public
USERS = {"admin@x.cl": ("clave123", "u-admin"), "otro@x.cl": ("clave123", "u-otro")}
ADMINS = {"u-admin"}
DB = {"rows": {}, "files": {}, "pushes": 0, "offline": False}
TOKENS = {}

def user_of(req):
    auth = req.headers.get("authorization", "")
    return TOKENS.get(auth.replace("Bearer ", "")) if auth.startswith("Bearer ") else None

def sb_handler(route):
    req = route.request
    if DB["offline"]: return route.abort("internetdisconnected")
    public_get = req.method == "GET" and "/storage/v1/object/public/" in req.url  # como Supabase: sin apikey
    if not public_get and req.headers.get("apikey") != "sb_publishable_test123": return route.fulfill(status=401, json={"message": "No API key"})
    u = urllib.parse.urlparse(req.url); q = urllib.parse.parse_qs(u.query); path = u.path; m = req.method
    uid = user_of(req); admin = uid in ADMINS
    if path == "/auth/v1/token":
        body = json.loads(req.post_data or "{}")
        if q.get("grant_type") == ["password"]:
            pw, uid2 = USERS.get(body.get("email"), (None, None))
            if pw != body.get("password"): return route.fulfill(status=400, json={"error_description": "Invalid login credentials"})
            tok = f"tok-{uid2}-{len(TOKENS)}"; TOKENS[tok] = uid2
            return route.fulfill(json={"access_token": tok, "refresh_token": "r-" + tok, "expires_in": 3600, "user": {"id": uid2, "email": body["email"]}})
        old = body.get("refresh_token", "")[2:]
        if old not in TOKENS: return route.fulfill(status=400, json={"error_description": "Invalid Refresh Token"})
        tok = old + "x"; TOKENS[tok] = TOKENS[old]
        return route.fulfill(json={"access_token": tok, "refresh_token": "r-" + tok, "expires_in": 3600, "user": {"id": TOKENS[tok], "email": "x"}})
    if path == "/auth/v1/logout": return route.fulfill(status=204, body="")
    if path == "/rest/v1/admins":
        want = (q.get("user_id", [""])[0]).replace("eq.", "")
        return route.fulfill(json=[{"user_id": uid}] if uid and uid == want and admin else [])
    if path == "/rest/v1/app_state":
        if m == "GET":
            rows = [{"key": k, "data": v["data"], "updated_at": v["at"]} for k, v in DB["rows"].items() if v["public"] or admin]
            return route.fulfill(json=rows)
        if m == "POST":
            if not uid: return route.fulfill(status=401, json={"message": "permission denied"})
            if not admin: return route.fulfill(status=403, json={"message": "new row violates row-level security policy"})
            for r in json.loads(req.post_data):
                if not public_ok(r["key"], r["is_public"]): return route.fulfill(status=400, json={"message": "violates check constraint app_state_public_check"})
                DB["rows"][r["key"]] = {"data": r["data"], "public": r["is_public"], "at": datetime.datetime.utcnow().isoformat()}
            DB["pushes"] += 1
            return route.fulfill(status=201, body="")
        if m == "DELETE":
            if not admin: return route.fulfill(status=403, json={"message": "RLS"})
            keys = re.findall(r'"([^"]+)"', urllib.parse.unquote(q.get("key", [""])[0]))
            for k in keys: DB["rows"].pop(k, None)
            return route.fulfill(status=204, body="")
    m2 = re.match(r"^/storage/v1/object/(public/|authenticated/)?(media|documents)/?(.*)$", path)
    if m2:
        kind, bucket, name = m2.group(1), m2.group(2), urllib.parse.unquote(m2.group(3))
        if m == "POST":
            if not admin: return route.fulfill(status=403, json={"message": "RLS"})
            DB["files"][(bucket, name)] = (req.post_data_buffer, req.headers.get("content-type", ""))
            return route.fulfill(json={"Key": f"{bucket}/{name}"})
        if m == "GET":
            if kind == "public/" and bucket != "media": return route.fulfill(status=400, json={})
            if kind == "authenticated/" and not admin: return route.fulfill(status=403, json={})
            f = DB["files"].get((bucket, name))
            return route.fulfill(body=f[0], content_type=f[1]) if f else route.fulfill(status=404, json={})
        if m == "DELETE":
            if not admin: return route.fulfill(status=403, json={})
            for p in json.loads(req.post_data).get("prefixes", []): DB["files"].pop((bucket, p), None)
            return route.fulfill(json=[])
    return route.fulfill(status=404, json={"message": f"no simulado: {m} {path}"})

import base64
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=")
def route_all(page):
    def h(r):
        u = r.request.url
        if u.startswith(SB): return sb_handler(r)
        if "leaflet.min.js" in u: return r.fulfill(path=os.path.join(LEAFLET, "leaflet.js"), content_type="application/javascript")
        if "leaflet.min.css" in u: return r.fulfill(path=os.path.join(LEAFLET, "leaflet.css"), content_type="text/css")
        if "api.open-meteo.com" in u: return r.fulfill(json={"current": {"weather_code": 1, "precipitation": 0, "temperature_2m": 18}})
        if any(x in u for x in ["openstreetmap", "opentopomap", "arcgisonline", "cartocdn"]): return r.fulfill(body=PNG, content_type="image/png")
        if u.startswith(f"http://127.0.0.1:{PORT}/"): return r.continue_()
        return r.abort()
    page.route("**/*", h)

failures = []
def check(cond, msg):
    print(("  ok  " if cond else "  FAIL") + " " + msg)
    if not cond: failures.append(msg)

def visible(page, sel): return page.locator(sel).first.is_visible() if page.locator(sel).count() else False
def wait_status(page, text, timeout=4000):
    try: page.wait_for_function(f"document.querySelector('#cloudBar')?.textContent.includes({json.dumps(text)})", timeout=timeout); return True
    except Exception: return False

def new_device(browser, **kw):
    ctx = browser.new_context(viewport={"width": 1366, "height": 900}, **kw)
    ctx.clock.install(time=NOW)
    page = ctx.new_page(); errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    route_all(page)
    return ctx, page, errors

def login(page, email, pw):
    page.click("[data-act='cloud-login']"); page.wait_for_selector("#modal[open] input[name='email']")
    page.fill("#modal input[name='email']", email); page.fill("#modal input[name='password']", pw)
    page.click("#modal button[type='submit']"); page.wait_for_timeout(600)

with sync_playwright() as p:
    browser = p.chromium.launch()

    def nav(pg, route):
        pg.evaluate(f"location.hash = '#/{route}'"); pg.wait_for_timeout(300)
    READY = "#itineraryBody .itin-row"

    print("Visitante (base vacía)")
    ctx, page, errors = new_device(browser)
    page.goto(BASE + "#/viaje/itinerario"); page.wait_for_selector(READY); page.wait_for_timeout(500)
    check(page.evaluate("document.body.classList.contains('viewer-mode')"), "modo visitante activo")
    check("Vista pública" in page.text_content("#cloudBar") and visible(page, "[data-act='cloud-login']"), "barra: vista pública + iniciar sesión")
    check(visible(page, "#sec-itinerario") and visible(page, "#itineraryBody table.itin-table"), "ve el itinerario en tabla")
    for r in ["viaje/reservas", "viaje/presupuesto", "viaje/documentos", "viaje/resumen", "hoy", "ajustes", "viaje/compartir"]:
        nav(page, r)
        check(not visible(page, "#sec-reservas") and not visible(page, "#sec-gastos") and not visible(page, "#sec-documentos") and not visible(page, "#sec-ajustes") and not visible(page, "#sec-hoy"), f"ruta privada {r} bloqueada → {page.evaluate('location.hash')}")
    nav(page, "viaje/itinerario")
    check(not visible(page, ".history-bar") and not visible(page, ".ticket-stub"), "sin barra de gestión ni botones de viaje")
    for r in ["viaje/itinerario", "viaje/lugares", "inicio", "viajes", "ofertas"]:
        nav(page, r)
        vis_admin = page.evaluate("[...document.querySelectorAll('.admin')].filter(e => e.offsetParent !== null).length")
        mut = page.evaluate("""[...document.querySelectorAll('[data-act]')].filter(e => e.offsetParent !== null)
          .map(e => e.dataset.act).filter(a => /add|edit|delete|remove|save|reserve|done|planner|sort|purge|clear|import|budget|person|vote|promote|trip-/.test(a))""")
        check(vis_admin == 0 and not mut, f"{r}: sin controles de edición ({vis_admin}, {sorted(set(mut))[:5]})")
    check(not visible(page, "#sec-ideas"), "ideas (privadas) ocultas en Lugares")
    check(DB["pushes"] == 0 and not DB["rows"], "un visitante no escribe en la base")
    nav(page, "ofertas")
    page.click("[data-act='deal-tab'][data-tab='informe']"); page.wait_for_timeout(150)
    check(visible(page, "#reportFlights") and not visible(page, ".report-mail"), "informe visible sin el correo privado")
    check(page.locator("[data-act='deal-tab'][data-tab='datos']").is_hidden(), "pestañas de administración ocultas")

    print("Inicio de sesión")
    login(page, "admin@x.cl", "mala")
    check("Correo o contraseña incorrectos" in page.text_content("#modal"), "contraseña incorrecta")
    page.fill("#modal input[name='email']", "otro@x.cl"); page.fill("#modal input[name='password']", "clave123")
    page.click("#modal button[type='submit']"); page.wait_for_timeout(500)
    check("no tiene permisos de administrador" in page.text_content("#modal"), "usuario sin permisos rechazado")
    check(page.evaluate("localStorage.getItem('ba_cloud_session_v1')") is None, "sesión no admin descartada")
    page.fill("#modal input[name='email']", "admin@x.cl"); page.fill("#modal input[name='password']", "clave123")
    page.click("#modal button[type='submit']"); page.wait_for_timeout(900)
    check(not page.evaluate("document.body.classList.contains('viewer-mode')"), "administrador: modo edición")
    check(wait_status(page, "Guardado en la base"), "estado: guardado en la base")
    check(len(DB["rows"]) == 18, f"primera sesión sube 12 secciones del viaje + 6 globales ({len(DB['rows'])}: {sorted(DB['rows'])})")
    check(all(public_ok(k, v["public"]) for k, v in DB["rows"].items()) and DB["rows"]["trips"]["public"] and not DB["rows"]["budget"]["public"] and not DB["rows"]["tripIndex"]["public"], "visibilidad correcta por sección")
    check([t["id"] for t in DB["rows"]["publicTrips"]["data"]] == ["viaje_1"], "el viaje de ejemplo figura como público")
    nav(page, "viaje/presupuesto")
    check(visible(page, "#sec-gastos") and visible(page, ".history-bar"), "ve secciones privadas y gestión")

    print("Cambios del administrador → base")
    nav(page, "viaje/lugares")
    page.fill("form[data-form='idea'] input[name='name']", "Idea secreta del admin")
    page.click("form[data-form='idea'] button[type='submit']"); page.wait_for_timeout(1200)
    check(any(i.get("name") == "Idea secreta del admin" for i in DB["rows"]["ideas"]["data"]), "idea (privada) guardada en la base")
    nav(page, "ofertas")
    n_deals = len(DB["rows"]["deals"]["data"])
    page.click("[data-act='deal-tab'][data-tab='ofertas']"); page.wait_for_timeout(100)
    page.click("#deal-tda_js_scl_tru [data-act='deal-delete']"); page.wait_for_timeout(1200)
    check(len(DB["rows"]["deals"]["data"]) == n_deals - 1, "eliminar oferta se refleja en la base")
    pushes = DB["pushes"]
    nav(page, "ajustes"); page.click("#ajustesBody [data-act='theme'][data-theme='noche']"); nav(page, "inicio"); page.wait_for_timeout(1000)
    check(DB["pushes"] == pushes, "preferencias de interfaz y rutas no se suben (son por dispositivo)")

    print("Varios viajes en la base")
    nav(page, "viajes")
    page.click("#sec-viajes [data-act='planner']"); page.fill("#pDest", "Mendoza"); page.click("[data-next]"); page.click("[data-next]")
    page.click("[data-next]"); page.wait_for_timeout(1500)
    mid = page.evaluate("location.hash").split("/")[2]
    check(f"trips@{mid}" in DB["rows"] and f"budget@{mid}" in DB["rows"] and not DB["rows"][f"trips@{mid}"]["public"], "viaje nuevo guardado con sus propias claves (privado por defecto)")
    check(len(DB["rows"]["tripIndex"]["data"]) == 2 and [t["id"] for t in DB["rows"]["publicTrips"]["data"]] == ["viaje_1"], "índice privado con 2 viajes; lista pública con 1")
    nav(page, "viaje/compartir")
    page.click("#compartirBody .switch-row"); page.wait_for_timeout(1300)
    check(DB["rows"][f"trips@{mid}"]["public"] and DB["rows"][f"meta@{mid}"]["public"] and not DB["rows"][f"pending@{mid}"]["public"], "publicar el viaje expone solo itinerario, datos e imágenes")
    check(sorted(t["id"] for t in DB["rows"]["publicTrips"]["data"]) == sorted(["viaje_1", mid]), "lista pública actualizada")

    print("Otro dispositivo")
    ctx2, p2, err2 = new_device(browser)
    p2.goto(BASE + "#/viajes"); p2.wait_for_timeout(900)
    check(p2.locator("#viajesBody .trips-table tbody tr").count() == 2 and "Mendoza" in p2.text_content("#viajesBody"), "visitante ve los dos viajes públicos")
    p2.goto(BASE + f"#/viajes/{mid}/itinerario"); p2.wait_for_timeout(700)
    check(p2.text_content("#tripTitle") == "Mendoza" and p2.locator("#itineraryBody .itin-row").count() == 3, f"visitante abre el itinerario de Mendoza desde la base ({p2.text_content('#tripTitle')}, {p2.locator('#itineraryBody .itin-row').count()})")
    nav(p2, "ofertas")
    check(p2.locator("#deal-tda_js_scl_tru").count() == 0 and p2.locator("#deal-tda_js_scl_bue").count() == 1, "visitante ve la oferta eliminada por el admin")
    ls = p2.evaluate("JSON.stringify(localStorage)")
    check("Idea secreta del admin" not in p2.content() and "Idea secreta del admin" not in ls, "visitante no recibe datos privados")
    nav(page, "viaje/compartir")
    page.click("#compartirBody .switch-row"); page.wait_for_timeout(1300)
    p2.goto(BASE + "#/viajes"); p2.reload(); p2.wait_for_timeout(900)
    check(p2.locator("#viajesBody .trips-table tbody tr").count() == 1, "al volver a privado, el viaje desaparece para visitantes")
    p2.goto(BASE + f"#/viajes/{mid}/itinerario"); p2.wait_for_timeout(700)
    check(p2.text_content("#tripTitle") != "Mendoza", "un visitante no puede abrir un viaje privado por URL")
    login(p2, "admin@x.cl", "clave123")
    check(wait_status(p2, "Guardado en la base"), "admin en segundo dispositivo sincronizado")
    p2.goto(BASE + "#/viajes/viaje_1/lugares"); p2.wait_for_timeout(700)
    check("Idea secreta del admin" in p2.text_content("#sec-ideas"), "admin ve la idea creada en el otro dispositivo")
    p2.goto(BASE + f"#/viajes/{mid}/itinerario"); p2.wait_for_timeout(700)
    check(p2.text_content("#tripTitle") == "Mendoza", "admin abre en otro dispositivo el viaje creado en el primero")

    print("Sin conexión y reintento")
    page.goto(BASE + "#/viajes/viaje_1/lugares"); page.wait_for_timeout(800)
    DB["offline"] = True
    REQS = []
    page.on("request", lambda r: REQS.append(r.method + " " + r.url[:90]) if r.url.startswith(SB) else None)
    page.fill("form[data-form='idea'] input[name='name']", "Idea sin red")
    page.click("form[data-form='idea'] button[type='submit']"); page.wait_for_timeout(1300)
    check(wait_status(page, "Cambios pendientes"), f"estado: cambios pendientes ({page.text_content('#cloudBar')})")
    check("Idea sin red" in page.text_content("#sec-ideas"), "el cambio sigue visible localmente")
    nav(page, "viaje/itinerario"); nav(page, "viaje/lugares"); page.wait_for_timeout(1500)
    check(len([r for r in REQS if r.startswith("POST")]) <= 2, f"sin red no reintenta en bucle ({len(REQS)} intentos)")
    DB["offline"] = False
    page.evaluate("window.dispatchEvent(new Event('online'))"); page.wait_for_timeout(1000)
    check(any(i.get("name") == "Idea sin red" for i in DB["rows"]["ideas"]["data"]), "al volver la red, el cambio llega a la base (al viaje correcto)")
    check(not any(i.get("name") == "Idea sin red" for i in DB["rows"].get(f"ideas@{mid}", {"data": []})["data"]), "no se mezcla con otro viaje")
    check(wait_status(page, "Guardado en la base"), "estado vuelve a guardado")

    print("Archivos en Storage")
    nav(page, "viaje/itinerario")
    page.locator("#itineraryBody details.act-menu summary").first.click()
    page.locator("#itineraryBody details.act-menu[open] [data-act='img-edit']").click(); page.wait_for_selector("#modal[open] input[type='file']")
    page.set_input_files("#modal input[type='file']", files=[{"name": "foto.png", "mimeType": "image/png", "buffer": PNG}])
    page.click("#modal button[type='submit']"); page.wait_for_timeout(1500)
    media = [k for k in DB["files"] if k[0] == "media"]
    urls = DB["rows"]["imageUrls"]["data"]
    check(len(media) == 1 and any(v.startswith(SB + "/storage/v1/object/public/media/images/") for v in urls.values()), "imagen subida al bucket público y URL en la base")
    p2_ctx3 = browser.new_context(); p3 = p2_ctx3.new_page(); p3.clock.install(time=NOW); route_all(p3)
    p3.goto(BASE + "#/viajes/viaje_1/itinerario"); p3.wait_for_selector(READY); p3.wait_for_timeout(600)
    srcs = p3.evaluate("[...document.querySelectorAll('img')].map(i => i.src)")
    check(any("/storage/v1/object/public/media/images/" in s for s in srcs), "un visitante ve la imagen subida")
    nav(page, "viaje/documentos")
    page.click("#sec-documentos [data-act='doc-add']")
    page.wait_for_selector("#modal[open] input[name='name']")
    page.fill("#modal input[name='name']", "Pasaporte escaneado")
    page.set_input_files("#modal input[type='file']", files=[{"name": "pasaporte.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4 prueba"}])
    page.click("#modal button[type='submit']"); page.wait_for_timeout(1300)
    docs = [d for d in DB["rows"]["documents"]["data"] if d["name"] == "Pasaporte escaneado"]
    check(docs and docs[0]["fileCloud"] is True and ("documents", docs[0]["fileKey"]) in DB["files"], "documento subido al bucket privado")
    check("Archivo en la base central" in page.text_content("#sec-documentos"), "documento marcado como guardado en la base")

    print("Datos manipulados en la base")
    DB["rows"]["deals"]["data"].insert(0, {"id": "x_evil", "type": "vuelo", "title": "<img src=x onerror=window.__pwn=1>", "provider": "<script>window.__pwn=2</script>", "sourceUrl": "javascript:alert(1)"})
    DB["rows"]["publicTrips"]["data"].append({"id": "x<b>", "destination": "<img src=x onerror=window.__pwn=3>"})
    p3.goto(BASE + "#/ofertas"); p3.reload(); p3.wait_for_timeout(900)
    check(p3.evaluate("window.__pwn") is None and p3.locator("#deal-x_evil").count() == 1, "contenido de la base se escapa (sin ejecución)")
    check(p3.locator("#deal-x_evil a[href^='javascript']").count() == 0, "enlaces no http descartados")
    nav(p3, "viajes")
    check(p3.evaluate("window.__pwn") is None and "onerror" not in p3.inner_html("#viajesBody"), "viajes con id inválido descartados")
    DB["rows"]["publicTrips"]["data"].pop()

    print("Eliminar viaje")
    nav(page, "viajes")
    page.click(f"#viajesBody [data-act='trip-delete'][data-trip='{mid}']"); page.click("#modal [data-confirm]"); page.wait_for_timeout(1500)
    check(not any(k.endswith("@" + mid) for k in DB["rows"]) and len(DB["rows"]["tripIndex"]["data"]) == 1, "eliminar viaje borra sus filas de la base")

    print("Cerrar sesión")
    page.click("[data-act='cloud-logout']"); page.wait_for_timeout(900)
    check(page.evaluate("document.body.classList.contains('viewer-mode')"), "vuelve a modo visitante")
    ls = page.evaluate("JSON.stringify(localStorage)")
    check("Idea secreta del admin" not in ls and "Pasaporte escaneado" not in ls and "ba_cloud_session_v1" not in ls, "datos privados y sesión borrados del navegador")
    page.reload(); page.wait_for_timeout(700)
    check("Vista pública" in page.text_content("#cloudBar"), "tras recargar sigue como visitante")

    print("Sesión persistente")
    p2.reload(); p2.wait_for_timeout(900)
    check(not p2.evaluate("document.body.classList.contains('viewer-mode')") and "admin@x.cl" in p2.text_content("#cloudBar"), "el admin sigue con sesión al recargar")

    print("Móvil")
    m = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    m.clock.install(time=NOW); mp = m.new_page(); route_all(mp)
    mp.goto(BASE + "#/viaje/itinerario"); mp.wait_for_selector(READY); mp.wait_for_timeout(600)
    check(mp.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "visitante sin scroll horizontal a 390 px")
    navs = mp.evaluate("[...document.querySelectorAll('#bottomNav a')].filter(a => a.offsetParent !== null).map(a => a.dataset.route)")
    check("hoy" not in navs and "viajes" in navs and "ofertas" in navs, f"barra inferior del visitante ({navs})")
    mp.screenshot(path=f"{SHOTS}/cloud-visitante-movil.png")

    print("SEO en modo base central")
    html = open(os.path.join(OUT, "index.html"), encoding="utf-8").read()
    check('rel="canonical" href="https://example.github.io/ruta-ba/"' in html and 'src="assets/js/main.js' in html, "canonical con subruta y rutas relativas (sirven en raíz o subcarpeta)")
    check("sb_publishable_test123" in open(os.path.join(OUT, "assets/js/config.js")).read(), "configuración inyectada en el build")

    allerr = [e for e in errors + err2 if "Failed to fetch" not in e]
    check(not allerr, f"sin errores de JavaScript ({allerr[:2]})")
    browser.close()

print()
print("TODO OK" if not failures else f"{len(failures)} FALLAS")
raise SystemExit(1 if failures else 0)
