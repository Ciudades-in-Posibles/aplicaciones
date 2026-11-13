import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITA, CONVOCATORIA, limpiarDigitos, claveDesdeHash, comprobarClave, datosDeMaletin, maletinDeMesa } from '../src/comun/dominio/maletin.js';

test('la cita tiene diez líneas y su crédito', () => {
  assert.equal(CITA.lineas.length, 10);
  assert.equal(CITA.lineas[0], 'El tiempo presente y el tiempo pasado');
  assert.equal(CITA.obra, 'Burnt Norton');
});

test('la clave sale del enlace solo con seis dígitos', () => {
  assert.equal(claveDesdeHash('#123-456'), '123456');
  assert.equal(claveDesdeHash('#123456'), '123456');
  assert.equal(claveDesdeHash('123 456'), '123456');
  assert.equal(claveDesdeHash('#12-345'), '');
  assert.equal(claveDesdeHash('#1234567'), '');
  assert.equal(claveDesdeHash(''), '');
  assert.equal(claveDesdeHash(undefined), '');
});

test('sin clave, el maletín no se abre con nada', () => {
  assert.equal(comprobarClave('123456', ''), false);
  assert.equal(comprobarClave('', ''), false);
  assert.equal(comprobarClave('123456', '123456'), true);
  assert.equal(comprobarClave('123-456', '123456'), true);
  assert.equal(comprobarClave('123457', '123456'), false);
  assert.equal(comprobarClave('12345', '123456'), false);
});

test('los dígitos se limpian y se cortan en seis', () => {
  assert.equal(limpiarDigitos(' 1a2-3 4567'), '123456');
  assert.equal(limpiarDigitos(null), '');
  assert.deepEqual(datosDeMaletin('12-3', 4), { digitos: '123', n: 4 });
  assert.deepEqual(datosDeMaletin('', -1), { digitos: '', n: 0 });
});

test('el Visor lee el maletín de la mesa solo si trae contador', () => {
  assert.equal(maletinDeMesa({}), null);
  assert.equal(maletinDeMesa({ maletin: { digitos: '1' } }), null);
  assert.deepEqual(maletinDeMesa({ maletin: { digitos: '123456', n: 2 } }), { digitos: '123456', n: 2 });
});

test('la convocatoria remite a la página de la Asamblea', () => {
  assert.equal(CONVOCATORIA.url, `https://${CONVOCATORIA.direccion}/`);
});
