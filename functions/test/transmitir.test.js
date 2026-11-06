import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transmitir } from '../src/transmitir.js';
import { PREFIJO_IMAGEN } from '../src/entrada.js';
import { VENTANA_MS } from '../src/tope.js';

/** Firestore mínimo en memoria: doc().get/create, runTransaction con get/update. */
function bdFalsa(inicial = {}) {
  const datos = new Map(Object.entries(inicial));
  const ref = (ruta) => ({
    ruta,
    async get() { return { exists: datos.has(ruta), data: () => datos.get(ruta) }; },
    async create(d) {
      if (datos.has(ruta)) throw Object.assign(new Error('ALREADY_EXISTS'), { code: 6 });
      datos.set(ruta, d);
    }
  });
  return {
    datos,
    doc: ref,
    async runTransaction(fn) {
      return fn({
        get: (r) => r.get(),
        update: (r, c) => datos.set(r.ruta, { ...datos.get(r.ruta), ...c })
      });
    }
  };
}

const AHORA = 20 * VENTANA_MS + 1000;
const entrada = () => ({
  mesa: 'ABCD1',
  toma: { id: 'toma-0001-abcd', canal: 2, codigo: 'T-01', nota: 'hola', pregunta: '', imagen: PREFIJO_IMAGEN + 'QUJD', creada: 5 }
});
const escenario = (extra = {}) => bdFalsa({
  'mesas/ABCD1': { nombre: 'Prueba', abierta: true },
  'mesas/ABCD1/equipos/u1': { nombre: 'Las Hormigas' },
  ...extra
});
const limpia = async () => ({ descripcion: 'Una grieta en el muro.', rostros_reconocibles: false, inadecuada: false, motivo: '' });
const codigo = (p) => p.then(() => assert.fail('debía fallar'), (e) => e.code);

test('camino feliz: escribe la señal con los campos de las reglas', async () => {
  const db = escenario();
  const r = await transmitir({ db, uid: 'u1', datos: entrada(), llamarLLM: limpia, ahora: AHORA });
  assert.deepEqual(r, { estado: 'al-aire', descripcion: 'Una grieta en el muro.' });
  const s = db.datos.get('mesas/ABCD1/senales/toma-0001-abcd');
  assert.deepEqual(Object.keys(s).sort(), ['uid', 'equipo', 'canal', 'canalNombre', 'lente', 'codigo', 'nota', 'pregunta', 'descripcion', 'imagen', 'creada', 'hora'].sort());
  assert.equal(s.equipo, 'Las Hormigas');
  assert.equal(s.canalNombre, 'Ritmo');
  assert.equal(s.descripcion, 'Una grieta en el muro.');
  assert.equal(db.datos.get('mesas/ABCD1/equipos/u1').lecturas.n, 1);
});

test('idempotencia: si la señal ya existe no vuelve a leer', async () => {
  const db = escenario({ 'mesas/ABCD1/senales/toma-0001-abcd': { uid: 'u1' } });
  let llamadas = 0;
  const r = await transmitir({ db, uid: 'u1', datos: entrada(), llamarLLM: async () => { llamadas++; return {}; }, ahora: AHORA });
  assert.equal(r.estado, 'al-aire');
  assert.equal(llamadas, 0);
  assert.equal(db.datos.get('mesas/ABCD1/equipos/u1').lecturas, undefined);
});

test('rostro: responde rechazada y no escribe', async () => {
  const db = escenario();
  const r = await transmitir({
    db, uid: 'u1', datos: entrada(), ahora: AHORA,
    llamarLLM: async () => ({ descripcion: '', rostros_reconocibles: true, inadecuada: false, motivo: 'x' })
  });
  assert.equal(r.estado, 'rechazada');
  assert.match(r.motivo, /alguien/);
  assert.equal(db.datos.has('mesas/ABCD1/senales/toma-0001-abcd'), false);
});

test('respuesta inválida del modelo: internal', async () => {
  assert.equal(await codigo(transmitir({ db: escenario(), uid: 'u1', datos: entrada(), llamarLLM: async () => ({}), ahora: AHORA })), 'internal');
  assert.equal(await codigo(transmitir({ db: escenario(), uid: 'u1', datos: entrada(), llamarLLM: async () => { throw new Error('boom'); }, ahora: AHORA })), 'internal');
});

test('mesa inexistente o cerrada: failed-precondition; no es del equipo: permission-denied', async () => {
  const sinMesa = bdFalsa();
  assert.equal(await codigo(transmitir({ db: sinMesa, uid: 'u1', datos: entrada(), llamarLLM: limpia })), 'failed-precondition');
  const cerrada = escenario({ 'mesas/ABCD1': { abierta: false } });
  assert.equal(await codigo(transmitir({ db: cerrada, uid: 'u1', datos: entrada(), llamarLLM: limpia })), 'failed-precondition');
  assert.equal(await codigo(transmitir({ db: escenario(), uid: 'otro', datos: entrada(), llamarLLM: limpia })), 'permission-denied');
});

test('entrada inválida: invalid-argument', async () => {
  const d = entrada(); d.toma.canal = 12;
  assert.equal(await codigo(transmitir({ db: escenario(), uid: 'u1', datos: d, llamarLLM: limpia })), 'invalid-argument');
});

test('tope: la lectura 61 de la hora da resource-exhausted', async () => {
  const db = escenario({ 'mesas/ABCD1/equipos/u1': { nombre: 'Las Hormigas', lecturas: { ventana: 20, n: 60 } } });
  assert.equal(await codigo(transmitir({ db, uid: 'u1', datos: entrada(), llamarLLM: limpia, ahora: AHORA })), 'resource-exhausted');
  // en la hora siguiente vuelve a andar
  const r = await transmitir({ db, uid: 'u1', datos: entrada(), llamarLLM: limpia, ahora: AHORA + VENTANA_MS });
  assert.equal(r.estado, 'al-aire');
});

test('LECTURA_FALSA: no llama al modelo', async () => {
  const db = escenario();
  const r = await transmitir({ db, uid: 'u1', datos: entrada(), lecturaFalsa: true, llamarLLM: async () => assert.fail('no debía llamarse'), ahora: AHORA });
  assert.equal(r.estado, 'al-aire');
  assert.equal(db.datos.get('mesas/ABCD1/senales/toma-0001-abcd').descripcion, 'Una toma del canal Ritmo.');
});

test('carrera: si la señal aparece mientras se lee, sigue siendo al-aire', async () => {
  const db = escenario();
  const r = await transmitir({
    db, uid: 'u1', datos: entrada(), ahora: AHORA,
    llamarLLM: async () => { db.datos.set('mesas/ABCD1/senales/toma-0001-abcd', { uid: 'u1' }); return limpia(); }
  });
  assert.deepEqual(r, { estado: 'al-aire', descripcion: 'Una grieta en el muro.' });
});

test('rastro: la señal guarda la celda del rastro y el vecino', async () => {
  const { CELDA_BIBLIOTECA } = await import('../src/zona.js');
  const db = escenario();
  const d = entrada();
  d.toma.celda = CELDA_BIBLIOTECA;
  d.toma.vecino = 'vecino-mirla';
  await transmitir({ db, uid: 'u1', datos: d, llamarLLM: limpia, ahora: AHORA });
  const s = db.datos.get('mesas/ABCD1/senales/toma-0001-abcd');
  assert.equal(s.celda, CELDA_BIBLIOTECA);
  assert.equal(s.vecino, 'vecino-mirla');
});
