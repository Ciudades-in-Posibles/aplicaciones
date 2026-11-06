import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellToBoundary } from 'h3-js';
import { CELDAS, CENTRO } from '../src/comun/dominio/zona.js';
import { dibujarCeldas, teselas, proyeccion, desproyeccion, trazo } from '../src/comun/dominio/mapa.js';
import { MAPA_BASE } from '../src/visor/mapaBase.js';

const { caja } = dibujarCeldas(CELDAS, CENTRO);

test('desproyeccion deshace la proyección', () => {
  const p = proyeccion(CENTRO);
  const d = desproyeccion(CENTRO);
  const [lat, lng] = d(...p(4.6251, -74.0641));
  assert.ok(Math.abs(lat - 4.6251) < 1e-9);
  assert.ok(Math.abs(lng + 74.0641) < 1e-9);
});

test('trazo: puntos en metros con un decimal', () => {
  assert.equal(trazo([[CENTRO.lat, CENTRO.lng]], CENTRO), '0.0,0.0');
});

test('teselas: cubren la caja de la zona, sin huecos, con URLs de OpenStreetMap', () => {
  const lista = teselas(caja, CENTRO, 18);
  assert.ok(lista.length > 4 && lista.length < 60, `${lista.length} teselas`);
  for (const t of lista) {
    assert.ok(Number.isInteger(t.x) && Number.isInteger(t.y) && t.z === 18);
    assert.equal(t.url, `https://tile.openstreetmap.org/18/${t.x}/${t.y}.png`);
    assert.ok(t.rect.ancho > 0 && t.rect.alto > 0);
  }
  const x0 = Math.min(...lista.map((t) => t.rect.x));
  const y0 = Math.min(...lista.map((t) => t.rect.y));
  const x1 = Math.max(...lista.map((t) => t.rect.x + t.rect.ancho));
  const y1 = Math.max(...lista.map((t) => t.rect.y + t.rect.alto));
  assert.ok(x0 <= caja.x && y0 <= caja.y && x1 >= caja.x + caja.ancho && y1 >= caja.y + caja.alto);
  // columnas y filas contiguas: el número de teselas es el producto
  const xs = new Set(lista.map((t) => t.x));
  const ys = new Set(lista.map((t) => t.y));
  assert.equal(lista.length, xs.size * ys.size);
  assert.equal(Math.max(...xs) - Math.min(...xs) + 1, xs.size);
});

test('mapa base: tiene vías y senderos y cubre todas las celdas de la zona', () => {
  assert.ok(MAPA_BASE.vias.length > 10 && MAPA_BASE.caminos.length > 10 && MAPA_BASE.edificios.length > 0);
  const pts = Object.values(MAPA_BASE).flatMap((capa) => (Array.isArray(capa[0]) && typeof capa[0][0] === 'number' ? capa : capa.flatMap((l) => l.pts || l)));
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const [s, n, o, e] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  for (const c of CELDAS) {
    for (const [la, lo] of cellToBoundary(c)) assert.ok(la >= s && la <= n && lo >= o && lo <= e, c);
  }
});
