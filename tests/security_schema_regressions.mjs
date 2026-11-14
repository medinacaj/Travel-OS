import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertSecuritySchemaContract } from './security_schema.mjs';

const original = readFileSync('supabase/schema.sql', 'utf8');
test('current SQL retains public/private policy boundaries', () => {
  assert.doesNotThrow(() => assertSecuritySchemaContract(original));
});
for (const [label, from, to] of [
  ['private section accidentally public', 'else not is_public', 'else is_public'],
  ['security definer search_path writable', "set search_path = ''", 'set search_path = public'],
  ['anonymous reader sees everything', 'using (is_public or public.is_admin())', 'using (true)'],
  ['admin update loses WITH CHECK', 'using (public.is_admin()) with check (public.is_admin())',
    'using (public.is_admin())'],
  ['documents bucket made public', "values ('documents', 'documents', false", "values ('documents', 'documents', true"],
  ['private documents exposed to visitors', "for select to authenticated using (bucket_id = 'documents' and public.is_admin())",
    "for select to anon, authenticated using (bucket_id = 'documents')"],
]) {
  test('rejects regression: ' + label, () => {
    assert.ok(original.includes(from), 'Source fixture changed: ' + label);
    assert.throws(() => assertSecuritySchemaContract(original.replace(from, to)), /RLS contract/);
  });
}
