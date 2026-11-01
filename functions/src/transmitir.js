/**
 * Núcleo de transmisorTransmitir: comprueba mesa y equipo, aplica el tope, lee la toma
 * con el LLM y escribe la señal. Recibe sus dependencias para poder probarse sin red.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { validarEntrada, EntradaInvalida } from './entrada.js';
import { mensajesLectura, lecturaFalsa, validarLectura } from './lectura.js';
import { contarLectura } from './tope.js';

const yaExiste = (err) => err?.code === 6 || err?.code === 'already-exists' || /ALREADY_EXISTS/.test(err?.message || '');

/**
 * Reserva una lectura del tope del equipo en una transacción.
 * @returns {Promise<boolean>} false si el equipo ya agotó su hora
 */
async function reservarLectura(db, refEquipo, ahoraMs) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(refEquipo);
    const { permitido, lecturas } = contarLectura(snap.data()?.lecturas, ahoraMs);
    if (permitido) tx.update(refEquipo, { lecturas });
    return permitido;
  });
}

/**
 * @param {object} deps
 * @param {import('firebase-admin/firestore').Firestore} deps.db  base «transmisor»
 * @param {string} deps.uid
 * @param {unknown} deps.datos  request.data
 * @param {(mensajes: object[]) => Promise<object>} deps.llamarLLM  devuelve el JSON del modelo
 * @param {boolean} [deps.lecturaFalsa]
 * @param {number} [deps.ahora]
 * @returns {Promise<{estado: 'al-aire', descripcion: string} | {estado: 'rechazada', motivo: string}>}
 */
export async function transmitir({ db, uid, datos, llamarLLM, lecturaFalsa: falsa = false, ahora = Date.now() }) {
  let entrada;
  try {
    entrada = validarEntrada(datos, ahora);
  } catch (err) {
    if (err instanceof EntradaInvalida) throw new HttpsError('invalid-argument', err.message);
    throw err;
  }
  const { mesa, toma, canal } = entrada;

  const refMesa = db.doc(`mesas/${mesa}`);
  const refEquipo = db.doc(`mesas/${mesa}/equipos/${uid}`);
  const refSenal = db.doc(`mesas/${mesa}/senales/${toma.id}`);

  const [snapMesa, snapEquipo] = await Promise.all([refMesa.get(), refEquipo.get()]);
  if (!snapMesa.exists) throw new HttpsError('failed-precondition', 'La mesa no existe.');
  if (snapMesa.data().abierta === false) throw new HttpsError('failed-precondition', 'La mesa está cerrada.');
  if (!snapEquipo.exists) throw new HttpsError('permission-denied', 'Este equipo no está en la mesa.');
  const equipo = snapEquipo.data().nombre;
  if (typeof equipo !== 'string' || !equipo) throw new HttpsError('failed-precondition', 'El equipo no tiene nombre.');

  // idempotencia: un reintento de una toma que ya salió no vuelve a gastar lectura
  const previa = await refSenal.get();
  if (previa.exists) return { estado: 'al-aire', descripcion: previa.data().descripcion || '' };

  if (!(await reservarLectura(db, refEquipo, ahora))) {
    throw new HttpsError('resource-exhausted', 'Este equipo llegó al tope de lecturas por hora. Intenten de nuevo más tarde.');
  }

  let lectura;
  if (falsa) {
    lectura = validarLectura(lecturaFalsa(canal));
  } else {
    let respuesta;
    try {
      respuesta = await llamarLLM(mensajesLectura(canal, toma.imagen));
    } catch (err) {
      console.error('Lectura del Transmisor:', err?.message);
      throw new HttpsError('internal', 'No alcancé a leer esta toma. Intenten de nuevo.');
    }
    lectura = validarLectura(respuesta);
  }
  if (!lectura.ok) {
    if (lectura.tipo === 'invalida') throw new HttpsError('internal', lectura.motivo);
    return { estado: 'rechazada', motivo: lectura.motivo };
  }

  try {
    await refSenal.create({
      uid,
      equipo,
      canal: canal.n,
      canalNombre: canal.nombre,
      lente: canal.lente,
      codigo: toma.codigo,
      nota: toma.nota,
      pregunta: '', // la pregunta se retiró el 31 oct; el campo queda vacío
      descripcion: lectura.descripcion,
      imagen: toma.imagen,
      creada: toma.creada,
      hora: FieldValue.serverTimestamp()
    });
  } catch (err) {
    // otra llamada con el mismo id ganó la carrera: la señal ya está al aire
    if (!yaExiste(err)) throw err;
  }
  return { estado: 'al-aire', descripcion: lectura.descripcion };
}
