import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promptLectura, mensajesLectura, validarLectura, lecturaFalsa, MAX_DESCRIPCION } from '../src/lectura.js';
import { CANALES } from '../src/canales.js';

test('el prompt lleva el número, el nombre y la lente del canal', () => {
  const p = promptLectura(CANALES[3]);
  assert.match(p, /canal 4 \(«A ras»\)|canal 4 «A ras»|canal 4/);
  assert.ok(p.includes('«A ras»'));
  assert.ok(p.includes(CANALES[3].lente));
  assert.ok(!p.includes('{canal}') && !p.includes('{nombre}') && !p.includes('{lente}'));
});

test('una lente con «$&» no se interpreta como patrón de reemplazo', () => {
  const p = promptLectura({ n: 8, nombre: 'Sombras', lente: 'Lo que $& pasa' });
  assert.ok(p.includes('Lo que $& pasa'));
});

test('los mensajes llevan el prompt de sistema y la imagen', () => {
  const m = mensajesLectura(CANALES[0], 'data:image/jpeg;base64,AAAA');
  assert.equal(m[0].role, 'system');
  assert.equal(m[1].content[1].image_url.url, 'data:image/jpeg;base64,AAAA');
});

test('una lectura limpia pasa y recorta la descripción', () => {
  const r = validarLectura({ descripcion: `  ${'a'.repeat(300)}  `, rostros_reconocibles: false, inadecuada: false, motivo: '' });
  assert.equal(r.ok, true);
  assert.equal(r.descripcion.length, MAX_DESCRIPCION);
});

test('rostros e inadecuadas se rechazan con su tipo', () => {
  assert.deepEqual(
    (({ ok, tipo }) => ({ ok, tipo }))(validarLectura({ descripcion: '', rostros_reconocibles: true, inadecuada: false })),
    { ok: false, tipo: 'rostro' }
  );
  assert.equal(validarLectura({ descripcion: '', rostros_reconocibles: false, inadecuada: true }).tipo, 'inadecuada');
});

test('falla de forma segura si faltan campos del filtro', () => {
  for (const r of [null, 'texto', {}, { descripcion: 'x' }, { descripcion: 'x', rostros_reconocibles: 'no', inadecuada: false }, { descripcion: 'x', rostros_reconocibles: false }]) {
    const v = validarLectura(r);
    assert.equal(v.ok, false);
    assert.equal(v.tipo, 'invalida');
  }
});

test('la lectura falsa pasa el filtro', () => {
  const v = validarLectura(lecturaFalsa(CANALES[1]));
  assert.equal(v.ok, true);
  assert.equal(v.descripcion, 'Una toma del canal Ritmo.');
});
