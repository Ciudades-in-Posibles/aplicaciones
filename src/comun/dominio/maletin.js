/**
 * El maletín del Visor (/maletin): pide la clave de seis dígitos y, si es la correcta, se abre y deja
 * ver la cita de la tapa. La clave nunca está en el código: llega en el enlace (`#NNN-NNN`).
 */

export const DIGITOS_CLAVE = 6;

/**
 * La cita que va dentro de la tapa: T. S. Eliot, «Burnt Norton» (Cuatro cuartetos, I), en la
 * transcripción de MangleRojo del 13 nov 2026.
 */
export const CITA = {
  lineas: [
    'El tiempo presente y el tiempo pasado',
    'están ambos tal vez presentes en el tiempo futuro,',
    'y el tiempo futuro contenido en el tiempo pasado.',
    'Si todo tiempo es eternamente presente',
    'todo tiempo es irredimible.',
    'Lo que pudo haber sido es una abstracción',
    'que permanece como perpetua posibilidad',
    'solo en un mundo de especulación.',
    'Lo que pudo haber sido y lo que ha sido',
    'apuntan a un solo fin, que siempre está presente.'
  ],
  autor: 'T. S. Eliot',
  obra: 'Burnt Norton'
};

/** Solo los dígitos, hasta seis. */
/**
 * El pie de la carta: remite a la página de la Asamblea en el sitio, que lleva la cuenta regresiva
 * (17 nov 2026, 5 p.m., hora de Bogotá). El QR de la hoja abre `url`.
 */
export const CONVOCATORIA = {
  remitente: 'Sociedad de',
  evento: 'Asamblea de la Sociedad',
  cuando: 'Martes 17 de noviembre · 5 p.m.',
  url: 'https://ciudadesinposibles.net/sociedad/',
  direccion: 'ciudadesinposibles.net/sociedad'
};

export function limpiarDigitos(texto) {
  return String(texto ?? '').replace(/[^0-9]/g, '').slice(0, DIGITOS_CLAVE);
}

/** La clave que trae el enlace (`#123-456`, `#123456`); '' si no son exactamente seis dígitos. */
export function claveDesdeHash(hash) {
  const d = String(hash ?? '').replace(/^#/, '').replace(/[^0-9]/g, '');
  return d.length === DIGITOS_CLAVE ? d : '';
}

/** Sin clave, el maletín no se abre con nada. */
export function comprobarClave(digitos, clave) {
  return !!clave && clave.length === DIGITOS_CLAVE && limpiarDigitos(digitos) === clave;
}

/** Lo que la Consola escribe en la mesa: los dígitos (vacío para cerrar) y un contador de envíos. */
export function datosDeMaletin(digitos, n) {
  return { digitos: limpiarDigitos(digitos), n: Number.isInteger(n) && n >= 0 ? n : 0 };
}

/** Lo que el Visor lee de la mesa; null si la mesa no trae nada del maletín. */
export function maletinDeMesa(datos) {
  const m = datos?.maletin;
  if (!m || typeof m !== 'object' || !Number.isInteger(m.n)) return null;
  return datosDeMaletin(m.digitos, m.n);
}
