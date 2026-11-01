/**
 * Tope de lecturas por equipo: ventana fija de una hora, contada en el documento del equipo
 * (campo `lecturas: { ventana, n }`). Lógica pura; la transacción vive en transmitir.js.
 */

export const MAX_LECTURAS_POR_HORA = 60;
export const VENTANA_MS = 60 * 60 * 1000;

/** Número de la ventana de una hora a la que pertenece el instante. */
export function ventanaDe(ahoraMs) {
  return Math.floor(ahoraMs / VENTANA_MS);
}

/**
 * Cuenta una lectura más si cabe en la ventana actual.
 * @param {{ventana?: number, n?: number}|undefined} lecturas  lo que hay guardado en el equipo
 * @param {number} ahoraMs
 * @param {number} [maximo]
 * @returns {{permitido: boolean, lecturas: {ventana: number, n: number}}}
 *   lecturas: el valor que debe quedar guardado (sin cambios si no se permitió)
 */
export function contarLectura(lecturas, ahoraMs, maximo = MAX_LECTURAS_POR_HORA) {
  const ventana = ventanaDe(ahoraMs);
  const n = lecturas && lecturas.ventana === ventana && Number.isInteger(lecturas.n) && lecturas.n >= 0 ? lecturas.n : 0;
  if (n >= maximo) return { permitido: false, lecturas: { ventana, n } };
  return { permitido: true, lecturas: { ventana, n: n + 1 } };
}
