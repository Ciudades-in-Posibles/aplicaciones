/**
 * Dibujo de celdas H3 en SVG: proyección plana (equirectangular) alrededor de un centro.
 * A la escala del parque (menos de 1 km) la deformación no se nota. Lógica pura.
 * El norte queda arriba; x crece hacia el este e y hacia el sur, como en SVG.
 */

import { cellToBoundary, cellToLatLng } from 'h3-js';

const M_POR_GRADO = 111320;

/**
 * @param {{lat: number, lng: number}} centro
 * @returns {(lat: number, lng: number) => [number, number]} metros desde el centro
 */
export function proyeccion(centro) {
  const k = Math.cos((centro.lat * Math.PI) / 180);
  return (lat, lng) => [(lng - centro.lng) * M_POR_GRADO * k, (centro.lat - lat) * M_POR_GRADO];
}

/**
 * Polígonos de las celdas y su caja, en metros desde el centro.
 * @param {string[]} celdas
 * @param {{lat: number, lng: number}} centro
 */
export function dibujarCeldas(celdas, centro) {
  const p = proyeccion(centro);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const poligonos = celdas.map((c) => {
    const pts = cellToBoundary(c).map(([lat, lng]) => p(lat, lng));
    for (const [x, y] of pts) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const [cx, cy] = p(...cellToLatLng(c));
    return { celda: c, puntos: pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '), cx, cy };
  });
  return { poligonos, caja: { x: minX, y: minY, ancho: maxX - minX, alto: maxY - minY } };
}

/** El centro de una celda en metros desde el centro dado. */
export function centroDe(celda, centro) {
  return proyeccion(centro)(...cellToLatLng(celda));
}

/** viewBox de una caja con margen. */
export const viewBox = (caja, margen = 10) => `${(caja.x - margen).toFixed(1)} ${(caja.y - margen).toFixed(1)} ${(caja.ancho + 2 * margen).toFixed(1)} ${(caja.alto + 2 * margen).toFixed(1)}`;

/** Inversa de `proyeccion`: de metros desde el centro a [lat, lng]. */
export function desproyeccion(centro) {
  const k = Math.cos((centro.lat * Math.PI) / 180);
  return (x, y) => [centro.lat - y / M_POR_GRADO, centro.lng + x / (M_POR_GRADO * k)];
}

/** Puntos de un polyline o polygon a partir de [lat, lng]. */
export function trazo(pts, centro) {
  const p = proyeccion(centro);
  return pts.map(([lat, lng]) => p(lat, lng).map((v) => v.toFixed(1)).join(',')).join(' ');
}

// ---- teselas web-mercator (OpenStreetMap) ----

const teselaX = (lng, z) => ((lng + 180) / 360) * 2 ** z;
const teselaY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};
const lngDe = (x, z) => (x / 2 ** z) * 360 - 180;
const latDe = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

export const URL_TESELA = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

/**
 * Teselas de OpenStreetMap que cubren una caja en metros (como la de `dibujarCeldas`), cada una con
 * su rectángulo en metros desde el centro. A la escala del parque la proyección plana y la de
 * mercator coinciden a menos de un metro.
 * @returns {{z: number, x: number, y: number, url: string, rect: {x: number, y: number, ancho: number, alto: number}}[]}
 */
export function teselas(caja, centro, z = 18) {
  const des = desproyeccion(centro);
  const pro = proyeccion(centro);
  const [latN, lngO] = des(caja.x, caja.y);
  const [latS, lngE] = des(caja.x + caja.ancho, caja.y + caja.alto);
  const out = [];
  for (let x = Math.floor(teselaX(lngO, z)); x <= Math.floor(teselaX(lngE, z)); x++) {
    for (let y = Math.floor(teselaY(latN, z)); y <= Math.floor(teselaY(latS, z)); y++) {
      const [x0, y0] = pro(latDe(y, z), lngDe(x, z));
      const [x1, y1] = pro(latDe(y + 1, z), lngDe(x + 1, z));
      out.push({ z, x, y, url: URL_TESELA(z, x, y), rect: { x: x0, y: y0, ancho: x1 - x0, alto: y1 - y0 } });
    }
  }
  return out;
}
