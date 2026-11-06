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
