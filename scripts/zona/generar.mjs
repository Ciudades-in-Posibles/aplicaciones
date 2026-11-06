// Genera la zona de los vecinos (src/comun/dominio/zona.js y su copia functions/src/zona.js) y el
// mapa dibujado del Visor (src/visor/mapaBase.js) a partir de geo.json: biblioteca, parque, agua,
// arbolado, prado, edificios, vías y senderos del Parque Nacional, extraídos de OpenStreetMap
// (© colaboradores de OpenStreetMap, ODbL) el 6 nov 2026. Los senderos («caminos») solo se dibujan:
// no cuentan para la zona.
//
//   npm run zona                 (resolución 12, radio de 40 celdas)
//   node scripts/zona/generar.mjs [radio] [resolución]
//
// Después: npm test aquí y en functions/.
import fs from 'node:fs';
import * as h3 from 'h3-js';
const [K = '40', R = '12'] = process.argv.slice(2);
const geo = JSON.parse(fs.readFileSync(new URL('./geo.json', import.meta.url), 'utf8'));
const salidas = ['../../src/comun/dominio/zona.js', '../../functions/src/zona.js'].map((p) => new URL(p, import.meta.url));
const RES = Number(R);

const dentro = ([lat, lng], poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const muestrear = (pts, paso = 0.00003) => { // ~3 m
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / paso));
    for (let k = 0; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
};
const centroide = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

const bib = centroide(geo.biblioteca);
const celdaBib = h3.latLngToCell(bib[0], bib[1], RES);
const candidatas = h3.gridDisk(celdaBib, Number(K));

const vias = new Set();
const cruces = new Set();
for (const v of geo.vias) {
  const destino = ['primary', 'secondary', 'trunk'].includes(v.tipo) ? vias : v.tipo === 'tertiary' ? cruces : null;
  if (destino) for (const p of muestrear(v.pts)) destino.add(h3.latLngToCell(p[0], p[1], RES));
}
const agua = new Set();
for (const l of geo.agua) for (const p of muestrear(l)) agua.add(h3.latLngToCell(p[0], p[1], RES));
const arboles = new Set(geo.arboles_pt.map((p) => h3.latLngToCell(p[0], p[1], RES)));
const edificios = new Set(geo.edificios.map((e) => h3.latLngToCell(...centroide(e), RES)));
// las celdas de la biblioteca entran aunque su centro quede fuera del parque, pero nunca si las toca una vía mayor
const bibCeldas = new Set([celdaBib, ...geo.biblioteca.map((p) => h3.latLngToCell(p[0], p[1], RES))].filter((c) => !vias.has(c)));
if (!bibCeldas.has(celdaBib)) throw new Error('una vía mayor toca la celda de la biblioteca');

const zona = {};
for (const c of candidatas) {
  const centro = h3.cellToLatLng(c);
  if (!dentro(centro, geo.parque) && !bibCeldas.has(c)) continue;
  if (vias.has(c)) continue;
  const et = [];
  if (bibCeldas.has(c)) et.push('biblioteca');
  if (cruces.has(c)) et.push('cruce');
  if (agua.has(c)) et.push('agua');
  if (arboles.has(c) || geo.arboles_area.some((a) => dentro(centro, a))) et.push('arboles');
  if (edificios.has(c) || geo.edificios.some((e) => dentro(centro, e))) et.push('edificio');
  zona[c] = et;
}
// orilla: junto al agua; prado: lo que no es edificio ni agua ni biblioteca
for (const c of Object.keys(zona)) {
  const et = zona[c];
  if (!et.includes('agua') && h3.gridDisk(c, 1).some((v) => zona[v]?.includes('agua'))) et.push('orilla');
  if (!et.some((e) => ['agua', 'edificio', 'biblioteca', 'cruce'].includes(e))) et.push('prado');
}
// solo la parte conectada con la biblioteca (la zona se recorre a pie sin cruzar vías)
const conectada = new Set([celdaBib]);
const pila = [celdaBib];
while (pila.length) for (const v of h3.gridDisk(pila.pop(), 1)) if (zona[v] && !conectada.has(v)) { conectada.add(v); pila.push(v); }
const celdas = Object.keys(zona).filter((c) => conectada.has(c)).sort();
if (celdas.some((c) => vias.has(c))) throw new Error('la zona toca una vía mayor');
const mitad = (h3.getHexagonEdgeLengthAvg(RES, 'm')).toFixed(0);

const cuenta = {};
for (const c of celdas) for (const e of zona[c]) cuenta[e] = (cuenta[e] || 0) + 1;
const lineas = celdas.map((c) => `  '${c}': '${zona[c].join(' ')}'`).join(',\n');
const js = `/**
 * Zona de juego de los vecinos: celdas H3 de resolución ${RES} (lado medio ≈ ${mitad} m) alrededor de la
 * Biblioteca El Parque, dentro del Parque Nacional Enrique Olaya Herrera.
 * Generado desde OpenStreetMap (© colaboradores de OpenStreetMap, ODbL) el ${new Date().toISOString().slice(0, 10)}:
 * - centro: la biblioteca (way 558618583, «Biblioteca Infantil Parque Nacional» en OSM);
 * - quedan dentro las celdas cuyo centro cae en el parque (way 404741327), a ${K} celdas o menos
 *   de la biblioteca, sin las que tocan vías primarias o secundarias (Carrera 7, Carrera 5), ni
 *   siquiera las de la biblioteca, y conectadas a pie con ella: la zona queda toda del lado
 *   occidental de la Avenida Carrera 5 y nadie cruza una vía mayor.
 * Etiquetas: biblioteca, agua (quebrada o canal Arzobispo), orilla, arboles, edificio, prado y
 * cruce (una vía terciaria dentro del parque: se puede pasar, pero ningún vecino deja rastro ahí).
 * No se edita a mano: se regenera con «npm run zona» (scripts/zona/). functions/src/zona.js es copia exacta.
 */

export const RESOLUCION = ${RES};
export const CELDA_BIBLIOTECA = '${celdaBib}';
export const CENTRO = { lat: ${bib[0].toFixed(6)}, lng: ${bib[1].toFixed(6)} };

/** celda → etiquetas separadas por espacio */
export const ZONA = {
${lineas}
};

export const CELDAS = Object.keys(ZONA);

export function enZona(celda) {
  return typeof celda === 'string' && Object.prototype.hasOwnProperty.call(ZONA, celda);
}

export function etiquetas(celda) {
  return enZona(celda) ? ZONA[celda].split(' ') : [];
}
`;
for (const s of salidas) fs.writeFileSync(s, js);
console.log('celdas', celdas.length, cuenta, 'bib', celdaBib, bib);

// ---- mapa dibujado del Visor: lo que toca la caja de la zona más un margen ----
let [s0, n0, o0, e0] = [90, -90, 180, -180];
for (const c of celdas) for (const [la, lo] of h3.cellToBoundary(c)) { s0 = Math.min(s0, la); n0 = Math.max(n0, la); o0 = Math.min(o0, lo); e0 = Math.max(e0, lo); }
const MARGEN = 0.0008; // ≈ 90 m
const enCaja = ([la, lo]) => la > s0 - MARGEN && la < n0 + MARGEN && lo > o0 - MARGEN && lo < e0 + MARGEN;
const redondo = ([la, lo]) => [Number(la.toFixed(6)), Number(lo.toFixed(6))];
const lineas6 = (lista) => lista.filter((l) => l.some(enCaja)).map((l) => l.map(redondo));
const base = {
  parque: geo.parque.map(redondo),
  prado: lineas6(geo.prado),
  arboles: lineas6(geo.arboles_area),
  agua: lineas6(geo.agua),
  edificios: lineas6(geo.edificios),
  vias: geo.vias.filter((v) => v.pts.some(enCaja)).map((v) => ({ tipo: v.tipo, nombre: v.nombre || '', pts: v.pts.map(redondo) })),
  caminos: (geo.caminos || []).filter((v) => v.pts.some(enCaja)).map((v) => ({ tipo: v.tipo, pts: v.pts.map(redondo) }))
};
const jsBase = `/**
 * Mapa dibujado bajo los hexágonos del mapa de rastros (Visor, /rastros).
 * Datos © colaboradores de OpenStreetMap (ODbL), extraídos el 6 nov 2026 y recortados a la zona
 * de los vecinos más ≈ 90 m. Coordenadas [lat, lng]. No se edita a mano: «npm run zona».
 */
export const MAPA_BASE = ${JSON.stringify(base)};
`;
fs.writeFileSync(new URL('../../src/visor/mapaBase.js', import.meta.url), jsBase);
console.log('mapa base', Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v.length])), Math.round(jsBase.length / 1024), 'KB');
