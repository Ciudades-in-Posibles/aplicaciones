/**
 * La toma: una foto 4:3 en blanco y negro registrada en un canal.
 * Vive en el teléfono. Solo sale de él si el equipo la manda al aire.
 *
 * Estados:
 *   local      → registrada, solo en el teléfono
 *   en-cola    → el equipo la mandó al aire; espera señal
 *   al-aire    → pasó el filtro y está en el muro de la mesa
 *   rechazada  → el filtro encontró un rostro o algo inadecuado; no salió
 *
 * Las tomas de prueba (prueba: true) son de versiones anteriores: al cargar, vuelven a local.
 * Al unirse a una mesa, esas tomas vuelven a local para transmitirlas de verdad.
 */

import { canalValido } from './canales.js';

export const ESTADOS = ['local', 'en-cola', 'al-aire', 'rechazada'];
export const MAX_NOTA = 280;

const TRANSICIONES = {
  local: ['en-cola'],
  'en-cola': ['al-aire', 'rechazada', 'local'],
  rechazada: ['local'],
  'al-aire': ['local'] // el equipo la saca del aire para cambiarla
};

export function puedePasar(desde, hacia) {
  return (TRANSICIONES[desde] || []).includes(hacia);
}

function limpiar(texto, maximo) {
  return typeof texto === 'string' ? texto.trim().slice(0, maximo) : '';
}

/** Código visible de una toma a partir de su número (1 → T-01). */
export function codigoToma(numero) {
  return `T-${String(numero).padStart(2, '0')}`;
}

/**
 * La toma nace sin canal (canal: null); se le asigna en la mesa de edición.
 * @param {{id: string, numero: number, canal?: number|null, creada: number, nota?: string}} datos
 */
export function crearToma({ id, numero, canal = null, creada, nota }) {
  if (!id) throw new Error('La toma necesita un id.');
  if (canal != null && !canalValido(canal)) throw new Error('Canal fuera del dial.');
  return {
    id,
    numero,
    codigo: codigoToma(numero),
    canal,
    creada,
    nota: limpiar(nota, MAX_NOTA),
    pregunta: '', // ya no se pregunta; el campo se conserva vacío por las tomas viejas y las reglas de Firestore
    estado: 'local',
    lectura: null,
    motivo: ''
  };
}

export function editarToma(toma, cambios) {
  if (toma.estado !== 'local' && toma.estado !== 'rechazada') {
    throw new Error('Una toma al aire o en cola no se edita.');
  }
  const t = { ...toma };
  if ('nota' in cambios) t.nota = limpiar(cambios.nota, MAX_NOTA);
  if ('canal' in cambios) {
    if (cambios.canal != null && !canalValido(cambios.canal)) throw new Error('Canal fuera del dial.');
    t.canal = cambios.canal;
  }
  return t;
}

function pasar(toma, hacia, extra = {}) {
  if (!puedePasar(toma.estado, hacia)) {
    throw new Error(`La toma no puede pasar de ${toma.estado} a ${hacia}.`);
  }
  return { ...toma, ...extra, estado: hacia };
}

export const SIN_CANAL = 'Asignen un canal antes de mandarla al aire.';

export const editable = (toma) => toma.estado === 'local' || toma.estado === 'rechazada';

export function encolar(toma) {
  if (!canalValido(toma.canal)) throw new Error(SIN_CANAL);
  return pasar(toma, 'en-cola', { motivo: '' });
}
export const sacarDeCola = (toma) => pasar(toma, 'local');
export const ponerAlAire = (toma, lectura) => pasar(toma, 'al-aire', { lectura, enviada: Date.now() });
export const rechazar = (toma, motivo) => pasar(toma, 'rechazada', { motivo });
export const volverALocal = (toma) => pasar(toma, 'local', { motivo: '' });

/** Asigna un canal a varias tomas a la vez; solo cambian las editables. */
export function asignarCanal(tomas, ids, canal) {
  const sel = new Set(ids);
  return tomas.filter((t) => sel.has(t.id) && editable(t)).map((t) => editarToma(t, { canal }));
}

/** Al aire de prueba: sin mesa, la toma sale solo al televisor de este teléfono. */
export const ponerAlAireDePrueba = (toma) => ({ ...ponerAlAire(encolar(toma), null), prueba: true });

/**
 * El equipo saca su toma del aire: vuelve a la mesa de edición con su nota.
 * Si se reenvía, el servidor la lee de nuevo.
 */
export function sacarDelAire(toma) {
  const { prueba, enviada, lectura, lecturaPrevia, ...resto } = pasar(toma, 'local', { motivo: '' });
  return { ...resto, lectura: null };
}

/** Al unirse a la mesa, una toma de prueba vuelve a local. */
export function deshacerPrueba(toma) {
  if (!toma.prueba) return toma;
  const { prueba, enviada, ...resto } = toma;
  return { ...resto, estado: 'local', lectura: null };
}

/** La toma de prueba con la forma de una señal del muro. */
export function senalDePrueba(toma, canal) {
  return {
    id: toma.id, prueba: true, equipo: 'Prueba · este teléfono', canal: toma.canal,
    canalNombre: canal?.nombre || '', lente: canal?.lente || '', codigo: toma.codigo,
    nota: toma.nota, pregunta: '', descripcion: '', imagen: toma.imagen,
    creada: toma.enviada || toma.creada
  };
}
