import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarEntrada, EntradaInvalida, MAX_IMAGEN, PREFIJO_IMAGEN } from '../src/entrada.js';

const imagen = PREFIJO_IMAGEN + 'QUJD';
const base = () => ({
  mesa: 'ABCD1',
  toma: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', canal: 3, codigo: 'T-07', nota: 'una nota', pregunta: '¿qué?', imagen, creada: 1700000000000 }
});
const rechaza = (datos) => assert.throws(() => validarEntrada(datos), EntradaInvalida);

test('una entrada válida devuelve el canal desde canales.js', () => {
  const e = validarEntrada(base());
  assert.equal(e.canal.nombre, 'Grieta');
  assert.match(e.canal.lente, /^Encuadra lo que crece/);
  assert.equal(e.toma.nota, 'una nota');
});

test('nombre y lente de canales fijos no los decide el cliente', () => {
  const d = base();
  d.toma.canalNombre = 'Falso';
  d.toma.abierto = { nombre: 'Falso', lente: 'Falsa' };
  const e = validarEntrada(d);
  assert.equal(e.canal.nombre, 'Grieta');
});

test('los canales abiertos aceptan nombre y lente del equipo, recortados', () => {
  const d = base();
  d.toma.canal = 8;
  d.toma.abierto = { nombre: 'x'.repeat(40), lente: 'y'.repeat(300) };
  const e = validarEntrada(d);
  assert.equal(e.canal.nombre.length, 24);
  assert.equal(e.canal.lente.length, 160);
  d.toma.abierto = undefined;
  assert.equal(validarEntrada(d).canal.nombre, 'Abierto');
});

test('canal fuera de 1–9 o no entero', () => {
  for (const c of [0, 10, 2.5, '3', null, undefined, NaN]) {
    const d = base(); d.toma.canal = c; rechaza(d);
  }
});

test('nota de más de 280 caracteres', () => {
  const d = base(); d.toma.nota = 'a'.repeat(281); rechaza(d);
  d.toma.nota = 'a'.repeat(280); assert.ok(validarEntrada(d));
  d.toma.nota = 5; rechaza(d);
});

test('imagen: prefijo, tamaño y base64', () => {
  const d = base();
  d.toma.imagen = 'data:image/png;base64,QUJD'; rechaza(d);
  d.toma.imagen = 'http://x/y.jpg'; rechaza(d);
  d.toma.imagen = PREFIJO_IMAGEN + 'A'.repeat(MAX_IMAGEN); rechaza(d);
  d.toma.imagen = PREFIJO_IMAGEN + 'A'.repeat(MAX_IMAGEN - PREFIJO_IMAGEN.length - 1); assert.ok(validarEntrada(d));
  d.toma.imagen = PREFIJO_IMAGEN + 'no es base64!'; rechaza(d);
  d.toma.imagen = PREFIJO_IMAGEN; rechaza(d);
  d.toma.imagen = undefined; rechaza(d);
});

test('id de toma: UUID o respaldo de marca de tiempo; nada con barras', () => {
  for (const id of ['a1b2c3d4-e5f6-7890-abcd-ef1234567890', '1730000000000-k3j2h1g0f9']) {
    const d = base(); d.toma.id = id; assert.ok(validarEntrada(d));
  }
  for (const id of ['', 'corto', 'a/b/c/d/e/f/g/h', 'con espacios aqui', 'x'.repeat(65), 12345678, null]) {
    const d = base(); d.toma.id = id; rechaza(d);
  }
});

test('mesa con el formato de las reglas', () => {
  for (const m of ['abcd', 'ABC', 'A'.repeat(17), 'AB CD', 'AB/CD', '', null]) {
    const d = base(); d.mesa = m; rechaza(d);
  }
});

test('pregunta, código y forma general', () => {
  const d = base(); d.toma.pregunta = 'a'.repeat(201); rechaza(d);
  const e = base(); e.toma.codigo = 'otro'; rechaza(e);
  rechaza(null); rechaza({}); rechaza({ mesa: 'ABCD' }); rechaza('x');
  const f = base(); delete f.toma.nota; delete f.toma.pregunta; delete f.toma.codigo; delete f.toma.creada;
  const v = validarEntrada(f, 42);
  assert.equal(v.toma.nota, ''); assert.equal(v.toma.creada, 42);
});
