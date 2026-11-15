import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './comun/estilos/app.css';
import { registerSW } from 'virtual:pwa-register';
import App from './transmisor/App.jsx';
import { vistaDeRuta } from './comun/dominio/rutas.js';

const AlAire = lazy(() => import('./visor/AlAire.jsx'));
const Consola = lazy(() => import('./consola/Consola.jsx'));
const Maletin = lazy(() => import('./visor/Maletin.jsx'));
// Una sola app en transmisor.ciudadesinposibles.net; la ruta elige la vista (ver comun/dominio/rutas.js).
// /visor muestra el televisor; /visor/mosaico, los nueve canales; /visor/rastros, el mapa de los vecinos
// alrededor de la biblioteca; /visor/maletin, el maletín en 3D. /consola es la administración de la mesa.
// /al-aire (el alias viejo) se lleva a su ruta bajo /visor sin perder ?mesa= ni el #clave del maletín.
const { vista, pagina, raiz, canonica } = vistaDeRuta(location.pathname);
if (canonica) history.replaceState(history.state, '', canonica + location.search + location.hash);

// versión nueva: el service worker la toma y la página se recarga sola, apenas se abre.
// El Visor pasa horas proyectando: además revisa cada 10 minutos.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registro) {
    if (registro && vista === 'visor') setInterval(() => registro.update().catch(() => {}), 10 * 60 * 1000);
  }
});

function Raiz() {
  if (vista === 'consola') return <Suspense fallback={null}><Consola /></Suspense>;
  if (vista === 'visor') {
    return (
      <Suspense fallback={null}>
        {pagina === 'maletin' ? <Maletin raiz={raiz} /> : <AlAire mosaico={pagina === 'mosaico'} rastros={pagina === 'rastros'} raiz={raiz} />}
      </Suspense>
    );
  }
  return <App />;
}

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <Raiz />
  </StrictMode>
);
