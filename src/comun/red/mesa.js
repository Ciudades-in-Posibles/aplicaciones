/**
 * Unirse a la mesa con código y nombre de equipo. Sin correo: auth anónima.
 * El código de mesa es el id del documento; quien no lo sabe no lo encuentra.
 */

import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { normalizarCodigo, codigoValido, limpiarNombreEquipo, llaveNombre, nombreValido, mesaAbierta } from '../dominio/mesa.js';

export async function asegurarSesion() {
  if (auth.currentUser) return auth.currentUser;
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  return (await signInAnonymously(auth)).user;
}

async function leerMesa(codigo) {
  const snap = await getDoc(doc(db, 'mesas', codigo)).catch(() => null);
  return snap?.exists() ? snap.data() : null;
}

async function mesaExiste(codigo) {
  return Boolean(await leerMesa(codigo));
}

/**
 * @returns {Promise<{mesa: string, uid: string, nombre: string}>}
 */
export async function unirseAMesa(codigoEscrito, nombreEscrito) {
  const mesa = normalizarCodigo(codigoEscrito);
  const nombre = limpiarNombreEquipo(nombreEscrito);
  if (!codigoValido(mesa)) throw new Error('Ese código de mesa no tiene la forma de siempre.');
  if (!nombreValido(nombre)) throw new Error('El equipo necesita un nombre de al menos dos letras.');

  const user = await asegurarSesion();
  const datos = await leerMesa(mesa);
  if (!datos) throw new Error('No encuentro esa mesa. Revisen el código.');
  if (!mesaAbierta(datos)) throw new Error('Esta mesa está cerrada por ahora.');

  const llave = llaveNombre(nombre);
  const refEquipo = doc(db, 'mesas', mesa, 'equipos', user.uid);
  const refNombre = doc(db, 'mesas', mesa, 'nombres', llave);

  await runTransaction(db, async (tx) => {
    const yo = await tx.get(refEquipo);
    const otro = await tx.get(refNombre);
    if (otro.exists() && otro.data().uid !== user.uid) {
      throw new Error('Ese nombre ya lo tiene otro equipo de la mesa. Elijan otro.');
    }
    if (yo.exists()) {
      // Mismo teléfono: conserva el nombre con que se unió.
      return;
    }
    tx.set(refNombre, { uid: user.uid });
    tx.set(refEquipo, { nombre, llave, creado: serverTimestamp() });
  });

  const final = (await getDoc(refEquipo)).data();
  return { mesa, uid: user.uid, nombre: final?.nombre || nombre };
}

/**
 * Dónde está el equipo respecto a su mesa, para explicar por qué las reglas niegan algo.
 * @returns {Promise<'ok'|'cerrada'|'fuera'>} fuera: la mesa no existe o la Consola liberó al equipo
 */
export async function estadoEnMesa(mesa) {
  const user = await asegurarSesion();
  const datos = await leerMesa(mesa);
  if (!datos) return 'fuera';
  const yo = await getDoc(doc(db, 'mesas', mesa, 'equipos', user.uid));
  if (!yo.exists()) return 'fuera';
  return mesaAbierta(datos) ? 'ok' : 'cerrada';
}

/** La pantalla de proyección se une sin nombre de equipo. */
export async function unirPantalla(codigoEscrito) {
  const mesa = normalizarCodigo(codigoEscrito);
  if (!codigoValido(mesa)) throw new Error('Ese código de mesa no tiene la forma de siempre.');
  const user = await asegurarSesion();
  if (!(await mesaExiste(mesa))) throw new Error('No encuentro esa mesa.');
  // si esta pantalla ya proyectó esta mesa, su registro sigue ahí y las reglas no dejan reescribirlo
  const ref = doc(db, 'mesas', mesa, 'pantallas', user.uid);
  if (!(await getDoc(ref)).exists()) {
    // dos uniones a la vez (p. ej. al recargar): la segunda escritura cuenta como edición y se niega
    await setDoc(ref, { creada: serverTimestamp() }).catch(async (err) => {
      if (!(await getDoc(ref)).exists()) throw err;
    });
  }
  return { mesa, uid: user.uid };
}
