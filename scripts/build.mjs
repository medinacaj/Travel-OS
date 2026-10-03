// Build estático: copia a /dist, inyecta dominio canónico (con subruta si se publica en
// GitHub Pages como sitio de proyecto), robots según entorno y versión de assets. Sin dependencias.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, extname, resolve } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = process.env.OUT_DIR ? resolve(process.env.OUT_DIR) : join(ROOT, "dist");
const FALLBACK_URL = "https://ruta-ba.vercel.app";

function resolveSiteUrl() {
  const explicit = process.env.SITE_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const raw = explicit || (vercel ? `https://${vercel}` : "");
  if (!raw) {
    console.warn(`[build] SITE_URL no definido: se usa ${FALLBACK_URL}. Define SITE_URL con el dominio definitivo.`);
    return FALLBACK_URL;
  }
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("SITE_URL debe usar https://");
  // Admite subruta (https://usuario.github.io/ruta-ba). Sin barra final.
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

// VERCEL_ENV en Vercel; DEPLOY_ENV en GitHub Actions u otro CI. Por defecto, producción.
const env = process.env.VERCEL_ENV || process.env.DEPLOY_ENV || "production";
const indexable = env === "production";
const siteUrl = resolveSiteUrl();
const basePath = new URL(siteUrl).pathname.replace(/\/+$/, ""); // "" en dominio raíz, "/ruta-ba" en Pages de proyecto

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, "assets"), join(DIST, "assets"), { recursive: true });
["index.html", "404.html", "robots.txt", "sitemap.xml"].forEach((f) => cpSync(join(ROOT, f), join(DIST, f)));

// Base central (opcional): Supabase. Sin estas variables la app funciona en modo local.
const supabaseUrl = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const supabaseKey = (process.env.SUPABASE_ANON_KEY || "").trim();
if (supabaseUrl && !/^https:\/\/[\w.-]+(:\d+)?$/.test(supabaseUrl)) throw new Error("SUPABASE_URL debe ser https://xxxx.supabase.co");
if (Boolean(supabaseUrl) !== Boolean(supabaseKey)) throw new Error("Define SUPABASE_URL y SUPABASE_ANON_KEY juntas (o ninguna).");
if (/service_role|sb_secret_/.test(supabaseKey)) throw new Error("SUPABASE_ANON_KEY no puede ser la clave service_role/secret: usa la anon/publishable.");
if (supabaseKey.startsWith("eyJ")) {
  try {
    const payload = JSON.parse(Buffer.from(supabaseKey.split(".")[1], "base64url").toString());
    if (payload.role && payload.role !== "anon") throw new Error("SUPABASE_ANON_KEY no es una clave anon.");
  } catch (err) { if (err.message.includes("anon")) throw err; }
}
const configPath = join(DIST, "assets", "js", "config.js");
writeFileSync(configPath, readFileSync(configPath, "utf8")
  .replace("__SUPABASE_URL__", supabaseUrl).replace("__SUPABASE_ANON_KEY__", supabaseKey.replace(/[^\w.-]/g, "")));

const hash = createHash("sha256");
walk(join(DIST, "assets")).sort().forEach((f) => hash.update(readFileSync(f)));
const version = hash.digest("hex").slice(0, 10);

// Versiona los imports de módulos para que todo el grafo se renueve junto.
walk(join(DIST, "assets", "js")).filter((f) => extname(f) === ".js").forEach((f) => {
  const src = readFileSync(f, "utf8").replace(/from "(\.\/[\w-]+\.js)"/g, `from "$1?v=${version}"`);
  writeFileSync(f, src);
});

const replacements = {
  __SITE_URL__: siteUrl,
  __BASE_PATH__: basePath,
  __ASSET_V__: version,
  __ROBOTS__: indexable ? "index, follow" : "noindex, nofollow",
  __LASTMOD__: new Date().toISOString().slice(0, 10)
};
["index.html", "404.html", "sitemap.xml", "robots.txt"].forEach((f) => {
  const p = join(DIST, f);
  let txt = readFileSync(p, "utf8");
  for (const [k, v] of Object.entries(replacements)) txt = txt.split(k).join(v);
  if (f === "robots.txt" && !indexable) txt = "User-agent: *\nDisallow: /\n";
  const left = txt.match(/__[A-Z_]+__/);
  if (left) throw new Error(`Marcador sin reemplazar en ${f}: ${left[0]}`);
  writeFileSync(p, txt);
});

// GitHub Pages: sin procesamiento Jekyll.
writeFileSync(join(DIST, ".nojekyll"), "");

console.log(`[build] entorno=${env} indexable=${indexable} sitio=${siteUrl} base=${basePath || "/"} base-central=${supabaseUrl || "no (modo local)"} assets=v${version}`);
