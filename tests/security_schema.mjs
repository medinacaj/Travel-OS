import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('supabase/schema.sql','utf8');
for(const t of ['app_state','admins'])assert(new RegExp('alter\\s+table\\s+public\\.'+t+'\\s+enable\\s+row\\s+level\\s+security','i').test(s), 'RLS ausente: '+t);
for(const t of ['admin inserta','admin actualiza','admin borra'])assert(s.includes('create policy "'+t+'"'));
assert(s.includes('with check (public.is_admin())'));
console.log('RLS y permisos documentados en schema.sql');
