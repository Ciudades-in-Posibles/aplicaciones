/**
 * Impresión térmica para la PeriPage A6 (203 dpi, papel de 57 mm, 384 puntos útiles).
 * Lógica pura: de grises a bits con difuminado y de bits a los bytes que entiende la impresora.
 * Protocolo tomado de la librería peripage-python (reinicio, concentración, GS v 0 y avance).
 */

export const ANCHO_TERMICA = 384;
export const BYTES_POR_FILA = ANCHO_TERMICA / 8;
export const PUNTOS_POR_MM = 8;
export const FILAS_POR_BANDA = 24;

/**
 * Difuminado Floyd–Steinberg.
 * @param {Uint8Array|Uint8ClampedArray|number[]} gris  un valor 0–255 por punto, fila tras fila (0 = negro)
 * @returns {Uint8Array} BYTES_POR_FILA × alto; cada bit en 1 es un punto negro, el más significativo a la izquierda
 */
export function difuminar(gris, ancho, alto) {
  if (ancho !== ANCHO_TERMICA) throw new Error(`El ancho debe ser ${ANCHO_TERMICA}`);
  if (gris.length !== ancho * alto) throw new Error('El tamaño de los grises no coincide');
  const v = Float32Array.from(gris);
  const bits = new Uint8Array(BYTES_POR_FILA * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x;
      const viejo = v[i];
      const negro = viejo < 128;
      if (negro) bits[y * BYTES_POR_FILA + (x >> 3)] |= 0x80 >> (x & 7);
      const err = viejo - (negro ? 0 : 255);
      if (x + 1 < ancho) v[i + 1] += (err * 7) / 16;
      if (y + 1 < alto) {
        if (x > 0) v[i + ancho - 1] += (err * 3) / 16;
        v[i + ancho] += (err * 5) / 16;
        if (x + 1 < ancho) v[i + ancho + 1] += err / 16;
      }
    }
  }
  return bits;
}

const REINICIO = [0x10, 0xff, 0xfe, 0x01, ...new Array(12).fill(0)];
const AVANCE = [0x1b, 0x4a, 0x40];

/** Concentración del calor: 0 clara, 1 media, 2 oscura. */
export function comandoConcentracion(n) {
  const c = Math.max(0, Math.min(2, Math.round(Number(n) || 0)));
  return [0x10, 0xff, 0x10, 0x00, c];
}

/** Cabecera GS v 0 para una banda de `filas` filas de 384 puntos. */
export function cabeceraBanda(filas) {
  return [0x1d, 0x76, 0x30, 0x00, BYTES_POR_FILA & 0xff, BYTES_POR_FILA >> 8, filas & 0xff, filas >> 8];
}

/**
 * Bytes de una impresión completa.
 * @param {Uint8Array} bits  salida de `difuminar`
 * @param {number} alto  filas
 * @param {{concentracion?: number, avance?: boolean}} op
 */
export function bytesPeriPage(bits, alto, { concentracion = 1, avance = true } = {}) {
  if (bits.length !== BYTES_POR_FILA * alto) throw new Error('El tamaño de los bits no coincide');
  const partes = [REINICIO, comandoConcentracion(concentracion)];
  for (let y = 0; y < alto; y += FILAS_POR_BANDA) {
    const filas = Math.min(FILAS_POR_BANDA, alto - y);
    partes.push(cabeceraBanda(filas), bits.subarray(y * BYTES_POR_FILA, (y + filas) * BYTES_POR_FILA));
  }
  if (avance) partes.push(AVANCE);
  const total = partes.reduce((s, p) => s + p.length, 0);
  const salida = new Uint8Array(total);
  let o = 0;
  for (const p of partes) { salida.set(p, o); o += p.length; }
  return salida;
}

/** Corta los bytes en trozos para escribirlos por Bluetooth. */
export function enTrozos(bytes, tam) {
  const trozos = [];
  for (let i = 0; i < bytes.length; i += tam) trozos.push(bytes.subarray(i, i + tam));
  return trozos;
}

/** Parte un texto en líneas que caben en `ancho`, según `medir(texto)`. Corta palabras más largas que la línea. */
export function partirLineas(texto, ancho, medir, maxLineas = Infinity) {
  const palabras = String(texto || '').trim().split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (let p of palabras) {
    while (medir(p) > ancho && p.length > 1) {
      let k = p.length - 1;
      while (k > 1 && medir(p.slice(0, k)) > ancho) k--;
      if (actual) { lineas.push(actual); actual = ''; }
      lineas.push(p.slice(0, k));
      p = p.slice(k);
    }
    const prueba = actual ? `${actual} ${p}` : p;
    if (medir(prueba) <= ancho) actual = prueba;
    else { lineas.push(actual); actual = p; }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maxLineas) {
    const corte = lineas.slice(0, maxLineas);
    let ultima = corte[maxLineas - 1];
    while (ultima && medir(`${ultima}…`) > ancho) ultima = ultima.slice(0, -1);
    corte[maxLineas - 1] = `${ultima.trimEnd()}…`;
    return corte;
  }
  return lineas;
}
