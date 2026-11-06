/**
 * Procesa la cola de salida cuando hay señal:
 *   señal → callable transmisorTransmitir (el servidor lee la toma con el LLM, aplica el filtro
 *           y escribe el documento en mesas/{mesa}/senales)
 * Solo sale lo que el equipo mandó al aire. Las tomas rechazadas no suben.
 */

import { httpsCallable } from 'firebase/functions';
import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db, functions } from '../../comun/red/firebase.js';
import { asegurarSesion, estadoEnMesa } from '../../comun/red/mesa.js';
import { listos, reprogramar, aplazar, clasificarError, ESPERA_CERRADA_MS, ESPERA_TOPE_MS } from '../../comun/dominio/cola.js';
import { ponerAlAire, rechazar } from '../../comun/dominio/toma.js';
import * as local from '../local/db.js';

// functions/ de este repo: lee la toma, aplica el filtro y escribe la señal.
// Responde {estado: 'al-aire', descripcion} o {estado: 'rechazada', motivo}.
const transmitirServidor = httpsCallable(functions, 'transmisorTransmitir', { timeout: 90000 });

function esErrorDeRed(err) {
  const c = err?.code || '';
  return !navigator.onLine || /unavailable|deadline|network|internal/.test(c);
}

async function enviarSenal(elemento, contexto) {
  const toma = await local.leerToma(elemento.ref);
  if (!toma || toma.estado !== 'en-cola') return 'descartar';
  const canal = contexto.canales.find((c) => c.n === toma.canal);
  // el servidor decide el nombre y la lente de los canales fijos; los dos abiertos los escribe el equipo
  const abierto = canal.abierto ? { nombre: canal.nombre, lente: canal.lente } : undefined;
  const res = await transmitirServidor({
    mesa: contexto.mesa,
    toma: {
      id: toma.id, canal: toma.canal, codigo: toma.codigo, nota: toma.nota, imagen: toma.imagen, creada: toma.creada,
      ...(abierto && { abierto }),
      // la celda es la del rastro del vecino, no la ubicación del equipo
      ...(toma.celda && toma.vecino && { celda: toma.celda, vecino: toma.vecino })
    }
  });
  if (res.data?.estado === 'rechazada') {
    await local.guardarToma(rechazar(toma, res.data.motivo || 'Esta toma no sale al aire. Probemos con otra.'));
    return 'rechazada';
  }
  // una lectura previa de versiones anteriores ya no se usa
  const { lecturaPrevia, ...sinPrevia } = toma;
  await local.guardarToma(ponerAlAire(sinPrevia, { descripcion: res.data?.descripcion || '' }));
  return 'al-aire';
}

/**
 * El equipo saca su propia señal del aire, con las respuestas que hubiera recibido antes (Firestore no borra subcolecciones solo).
 * Si la Consola ya la había sacado, no hay nada que borrar.
 */
export async function quitarMiSenal(mesa, id) {
  await asegurarSesion();
  const ref = doc(db, 'mesas', mesa, 'senales', id);
  if (!(await getDoc(ref)).exists()) return;
  const respuestas = await getDocs(collection(ref, 'respuestas'));
  const b = writeBatch(db);
  respuestas.forEach((r) => b.delete(r.ref));
  b.delete(ref);
  await b.commit();
}

let procesando = false;

/** La toma ya no se reintenta: queda rechazada, en la mesa de edición, con su motivo. */
async function dejarRechazada(elemento, motivo) {
  await local.sacarDeCola(elemento.id);
  const toma = await local.leerToma(elemento.ref);
  if (toma?.estado === 'en-cola') await local.guardarToma(rechazar(toma, motivo));
}

/**
 * @param {{mesa: string, uid: string, equipo: string, canales: object[]}} contexto
 * @param {(evento: {tipo: string, ref: string, resultado?: string, error?: string}) => void} avisar
 *   error: 'espera' (sin red o el servidor no pudo), 'cerrada' (la mesa está cerrada),
 *   'fuera' (el equipo ya no está en la mesa), 'tope' (llegó al tope de lecturas por hora),
 *   'no-aceptada' (el servidor no aceptó la toma)
 */
export async function procesarCola(contexto, avisar = () => {}) {
  if (procesando || !contexto?.mesa || !navigator.onLine) return;
  procesando = true;
  try {
    await asegurarSesion();
    const cola = await local.listarCola();
    let estado = null; // se averigua una vez por vuelta, solo si el servidor dice que algo no está en orden
    const pendientes = listos(cola, Date.now());
    for (let i = 0; i < pendientes.length; i++) {
      const e = pendientes[i];
      // un elemento viejo de otro tipo (las respuestas ya no existen) se descarta
      if (e.tipo !== 'senal') { await local.sacarDeCola(e.id); continue; }
      try {
        const resultado = await enviarSenal(e, contexto);
        await local.sacarDeCola(e.id);
        avisar({ tipo: e.tipo, ref: e.ref, resultado });
      } catch (err) {
        console.warn('Cola de salida:', err);
        const clase = clasificarError(err);
        if (clase === 'tope') {
          // el tope es del equipo: todo lo que sigue en esta vuelta toparía igual
          for (const otro of pendientes.slice(i)) if (otro.tipo === 'senal') await local.guardarEnCola(aplazar(otro, Date.now(), ESPERA_TOPE_MS));
          avisar({ tipo: e.tipo, ref: e.ref, error: 'tope' });
          return;
        }
        if (clase === 'invalida') {
          await dejarRechazada(e, err.message || 'La mesa no aceptó esta toma. Revísenla y mándenla otra vez.');
          avisar({ tipo: e.tipo, ref: e.ref, error: 'no-aceptada' });
          continue;
        }
        if (clase === 'revisar-mesa') {
          const permiso = String(err.code).endsWith('permission-denied');
          estado ??= await estadoEnMesa(contexto.mesa).catch(() => 'desconocido');
          if (estado === 'fuera') { avisar({ tipo: e.tipo, ref: e.ref, error: 'fuera' }); return; }
          if (estado === 'cerrada' || (!permiso && estado !== 'ok')) {
            // espera a que la abran, sin gastar lecturas
            await local.guardarEnCola(aplazar(e, Date.now(), ESPERA_CERRADA_MS));
            avisar({ tipo: e.tipo, ref: e.ref, error: 'cerrada' });
            continue;
          }
          if (estado === 'ok' && permiso) {
            // la mesa está abierta y el equipo sigue: el servidor no acepta este elemento
            await dejarRechazada(e, 'La mesa no aceptó esta toma. Revísenla y mándenla otra vez.');
            avisar({ tipo: e.tipo, ref: e.ref, error: 'no-aceptada' });
            continue;
          }
        }
        await local.guardarEnCola(reprogramar(e, Date.now()));
        avisar({ tipo: e.tipo, ref: e.ref, error: esErrorDeRed(err) ? 'espera' : err.message || 'fallo' });
      }
    }
  } finally {
    procesando = false;
  }
}
