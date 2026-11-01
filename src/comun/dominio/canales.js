/**
 * Los nueve canales del juego: siete fijos y dos abiertos.
 * Nombres y lentes tal como están en ciudadesinposibles.net/el-juego/canales/.
 * El color es el token de la paleta v18 (ver estilos/tokens.css).
 */

export const CANALES = [
  { n: 1, nombre: 'Huella', color: 'rojo', lente: 'Encuadra algo que pasó por aquí y ya no está: marcas, desgaste, rastros.' },
  { n: 2, nombre: 'Ritmo', color: 'naranja', lente: 'Encuadra algo que se repite. Cuenta cuántas veces ocurre en un minuto.' },
  { n: 3, nombre: 'Grieta', color: 'amarillo', lente: 'Encuadra lo que crece, se cuela o se rompe donde nadie lo planeó.' },
  { n: 4, nombre: 'A ras', color: 'lima', lente: 'Encuadra lo que mide menos que tu mano, a la altura del suelo.' },
  { n: 5, nombre: 'Borde', color: 'menta', lente: 'Encuadra el lugar donde una cosa termina y empieza otra.' },
  { n: 6, nombre: 'Refugio', color: 'turquesa', lente: 'Encuadra dónde se resguarda algo que no eres tú.' },
  { n: 7, nombre: 'Fuente', color: 'azul', lente: 'Encuadra de dónde sale un sonido que no es una voz humana.' },
  { n: 8, nombre: 'Abierto', color: 'naranja-claro', lente: 'La mesa escribe la lente al iniciar la partida.', abierto: true },
  { n: 9, nombre: 'Abierto', color: 'violeta', lente: 'La mesa escribe la lente al iniciar la partida.', abierto: true }
];

export const MAX_NOMBRE_CANAL = 24;
export const MAX_LENTE = 160;

/**
 * Canales con los dos abiertos personalizados por el equipo.
 * @param {Record<number, {nombre?: string, lente?: string}>} abiertos
 */
export function canalesConAbiertos(abiertos = {}) {
  return CANALES.map((c) => {
    if (!c.abierto || !abiertos[c.n]) return c;
    const nombre = (abiertos[c.n].nombre || '').trim().slice(0, MAX_NOMBRE_CANAL);
    const lente = (abiertos[c.n].lente || '').trim().slice(0, MAX_LENTE);
    return { ...c, nombre: nombre || c.nombre, lente: lente || c.lente };
  });
}

export function canalValido(n) {
  return Number.isInteger(n) && n >= 1 && n <= 9;
}

/** El canal siguiente o anterior en el dial, con vuelta (9 → 1). */
export function girarDial(n, paso) {
  return ((((n - 1 + paso) % 9) + 9) % 9) + 1;
}
