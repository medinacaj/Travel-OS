// Configuración de la base central. El build reemplaza los marcadores con las variables
// SUPABASE_URL y SUPABASE_ANON_KEY. Vacíos = modo local (datos solo en este navegador).
// La clave anon/publishable es pública por diseño: la seguridad la ponen las reglas RLS de la base.
const raw = { url: "__SUPABASE_URL__", key: "__SUPABASE_ANON_KEY__" };
const clean = (v) => (v.startsWith("__") ? "" : v);
export const CONFIG = Object.freeze({
  supabaseUrl: clean(raw.url).replace(/\/+$/, ""),
  supabaseKey: clean(raw.key)
});
