import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vistaDeRuta } from '../src/comun/dominio/rutas.js';

const visor = (pagina, canonica = null) => ({ vista: 'visor', pagina, raiz: '/visor', canonica });
const otra = (vista) => ({ vista, pagina: null, raiz: '/visor', canonica: null });

test('la raíz y las rutas del Transmisor abren el Transmisor', () => {
  assert.deepEqual(vistaDeRuta('/'), otra('transmisor'));
  assert.deepEqual(vistaDeRuta(''), otra('transmisor'));
  assert.deepEqual(vistaDeRuta('/cualquier/cosa'), otra('transmisor'));
});

test('/visor abre el televisor, con o sin barra final', () => {
  assert.deepEqual(vistaDeRuta('/visor'), visor('tele'));
  assert.deepEqual(vistaDeRuta('/visor/'), visor('tele'));
});

test('/visor/mosaico, /rastros y /maletin abren su página', () => {
  for (const p of ['mosaico', 'rastros', 'maletin']) {
    assert.deepEqual(vistaDeRuta(`/visor/${p}`), visor(p));
    assert.deepEqual(vistaDeRuta(`/visor/${p}/`), visor(p));
  }
});

test('otra subruta bajo /visor abre el televisor', () => {
  assert.deepEqual(vistaDeRuta('/visor/otra'), visor('tele'));
  assert.deepEqual(vistaDeRuta('/visor/mosaico/extra'), visor('tele'));
});

test('/consola y lo que cuelga de ella abren la Consola', () => {
  assert.deepEqual(vistaDeRuta('/consola'), otra('consola'));
  assert.deepEqual(vistaDeRuta('/consola/'), otra('consola'));
  assert.deepEqual(vistaDeRuta('/consola/mesas'), otra('consola'));
});

test('el alias /al-aire abre el Visor y propone la ruta bajo /visor', () => {
  assert.deepEqual(vistaDeRuta('/al-aire'), visor('tele', '/visor'));
  assert.deepEqual(vistaDeRuta('/al-aire/'), visor('tele', '/visor'));
  for (const p of ['mosaico', 'rastros', 'maletin']) {
    assert.deepEqual(vistaDeRuta(`/al-aire/${p}`), visor(p, `/visor/${p}`));
    assert.deepEqual(vistaDeRuta(`/al-aire/${p}/`), visor(p, `/visor/${p}`));
  }
  assert.deepEqual(vistaDeRuta('/al-aire/otra'), visor('tele', '/visor'));
});

test('los prefijos parecidos no se confunden', () => {
  for (const r of ['/visores', '/visor2', '/visores/mosaico', '/consolas', '/consola2', '/al-aires', '/al-aire-libre']) {
    assert.deepEqual(vistaDeRuta(r), otra('transmisor'), r);
  }
});

test('solo los alias traen ruta canónica', () => {
  for (const r of ['/', '/visor', '/visor/rastros', '/consola', '/visores']) {
    assert.equal(vistaDeRuta(r).canonica, null, r);
  }
});

test('una entrada vacía o rara cae en el Transmisor', () => {
  assert.deepEqual(vistaDeRuta(undefined), otra('transmisor'));
  assert.deepEqual(vistaDeRuta(null), otra('transmisor'));
});
