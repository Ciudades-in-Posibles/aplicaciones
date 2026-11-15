/**
 * El muro de la mesa: todas las señales al aire, en vivo.
 */

import { collection, doc, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from './firebase.js';
import { mesaAbierta } from '../dominio/mesa.js';

export function escucharMuro(mesa, alCambiar, alFallar = () => {}, base = db) {
  const q = query(collection(base, 'mesas', mesa, 'senales'), orderBy('creada', 'desc'), limit(200));
  return onSnapshot(q, (snap) => {
    alCambiar(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, alFallar);
}

/** Si la mesa está abierta; la Consola la cierra y los visores lo ven al instante. */
export function escucharAbierta(mesa, alCambiar, alFallar = () => {}, base = db) {
  return onSnapshot(doc(base, 'mesas', mesa), (snap) => {
    if (!snap.exists() && snap.metadata.fromCache) return; // la caché aún no la tiene: esperar al servidor
    alCambiar(mesaAbierta(snap.data()));
  }, alFallar);
}

/** El documento de la mesa tal cual (el maletín del Visor lee ahí lo que manda la Consola). */
export function escucharMesa(mesa, alCambiar, alFallar = () => {}, base = db) {
  return onSnapshot(doc(base, 'mesas', mesa), (snap) => {
    if (!snap.exists() && snap.metadata.fromCache) return;
    alCambiar(snap.data() || null);
  }, alFallar);
}

/** Los vecinos de la mesa (los crea la Consola). Su posición se calcula en cada teléfono. */
export function escucharVecinos(mesa, alCambiar, alFallar = () => {}, base = db) {
  return onSnapshot(collection(base, 'mesas', mesa, 'vecinos'), (snap) => {
    alCambiar(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, alFallar);
}
