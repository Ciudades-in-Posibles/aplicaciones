/**
 * Andares y datos de los vecinos, sin H3: los usan la Consola y el estado del teléfono
 * sin cargar h3-js. La geometría (dónde está cada vecino) vive en vecinos.js.
 */

const MIN = 60 * 1000;

/**
 * Andares: cómo se mueve un vecino. Propuesta del asistente; la Consola elige uno por vecino.
 * Todos viven del lado sur del río Arzobispo (CELDAS_DE_VECINOS en vecinos.js), sin pisar el agua,
 * y fuera de la franja de 2 celdas alrededor de la biblioteca (CELDAS_FRANJA).
 * - habitat: etiquetas de la zona donde puede estar (nunca en «cruce»)
 * - ribera: en lugar de las etiquetas, las celdas a esa cantidad de celdas del agua o menos
 * - prefiere: etiquetas que pesan el triple al elegir el paso
 * - pasoMin: minutos entre pasos; salto: hasta cuántas celdas avanza en un paso
 * - noche: solo se mueve de 17:30 a 6:00; de día queda en su casa
 */
export const ANDARES = {
  quieto: { nombre: 'Quieto', ejemplo: 'musgo, liquen', habitat: ['arboles', 'prado', 'orilla', 'edificio'], prefiere: ['arboles'], pasoMin: 60, salto: 1 },
  // la orilla sur sola queda partida en islas de 5 y 11 celdas: la ribera de 3 celdas (≈ 55 m) le da 35
  rio: { nombre: 'Por el agua', ejemplo: 'quebrada, renacuajo', habitat: ['orilla'], ribera: 3, prefiere: ['orilla'], pasoMin: 5, salto: 1 },
  copas: { nombre: 'Entre copas', ejemplo: 'mirla, colibrí', habitat: ['arboles', 'prado', 'orilla'], prefiere: ['arboles', 'orilla'], pasoMin: 5, salto: 3 },
  suelo: { nombre: 'A ras del suelo', ejemplo: 'hormigas, lombriz', habitat: ['prado', 'orilla', 'arboles', 'edificio'], prefiere: ['prado'], pasoMin: 10, salto: 1 },
  noche: { nombre: 'De noche', ejemplo: 'zarigüeya, polilla', habitat: ['prado', 'arboles', 'orilla'], prefiere: ['arboles'], pasoMin: 5, salto: 1, noche: { desde: (17 * 60 + 30) * MIN } }
};

export const ANDAR_POR_DEFECTO = 'suelo';

/**
 * Vecinos de prueba para jugar en Local (sin mesa) o en una mesa que todavía no tiene vecinos.
 * El canal de cada andar es solo una sugerencia; los de verdad los nombra la mesa en la Consola.
 */
export const VECINOS_DE_PRUEBA = [
  { id: 'prueba-suelo-1', nombre: 'De prueba · a ras 1', canal: 1, andar: 'suelo', prueba: true },
  { id: 'prueba-copas-2', nombre: 'De prueba · entre copas 2', canal: 2, andar: 'copas', prueba: true },
  { id: 'prueba-quieto', nombre: 'De prueba · quieto', canal: 3, andar: 'quieto', prueba: true },
  { id: 'prueba-suelo', nombre: 'De prueba · a ras', canal: 4, andar: 'suelo', prueba: true },
  { id: 'prueba-agua', nombre: 'De prueba · por el agua', canal: 5, andar: 'rio', prueba: true },
  { id: 'prueba-copas', nombre: 'De prueba · entre copas', canal: 6, andar: 'copas', prueba: true },
  { id: 'prueba-agua-7', nombre: 'De prueba · por el agua 7', canal: 7, andar: 'rio', prueba: true },
  { id: 'prueba-noche-8', nombre: 'De prueba · de noche', canal: 8, andar: 'noche', prueba: true },
  { id: 'prueba-quieto-9', nombre: 'De prueba · quieto 9', canal: 9, andar: 'quieto', prueba: true }
];
export const andarValido = (a) => Object.prototype.hasOwnProperty.call(ANDARES, a);
export const MAX_NOMBRE_VECINO = 40;

/**
 * Los datos que la Consola guarda de un vecino (las mismas claves que exige firestore.rules).
 * El nombre lo dice la niña o el niño y el adulto lo copia tal cual: solo se recortan los espacios.
 */
export function datosDeVecino({ nombre, canal, andar }) {
  const n = String(nombre || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NOMBRE_VECINO);
  if (!n) throw new Error('El vecino necesita un nombre.');
  const c = Number(canal);
  if (!Number.isInteger(c) || c < 1 || c > 9) throw new Error('El canal va del 1 al 9.');
  if (!andarValido(andar)) throw new Error('Elijan un andar de la lista.');
  return { nombre: n, canal: c, andar };
}
