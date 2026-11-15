import test from 'node:test';
import assert from 'node:assert/strict';
import { toNumber } from '../assets/js/util.js';
import { normalizeMeta, normalizePlace as normalizeTravelPlace } from '../assets/js/store.js';

test('los importes y coordenadas vacíos no se convierten en cero', () => {
  for (const input of ['', ' ', ' \n\t ', null, undefined, false, true, [], {}, '0x10']) {
    assert.equal(Number.isNaN(toNumber(input)), true, JSON.stringify(input));
  }
  assert.equal(toNumber(0), 0, 'cero numérico explícito es válido');
  assert.equal(toNumber('0'), 0, 'cero textual explícito es válido');
  assert.equal(toNumber('1,25'), 1.25, 'mantener decimales españoles');
  assert.equal(toNumber('-36.827'), -36.827);
  assert.equal(toNumber('-73,05'), -73.05);
  assert.equal(toNumber('1e3'), 1000, 'mantener notación científica previamente aceptada');
  const missing = normalizeTravelPlace({ name:'Dirección no verificada', lat:'   ', lng:' ', category:'Cultura' });
  assert.equal(missing.lat, null);
  assert.equal(missing.lng, null);
  const equator = normalizeTravelPlace({ name:'Coordenada exacta', lat:'0', lng:'0' });
  assert.equal(equator.lat, 0);
  assert.equal(equator.lng, 0);
});

test('fecha de inicio de viaje respeta el calendario y años bisiestos', () => {
  for(const startDate of ['2027-02-29','2027-02-30','2027-04-31','2027-13-01','2026-00-10','2026-01-00','texto']) {
    assert.equal(normalizeMeta({destination:'Mi viaje',startDate}).startDate, '', startDate);
  }
  assert.equal(normalizeMeta({destination:'Mi viaje',startDate:'2028-02-29'}).startDate,'2028-02-29');
  assert.equal(normalizeMeta({destination:'Mi viaje',startDate:'2027-12-31'}).startDate,'2027-12-31');
});
