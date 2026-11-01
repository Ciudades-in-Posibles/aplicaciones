import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANALES, canalesConAbiertos, girarDial } from '../src/comun/dominio/canales.js';
import { sacarDelAire, crearToma, encolar, ponerAlAire, rechazar, volverALocal, editarToma, codigoToma, ponerAlAireDePrueba, deshacerPrueba, senalDePrueba, asignarCanal, SIN_CANAL } from '../src/comun/dominio/toma.js';
import { agregar, mover, quitar, sincronizar } from '../src/comun/dominio/tira.js';
import { validarLectura, promptLectura } from '../src/comun/dominio/lectura.js';
import { normalizarCodigo, codigoValido, llaveNombre, nombreValido, mesaAbierta, resumenMesa } from '../src/comun/dominio/mesa.js';
import { nuevoElemento, listos, reprogramar, aplazar, clasificarError, ESPERA_TOPE_MS } from '../src/comun/dominio/cola.js';

test('nueve canales, del 1 al 9', () => {
  assert.equal(CANALES.length, 9);
  assert.deepEqual(CANALES.map((c) => c.n), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('el dial da la vuelta', () => {
  assert.equal(girarDial(9, 1), 1);
  assert.equal(girarDial(1, -1), 9);
  assert.equal(girarDial(4, 2), 6);
});

test('los canales abiertos toman nombre y lente del equipo; los fijos no cambian', () => {
  const c = canalesConAbiertos({ 8: { nombre: ' Sombra ', lente: 'Encuadra una sombra.' }, 1: { nombre: 'X' } });
  assert.equal(c[7].nombre, 'Sombra');
  assert.equal(c[7].lente, 'Encuadra una sombra.');
  assert.equal(c[0].nombre, 'Huella');
  assert.equal(c[8].nombre, 'Abierto');
});

test('una toma recorre local → en cola → al aire', () => {
  let t = crearToma({ id: 'a', numero: 3, canal: 3, creada: 1, nota: '  raíz ' });
  assert.equal(t.codigo, 'T-03');
  assert.equal(t.nota, 'raíz');
  assert.equal(t.estado, 'local');
  t = encolar(t);
  t = ponerAlAire(t, { descripcion: 'Una raíz.' });
  assert.equal(t.estado, 'al-aire');
  assert.throws(() => encolar(t));
  assert.throws(() => editarToma(t, { nota: 'x' }));
});

test('una toma rechazada vuelve a local y se puede editar', () => {
  let t = rechazar(encolar(crearToma({ id: 'b', numero: 1, canal: 1, creada: 1 })), 'rostro');
  assert.equal(t.estado, 'rechazada');
  t = volverALocal(t);
  assert.equal(t.motivo, '');
  assert.equal(editarToma(t, { canal: 5 }).canal, 5);
});

test('crearToma rechaza canales fuera del dial', () => {
  assert.throws(() => crearToma({ id: 'c', numero: 1, canal: 10, creada: 1 }));
  assert.equal(codigoToma(12), 'T-12');
});

test('la tira agrega, mueve, quita y se sincroniza', () => {
  let t = agregar(agregar(agregar([], 'a'), 'b'), 'c');
  assert.deepEqual(agregar(t, 'a'), ['a', 'b', 'c']);
  assert.deepEqual(mover(t, 'c', -1), ['a', 'c', 'b']);
  assert.deepEqual(mover(t, 'a', -1), ['a', 'b', 'c']);
  assert.deepEqual(quitar(t, 'b'), ['a', 'c']);
  assert.deepEqual(sincronizar(['c', 'x', 'a'], ['a', 'b', 'c']), ['c', 'a', 'b']);
});

// Respuestas grabadas del modelo (sin red).
const GRABADAS = {
  limpia: { descripcion: 'Una raíz levanta el adoquín junto al muro.', rostros_reconocibles: false, inadecuada: false, motivo: '' },
  rostro: { descripcion: '', rostros_reconocibles: true, inadecuada: false, motivo: 'Se ve una cara de frente.' },
  inadecuada: { descripcion: '', rostros_reconocibles: false, inadecuada: true, motivo: 'Placa legible.' },
  incompleta: { descripcion: 'Un muro.' }
};

test('la lectura deja pasar una toma limpia', () => {
  const r = validarLectura(GRABADAS.limpia);
  assert.equal(r.ok, true);
  assert.match(r.descripcion, /raíz/);
});

test('el filtro detiene rostros, contenido inadecuado y respuestas incompletas', () => {
  assert.equal(validarLectura(GRABADAS.rostro).tipo, 'rostro');
  assert.equal(validarLectura(GRABADAS.inadecuada).tipo, 'inadecuada');
  assert.equal(validarLectura(GRABADAS.incompleta).tipo, 'invalida');
  assert.equal(validarLectura(null).ok, false);
});

test('el prompt lleva canal, nombre y lente', () => {
  const p = promptLectura(CANALES[2]);
  assert.match(p, /canal 3/);
  assert.match(p, /Grieta/);
  assert.match(p, /nadie lo planeó/);
});

test('código de mesa y nombre de equipo', () => {
  assert.equal(normalizarCodigo(' parque-27 '), 'PARQUE27');
  assert.equal(codigoValido('ab'), false);
  assert.equal(codigoValido('PARQUE27'), true);
  assert.equal(llaveNombre('  Los Sirirí  '), 'los-siriri');
  assert.equal(nombreValido('!'), false);
});

test('la cola reintenta con espera creciente', () => {
  let e = nuevoElemento({ id: 'q', tipo: 'senal', ref: 'a', ahora: 0 });
  assert.equal(listos([e], 0).length, 1);
  e = reprogramar(e, 0);
  assert.equal(e.siguiente, 5000);
  e = reprogramar(e, 0);
  assert.equal(e.siguiente, 10000);
  assert.equal(listos([e], 9999).length, 0);
});

test('al aire de prueba: sin mesa, y vuelve a local al unirse', () => {
  const t = crearToma({ id: 'p', numero: 3, canal: 4, creada: 1 });
  const p = ponerAlAireDePrueba(t);
  assert.equal(p.estado, 'al-aire');
  assert.equal(p.prueba, true);
  const s = senalDePrueba(p, CANALES[3]);
  assert.equal(s.canal, 4);
  assert.equal(s.canalNombre, 'A ras');
  const l = deshacerPrueba(p);
  assert.equal(l.estado, 'local');
  assert.equal('prueba' in l, false);
  assert.equal(encolar(l).estado, 'en-cola');
});

test('la toma nace sin canal y no sale al aire sin uno', () => {
  const t = crearToma({ id: 's', numero: 1, creada: 1 });
  assert.equal(t.canal, null);
  assert.throws(() => encolar(t), { message: SIN_CANAL });
  assert.throws(() => ponerAlAireDePrueba(t), { message: SIN_CANAL });
  assert.equal(encolar(editarToma(t, { canal: 2 })).estado, 'en-cola');
});

test('asignar canal a varias: solo las editables', () => {
  const a = crearToma({ id: 'a', numero: 1, creada: 1 });
  const b = rechazar(encolar(editarToma(crearToma({ id: 'b', numero: 2, creada: 1 }), { canal: 1 })), 'rostro');
  const c = ponerAlAire(encolar(editarToma(crearToma({ id: 'c', numero: 3, creada: 1 }), { canal: 1 })), {});
  const r = asignarCanal([a, b, c], ['a', 'b', 'c'], 5);
  assert.deepEqual(r.map((t) => [t.id, t.canal]), [['a', 5], ['b', 5]]);
  assert.equal(volverALocal(r[1]).canal, 5);
});

test('mesa abierta o cerrada', () => {
  assert.equal(mesaAbierta({ nombre: 'x' }), true);
  assert.equal(mesaAbierta({ abierta: true }), true);
  assert.equal(mesaAbierta({ abierta: false }), false);
  assert.equal(mesaAbierta(null), false);
});

test('resumen de la mesa para la Consola', () => {
  const r = resumenMesa([{ canal: 1, uid: 'a' }, { canal: 1, uid: 'b' }, { canal: 3, uid: 'a' }]);
  assert.equal(r.total, 3);
  assert.deepEqual(r.porCanal, { 1: 2, 3: 1 });
  assert.deepEqual(r.porEquipo, { a: 2, b: 1 });
});

test('sacar del aire: la toma vuelve a la mesa de edición', () => {
  const t = ponerAlAire(encolar(crearToma({ id: 'a', numero: 1, canal: 3, creada: 1, nota: 'raíz' })), { descripcion: 'Una raíz.' });
  const s = sacarDelAire(t);
  assert.equal(s.estado, 'local');
  assert.equal(s.nota, 'raíz');
  assert.equal(s.pregunta, '');
  assert.equal(s.lectura, null);
  assert.equal(s.enviada, undefined);
  assert.equal(s.lecturaPrevia, undefined);
  const p = sacarDelAire(ponerAlAireDePrueba(crearToma({ id: 'b', numero: 2, canal: 1, creada: 1 })));
  assert.equal(p.estado, 'local');
  assert.equal(p.prueba, undefined);
  assert.equal(p.lecturaPrevia, undefined);
  assert.throws(() => sacarDelAire(crearToma({ id: 'c', numero: 3, canal: 1, creada: 1 })));
});

test('sacar del aire descarta una lectura previa de versiones anteriores', () => {
  const t = { ...ponerAlAire(encolar(crearToma({ id: 'v', numero: 1, canal: 2, creada: 1 })), { descripcion: 'x' }), lecturaPrevia: { canal: 2, descripcion: 'vieja' } };
  assert.equal(sacarDelAire(t).lecturaPrevia, undefined);
});

test('la cola aplaza sin contar un intento', () => {
  const e = aplazar(nuevoElemento({ id: 'a', tipo: 'senal', ref: 'a', ahora: 0 }), 1000, ESPERA_TOPE_MS);
  assert.equal(e.intentos, 0);
  assert.equal(e.siguiente, 1000 + 5 * 60 * 1000);
  assert.deepEqual(listos([e], 1000 + 60000), []);
});

test('los errores de la callable se clasifican por su código', () => {
  assert.equal(clasificarError({ code: 'functions/resource-exhausted' }), 'tope');
  assert.equal(clasificarError({ code: 'functions/failed-precondition' }), 'revisar-mesa');
  assert.equal(clasificarError({ code: 'permission-denied' }), 'revisar-mesa');
  assert.equal(clasificarError({ code: 'functions/invalid-argument' }), 'invalida');
  for (const c of ['functions/internal', 'functions/unavailable', 'functions/deadline-exceeded', undefined]) {
    assert.equal(clasificarError({ code: c }), 'reintentar');
  }
  assert.equal(clasificarError(null), 'reintentar');
});
