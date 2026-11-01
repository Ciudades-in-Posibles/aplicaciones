/**
 * La tira de la mesa de transmisión: los ids de las tomas en orden de salida.
 * Funciones puras: reciben una tira y devuelven otra.
 */

export function agregar(tira, id) {
  return tira.includes(id) ? tira : [...tira, id];
}

export function quitar(tira, id) {
  return tira.filter((x) => x !== id);
}

/** Mueve una toma un lugar a la izquierda (-1) o a la derecha (+1). */
export function mover(tira, id, paso) {
  const i = tira.indexOf(id);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= tira.length) return tira;
  const t = [...tira];
  [t[i], t[j]] = [t[j], t[i]];
  return t;
}

/** Deja en la tira solo ids que existen, en su orden, y agrega al final los que falten. */
export function sincronizar(tira, ids) {
  const existe = new Set(ids);
  const base = tira.filter((x) => existe.has(x));
  return [...base, ...ids.filter((x) => !base.includes(x))];
}
