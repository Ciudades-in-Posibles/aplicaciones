/**
 * Impresiones de una señal para la PeriPage A6 (384 puntos de ancho, 48 mm), en blanco y negro.
 * - carta: 48 × 88 mm. Ficha del canal con su número y nombre, dial 1–9, la toma 4:3 a todo el ancho,
 *   el texto de la carta, el equipo, el código y la fecha.
 * - imagen: solo la toma, horizontal (48 × 36 mm).
 * - imagenGirada: solo la toma girada a lo largo del papel (48 × 64 mm).
 * Debajo de cada una va una franja con marcas de corte para el papel adhesivo.
 */
import { ANCHO_TERMICA, BYTES_POR_FILA, PUNTOS_POR_MM, difuminar, bytesPeriPage, partirLineas } from '../../comun/dominio/termica.js';
import { textoDeCarta, fechaCorta } from '../../comun/dominio/archivo.js';
import { CANALES, canalValido } from '../../comun/dominio/canales.js';

const W = ANCHO_TERMICA;
const ALTO_CARTA = 88 * PUNTOS_POR_MM; // 704
const ALTO_CORTE = 6 * PUNTOS_POR_MM; // franja con marcas de corte
const ALTO = ALTO_CARTA + ALTO_CORTE;
const M = 12; // margen lateral
const F = '"Gabarito", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

async function fuentes() {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all([
    document.fonts.load(`900 80px ${F}`),
    document.fonts.load(`800 34px ${F}`),
    document.fonts.load(`700 26px ${F}`),
    document.fonts.load(`500 18px ${MONO}`)
  ]).catch(() => {});
}

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    if (!src) return resolve(null);
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

function rectRedondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Recorte tipo cover de la foto al rectángulo dado. */
function dibujarFoto(ctx, im, x, y, w, h) {
  const escala = Math.max(w / im.width, h / im.height);
  const sw = w / escala, sh = h / escala;
  ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x, y, w, h);
}

/** Grises de la zona de la foto, con los niveles estirados para que el difuminado no salga lavado. */
function estirarNiveles(gris, desde, hasta) {
  const hist = new Uint32Array(256);
  for (let i = desde; i < hasta; i++) hist[gris[i]]++;
  const n = hasta - desde;
  let acc = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.02) { hi = v; break; } }
  if (hi - lo < 20) return;
  for (let i = desde; i < hasta; i++) {
    const t = Math.min(1, Math.max(0, (gris[i] - lo) / (hi - lo)));
    gris[i] = Math.round(255 * Math.pow(t, 0.85)); // un poco más clara: el calor oscurece
  }
}

export const FORMATOS = [
  ['carta', 'Carta'],
  ['imagen', 'Solo imagen'],
  ['imagenGirada', 'Imagen girada']
];

/** Marcas de corte a los dos lados, a media altura de la franja que empieza en `y`. */
function marcasDeCorte(ctx, y) {
  const yc = y + ALTO_CORTE / 2;
  ctx.fillRect(0, yc - 1, 28, 3);
  ctx.fillRect(W - 28, yc - 1, 28, 3);
}

/** Grises (0 = negro) del lienzo, fila tras fila. */
function grisesDe(ctx, alto) {
  const datos = ctx.getImageData(0, 0, W, alto).data;
  const gris = new Uint8Array(W * alto);
  for (let i = 0, j = 0; i < gris.length; i++, j += 4) {
    gris[i] = Math.round(0.299 * datos[j] + 0.587 * datos[j + 1] + 0.114 * datos[j + 2]);
  }
  return gris;
}

function nuevoLienzo(alto) {
  const lienzo = document.createElement('canvas');
  lienzo.width = W; lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, alto);
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
  return ctx;
}

/** Solo la toma: horizontal (384 × 288) o girada a lo largo (384 × 512). */
export async function dibujarImagen(senal, { girada = false } = {}) {
  const im = await cargarImagen(senal.imagen).catch(() => null);
  if (!im) throw new Error('sin-imagen');
  const ph = girada ? (W * 4) / 3 : (W * 3) / 4;
  const alto = ph + ALTO_CORTE;
  const ctx = nuevoLienzo(alto);
  if (girada) {
    // la toma 4:3 gira -90°: su lado largo queda a lo largo del papel
    ctx.save();
    ctx.translate(0, ph);
    ctx.rotate(-Math.PI / 2);
    dibujarFoto(ctx, im, 0, 0, ph, W);
    ctx.restore();
  } else {
    dibujarFoto(ctx, im, 0, 0, W, ph);
  }
  marcasDeCorte(ctx, ph);
  const gris = grisesDe(ctx, alto);
  estirarNiveles(gris, 0, ph * W);
  return { gris, alto };
}

/** Dibuja la carta y devuelve sus grises (0 = negro), fila tras fila. */
export async function dibujarCarta(senal) {
  await fuentes();
  const n = canalValido(senal.canal) ? senal.canal : 0;
  const nombreCanal = senal.canalNombre || CANALES.find((c) => c.n === n)?.nombre || 'Sin canal';
  const ctx = nuevoLienzo(ALTO);
  ctx.textBaseline = 'alphabetic';

  // Ficha del canal: número grande y nombre, con filete
  const fy = 14, fh = 92;
  ctx.lineWidth = 6;
  rectRedondo(ctx, M + 3, fy + 3, W - 2 * M - 6, fh - 6, [22, 8, 22, 8]);
  ctx.stroke();
  ctx.font = `900 84px ${F}`;
  const num = n ? String(n) : '–';
  ctx.fillText(num, M + 20, fy + fh - 16);
  const xNombre = M + 32 + ctx.measureText(num).width;
  ctx.font = `800 36px ${F}`;
  const nombre = partirLineas(nombreCanal, W - M - 20 - xNombre, (s) => ctx.measureText(s).width, 1)[0] || '';
  ctx.fillText(nombre, xNombre, fy + 58);

  // Dial 1–9: el canal de la señal va lleno
  const dy = fy + fh + 12, dh = 34, gap = 5;
  const dw = (W - 2 * M - 8 * gap) / 9;
  ctx.font = `500 18px ${MONO}`; ctx.textAlign = 'center';
  for (let k = 1; k <= 9; k++) {
    const x = M + (k - 1) * (dw + gap);
    rectRedondo(ctx, x + 1.5, dy + 1.5, dw - 3, dh - 3, [7, 3, 7, 3]);
    if (k === n) { ctx.fill(); ctx.fillStyle = '#fff'; } else { ctx.lineWidth = 3; ctx.stroke(); }
    ctx.fillText(String(k), x + dw / 2, dy + dh / 2 + 6);
    ctx.fillStyle = '#000';
  }
  ctx.textAlign = 'left';

  // Toma 4:3 a todo el ancho
  const py = dy + dh + 14, ph = (W * 3) / 4; // 288
  const im = await cargarImagen(senal.imagen).catch(() => null);
  if (im) dibujarFoto(ctx, im, 0, py, W, ph);
  else { ctx.lineWidth = 3; ctx.strokeRect(1.5, py + 1.5, W - 3, ph - 3); }

  // Franja: filete, texto de la carta, equipo, código y fecha
  const ry = py + ph + 8;
  ctx.fillRect(0, ry, W, 6);
  ctx.font = `700 26px ${F}`;
  const lineas = partirLineas(textoDeCarta(senal), W - 2 * M, (s) => ctx.measureText(s).width, 4);
  let y = ry + 38;
  for (const l of lineas) { ctx.fillText(l, M, y); y += 30; }
  ctx.font = `500 18px ${MONO}`;
  const medirMono = (s) => ctx.measureText(s).width;
  const pie = [senal.equipo || '', [senal.codigo, fechaCorta(senal.hora || senal.creada)].filter(Boolean).join(' · ')];
  let yp = ALTO_CARTA - 14 - 26 * (pie.length - 1);
  for (const p of pie) { ctx.fillText(partirLineas(p, W - 2 * M, medirMono, 1)[0] || '', M, yp); yp += 26; }

  marcasDeCorte(ctx, ALTO_CARTA);

  const gris = grisesDe(ctx, ALTO);
  if (im) estirarNiveles(gris, py * W, (py + ph) * W);
  return { gris, alto: ALTO };
}

/** PNG de los bits, para ver la carta tal como saldrá. */
function bitsAPng(bits, alto) {
  const lienzo = document.createElement('canvas');
  lienzo.width = W; lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  const img = ctx.createImageData(W, alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < W; x++) {
      const negro = bits[y * BYTES_POR_FILA + (x >> 3)] & (0x80 >> (x & 7));
      const k = (y * W + x) * 4;
      const v = negro ? 20 : 250;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return lienzo.toDataURL('image/png');
}

/** Todo lo de una impresión: la vista previa en 1 bit y los bytes para la impresora. */
export async function prepararCarta(senal, { concentracion = 1, formato = 'carta' } = {}) {
  const { gris, alto } = formato === 'carta'
    ? await dibujarCarta(senal)
    : await dibujarImagen(senal, { girada: formato === 'imagenGirada' });
  const bits = difuminar(gris, W, alto);
  return { vista: bitsAPng(bits, alto), bytes: bytesPeriPage(bits, alto, { concentracion }) };
}
