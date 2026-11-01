/**
 * Almacenamiento en el teléfono (IndexedDB). Es la fuente de verdad del equipo.
 * - tomas:   cada toma con su foto (data URL JPEG 4:3 en B/N)
 * - ajustes: clave-valor (equipo, mesa, canal, tira, canales abiertos, contador)
 * - cola:    lo que espera señal para salir
 * - muro:    copia de lo último que se vio en la mesa, para verlo sin señal
 */

import { openDB } from 'idb';

const dbPromesa = openDB('transmisor', 1, {
  upgrade(db) {
    db.createObjectStore('tomas', { keyPath: 'id' });
    db.createObjectStore('ajustes');
    db.createObjectStore('cola', { keyPath: 'id' });
    db.createObjectStore('muro', { keyPath: 'id' });
  }
});

export async function leerAjuste(clave, porDefecto = null) {
  const v = await (await dbPromesa).get('ajustes', clave);
  return v === undefined ? porDefecto : v;
}

export async function guardarAjuste(clave, valor) {
  return (await dbPromesa).put('ajustes', valor, clave);
}

/** Número consecutivo para el código visible de la toma. */
export async function siguienteNumero() {
  const db = await dbPromesa;
  const tx = db.transaction('ajustes', 'readwrite');
  const n = ((await tx.store.get('contador')) || 0) + 1;
  await tx.store.put(n, 'contador');
  await tx.done;
  return n;
}

export async function listarTomas() {
  const tomas = await (await dbPromesa).getAll('tomas');
  return tomas.sort((a, b) => a.creada - b.creada);
}

export async function leerToma(id) {
  return (await dbPromesa).get('tomas', id);
}

export async function guardarToma(toma) {
  return (await dbPromesa).put('tomas', toma);
}

export async function borrarToma(id) {
  return (await dbPromesa).delete('tomas', id);
}

export async function listarCola() {
  return (await dbPromesa).getAll('cola');
}

export async function guardarEnCola(elemento) {
  return (await dbPromesa).put('cola', elemento);
}

export async function sacarDeCola(id) {
  return (await dbPromesa).delete('cola', id);
}

export async function guardarMuro(senales) {
  const db = await dbPromesa;
  const tx = db.transaction('muro', 'readwrite');
  await tx.store.clear();
  for (const s of senales) await tx.store.put(s);
  await tx.done;
}

export async function leerMuro() {
  return (await dbPromesa).getAll('muro');
}

export function nuevoId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
