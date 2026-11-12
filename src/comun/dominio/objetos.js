/**
 * Los objetos del maletín: uno por cada canal fijo. Cambian cómo se percibe sin tapar la vista.
 * Cada objeto lleva un QR (urlDeBot en mesa.js) que hace que el equipo siga solo al vecino de ese
 * canal. Decisión de MangleRojo, 12 nov 2026.
 *
 * `silueta` es un recorte plano en una caja de 100 × 100 (se rellena con fill-rule «evenodd»: los
 * huecos son parte del dibujo). De aquí salen la silueta de la Antena y la que se pega en la carta.
 */

export const OBJETOS = [
  {
    canal: 1, nombre: 'Visera corta', uso: 'Sobre la frente: baja la mirada al suelo.',
    silueta: 'M10 30a6 6 0 0 1 6-6h68a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6h-1C80 66 64 80 50 80S20 66 17 46h-1a6 6 0 0 1-6-6Z'
  },
  {
    canal: 2, nombre: 'Orejas', uso: 'Se giran hacia lo que se repite.',
    silueta: 'M10 72a6 6 0 0 1 6-6h3C17 46 22 24 31 13C40 24 45 46 43 66h14C55 46 60 24 69 13C78 24 83 46 81 66h3a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6Z'
  },
  {
    canal: 3, nombre: 'Rendija de mano', uso: 'Se pasa sobre muros y suelo: deja ver solo una franja.',
    silueta: 'M12 26a8 8 0 0 1 8-8h60a8 8 0 0 1 8 8v48a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8ZM27 44h46a6 6 0 0 1 0 12H27a6 6 0 0 1 0-12Z'
  },
  {
    canal: 4, nombre: 'Hocico', uso: 'Lleva la nariz al suelo: se mira lo que toca la punta.',
    silueta: 'M12 22a4 4 0 0 1 5-4L68 35a16 16 0 1 1 0 30L17 82a4 4 0 0 1-5-4ZM81 43a3.5 3.5 0 0 1 0 7a3.5 3.5 0 0 1 0-7Z'
  },
  {
    canal: 5, nombre: 'Marco partido', uso: 'Se pone sobre el límite: una cosa a cada lado.',
    silueta: 'M10 20a8 8 0 0 1 8-8h64a8 8 0 0 1 8 8v60a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8ZM23 25v50h21V25ZM56 25v50h21V25Z'
  },
  {
    canal: 6, nombre: 'Tubo corto', uso: 'Para asomarse a huecos y debajo de las hojas.',
    silueta: 'M24 28h46a16 22 0 0 1 0 44H24a12 22 0 0 1 0-44ZM70 37a8 13 0 0 1 0 26a8 13 0 0 1 0-26Z'
  },
  {
    canal: 7, nombre: 'Cono de escucha', uso: 'Se apunta y se pega a donde sale el sonido.',
    silueta: 'M10 44a4 4 0 0 1 3-4L72 14a14 36 0 0 1 0 72L13 60a4 4 0 0 1-3-4ZM72 26a7 24 0 0 1 0 48a7 24 0 0 1 0-48Z'
  }
];

/** El objeto del canal, o null si el canal no tiene uno (los abiertos, 8 y 9). */
export function objetoDeCanal(canal) {
  return OBJETOS.find((o) => o.canal === canal) || null;
}
