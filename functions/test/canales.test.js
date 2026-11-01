import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const aqui = (ruta) => fileURLToPath(new URL(ruta, import.meta.url));

test('canales.js del servidor es copia exacta del cliente', () => {
  const candidatos = ['../../src/comun/dominio/canales.js', '../../src/dominio/canales.js'].map(aqui);
  const cliente = candidatos.find(existsSync);
  assert.ok(cliente, 'no se encontró canales.js del cliente');
  assert.equal(
    Buffer.compare(readFileSync(aqui('../src/canales.js')), readFileSync(cliente)),
    0,
    'functions/src/canales.js difiere del canales.js del cliente: vuelvan a copiarlo'
  );
});
