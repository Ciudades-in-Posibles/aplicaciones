// Service worker de baja. Los navegadores que instalaron la PWA vieja de este sitio reciben este
// archivo al buscar actualización: se activa de inmediato, borra las cachés, se da de baja y
// recarga las pestañas abiertas para que vean la página de aviso. No intercepta ninguna petición.
// Cada paso va envuelto para que un fallo no impida los demás.

self.addEventListener('install', () => {
  try { self.skipWaiting(); } catch { /* sigue */ }
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    try {
      const nombres = await caches.keys();
      await Promise.all(nombres.map((n) => caches.delete(n).catch(() => false)));
    } catch { /* sigue */ }

    try {
      await self.registration.unregister();
    } catch { /* sigue */ }

    try {
      const ventanas = await self.clients.matchAll({ type: 'window' });
      await Promise.all(ventanas.map(async (ventana) => {
        try { await ventana.navigate(ventana.url); } catch { /* sigue */ }
      }));
    } catch { /* sigue */ }
  })());
});
