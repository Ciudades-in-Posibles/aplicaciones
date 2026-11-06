import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './comun/estilos/app.css';
import { registerSW } from 'virtual:pwa-register';
import App from './transmisor/App.jsx';

const AlAire = lazy(() => import('./visor/AlAire.jsx'));
const Consola = lazy(() => import('./consola/Consola.jsx'));
const Maletin = lazy(() => import('./visor/Maletin.jsx'));
// un mismo build, tres sitios: visor.… (salida al aire), consola.… (administración) y el Transmisor;
// /al-aire y /consola quedan de respaldo. El Visor muestra el televisor; /mosaico, los nueve canales;
// /rastros, el mapa de los vecinos alrededor de la biblioteca; /maletin, el maletín en 3D.
const ruta = location.pathname.replace(/\/$/, '');
const esConsola = location.hostname.startsWith('consola') || ruta === '/consola';
const enVisor = location.hostname.startsWith('visor');
const esPantalla = !esConsola && (enVisor || ruta.startsWith('/al-aire'));
const raizVisor = enVisor ? '' : '/al-aire';
const mosaico = ruta === `${raizVisor}/mosaico`;
const rastros = ruta === `${raizVisor}/rastros`;
const maletin = ruta === `${raizVisor}/maletin`;

// versión nueva: el service worker la toma y la página se recarga sola, apenas se abre.
// El Visor pasa horas proyectando: además revisa cada 10 minutos.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registro) {
    if (registro && esPantalla) setInterval(() => registro.update().catch(() => {}), 10 * 60 * 1000);
  }
});

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    {esConsola ? <Suspense fallback={null}><Consola /></Suspense> : esPantalla ? <Suspense fallback={null}>{maletin ? <Maletin raiz={raizVisor} /> : <AlAire mosaico={mosaico} rastros={rastros} raiz={raizVisor} />}</Suspense> : <App />}
  </StrictMode>
);
