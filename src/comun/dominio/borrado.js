/**
 * Plan para borrar una mesa entera, sin tocar Firestore.
 * El orden importa. Las respuestas salen antes que sus señales, para que un reintento a medias
 * nunca deje respuestas huérfanas que ya no se puedan encontrar. La mesa va al final.
 */

export const MAX_LOTE = 450;

export const ETAPAS = [
  { id: 'respuestas', texto: 'respuestas' },
  { id: 'senales', texto: 'señales' },
  { id: 'equipos', texto: 'equipos' },
  { id: 'nombres', texto: 'nombres' },
  { id: 'pantallas', texto: 'pantallas' },
  { id: 'mesa', texto: 'la mesa' }
];

/**
 * @param {string} mesa código de la mesa
 * @param {{senales: {id: string, respuestas: string[]}[], equipos: string[], nombres: string[], pantallas: string[]}} contenido
 *   los ids que hay hoy en cada colección
 * @returns {{id: string, texto: string, rutas: string[][]}[]} las seis etapas en orden; cada ruta es el camino de un documento
 */
export function planDeBorrado(mesa, { senales = [], equipos = [], nombres = [], pantallas = [] }) {
  const base = ['mesas', mesa];
  const rutas = {
    respuestas: senales.flatMap((s) => s.respuestas.map((r) => [...base, 'senales', s.id, 'respuestas', r])),
    senales: senales.map((s) => [...base, 'senales', s.id]),
    equipos: equipos.map((id) => [...base, 'equipos', id]),
    nombres: nombres.map((id) => [...base, 'nombres', id]),
    pantallas: pantallas.map((id) => [...base, 'pantallas', id]),
    mesa: [base]
  };
  return ETAPAS.map((e) => ({ ...e, rutas: rutas[e.id] }));
}

/** Parte una lista en lotes de a lo sumo `max` (writeBatch admite 500 operaciones). */
export function enLotes(lista, max = MAX_LOTE) {
  const lotes = [];
  for (let i = 0; i < lista.length; i += max) lotes.push(lista.slice(i, i + max));
  return lotes;
}

/** El aviso de avance: «Borrando señales · 120 de 340». */
export function textoDeAvance(etapa, hechos, total) {
  return `Borrando ${etapa.texto} · ${hechos} de ${total}`;
}
