import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matrizQR, moduloQR, ZONA_SILENCIO } from '../src/comun/dominio/qr.js';
import { urlDeMesa, codigoDeEnlace, TRANSMISOR } from '../src/comun/dominio/mesa.js';
import { ANCHO_TERMICA } from '../src/comun/dominio/termica.js';

test('urlDeMesa: el Transmisor con el código normalizado', () => {
  assert.equal(urlDeMesa(' parque-13 '), `${TRANSMISOR}/?mesa=PARQUE13`);
});

test('codigoDeEnlace: lee ?mesa= y descarta lo que no es un código', () => {
  assert.equal(codigoDeEnlace('?mesa=parque13'), 'PARQUE13');
  assert.equal(codigoDeEnlace('?celda=abc&mesa=ab-cd'), 'ABCD');
  assert.equal(codigoDeEnlace('?mesa=abc'), '');
  assert.equal(codigoDeEnlace('?mesa=' + 'x'.repeat(17)), '');
  assert.equal(codigoDeEnlace(''), '');
  assert.equal(codigoDeEnlace(undefined), '');
});

// las tres marcas de posición: anillo oscuro de 7×7, anillo claro y centro de 3×3
function marca(m, x0, y0) {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const borde = x === 0 || y === 0 || x === 6 || y === 6;
      const centro = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      if (m.oscuro(x0 + x, y0 + y) !== (borde || centro)) return false;
    }
  }
  return true;
}

test('matrizQR: tiene sus tres marcas y cabe en la térmica con módulos enteros', () => {
  const url = urlDeMesa('ABCDEFGHIJKLMNOP'); // el código más largo
  const m = matrizQR(url);
  assert.ok(marca(m, 0, 0) && marca(m, m.tam - 7, 0) && marca(m, 0, m.tam - 7));
  const mod = moduloQR(m.tam, ANCHO_TERMICA);
  assert.ok(mod >= 6, `módulo de ${mod} puntos`);
  assert.ok((m.tam + 2 * ZONA_SILENCIO) * mod <= ANCHO_TERMICA);
});

test('matrizQR: el mismo texto da la misma matriz', () => {
  const a = matrizQR(urlDeMesa('PRUEBA'));
  const b = matrizQR(urlDeMesa('PRUEBA'));
  assert.equal(a.tam, b.tam);
  for (let y = 0; y < a.tam; y++) for (let x = 0; x < a.tam; x++) assert.equal(a.oscuro(x, y), b.oscuro(x, y));
});
