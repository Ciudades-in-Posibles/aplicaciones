import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANCHO_TERMICA, BYTES_POR_FILA, FILAS_POR_BANDA, difuminar, bytesPeriPage, cabeceraBanda, comandoConcentracion, enTrozos, partirLineas
} from '../src/comun/dominio/termica.js';

const lleno = (alto, valor) => new Uint8Array(ANCHO_TERMICA * alto).fill(valor);

test('difuminar: blanco da ceros y negro da 0xff', () => {
  assert.ok(difuminar(lleno(3, 255), ANCHO_TERMICA, 3).every((b) => b === 0));
  assert.ok(difuminar(lleno(3, 0), ANCHO_TERMICA, 3).every((b) => b === 0xff));
});

test('difuminar: el gris medio deja más o menos la mitad de los puntos', () => {
  const bits = difuminar(lleno(40, 128), ANCHO_TERMICA, 40);
  let unos = 0;
  for (const b of bits) for (let k = 0; k < 8; k++) unos += (b >> k) & 1;
  const fraccion = unos / (ANCHO_TERMICA * 40);
  assert.ok(fraccion > 0.4 && fraccion < 0.6, `fracción ${fraccion}`);
});

test('difuminar: el primer punto es el bit más significativo', () => {
  const g = lleno(1, 255);
  g[0] = 0;
  const bits = difuminar(g, ANCHO_TERMICA, 1);
  assert.equal(bits[0] & 0x80, 0x80);
});

test('difuminar: rechaza otro ancho o un tamaño que no cuadra', () => {
  assert.throws(() => difuminar(new Uint8Array(10), 10, 1));
  assert.throws(() => difuminar(new Uint8Array(5), ANCHO_TERMICA, 1));
});

test('cabeceraBanda y concentración', () => {
  assert.deepEqual(cabeceraBanda(24), [0x1d, 0x76, 0x30, 0x00, 48, 0, 24, 0]);
  assert.deepEqual(comandoConcentracion(2), [0x10, 0xff, 0x10, 0x00, 2]);
  assert.deepEqual(comandoConcentracion(9), [0x10, 0xff, 0x10, 0x00, 2]);
  assert.deepEqual(comandoConcentracion(-1), [0x10, 0xff, 0x10, 0x00, 0]);
});

test('bytesPeriPage: reinicio, concentración, bandas de 24 filas y avance', () => {
  const alto = 50; // 24 + 24 + 2
  const bits = new Uint8Array(BYTES_POR_FILA * alto).fill(0xaa);
  const b = bytesPeriPage(bits, alto, { concentracion: 1 });
  assert.deepEqual([...b.subarray(0, 4)], [0x10, 0xff, 0xfe, 0x01]);
  assert.deepEqual([...b.subarray(16, 21)], [0x10, 0xff, 0x10, 0x00, 1]);
  const bandas = Math.ceil(alto / FILAS_POR_BANDA);
  assert.equal(b.length, 16 + 5 + bandas * 8 + bits.length + 3);
  assert.deepEqual([...b.subarray(21, 29)], cabeceraBanda(24));
  const ultima = 21 + 2 * (8 + 24 * BYTES_POR_FILA);
  assert.deepEqual([...b.subarray(ultima, ultima + 8)], cabeceraBanda(2));
  assert.deepEqual([...b.subarray(-3)], [0x1b, 0x4a, 0x40]);
});

test('bytesPeriPage: sin avance y con bits de otro tamaño', () => {
  const b = bytesPeriPage(new Uint8Array(BYTES_POR_FILA), 1, { avance: false });
  assert.equal(b.length, 16 + 5 + 8 + BYTES_POR_FILA);
  assert.throws(() => bytesPeriPage(new Uint8Array(3), 1));
});

test('enTrozos: corta sin perder bytes', () => {
  const t = enTrozos(new Uint8Array(250), 100);
  assert.deepEqual(t.map((x) => x.length), [100, 100, 50]);
});

test('partirLineas: respeta el ancho, corta palabras largas y pone puntos suspensivos', () => {
  const medir = (s) => s.length;
  assert.deepEqual(partirLineas('uno dos tres cuatro', 8, medir), ['uno dos', 'tres', 'cuatro']);
  assert.deepEqual(partirLineas('abcdefghij', 4, medir), ['abcd', 'efgh', 'ij']);
  assert.deepEqual(partirLineas('uno dos tres cuatro cinco', 8, medir, 2), ['uno dos', 'tres…']);
  assert.deepEqual(partirLineas('', 8, medir), []);
});
