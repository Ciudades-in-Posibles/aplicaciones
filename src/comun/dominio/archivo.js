/**
 * Archivo Ucrónico de una mesa: las reglas para armar el .zip (carpetas, CSV y LEEME).
 * Funciones puras, sin Firebase ni DOM; quien lee la mesa y descarga el zip vive en consola/archivo.js.
 */

import { canalValido } from './canales.js';

export const COLUMNAS = ['mesa', 'codigo', 'equipo', 'canal', 'canalNombre', 'lente', 'nota', 'descripcion', 'pregunta', 'respuestas', 'hora', 'archivo'];
export const SIN_CANAL_CARPETA = 'sin-canal';
export const BOM = '﻿';

/** Texto apto para nombres de carpeta y de archivo: sin tildes, en minúscula y con guiones. */
export function nombreSeguro(texto, respaldo = 'sin-nombre') {
  const limpio = String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return limpio || respaldo;
}

/** Una fila CSV con comillas dobles en cada valor (las comillas internas se duplican). */
export function filaCsv(valores) {
  return valores.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
}

/** El CSV completo: BOM para que las hojas de cálculo lean bien las tildes, y saltos \r\n. */
export function csvDe(filas) {
  return BOM + filas.map(filaCsv).join('\r\n');
}

/** Fecha en ISO desde un Timestamp de Firestore, un número en milisegundos o una fecha. Vacío si no hay. */
export function aIso(valor) {
  const d = valor?.toDate ? valor.toDate() : typeof valor?.seconds === 'number' ? new Date(valor.seconds * 1000) : valor != null ? new Date(valor) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : '';
}

/** Carpeta de una señal dentro de «tomas/»: «3-grieta», o «sin-canal» si el canal no es válido. */
export function carpetaDeCanal(senal) {
  return canalValido(senal.canal) ? `${senal.canal}-${nombreSeguro(senal.canalNombre, 'canal')}` : SIN_CANAL_CARPETA;
}

/**
 * Ruta del .jpg de cada señal, en el mismo orden: «tomas/<canal>-<nombre>/<codigo>-<equipo>.jpg».
 * Si dos señales caen en la misma ruta, la segunda suma «-2», la tercera «-3», y así.
 */
export function rutasDeTomas(senales) {
  const usadas = new Map();
  return senales.map((s) => {
    const base = `tomas/${carpetaDeCanal(s)}/${nombreSeguro(s.codigo, 'toma')}-${nombreSeguro(s.equipo, 'equipo')}`;
    const n = (usadas.get(base) || 0) + 1;
    usadas.set(base, n);
    return `${base}${n > 1 ? `-${n}` : ''}.jpg`;
  });
}

/** Las respuestas heredadas de una señal, de la más vieja a la más nueva: «equipo: texto | equipo: texto». */
export function respuestasEnTexto(respuestas = []) {
  return [...respuestas]
    .sort((a, b) => (Date.parse(aIso(a.hora)) || 0) - (Date.parse(aIso(b.hora)) || 0))
    .map((r) => `${r.equipo || ''}: ${r.texto || ''}`)
    .join(' | ');
}

/**
 * Las filas del CSV, con el encabezado primero.
 * @param {string} mesa código de la mesa
 * @param {object[]} senales
 * @param {string[]} rutas lo que devuelve rutasDeTomas(senales)
 * @param {Record<string, object[]>} respuestasPorSenal respuestas heredadas, por id de señal
 */
export function filasDelCsv(mesa, senales, rutas, respuestasPorSenal = {}) {
  return [
    COLUMNAS,
    ...senales.map((s, i) => [
      mesa, s.codigo, s.equipo, s.canal, s.canalNombre, s.lente, s.nota, s.descripcion, s.pregunta,
      respuestasEnTexto(respuestasPorSenal[s.id]), aIso(s.hora || s.creada), rutas[i]
    ])
  ];
}

/** Bytes de una data URL en base64 (las tomas son JPEG). */
export function dataUrlABytes(dataUrl) {
  const binario = atob(String(dataUrl).slice(String(dataUrl).indexOf(',') + 1));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export function nombreDelZip(mesa) {
  return `archivo-ucronico-${mesa}.zip`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «31 de octubre de 2026» (hora local). */
export function fechaLarga(fecha) {
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

/** El LEEME.txt del zip, en español claro. */
export function textoLeeme({ mesa, nombre, ahora = new Date(), total = 0 }) {
  return [
    `ARCHIVO UCRÓNICO · ${nombre || mesa}`,
    '',
    `Mesa ${mesa}. Exportado el ${fechaLarga(ahora)}. Trae ${total} ${total === 1 ? 'toma' : 'tomas'}.`,
    '',
    'QUÉ ES',
    'Es la memoria de una mesa de Ciudades(In)Posibles. Reúne las tomas que los equipos mandaron al aire, con lo que escribieron.',
    'Lo custodia la Biblioteca Pública El Parque.',
    '',
    'LO QUE DEBEN SABER',
    '- El Transmisor borra lo que guarda en la red el 11 de febrero de 2027. Esta copia es la que queda.',
    '- El juego no guarda voz (Art. 15). Las notas las escribió cada equipo; la descripción la propuso la app.',
    '- Las tomas pasaron un filtro que descarta las que muestran a alguien reconocible.',
    '',
    'CÓMO SE ORDENA',
    '- tomas/ tiene una carpeta por canal, con el número y el nombre, por ejemplo 3-grieta.',
    '- Las tomas que no traen un canal válido van en tomas/sin-canal/.',
    '- Cada toma es un JPEG en blanco y negro. Se llama con su código y el nombre del equipo, por ejemplo t-04-parque-nacional.jpg.',
    '- archivo.csv tiene una fila por toma. Se abre con cualquier hoja de cálculo.',
    '',
    'LAS COLUMNAS DE ARCHIVO.CSV',
    '- mesa es el código de la mesa.',
    '- codigo es el de la toma dentro de su equipo, por ejemplo T-04.',
    '- equipo es el nombre con que se unió el equipo.',
    '- canal y canalNombre dicen en qué canal salió al aire.',
    '- lente es la consigna del canal.',
    '- nota es lo que el equipo escribió al registrar la toma.',
    '- descripcion es lo que la app vio en la toma.',
    '- pregunta y respuestas vienen de una mecánica que se retiró el 31 de octubre de 2026. Pueden estar vacías. Las respuestas se separan con una barra, así: equipo: texto | equipo: texto.',
    '- hora es el momento en que salió al aire, en formato ISO y hora universal.',
    '- archivo es la ruta de la toma dentro de este zip.',
    ''
  ].join('\r\n');
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «4 nov 2026» para la carta impresa, en hora local. Vacío si no hay fecha. */
export function fechaCorta(valor) {
  const iso = aIso(valor);
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Lo que va en la franja de la carta impresa: la nota del equipo o, si no escribió, la descripción. */
export function textoDeCarta(senal) {
  return String(senal.nota || '').trim() || String(senal.descripcion || '').trim();
}

/** Las señales en hojas de a seis cartas (3 × 2). */
export function enHojas(senales, porHoja = 6) {
  const hojas = [];
  for (let i = 0; i < senales.length; i += porHoja) hojas.push(senales.slice(i, i + porHoja));
  return hojas;
}
