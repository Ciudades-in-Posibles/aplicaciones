/**
 * Ticket de la mesa para la PeriPage A6 (384 puntos, 48 mm): el QR que abre el Transmisor con el
 * código puesto, el código en grande y el enlace en texto, para quien no pueda escanear.
 * El QR va en negro puro con módulos de puntos enteros, sin difuminado: así se lee bien en el papel.
 */
import { ANCHO_TERMICA, difuminar, bytesPeriPage, partirLineas } from '../../comun/dominio/termica.js';
import { matrizQR, moduloQR, ZONA_SILENCIO } from '../../comun/dominio/qr.js';
import { urlDeMesa, TRANSMISOR, normalizarCodigo } from '../../comun/dominio/mesa.js';
import { ALTO_CORTE, fuentes, nuevoLienzo, grisesDe, bitsAPng, marcasDeCorte } from './cartaTermica.js';

const W = ANCHO_TERMICA;
const M = 12;
const ALTO_MAX = 1200; // se dibuja en un lienzo alto y se imprime solo hasta donde llega
const F = '"Gabarito", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

/** El enlace en líneas que caben, cortado por sus partes (no a mitad de palabra). */
function lineasDelEnlace(codigo, ancho, medir) {
  const host = TRANSMISOR.replace(/^https:\/\//, '');
  const partes = ['https://', ...host.split(/(?<=\.)/), '/?mesa=', codigo];
  const lineas = [];
  let actual = '';
  for (const p of partes) {
    if (actual && medir(actual + p) > ancho) { lineas.push(actual); actual = p; } else actual += p;
  }
  if (actual) lineas.push(actual);
  return lineas.flatMap((l) => partirLineas(l, ancho, medir));
}

/** El tamaño de letra más grande, desde `desde`, con el que `texto` cabe en `ancho`. */
function ajustar(ctx, texto, peso, desde, ancho) {
  let t = desde;
  ctx.font = `${peso} ${t}px ${F}`;
  while (t > 20 && ctx.measureText(texto).width > ancho) { t -= 2; ctx.font = `${peso} ${t}px ${F}`; }
  return t;
}

/** Dibuja el ticket y devuelve sus grises (0 = negro), fila tras fila, con su alto. */
export async function dibujarQR(mesa) {
  await fuentes();
  const codigo = normalizarCodigo(mesa.id);
  const ctx = nuevoLienzo(ALTO_MAX);
  ctx.textBaseline = 'alphabetic';
  const ancho = W - 2 * M;
  let y = 30;

  ctx.font = `500 18px ${MONO}`;
  const medirMono = (s) => ctx.measureText(s).width;
  for (const l of partirLineas('Ciudades(In)Posibles · Transmisor', ancho, medirMono, 2)) { ctx.fillText(l, M, y); y += 24; }

  if (mesa.nombre && normalizarCodigo(mesa.nombre) !== codigo) {
    y += 8;
    ctx.font = `700 26px ${F}`;
    for (const l of partirLineas(mesa.nombre, ancho, (s) => ctx.measureText(s).width, 2)) { ctx.fillText(l, M, y); y += 30; }
    y -= 6;
  }
  ctx.fillRect(0, y, W, 6);
  y += 6;

  // QR centrado, con su zona de silencio
  const m = matrizQR(urlDeMesa(codigo));
  const mod = moduloQR(m.tam, W);
  const lado = m.tam * mod;
  const x0 = Math.floor((W - lado) / 2);
  const y0 = y + ZONA_SILENCIO * mod;
  for (let fy = 0; fy < m.tam; fy++) {
    for (let fx = 0; fx < m.tam; fx++) if (m.oscuro(fx, fy)) ctx.fillRect(x0 + fx * mod, y0 + fy * mod, mod, mod);
  }
  y = y0 + lado + ZONA_SILENCIO * mod - 6;

  ctx.font = `500 18px ${MONO}`;
  ctx.fillText('Código de mesa', M, y);
  const t = ajustar(ctx, codigo, 900, 72, ancho);
  y += t * 0.95;
  ctx.fillText(codigo, M, y);
  y += 32;

  ctx.font = `500 18px ${MONO}`;
  for (const l of lineasDelEnlace(codigo, ancho, medirMono)) { ctx.fillText(l, M, y); y += 24; }
  y = Math.ceil(y - 10);

  marcasDeCorte(ctx, y);
  const alto = y + ALTO_CORTE;
  return { gris: grisesDe(ctx, alto), alto };
}

/** Vista previa en 1 bit y bytes para la impresora, como prepararCarta. */
export async function prepararQR(mesa, { concentracion = 1 } = {}) {
  const { gris, alto } = await dibujarQR(mesa);
  const bits = difuminar(gris, W, alto);
  return { vista: bitsAPng(bits, alto), bytes: bytesPeriPage(bits, alto, { concentracion }) };
}
