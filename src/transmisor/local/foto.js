/**
 * Convierte lo que entrega la cámara en una toma: recorte 4:3 al centro,
 * blanco y negro y JPEG de 960 × 720 (cabe holgado en un documento de Firestore).
 */

export const ANCHO = 960;
export const ALTO = 720;
const CALIDAD = 0.72;

/**
 * @param {CanvasImageSource} fuente video, imagen o bitmap
 * @param {number} w ancho natural de la fuente
 * @param {number} h alto natural de la fuente
 * @returns {string} data URL JPEG
 */
export function tomaDesde(fuente, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // Recorte 4:3 centrado
  let sw = w, sh = (w * 3) / 4;
  if (sh > h) { sh = h; sw = (h * 4) / 3; }
  const sx = (w - sw) / 2, sy = (h - sh) / 2;
  ctx.drawImage(fuente, sx, sy, sw, sh, 0, 0, ANCHO, ALTO);
  // Blanco y negro a mano (Safari no siempre aplica ctx.filter)
  const img = ctx.getImageData(0, 0, ANCHO, ALTO);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = y;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/jpeg', CALIDAD);
}

/** Toma desde un archivo elegido con <input type="file" capture>. */
export async function tomaDesdeArchivo(archivo) {
  const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' }).catch(() => null);
  if (bitmap) return tomaDesde(bitmap, bitmap.width, bitmap.height);
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return tomaDesde(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}
