import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const aqui = (ruta) => fileURLToPath(new URL(ruta, import.meta.url));

test('zona.js del servidor es copia exacta del cliente', () => {
  assert.equal(
    Buffer.compare(readFileSync(aqui('../src/zona.js')), readFileSync(aqui('../../src/comun/dominio/zona.js'))),
    0,
    'functions/src/zona.js difiere de src/comun/dominio/zona.js: vuelvan a copiarlo'
  );
});
