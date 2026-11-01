// Pantalla completa: esconde la barra del navegador. Necesita un toque del usuario;
// en iPhone Safari no existe para páginas (ahí sirve instalar la app en la pantalla de inicio).

export function enPantallaCompleta() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export async function pedirPantallaCompleta({ horizontal = false } = {}) {
  const el = document.documentElement;
  const pedir = el.requestFullscreen || el.webkitRequestFullscreen;
  try {
    if (!enPantallaCompleta() && pedir) await pedir.call(el, { navigationUI: 'hide' });
    if (horizontal) await screen.orientation?.lock?.('landscape');
  } catch { /* sin soporte o sin permiso: sigue con la barra */ }
}

export function salirDePantallaCompleta() {
  const salir = document.exitFullscreen || document.webkitExitFullscreen;
  if (enPantallaCompleta() && salir) salir.call(document).catch?.(() => {});
}

export function alternarPantallaCompleta() {
  if (enPantallaCompleta()) salirDePantallaCompleta();
  else pedirPantallaCompleta();
}
