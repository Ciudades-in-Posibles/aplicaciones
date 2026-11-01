/**
 * Archivo Ucrónico: descarga un .zip con las tomas de la mesa, su CSV y un LEEME.
 * Sigue el patrón del Cronista (exportarPartida.js): jszip se carga solo al exportar.
 *
 *   archivo-ucronico-<MESA>.zip
 *     LEEME.txt
 *     archivo.csv
 *     tomas/<canal>-<nombre>/<codigo>-<equipo>.jpg
 *     tomas/sin-canal/...
 */

import * as red from './red/consola.js';
import { csvDe, dataUrlABytes, filasDelCsv, nombreDelZip, rutasDeTomas, textoLeeme } from '../comun/dominio/archivo.js';

const SIMULTANEAS = 8;

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Lee las respuestas heredadas de cada señal, de a pocas a la vez. */
async function leerTodasLasRespuestas(mesa, senales, alAvanzar) {
  const porSenal = {};
  let siguiente = 0;
  let hechas = 0;
  await Promise.all(Array.from({ length: Math.min(SIMULTANEAS, senales.length) }, async () => {
    while (siguiente < senales.length) {
      const s = senales[siguiente++];
      porSenal[s.id] = await red.leerRespuestas(mesa, s.id);
      alAvanzar(`Leyendo respuestas heredadas · ${++hechas} de ${senales.length}`);
    }
  }));
  return porSenal;
}

/**
 * @param {{id: string, nombre?: string}} mesa
 * @param {(texto: string) => void} [alAvanzar]
 * @returns {Promise<number>} cuántas tomas quedaron en el zip
 */
export async function exportarArchivo(mesa, alAvanzar = () => {}) {
  alAvanzar('Leyendo las tomas de la mesa…');
  const [{ default: JSZip }, senales] = await Promise.all([import('jszip'), red.leerSenales(mesa.id)]);
  const respuestas = await leerTodasLasRespuestas(mesa.id, senales, alAvanzar);
  const rutas = rutasDeTomas(senales);

  const zip = new JSZip();
  zip.file('LEEME.txt', textoLeeme({ mesa: mesa.id, nombre: mesa.nombre, total: senales.length }));
  zip.file('archivo.csv', csvDe(filasDelCsv(mesa.id, senales, rutas, respuestas)));
  senales.forEach((s, i) => {
    if (s.imagen) zip.file(rutas[i], dataUrlABytes(s.imagen));
  });

  alAvanzar(`Comprimiendo ${senales.length} ${senales.length === 1 ? 'toma' : 'tomas'}…`);
  const blob = await zip.generateAsync({ type: 'blob' });
  descargar(blob, nombreDelZip(mesa.id));
  return senales.length;
}
