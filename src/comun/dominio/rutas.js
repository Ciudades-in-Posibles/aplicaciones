/**
 * Qué vista abre cada ruta de la app (una sola app en transmisor.ciudadesinposibles.net).
 * Puro, sin DOM: recibe el `pathname` y devuelve la vista, la página del Visor y, si la ruta
 * es un alias viejo (`/al-aire…`), la ruta canónica bajo `/visor` a la que conviene llevarla.
 */

export const RAIZ_VISOR = '/visor';

const PAGINAS = ['mosaico', 'rastros', 'maletin'];
const ALIAS_VISOR = '/al-aire';

/** Quita las barras repetidas del final: `/visor/` y `/visor` son lo mismo; `/` queda como ''. */
function sinBarraFinal(pathname) {
  return String(pathname || '').replace(/\/+$/, '');
}

/** `resto` es lo que sigue a la raíz del Visor ('' o '/algo'): la página que corresponde. */
function paginaDelVisor(resto) {
  const segmento = resto.slice(1);
  return PAGINAS.includes(segmento) ? segmento : 'tele';
}

/** ¿`ruta` es `base` o está debajo de ella? (`/visores` no cuenta como `/visor`.) */
function cuelgaDe(ruta, base) {
  return ruta === base || ruta.startsWith(`${base}/`);
}

/**
 * @param {string} pathname
 * @returns {{ vista: 'transmisor'|'visor'|'consola', pagina: 'tele'|'mosaico'|'rastros'|'maletin'|null, raiz: string, canonica: string|null }}
 */
export function vistaDeRuta(pathname) {
  const ruta = sinBarraFinal(pathname);
  if (cuelgaDe(ruta, RAIZ_VISOR)) {
    return { vista: 'visor', pagina: paginaDelVisor(ruta.slice(RAIZ_VISOR.length)), raiz: RAIZ_VISOR, canonica: null };
  }
  if (cuelgaDe(ruta, ALIAS_VISOR)) {
    const pagina = paginaDelVisor(ruta.slice(ALIAS_VISOR.length));
    const canonica = pagina === 'tele' ? RAIZ_VISOR : `${RAIZ_VISOR}/${pagina}`;
    return { vista: 'visor', pagina, raiz: RAIZ_VISOR, canonica };
  }
  if (cuelgaDe(ruta, '/consola')) {
    return { vista: 'consola', pagina: null, raiz: RAIZ_VISOR, canonica: null };
  }
  return { vista: 'transmisor', pagina: null, raiz: RAIZ_VISOR, canonica: null };
}
