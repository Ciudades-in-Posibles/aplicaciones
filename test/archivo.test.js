import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOM, COLUMNAS, nombreSeguro, filaCsv, csvDe, aIso, carpetaDeCanal, rutasDeTomas, respuestasEnTexto, filasDelCsv,
  dataUrlABytes, nombreDelZip, fechaLarga, textoLeeme, fechaCorta, textoDeCarta, enHojas
} from '../src/comun/dominio/archivo.js';
import { planDeBorrado, enLotes, textoDeAvance, ETAPAS, MAX_LOTE } from '../src/comun/dominio/borrado.js';

const senal = (extra = {}) => ({ id: 's1', codigo: 'T-04', equipo: 'Parque Nacional', canal: 3, canalNombre: 'Grieta', lente: 'Encuadra una grieta.', nota: 'Musgo', descripcion: 'Una juntura.', pregunta: '', hora: '2026-11-04T15:30:00.000Z', ...extra });

test('nombreSeguro: sin tildes, en minúscula y con guiones', () => {
  assert.equal(nombreSeguro('Parque Nacional · 13 nov'), 'parque-nacional-13-nov');
  assert.equal(nombreSeguro('Ñandú y Árbol'), 'nandu-y-arbol');
  assert.equal(nombreSeguro('   '), 'sin-nombre');
  assert.equal(nombreSeguro('', 'canal'), 'canal');
  assert.ok(nombreSeguro('a'.repeat(100)).length <= 60);
});

test('filaCsv: comillas, comas y saltos de línea quedan dentro del valor', () => {
  assert.equal(filaCsv(['a', 'b']), '"a","b"');
  assert.equal(filaCsv(['dijo "hola"']), '"dijo ""hola"""');
  assert.equal(filaCsv(['uno, dos']), '"uno, dos"');
  assert.equal(filaCsv(['línea 1\nlínea 2']), '"línea 1\nlínea 2"');
  assert.equal(filaCsv([null, undefined, 0]), '"","","0"');
});

test('csvDe: BOM al principio, coma como separador y \\r\\n entre filas', () => {
  const csv = csvDe([['a', 'b'], ['1', 'x,y']]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.equal(csv[0], BOM);
  assert.equal(csv.slice(1), '"a","b"\r\n"1","x,y"');
});

test('aIso acepta Timestamp de Firestore, segundos, milisegundos y vacío', () => {
  const iso = '2026-11-04T15:30:00.000Z';
  assert.equal(aIso({ toDate: () => new Date(iso) }), iso);
  assert.equal(aIso({ seconds: Date.parse(iso) / 1000 }), iso);
  assert.equal(aIso(Date.parse(iso)), iso);
  assert.equal(aIso(null), '');
  assert.equal(aIso('no es fecha'), '');
});

test('rutas: tomas/<canal>-<nombre>/<codigo>-<equipo>.jpg', () => {
  assert.equal(carpetaDeCanal(senal()), '3-grieta');
  assert.deepEqual(rutasDeTomas([senal()]), ['tomas/3-grieta/t-04-parque-nacional.jpg']);
  assert.deepEqual(rutasDeTomas([senal({ canal: 8, canalNombre: 'Mi canal ñu' })]), ['tomas/8-mi-canal-nu/t-04-parque-nacional.jpg']);
});

test('rutas: sin canal válido van a tomas/sin-canal/', () => {
  for (const canal of [null, undefined, 0, 10, 'x', 2.5]) {
    assert.deepEqual(rutasDeTomas([senal({ canal })]), ['tomas/sin-canal/t-04-parque-nacional.jpg']);
  }
});

test('rutas: si dos señales coinciden, la segunda suma -2', () => {
  const r = rutasDeTomas([senal(), senal({ id: 's2' }), senal({ id: 's3' }), senal({ id: 's4', codigo: 'T-05' })]);
  assert.deepEqual(r, [
    'tomas/3-grieta/t-04-parque-nacional.jpg', 'tomas/3-grieta/t-04-parque-nacional-2.jpg',
    'tomas/3-grieta/t-04-parque-nacional-3.jpg', 'tomas/3-grieta/t-05-parque-nacional.jpg'
  ]);
});

test('respuestas heredadas: «equipo: texto | equipo: texto», de la más vieja a la más nueva', () => {
  const r = respuestasEnTexto([
    { equipo: 'B', texto: 'segunda', hora: '2026-11-04T16:00:00Z' },
    { equipo: 'A', texto: 'primera', hora: '2026-11-04T15:00:00Z' }
  ]);
  assert.equal(r, 'A: primera | B: segunda');
  assert.equal(respuestasEnTexto([]), '');
  assert.equal(respuestasEnTexto(undefined), '');
});

test('filas del CSV: encabezado, columnas en orden y ruta del jpg', () => {
  const s = senal();
  const filas = filasDelCsv('PRUEBA1', [s], rutasDeTomas([s]), { s1: [{ equipo: 'A', texto: 'sí', hora: '2026-11-04T16:00:00Z' }] });
  assert.deepEqual(filas[0], COLUMNAS);
  assert.deepEqual(COLUMNAS, ['mesa', 'codigo', 'equipo', 'canal', 'canalNombre', 'lente', 'nota', 'descripcion', 'pregunta', 'respuestas', 'hora', 'archivo']);
  assert.deepEqual(filas[1], ['PRUEBA1', 'T-04', 'Parque Nacional', 3, 'Grieta', 'Encuadra una grieta.', 'Musgo', 'Una juntura.', '', 'A: sí', '2026-11-04T15:30:00.000Z', 'tomas/3-grieta/t-04-parque-nacional.jpg']);
  const csv = csvDe(filas);
  assert.equal(csv.split('\r\n').length, 2);
});

test('data URL a bytes', () => {
  const bytes = dataUrlABytes('data:image/jpeg;base64,/9j/4AAQ');
  assert.deepEqual([...bytes], [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
});

test('el nombre del zip y el LEEME', () => {
  assert.equal(nombreDelZip('PRUEBA1'), 'archivo-ucronico-PRUEBA1.zip');
  assert.equal(fechaLarga(new Date(2026, 9, 31)), '31 de octubre de 2026');
  const t = textoLeeme({ mesa: 'PRUEBA1', nombre: 'Parque Nacional · 13 nov', ahora: new Date(2026, 10, 14), total: 12 });
  for (const frase of ['Parque Nacional · 13 nov', 'PRUEBA1', '14 de noviembre de 2026', 'Biblioteca Pública El Parque', '11 de febrero de 2027', 'Art. 15', 'reconocible', 'sin-canal', 'archivo.csv']) {
    assert.ok(t.includes(frase), frase);
  }
  for (const col of COLUMNAS) assert.ok(t.includes(`- ${col} `) || t.includes(col), col);
});

test('carta impresa: fecha, texto y hojas de seis', () => {
  assert.equal(fechaCorta(new Date(2026, 10, 4, 12).toISOString()), '4 nov 2026');
  assert.equal(fechaCorta(null), '');
  assert.equal(textoDeCarta(senal()), 'Musgo');
  assert.equal(textoDeCarta(senal({ nota: '  ' })), 'Una juntura.');
  const hojas = enHojas(Array.from({ length: 13 }, (_, i) => i));
  assert.deepEqual(hojas.map((h) => h.length), [6, 6, 1]);
  assert.deepEqual(enHojas([]), []);
});

test('borrar mesa: el plan va en orden y con la ruta de cada documento', () => {
  const plan = planDeBorrado('PRUEBA1', {
    senales: [{ id: 's1', respuestas: ['r1', 'r2'] }, { id: 's2', respuestas: [] }],
    equipos: ['u1'], nombres: ['parque'], pantallas: ['p1']
  });
  assert.deepEqual(plan.map((e) => e.id), ['respuestas', 'senales', 'equipos', 'nombres', 'pantallas', 'mesa']);
  assert.deepEqual(plan.map((e) => e.id), ETAPAS.map((e) => e.id));
  assert.deepEqual(plan[0].rutas, [['mesas', 'PRUEBA1', 'senales', 's1', 'respuestas', 'r1'], ['mesas', 'PRUEBA1', 'senales', 's1', 'respuestas', 'r2']]);
  assert.deepEqual(plan[1].rutas, [['mesas', 'PRUEBA1', 'senales', 's1'], ['mesas', 'PRUEBA1', 'senales', 's2']]);
  assert.deepEqual(plan[2].rutas, [['mesas', 'PRUEBA1', 'equipos', 'u1']]);
  assert.deepEqual(plan[3].rutas, [['mesas', 'PRUEBA1', 'nombres', 'parque']]);
  assert.deepEqual(plan[4].rutas, [['mesas', 'PRUEBA1', 'pantallas', 'p1']]);
  assert.deepEqual(plan[5].rutas, [['mesas', 'PRUEBA1']]);
});

test('borrar mesa: una mesa vacía solo borra la mesa', () => {
  const plan = planDeBorrado('X', {});
  assert.deepEqual(plan.map((e) => e.rutas.length), [0, 0, 0, 0, 0, 1]);
});

test('borrar mesa: lotes de a lo sumo 450', () => {
  assert.equal(MAX_LOTE, 450);
  const lotes = enLotes(Array.from({ length: 1000 }, (_, i) => i));
  assert.deepEqual(lotes.map((l) => l.length), [450, 450, 100]);
  assert.deepEqual(enLotes([]), []);
  assert.equal(enLotes([1, 2, 3], 2).length, 2);
});

test('borrar mesa: el aviso de avance', () => {
  assert.equal(textoDeAvance(ETAPAS[1], 120, 340), 'Borrando señales · 120 de 340');
});
