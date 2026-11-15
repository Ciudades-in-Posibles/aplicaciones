/**
 * Consola: administración de las mesas. Se entra con Google; las reglas solo dejan
 * administrar a los correos del documento admin/consola (firestore.rules, esConsola).
 */

import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch
} from 'firebase/firestore';
import { comprobarClave, limpiarDigitos } from '../../comun/dominio/maletin.js';
import { auth, db } from './firebase.js';
import * as muro from '../../comun/red/muro.js';
import { normalizarCodigo, codigoValido, MAX_NOMBRE_MESA } from '../../comun/dominio/mesa.js';
import { borrarMesaEn } from './borrar.js';

import { datosDeVecino } from '../../comun/dominio/andares.js';

// El muro se lee con la conexión de la Consola, no con la de los equipos.
export const escucharMuro = (mesa, alCambiar, alFallar) => muro.escucharMuro(mesa, alCambiar, alFallar, db);
export const escucharVecinos = (mesa, alCambiar, alFallar) => muro.escucharVecinos(mesa, alCambiar, alFallar, db);

export function escucharSesion(alCambiar) {
  return onAuthStateChanged(auth, alCambiar);
}

export function entrarConGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function salir() {
  return signOut(auth);
}

function lista(q, alCambiar, alFallar) {
  return onSnapshot(q, (snap) => alCambiar(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), alFallar);
}

// sin orderBy: las mesas creadas a mano en la consola de Firebase pueden no tener «creada»
export function escucharMesas(alCambiar, alFallar = () => {}) {
  return lista(collection(db, 'mesas'), (m) => alCambiar(m.sort((a, b) => (b.creada?.seconds || 0) - (a.creada?.seconds || 0))), alFallar);
}

export function escucharEquipos(mesa, alCambiar, alFallar = () => {}) {
  return lista(collection(db, 'mesas', mesa, 'equipos'), alCambiar, alFallar);
}

export function escucharPantallas(mesa, alCambiar, alFallar = () => {}) {
  return lista(collection(db, 'mesas', mesa, 'pantallas'), alCambiar, alFallar);
}

const limpiarNombreMesa = (n) => String(n || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NOMBRE_MESA);

export async function crearMesa(codigoEscrito, nombre) {
  const codigo = normalizarCodigo(codigoEscrito);
  if (!codigoValido(codigo)) throw new Error('El código va de 4 a 16 letras o números.');
  const ref = doc(db, 'mesas', codigo);
  if ((await getDoc(ref)).exists()) throw new Error('Ya hay una mesa con ese código.');
  await setDoc(ref, { nombre: limpiarNombreMesa(nombre) || codigo, abierta: true, creada: serverTimestamp() });
  return codigo;
}

export function cambiarAbierta(mesa, abierta) {
  return updateDoc(doc(db, 'mesas', mesa), { abierta });
}

/**
 * El maletín del Visor (/maletin): manda los dígitos y el Visor los compara con la clave de su enlace.
 * Vacío cierra la tapa (y la clave deja de estar en la mesa). `n` cuenta los envíos.
 */
export async function enviarAlMaletin(mesa, digitos) {
  const d = limpiarDigitos(digitos);
  let abre = false;
  if (d) {
    const c = await getDoc(doc(db, 'admin', 'maletin'));
    if (!c.exists() || !c.data().clave) throw new Error('Falta la clave del maletín (documento admin/maletin, campo «clave»).');
    abre = comprobarClave(d, String(c.data().clave));
  }
  // por campos: si se reemplaza el mapa entero, el contador vuelve a empezar y el Visor no ve el envío
  await updateDoc(doc(db, 'mesas', mesa), { 'maletin.digitos': d, 'maletin.n': increment(1), 'maletin.abre': abre });
  return abre;
}

export function renombrar(mesa, nombre) {
  return updateDoc(doc(db, 'mesas', mesa), { nombre: limpiarNombreMesa(nombre) || mesa });
}

/** Saca una señal del aire junto con sus respuestas (Firestore no borra subcolecciones solo). */
export async function quitarSenal(mesa, id) {
  const respuestas = await getDocs(collection(db, 'mesas', mesa, 'senales', id, 'respuestas'));
  const b = writeBatch(db);
  respuestas.forEach((r) => b.delete(r.ref));
  b.delete(doc(db, 'mesas', mesa, 'senales', id));
  await b.commit();
}

/** Libera el nombre de un equipo: puede volver a unirse (con ese nombre u otro). */
export async function liberarEquipo(mesa, uid, llave) {
  const b = writeBatch(db);
  b.delete(doc(db, 'mesas', mesa, 'equipos', uid));
  if (llave) b.delete(doc(db, 'mesas', mesa, 'nombres', llave));
  await b.commit();
}

/** Todas las señales de la mesa, de la más vieja a la más nueva (el muro solo trae las últimas 200). */
export async function leerSenales(mesa) {
  const snap = await getDocs(query(collection(db, 'mesas', mesa, 'senales'), orderBy('creada', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Las respuestas heredadas de una señal. Ya no se crean; se leen una vez para el Archivo Ucrónico. */
export async function leerRespuestas(mesa, senal) {
  const snap = await getDocs(collection(db, 'mesas', mesa, 'senales', senal, 'respuestas'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Borra la mesa con todo lo que cuelga de ella, en lotes. Se puede repetir si se corta. */
export function borrarMesa(mesa, alAvanzar) {
  return borrarMesaEn(db, mesa, alAvanzar);
}

// ---- vecinos de la mesa (Antena y /rastros) ----

export function crearVecino(mesa, datos) {
  return addDoc(collection(db, 'mesas', mesa, 'vecinos'), { ...datosDeVecino(datos), creado: serverTimestamp() });
}

/** Cambiar el andar o el canal de un vecino lo mueve a otro recorrido desde ese momento. */
export function cambiarVecino(mesa, id, datos, creado) {
  return setDoc(doc(db, 'mesas', mesa, 'vecinos', id), { ...datosDeVecino(datos), creado: creado || serverTimestamp() });
}

export function quitarVecino(mesa, id) {
  return deleteDoc(doc(db, 'mesas', mesa, 'vecinos', id));
}
