import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function assertSecuritySchemaContract(sql) {
  // Contract check only: not a substitute for RLS policy tests in a real Supabase DB.
  const s = sql.replace(/--[^\r\n]*/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  function requirePart(part, why) {
    assert.ok(s.includes(part.toLowerCase()), 'RLS contract: ' + why);
  }
  for (const table of ['app_state', 'admins']) {
    requirePart('alter table public.' + table + ' enable row level security;', 'RLS required on ' + table);
  }
  requirePart("else not is_public end );", 'private sections must never be marked public');
  requirePart("when key = any (array['deals','dealnews','dealdiscarded','publictrips']) then is_public",
    'public catalogue must have a controlled visibility contract');
  requirePart("when split_part(key, '@', 1) = any (array['meta','trips','imageurls']) then true",
    'only explicitly publishable trip sections may opt into public access');

  requirePart('for select to anon, authenticated using (is_public or public.is_admin());',
    'visitors must only read public rows');
  requirePart('for insert to authenticated with check (public.is_admin());',
    'writes require an admin');
  requirePart('for update to authenticated using (public.is_admin()) with check (public.is_admin());',
    'updates require admin both before and after');
  requirePart('for delete to authenticated using (public.is_admin());',
    'deletes require an admin');
  requirePart('for select to authenticated using (user_id = auth.uid());',
    'admin membership lookup must only expose own row');
  requirePart("security definer set search_path = '' as $$",
    'security-definer helper needs an empty search_path');
  requirePart('from public.admins where user_id = auth.uid()', 'admin helper must check its own account');
  requirePart('revoke all on function public.is_admin() from public;',
    'remove default function privileges');

  requirePart("values ('documents', 'documents', false, 52428800)",
    'documents bucket must remain private');
  requirePart('on conflict (id) do update set public = false;',
    'reapplying schema must not expose documents');
  requirePart("for select to authenticated using (bucket_id = 'documents' and public.is_admin());",
    'only admins can download documents');
  requirePart('grant select on public.app_state to anon, authenticated;',
    'public selector must be read-only');
  requirePart('grant insert, update, delete on public.app_state to authenticated;',
    'authenticated mutation grants require RLS policies');

  assert.doesNotMatch(s, /grant\s+(?:insert|update|delete)(?:\s*,\s*(?:insert|update|delete))*\s+on\s+public\.app_state\s+to\s+anon\s*;/,
    'RLS contract: do not explicitly grant anonymous writes');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assertSecuritySchemaContract(readFileSync('supabase/schema.sql', 'utf8'));
  console.log('RLS contract verified statically; live authorization still requires a Supabase test.');
}
