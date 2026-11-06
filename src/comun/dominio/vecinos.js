/**
 * Vecinos multiespecie en la zona H3 de la Biblioteca El Parque. Lógica pura, sin red.
 *
 * Los vecinos no hablan ni se presentan: dejan rastros. Cada vecino tiene un canal (la lente con
 * que se registra su rastro) y un andar (cómo se mueve). Su posición sale de una fórmula
 * determinista: todos los teléfonos y el Visor calculan lo mismo con el mismo reloj, sin que el
 * servidor escriba nada.
 *
 * El día del juego empieza a las 6:00 de Bogotá (UTC−5, sin horario de verano). Cada día el
 * vecino sale de su casa (una celda fija que depende de su id) y da un paso cada tantos minutos
 * a una celda vecina de su hábitat.
 */

import { gridDisk, gridDistance, cellToLatLng } from 'h3-js';
import { ZONA, CELDAS, CELDA_BIBLIOTECA, etiquetas } from './zona.js';
import { ANDARES, ANDAR_POR_DEFECTO, andarValido } from './andares.js';

export * from './andares.js';

const MIN = 60 * 1000;
const OFFSET_BOGOTA = -5 * 60 * MIN;
const INICIO_DIA = 6 * 60 * MIN; // 6:00
const DIA = 24 * 60 * MIN;

// celdas de resolución 12 (≈ 11 m de lado, ≈ 19 m de un centro al siguiente)
export const RASTROS_POR_VECINO = 10;
export const DISTANCIA_ENCUENTRO = 2; // a dos celdas o menos (≈ 40 m), el rastro aparece: cubre el error del GPS
export const ALCANCE_SENAL = 12; // más lejos de 12 celdas (≈ 225 m) solo hay estática

// ---- azar con semilla ----

/** Hash FNV-1a de 32 bits. */
export function hash(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Número en [0, 1) que depende solo de la semilla. */
function azar(semilla) {
  let t = (hash(semilla) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---- hábitat ----

/**
 * Límite de los vecinos: no pasan del borde sur del río Arzobispo. Son las celdas a las que se
 * llega a pie desde la biblioteca sin pisar el agua; las celdas de agua forman una barrera continua
 * a lo ancho de la zona. Los equipos sí pueden caminar al norte, pero allí solo hay estática.
 * Vale para todas las mesas (decisión de MangleRojo, 6 nov 2026).
 */
export const CELDAS_DE_VECINOS = (() => {
  const sur = new Set([CELDA_BIBLIOTECA]);
  const pila = [CELDA_BIBLIOTECA];
  while (pila.length) {
    for (const v of gridDisk(pila.pop(), 1)) {
      if (ZONA[v] !== undefined && !etiquetas(v).includes('agua') && !sur.has(v)) { sur.add(v); pila.push(v); }
    }
  }
  return sur;
})();

/**
 * Franja sin rastros alrededor de la biblioteca: las celdas a FRANJA_BIBLIOTECA celdas o menos de
 * cualquier celda de la biblioteca (≈ 38 m). Ningún vecino pasa por ahí, así que desde una celda de
 * la biblioteca nunca se encuentra un rastro (el encuentro es a DISTANCIA_ENCUENTRO = 2); si el GPS
 * del edificio se corre una celda hacia afuera, sí puede aparecer. La Antena muestra señal, para que
 * salgan a buscar.
 * Decisión de MangleRojo, 6 nov 2026.
 */
export const FRANJA_BIBLIOTECA = 2;
const CELDAS_BIBLIOTECA = CELDAS.filter((c) => etiquetas(c).includes('biblioteca'));
export const CELDAS_FRANJA = new Set(CELDAS.filter((c) => CELDAS_BIBLIOTECA.some((b) => distancia(b, c) <= FRANJA_BIBLIOTECA)));

const CELDAS_AGUA = CELDAS.filter((c) => etiquetas(c).includes('agua'));

/** Celdas del lado sur a `n` celdas o menos del agua: la ribera de los andares que siguen el río. */
function ribera(n) {
  return new Set([...CELDAS_DE_VECINOS].filter((c) => CELDAS_AGUA.some((a) => distancia(a, c) <= n)));
}

const cacheHabitat = new Map();

/** Celdas del lado sur, fuera de la franja de la biblioteca, donde puede estar un andar, en orden estable. */
export function habitatDe(andar) {
  if (cacheHabitat.has(andar)) return cacheHabitat.get(andar);
  const a = ANDARES[andar] || ANDARES[ANDAR_POR_DEFECTO];
  const enRibera = a.ribera ? ribera(a.ribera) : null;
  const sur = CELDAS.filter((c) => CELDAS_DE_VECINOS.has(c) && !CELDAS_FRANJA.has(c) && !etiquetas(c).includes('cruce'));
  const celdas = sur.filter((c) => (enRibera ? enRibera.has(c) : etiquetas(c).some((e) => a.habitat.includes(e))));
  const base = celdas.length ? celdas : sur;
  const lista = sinIslasChicas(base, a.salto);
  cacheHabitat.set(andar, lista);
  return lista;
}

const ISLA_MINIMA = 20; // celdas

/**
 * Los cruces parten el hábitat en islas. Cada vecino vive en una, pero en una isla de pocas celdas
 * quedaría casi quieto: se dejan solo las islas de ISLA_MINIMA celdas o más (si no hay, todas).
 */
function sinIslasChicas(celdas, salto) {
  const conjunto = new Set(celdas);
  const visto = new Set();
  const grandes = new Set();
  for (const c of celdas) {
    if (visto.has(c)) continue;
    const isla = [c];
    visto.add(c);
    for (let i = 0; i < isla.length; i++) {
      for (const v of gridDisk(isla[i], salto)) if (conjunto.has(v) && !visto.has(v)) { visto.add(v); isla.push(v); }
    }
    if (isla.length >= ISLA_MINIMA) for (const x of isla) grandes.add(x);
  }
  return grandes.size ? celdas.filter((c) => grandes.has(c)) : celdas;
}

const andarDe = (vecino) => (andarValido(vecino?.andar) ? vecino.andar : ANDAR_POR_DEFECTO);

export const RADIO_CASA = 5; // celdas (≈ 95 m) desde el centro de la biblioteca

const cacheCasas = new Map();

/**
 * Celdas del hábitat donde puede quedar una casa: a RADIO_CASA celdas o menos de la biblioteca.
 * Si el hábitat queda más lejos (la franja deja las primeras celdas a unas 5; la ribera está a unos
 * 280 m), las más cercanas: hasta 2 celdas más allá de la primera. Las casas quedan a 75–115 m.
 */
export function casasPosibles(andar) {
  if (cacheCasas.has(andar)) return cacheCasas.get(andar);
  const habitat = habitatDe(andar);
  const d = new Map(habitat.map((c) => [c, distancia(CELDA_BIBLIOTECA, c)]));
  const dmin = Math.min(...d.values());
  const radio = Math.max(RADIO_CASA, dmin + 2);
  const lista = habitat.filter((c) => d.get(c) <= radio);
  cacheCasas.set(andar, lista);
  return lista;
}

/**
 * La casa del vecino: una celda fija de su hábitat, cerca de la biblioteca, que depende de su id.
 * Así cada día sale desde donde hay señal; a lo largo del día se inclina hacia lo que prefiere.
 */
export function casaDe(vecino) {
  const opciones = casasPosibles(andarDe(vecino));
  return opciones[hash(`casa:${vecino.id}`) % opciones.length];
}

// ---- reloj del juego ----

/** Día del juego (entero) y milisegundos desde las 6:00 de ese día, en hora de Bogotá. */
export function relojDelJuego(t) {
  const local = t + OFFSET_BOGOTA - INICIO_DIA;
  const dia = Math.floor(local / DIA);
  return { dia, desdeInicio: local - dia * DIA };
}

/** Instante (ms) en que empezó el día del juego de t: las 6:00 de Bogotá. */
export function inicioDelDia(t) {
  return t - relojDelJuego(t).desdeInicio;
}

/** Pasos que ya dio el vecino hoy. */
function pasosHoy(a, desdeInicio) {
  const paso = a.pasoMin * MIN;
  if (!a.noche) return Math.floor(desdeInicio / paso);
  const desdeNoche = a.noche.desde - INICIO_DIA; // 17:30 contado desde las 6:00
  return desdeInicio < desdeNoche ? 0 : Math.floor((desdeInicio - desdeNoche) / paso);
}

// ---- recorrido ----

const cacheRecorrido = new Map();

function siguiente(vecino, andar, desde, dia, n) {
  const a = ANDARES[andar];
  const habitat = new Set(habitatDe(andar));
  const opciones = gridDisk(desde, a.salto).filter((c) => habitat.has(c));
  if (!opciones.length) return desde;
  // quedarse pesa 1; moverse pesa 2, o 6 si la celda tiene una etiqueta que prefiere
  const pesos = opciones.map((c) => (c === desde ? 1 : etiquetas(c).some((e) => a.prefiere.includes(e)) ? 6 : 2));
  const total = pesos.reduce((s, p) => s + p, 0);
  let r = azar(`${vecino.id}:${dia}:${n}`) * total;
  for (let i = 0; i < opciones.length; i++) {
    r -= pesos[i];
    if (r < 0) return opciones[i];
  }
  return opciones[opciones.length - 1];
}

/** Las celdas por las que pasó el vecino hoy, desde la casa hasta el paso `pasos` (incluido). */
function recorrido(vecino, dia, pasos) {
  const andar = andarDe(vecino);
  const clave = `${vecino.id}|${andar}|${dia}`;
  let r = cacheRecorrido.get(clave);
  if (!r) {
    if (cacheRecorrido.size > 200) cacheRecorrido.clear();
    r = [casaDe(vecino)];
    cacheRecorrido.set(clave, r);
  }
  while (r.length <= pasos) r.push(siguiente(vecino, andar, r[r.length - 1], dia, r.length));
  return r.slice(0, pasos + 1);
}

/** Celda donde está el vecino en el instante t (ms). */
export function celdaDelVecino(vecino, t) {
  const { dia, desdeInicio } = relojDelJuego(t);
  const r = recorrido(vecino, dia, pasosHoy(ANDARES[andarDe(vecino)], desdeInicio));
  return r[r.length - 1];
}

/** Todo el camino del vecino hoy hasta t: de la casa a donde está, sin repetir celdas seguidas. */
export function recorridoDelDia(vecino, t) {
  const { dia, desdeInicio } = relojDelJuego(t);
  const r = recorrido(vecino, dia, pasosHoy(ANDARES[andarDe(vecino)], desdeInicio));
  return r.filter((c, i) => i === 0 || c !== r[i - 1]);
}

/**
 * Rastros del vecino en t: las últimas celdas distintas por las que pasó, de la más reciente a la
 * más vieja. `intensidad` va de 1 (donde está ahora) a 1/RASTROS_POR_VECINO.
 * @returns {{vecino: string, celda: string, edad: number, intensidad: number}[]}
 */
export function rastrosDelVecino(vecino, t, n = RASTROS_POR_VECINO) {
  const { dia, desdeInicio } = relojDelJuego(t);
  const r = recorrido(vecino, dia, pasosHoy(ANDARES[andarDe(vecino)], desdeInicio));
  const vistas = new Set();
  const out = [];
  for (let i = r.length - 1; i >= 0 && out.length < n; i--) {
    if (vistas.has(r[i])) continue;
    vistas.add(r[i]);
    out.push({ vecino: vecino.id, celda: r[i], edad: out.length, intensidad: 1 - out.length / n });
  }
  return out;
}

// ---- cercanía ----

/** Distancia en celdas; Infinity si no se puede medir. */
export function distancia(a, b) {
  try {
    return gridDistance(a, b);
  } catch {
    return Infinity;
  }
}

/** Qué tan clara se ve la señal (0 = solo estática, 1 = limpia) según la distancia y el rastro. */
export function intensidad(dist, intensidadRastro = 1) {
  if (!Number.isFinite(dist) || dist > ALCANCE_SENAL) return 0;
  const cerca = dist <= DISTANCIA_ENCUENTRO ? 1 : 1 - (dist - DISTANCIA_ENCUENTRO) / (ALCANCE_SENAL - DISTANCIA_ENCUENTRO + 1);
  return Math.max(0, Math.min(1, cerca * (0.55 + 0.45 * intensidadRastro)));
}

/**
 * El rastro más cercano a la celda del equipo, entre todos los vecinos.
 * A igual distancia gana el rastro más fresco.
 * @returns {null | {vecino: object, celda: string, edad: number, intensidad: number, distancia: number, senal: number, encontrado: boolean}}
 */
export function rastroMasCercano(celdaEquipo, vecinos, t) {
  let mejor = null;
  for (const v of vecinos) {
    for (const r of rastrosDelVecino(v, t)) {
      const d = distancia(celdaEquipo, r.celda);
      if (!mejor || d < mejor.distancia || (d === mejor.distancia && r.intensidad > mejor.intensidad)) {
        mejor = { ...r, vecino: v, distancia: d };
      }
    }
  }
  if (!mejor) return null;
  return { ...mejor, senal: intensidad(mejor.distancia, mejor.intensidad), encontrado: mejor.distancia <= DISTANCIA_ENCUENTRO };
}

/** Rumbo en grados (0 = norte, 90 = este) del centro de una celda al de otra. */
export function rumbo(desde, hasta) {
  const [la1, lo1] = cellToLatLng(desde).map((x) => (x * Math.PI) / 180);
  const [la2, lo2] = cellToLatLng(hasta).map((x) => (x * Math.PI) / 180);
  const y = Math.sin(lo2 - lo1) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(lo2 - lo1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export { ZONA, CELDAS };
