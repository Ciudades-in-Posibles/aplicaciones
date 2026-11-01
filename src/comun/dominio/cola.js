/**
 * Cola de salida: lo que espera señal para salir del teléfono.
 * Cada elemento es {id, tipo: 'senal', ref, intentos, siguiente}.
 * Funciones puras; quien la procesa vive en transmisor/red/transmitir.js.
 */

const ESPERA_BASE_MS = 5000;
const ESPERA_MAX_MS = 5 * 60 * 1000;

/** Mesa cerrada: se vuelve a preguntar cada minuto. */
export const ESPERA_CERRADA_MS = 60 * 1000;
/** Tope de lecturas por hora: no tiene sentido insistir antes de unos minutos. */
export const ESPERA_TOPE_MS = 5 * 60 * 1000;

export function nuevoElemento({ id, tipo, ref, ahora }) {
  return { id, tipo, ref, intentos: 0, siguiente: ahora };
}

/** Elementos listos para intentar, en orden de llegada. */
export function listos(cola, ahora) {
  return cola.filter((e) => e.siguiente <= ahora);
}

/** Tras un fallo de red, espera el doble cada vez, hasta 5 minutos. */
export function reprogramar(elemento, ahora) {
  const intentos = elemento.intentos + 1;
  const espera = Math.min(ESPERA_BASE_MS * 2 ** (intentos - 1), ESPERA_MAX_MS);
  return { ...elemento, intentos, siguiente: ahora + espera };
}

/** Deja el elemento para después, sin tratarlo como un fallo de red. */
export function aplazar(elemento, ahora, esperaMs) {
  return { ...elemento, siguiente: ahora + esperaMs };
}

/**
 * Qué hacer con el error de una señal. Los errores de la callable llegan como «functions/<código>».
 * @returns {'tope'|'revisar-mesa'|'invalida'|'reintentar'}
 *   tope: el equipo llegó al tope de lecturas por hora; revisar-mesa: la mesa o el equipo
 *   no están en orden (cerrada, fuera); invalida: la toma no la acepta el servidor;
 *   reintentar: red o servidor, con espera creciente.
 */
export function clasificarError(err) {
  const codigo = String(err?.code || '').replace(/^functions\//, '');
  if (codigo === 'resource-exhausted') return 'tope';
  if (codigo === 'permission-denied' || codigo === 'failed-precondition') return 'revisar-mesa';
  if (codigo === 'invalid-argument') return 'invalida';
  return 'reintentar';
}
