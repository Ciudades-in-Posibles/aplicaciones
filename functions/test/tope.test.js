import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contarLectura, ventanaDe, VENTANA_MS, MAX_LECTURAS_POR_HORA } from '../src/tope.js';

const T0 = 10 * VENTANA_MS + 5000;

test('la primera lectura abre la ventana', () => {
  const r = contarLectura(undefined, T0);
  assert.deepEqual(r, { permitido: true, lecturas: { ventana: 10, n: 1 } });
});

test('cuenta dentro de la misma ventana', () => {
  const r = contarLectura({ ventana: 10, n: 7 }, T0 + 1000);
  assert.deepEqual(r.lecturas, { ventana: 10, n: 8 });
  assert.equal(r.permitido, true);
});

test('la lectura 61 de la hora se niega y no cuenta', () => {
  const r = contarLectura({ ventana: 10, n: MAX_LECTURAS_POR_HORA }, T0);
  assert.equal(r.permitido, false);
  assert.equal(r.lecturas.n, MAX_LECTURAS_POR_HORA);
  assert.equal(contarLectura({ ventana: 10, n: MAX_LECTURAS_POR_HORA - 1 }, T0).permitido, true);
});

test('una ventana nueva reinicia la cuenta', () => {
  const r = contarLectura({ ventana: 10, n: 60 }, 11 * VENTANA_MS);
  assert.deepEqual(r, { permitido: true, lecturas: { ventana: 11, n: 1 } });
});

test('datos guardados raros se tratan como cuenta cero', () => {
  assert.equal(contarLectura({ ventana: 10, n: 'x' }, T0).lecturas.n, 1);
  assert.equal(contarLectura({ ventana: 10, n: -4 }, T0).lecturas.n, 1);
  assert.equal(ventanaDe(0), 0);
});

test('un tope propio', () => {
  assert.equal(contarLectura({ ventana: 10, n: 2 }, T0, 2).permitido, false);
});
