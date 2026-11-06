/**
 * Código QR como matriz de módulos, sin dibujo (lo dibuja quien lo usa: el ticket térmico de la mesa).
 * Usa qrcode-generator (MIT), con corrección de errores M y la versión más chica que alcance.
 */
import qrcode from 'qrcode-generator';

export const ZONA_SILENCIO = 4; // módulos en blanco alrededor, lo que pide la norma

/** @returns {{tam: number, oscuro: (x: number, y: number) => boolean}} */
export function matrizQR(texto) {
  const qr = qrcode(0, 'M');
  qr.addData(String(texto));
  qr.make();
  const tam = qr.getModuleCount();
  return { tam, oscuro: (x, y) => qr.isDark(y, x) };
}

/** El módulo más grande, en puntos enteros, con el que el QR y su zona de silencio caben en `ancho`. */
export function moduloQR(tam, ancho) {
  return Math.floor(ancho / (tam + 2 * ZONA_SILENCIO));
}
