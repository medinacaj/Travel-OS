// Vista previa en un solo archivo: ruta-ba-vista-previa.html (CSS y JS incrustados).
// Se abre con doble clic (file://) o en el celular sin servidor. Usa esbuild solo en desarrollo:
//   npx --yes esbuild@0.28 --version   (lo descarga npx la primera vez)
// La vista previa no es la versión publicada: no lleva canonical ni se indexa, y funciona en modo local
// salvo que se definan SUPABASE_URL y SUPABASE_ANON_KEY.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = new URL("..", import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), "rba-"));
// 1. Build normal (inyecta configuración y verifica marcadores) en una carpeta temporal.
execFileSync("node", [join(ROOT, "scripts/build.mjs")], { env: { ...process.env, OUT_DIR: tmp, DEPLOY_ENV: "preview" }, stdio: "ignore" });
// 2. Empaqueta los módulos en un solo script clásico.
const js = execFileSync("npx", ["--yes", "esbuild@0.28.2", join(tmp, "assets/js/main.js"), "--bundle", "--format=iife", "--minify", "--target=es2020", "--legal-comments=none"], { maxBuffer: 1 << 26 }).toString();
const css = readFileSync(join(tmp, "assets/css/app.css"), "utf8");
const icon = `data:image/svg+xml;base64,${readFileSync(join(ROOT, "assets/img/favicon.svg")).toString("base64")}`;
let html = readFileSync(join(tmp, "index.html"), "utf8");
const safeJs = js.replace(/<\/script/gi, "<\\/script");
html = html
  .replace(/<link rel="canonical"[^>]*>\s*/, "")
  .replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, nofollow">')
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon}" type="image/svg+xml">`)
  .replace(/<link rel="apple-touch-icon"[^>]*>\s*/, "")
  .replace(/<link rel="stylesheet" href="assets\/css\/app\.css[^"]*">/, () => `<style>${css}</style>`)
  // Un script clásico incrustado corre al leerse: se mueve al final del body (los módulos eran diferidos).
  .replace(/<script type="module" src="assets\/js\/main\.js[^"]*"><\/script>/, "")
  .replace("</body>", () => `<script>${safeJs}</script>\n</body>`)
  .replace("<title>", "<title>[Vista previa] ");
if (/assets\/(css|js)\//.test(html)) throw new Error("Quedó una referencia a assets/ sin incrustar");
const out = join(ROOT, "ruta-ba-vista-previa.html");
writeFileSync(out, html);
// Muestras que abren siempre con un tema (para comparar sin pasar por Ajustes).
for (const theme of ["factory", "seline", "steep", "ui", "ui-noche"]) {
  const force = `<script>(function(){var t=${JSON.stringify(theme)};try{localStorage.setItem("ba_trip_theme",JSON.stringify(t));}catch(e){}document.documentElement.setAttribute("data-theme",t);})();</script>`;
  writeFileSync(join(ROOT, `ruta-ba-muestra-${theme}.html`), html.replace("</head>", () => `${force}\n</head>`).replace("[Vista previa] ", `[Muestra ${theme}] `));
}
rmSync(tmp, { recursive: true, force: true });
console.log(`[vista previa] ${out} (${Math.round(html.length / 1024)} KB)`);
