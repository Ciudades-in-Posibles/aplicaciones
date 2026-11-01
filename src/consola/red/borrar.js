/**
 * Borrado de una mesa entera, en lotes. Recibe la base como parámetro para poder probarlo
 * con el emulador; consola.js lo usa con la base real.
 *
 * El proceso es idempotente: cada vuelta vuelve a listar lo que queda, y borrar lo que ya no está no falla.
 * Si algo se corta, basta con repetirlo.
 */

import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { planDeBorrado, enLotes, textoDeAvance } from '../../comun/dominio/borrado.js';

const SIMULTANEAS = 8;

async function enParalelo(lista, hacer) {
  const salida = new Array(lista.length);
  let siguiente = 0;
  await Promise.all(Array.from({ length: Math.min(SIMULTANEAS, lista.length) }, async () => {
    while (siguiente < lista.length) {
      const i = siguiente++;
      salida[i] = await hacer(lista[i], i);
    }
  }));
  return salida;
}

/** Lista lo que hay hoy en la mesa: ids de señales con sus respuestas, equipos, nombres y pantallas. */
export async function listarContenido(db, mesa) {
  const ids = async (...ruta) => (await getDocs(collection(db, ...ruta))).docs.map((d) => d.id);
  const [senalesIds, equipos, nombres, pantallas] = await Promise.all([
    ids('mesas', mesa, 'senales'), ids('mesas', mesa, 'equipos'), ids('mesas', mesa, 'nombres'), ids('mesas', mesa, 'pantallas')
  ]);
  const respuestas = await enParalelo(senalesIds, (s) => ids('mesas', mesa, 'senales', s, 'respuestas'));
  return { senales: senalesIds.map((id, i) => ({ id, respuestas: respuestas[i] })), equipos, nombres, pantallas };
}

/**
 * Borra la mesa y todo lo que cuelga de ella: respuestas, señales, equipos, nombres, pantallas y la mesa.
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} mesa
 * @param {(avance: {etapa: string, hechos: number, total: number, texto: string}) => void} [alAvanzar]
 */
export async function borrarMesaEn(db, mesa, alAvanzar = () => {}) {
  alAvanzar({ etapa: 'leer', hechos: 0, total: 0, texto: 'Mirando qué hay en la mesa…' });
  const plan = planDeBorrado(mesa, await listarContenido(db, mesa));
  for (const etapa of plan) {
    let hechos = 0;
    alAvanzar({ etapa: etapa.id, hechos, total: etapa.rutas.length, texto: textoDeAvance(etapa, hechos, etapa.rutas.length) });
    for (const lote of enLotes(etapa.rutas)) {
      const b = writeBatch(db);
      lote.forEach((ruta) => b.delete(doc(db, ...ruta)));
      await b.commit();
      hechos += lote.length;
      alAvanzar({ etapa: etapa.id, hechos, total: etapa.rutas.length, texto: textoDeAvance(etapa, hechos, etapa.rutas.length) });
    }
  }
}
