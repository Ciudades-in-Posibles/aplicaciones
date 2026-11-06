/**
 * Validación de la entrada de transmisorTransmitir. Lógica pura.
 * Los límites son los mismos que exige firestore.rules para una señal.
 */

import { CANALES, canalValido, canalesConAbiertos } from './canales.js';
import { enZona } from './zona.js';

export const MAX_NOTA = 280;
export const MAX_PREGUNTA = 200;
export const MAX_IMAGEN = 900000; // caracteres de la data URL, estrictamente menos
export const PREFIJO_IMAGEN = 'data:image/jpeg;base64,';

export const RE_MESA = /^[A-Z0-9]{4,16}$/;
// UUID de crypto.randomUUID o el respaldo «marca-de-tiempo-azar» de local/db.js
export const RE_ID_TOMA = /^[A-Za-z0-9_-]{8,64}$/;
export const RE_CODIGO = /^T-\d{2,6}$/;
// id de un documento de mesas/{mesa}/vecinos (id automático de Firestore)
export const RE_VECINO = /^[A-Za-z0-9_-]{2,40}$/;
const RE_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Error de validación: el motivo va al cliente tal cual. */
export class EntradaInvalida extends Error {
  constructor(motivo) {
    super(motivo);
    this.name = 'EntradaInvalida';
  }
}

function falla(motivo) {
  throw new EntradaInvalida(motivo);
}

/**
 * @param {unknown} datos  request.data
 * @returns {{mesa: string, toma: {id: string, canal: number, codigo: string, nota: string, pregunta: string, imagen: string, creada: number}, rastro: null | {celda: string, vecino: string}, canal: {n: number, nombre: string, lente: string}}}
 *   canal: nombre y lente salen de canales.js; solo en los canales abiertos (8 y 9) se acepta
 *   el nombre y la lente que escribió el equipo, recortados como en canalesConAbiertos.
 */
export function validarEntrada(datos, ahoraMs = Date.now()) {
  if (!datos || typeof datos !== 'object') falla('Faltan los datos de la toma.');
  const { mesa, toma } = datos;
  if (typeof mesa !== 'string' || !RE_MESA.test(mesa)) falla('El código de mesa no es válido.');
  if (!toma || typeof toma !== 'object') falla('Falta la toma.');

  if (typeof toma.id !== 'string' || !RE_ID_TOMA.test(toma.id)) falla('El id de la toma no es válido.');
  if (!canalValido(toma.canal)) falla('El canal debe ser un número del 1 al 9.');

  const nota = toma.nota ?? '';
  if (typeof nota !== 'string' || nota.length > MAX_NOTA) falla(`La nota no puede pasar de ${MAX_NOTA} caracteres.`);
  const pregunta = toma.pregunta ?? '';
  if (typeof pregunta !== 'string' || pregunta.length > MAX_PREGUNTA) falla(`La pregunta no puede pasar de ${MAX_PREGUNTA} caracteres.`);
  const codigo = toma.codigo ?? '';
  if (typeof codigo !== 'string' || (codigo !== '' && !RE_CODIGO.test(codigo))) falla('El código de la toma no es válido.');

  const imagen = toma.imagen;
  if (typeof imagen !== 'string' || !imagen.startsWith(PREFIJO_IMAGEN)) falla('La imagen debe ser un JPEG en data URL.');
  if (imagen.length >= MAX_IMAGEN) falla('La imagen es demasiado grande.');
  if (!RE_BASE64.test(imagen.slice(PREFIJO_IMAGEN.length))) falla('La imagen no está bien codificada.');

  const creada = Number.isFinite(toma.creada) ? toma.creada : ahoraMs;

  // rastro (opcional): la celda H3 del rastro de un vecino, dentro de la zona de juego
  let rastro = null;
  if (toma.celda != null || toma.vecino != null) {
    if (!enZona(toma.celda)) falla('La celda del rastro no está en la zona de juego.');
    if (typeof toma.vecino !== 'string' || !RE_VECINO.test(toma.vecino)) falla('El vecino del rastro no es válido.');
    rastro = { celda: toma.celda, vecino: toma.vecino };
  }

  const abiertos = {};
  const propuesto = toma.abierto;
  if (CANALES[toma.canal - 1].abierto && propuesto && typeof propuesto === 'object') {
    abiertos[toma.canal] = {
      nombre: typeof propuesto.nombre === 'string' ? propuesto.nombre : '',
      lente: typeof propuesto.lente === 'string' ? propuesto.lente : ''
    };
  }
  const canal = canalesConAbiertos(abiertos).find((c) => c.n === toma.canal);

  return {
    mesa,
    toma: { id: toma.id, canal: toma.canal, codigo, nota, pregunta, imagen, creada },
    rastro,
    canal: { n: canal.n, nombre: canal.nombre, lente: canal.lente }
  };
}
