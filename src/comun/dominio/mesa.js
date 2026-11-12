/**
 * La mesa (una sola por ahora) y el equipo que se une a ella.
 */

export const MAX_NOMBRE_EQUIPO = 32;

/** El código de mesa se escribe sin importar mayúsculas ni espacios. */
export function normalizarCodigo(codigo) {
  return String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function codigoValido(codigo) {
  const c = normalizarCodigo(codigo);
  return c.length >= 4 && c.length <= 16;
}

export const TRANSMISOR = 'https://transmisor.ciudadesinposibles.net';

/** El enlace que abre el Transmisor con el código de la mesa ya puesto (va en el QR de la mesa). */
export function urlDeMesa(codigo) {
  return `${TRANSMISOR}/?mesa=${normalizarCodigo(codigo)}`;
}

/** El código que trae un enlace `?mesa=…`, normalizado; '' si no trae uno válido. */
export function codigoDeEnlace(search) {
  let c = '';
  try { c = new URLSearchParams(search || '').get('mesa') || ''; } catch { return ''; }
  return codigoValido(c) ? normalizarCodigo(c) : '';
}

/** Los canales con un objeto en el maletín: los siete fijos. */
export const BOTS = 7;

/**
 * El enlace del QR de un objeto del maletín: abre el Transmisor siguiendo solo al vecino de ese canal.
 * Con `codigo`, además trae puesto el código de la mesa.
 */
export function urlDeBot(canal, codigo = '') {
  const n = Number(canal);
  if (!Number.isInteger(n) || n < 1 || n > BOTS) throw new Error('El objeto va con un canal del 1 al 7.');
  return codigoValido(codigo) ? `${urlDeMesa(codigo)}&bot=${n}` : `${TRANSMISOR}/?bot=${n}`;
}

/**
 * El canal que trae un enlace `?bot=N`: 1–7 para seguir a ese vecino, 0 para volver a seguirlos a
 * todos, null si el enlace no dice nada (o algo que no vale).
 */
export function botDeEnlace(search) {
  let b = null;
  try { b = new URLSearchParams(search || '').get('bot'); } catch { return null; }
  if (b === null || !/^[0-9]$/.test(b)) return null;
  const n = Number(b);
  return n <= BOTS ? n : null;
}

export function limpiarNombreEquipo(nombre) {
  return String(nombre || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE_EQUIPO);
}

/** Llave única del nombre dentro de la mesa: sin tildes, mayúsculas ni espacios. */
export function llaveNombre(nombre) {
  return limpiarNombreEquipo(nombre)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function nombreValido(nombre) {
  return llaveNombre(nombre).length >= 2;
}

export const MAX_NOMBRE_MESA = 60;

/** Las mesas sin el campo «abierta» cuentan como abiertas. */
export function mesaAbierta(datos) {
  return Boolean(datos) && datos.abierta !== false;
}

/** Para la Consola: cuántas señales hay por canal y por equipo (uid). */
export function resumenMesa(senales) {
  const porCanal = {};
  const porEquipo = {};
  for (const s of senales) {
    porCanal[s.canal] = (porCanal[s.canal] || 0) + 1;
    porEquipo[s.uid] = (porEquipo[s.uid] || 0) + 1;
  }
  return { total: senales.length, porCanal, porEquipo };
}
