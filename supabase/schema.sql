-- Ruta BA — Travel OS: base de datos central en Supabase.
-- Ejecutar una vez en Supabase → SQL Editor → New query → Run. Se puede volver a ejecutar sin romper nada.
--
-- Modelo "público + administrador":
--   * Cualquiera (sin sesión) lee las claves públicas: itinerario, imágenes y ofertas.
--   * Solo los usuarios de la tabla admins leen las claves privadas y escriben cualquier cosa.

-- 1. Estado de la app: una fila por sección (mismas claves que el estado de la app).
create table if not exists public.app_state (
  key        text primary key,
  data       jsonb not null,
  is_public  boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- Lista blanca: solo existen estas claves. Las secciones de un viaje llevan el sufijo "@<id del viaje>"
-- (el primer viaje, sin sufijo). La visibilidad la decide la base, no el navegador:
--   * siempre públicas: ofertas, noticias, descartados y la lista de viajes públicos;
--   * itinerario, datos e imágenes de un viaje: públicas solo si el administrador marcó el viaje como público;
--   * todo lo demás (reservas, gastos, documentos, ideas, notas, ajustes, índice completo): siempre privado.
alter table public.app_state drop constraint if exists app_state_key_check;
alter table public.app_state add constraint app_state_key_check check (
  key ~ '^(meta|trips|imageUrls|budget|pending|reservations|documents|ideas|people|groupExpenses|notes|doneItems)(@[A-Za-z0-9_-]{1,40})?$'
  or key = any (array['deals','dealNews','dealDiscarded','publicTrips','dealSettings','tripIndex'])
);
alter table public.app_state drop constraint if exists app_state_public_check;
alter table public.app_state add constraint app_state_public_check check (
  case
    when key = any (array['deals','dealNews','dealDiscarded','publicTrips']) then is_public
    when split_part(key, '@', 1) = any (array['meta','trips','imageUrls']) then true
    else not is_public
  end
);

create or replace function public.touch_app_state() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists app_state_touch on public.app_state;
create trigger app_state_touch before insert or update on public.app_state
  for each row execute function public.touch_app_state();

-- 2. Administradores.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email   text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 3. Reglas de acceso (RLS).
alter table public.app_state enable row level security;
alter table public.admins    enable row level security;

drop policy if exists "leer publico o admin" on public.app_state;
create policy "leer publico o admin" on public.app_state
  for select to anon, authenticated using (is_public or public.is_admin());

drop policy if exists "admin inserta" on public.app_state;
create policy "admin inserta" on public.app_state
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admin actualiza" on public.app_state;
create policy "admin actualiza" on public.app_state
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin borra" on public.app_state;
create policy "admin borra" on public.app_state
  for delete to authenticated using (public.is_admin());

-- Cada usuario solo puede ver si él mismo es admin (la app lo consulta al iniciar sesión).
drop policy if exists "ver mi fila de admin" on public.admins;
create policy "ver mi fila de admin" on public.admins
  for select to authenticated using (user_id = auth.uid());

grant select on public.app_state to anon, authenticated;
grant insert, update, delete on public.app_state to authenticated;
grant select on public.admins to authenticated;

-- 4. Archivos: imágenes públicas (media) y documentos privados (documents).
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 26214400)
on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do update set public = false;

drop policy if exists "media: admin escribe" on storage.objects;
create policy "media: admin escribe" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "media: admin actualiza" on storage.objects;
create policy "media: admin actualiza" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin());
drop policy if exists "media: admin borra" on storage.objects;
create policy "media: admin borra" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());

drop policy if exists "documents: admin lee" on storage.objects;
create policy "documents: admin lee" on storage.objects
  for select to authenticated using (bucket_id = 'documents' and public.is_admin());
drop policy if exists "documents: admin escribe" on storage.objects;
create policy "documents: admin escribe" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents' and public.is_admin());
drop policy if exists "documents: admin actualiza" on storage.objects;
create policy "documents: admin actualiza" on storage.objects
  for update to authenticated using (bucket_id = 'documents' and public.is_admin());
drop policy if exists "documents: admin borra" on storage.objects;
create policy "documents: admin borra" on storage.objects
  for delete to authenticated using (bucket_id = 'documents' and public.is_admin());

-- 5. Dar permisos de administrador (después de crear tu usuario en Authentication → Users).
--    Cambia el correo y ejecuta solo esta línea:
-- insert into public.admins (user_id, email)
--   select id, email from auth.users where email = 'tu@correo.cl'
--   on conflict (user_id) do nothing;
