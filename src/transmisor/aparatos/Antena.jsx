import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { latLngToCell, gridDisk, cellToLatLng } from 'h3-js';
import { ZONA, CELDA_BIBLIOTECA, RESOLUCION, enZona, etiquetas } from '../../comun/dominio/zona.js';
import { rastroMasCercano, rumbo, distancia } from '../../comun/dominio/vecinos.js';
import { dibujarCeldas, centroDe, viewBox } from '../../comun/dominio/mapa.js';

const TIC_MS = 10000; // los vecinos dan un paso cada 5 minutos o más: basta con mirar el reloj cada 10 s
const PRECISION_DEBIL = 40; // metros
const RADIO_MAPA = 4; // celdas alrededor del equipo en el mapa del tubo
const CAMPO_VISUAL = 60; // grados que abarca la cámara del teléfono, más o menos

/** La celda pedida en la dirección (?celda=…), para probar sin GPS. */
function celdaDePrueba() {
  const c = new URLSearchParams(location.search).get('celda');
  return c && enZona(c) ? c : null;
}

/** Diferencia de ángulos en (−180, 180]. */
const delta = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;

/**
 * Dónde está el equipo. La ubicación precisa nunca sale del teléfono: solo se usa para saber la celda.
 * @returns {{pos: null | {celda: string, precision: number|null, fuente: 'gps'|'manual'}, fallo: string, marcar: (c: string) => void, usarGps: () => void}}
 */
function useUbicacion(activa) {
  const [gps, setGps] = useState(null);
  const [manual, setManual] = useState(celdaDePrueba);
  const [fallo, setFallo] = useState('');
  useEffect(() => {
    if (!activa || manual) return;
    if (!navigator.geolocation) { setFallo('Este teléfono no da su ubicación.'); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => { setFallo(''); setGps({ celda: latLngToCell(p.coords.latitude, p.coords.longitude, RESOLUCION), precision: p.coords.accuracy, fuente: 'gps' }); },
      (e) => setFallo(e.code === 1 ? 'Sin permiso de ubicación.' : 'No llega la ubicación.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [activa, manual]);
  const pos = manual ? { celda: manual, precision: null, fuente: 'manual' } : gps;
  return { pos, fallo: manual ? '' : fallo, marcar: setManual, usarGps: () => { setManual(null); setGps(null); } };
}

/** Rumbo del teléfono (0 = norte). En iPhone hay que pedir permiso con un toque. */
function useBrujula() {
  const [rumboTel, setRumboTel] = useState(null);
  const [activa, setActiva] = useState(false);
  const suave = useRef(null);
  const disponible = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

  useEffect(() => {
    if (!activa) return;
    const absoluta = 'ondeviceorientationabsolute' in window;
    const evento = absoluta ? 'deviceorientationabsolute' : 'deviceorientation';
    const alGirar = (e) => {
      let h = null;
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading; // iPhone
      else if ((absoluta || e.absolute) && typeof e.alpha === 'number') h = 360 - e.alpha; // Android
      if (h == null) return;
      // la app se usa de lado: se suma el giro de la pantalla
      const giro = screen.orientation?.angle ?? (typeof window.orientation === 'number' ? window.orientation : 0);
      const nuevo = (((h + giro) % 360) + 360) % 360;
      suave.current = suave.current == null ? nuevo : (suave.current + delta(nuevo, suave.current) * 0.25 + 360) % 360;
      setRumboTel(Math.round(suave.current));
    };
    window.addEventListener(evento, alGirar, true);
    return () => window.removeEventListener(evento, alGirar, true);
  }, [activa]);

  const activar = useCallback(async () => {
    try {
      if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
        if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') return false;
      }
      setActiva(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { rumboTel: activa ? rumboTel : null, activa, disponible, activar };
}

/** La cámara en vivo, solo mientras se mira. */
function useCamara(activa) {
  const [flujo, setFlujo] = useState(null);
  const [fallo, setFallo] = useState('');
  useEffect(() => {
    if (!activa) return;
    let s = null;
    let vivo = true;
    if (!navigator.mediaDevices?.getUserMedia) { setFallo('Este navegador no deja usar la cámara en vivo.'); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((st) => { if (!vivo) { st.getTracks().forEach((t) => t.stop()); return; } s = st; setFlujo(st); setFallo(''); })
      .catch(() => setFallo('Sin permiso de cámara.'));
    return () => { vivo = false; s?.getTracks().forEach((t) => t.stop()); setFlujo(null); };
  }, [activa]);
  return { flujo, fallo };
}

/** El rastro: un recorte plano de cartulina con el color y el número del canal. */
function Recorte({ canal, estilo }) {
  return (
    <div className="recorte" style={{ ...estilo, '--c': `var(--c${canal.n})` }} aria-hidden="true">
      <span className={`num ${canal.n === 9 ? 'k9-t' : ''}`}>{canal.n}</span>
    </div>
  );
}

/** Mapa del tubo: las celdas alrededor del equipo, con el norte arriba (o girado con la brújula). */
function MapaTubo({ centro, objetivo, encontrado, rumboTel, flecha, alMarcar, canal, conEquipo = true }) {
  const celdas = useMemo(() => gridDisk(centro, RADIO_MAPA).filter((c) => ZONA[c] !== undefined), [centro]);
  const origen = useMemo(() => { const [lat, lng] = cellToLatLng(centro); return { lat, lng }; }, [centro]);
  const { poligonos } = useMemo(() => dibujarCeldas(celdas, origen), [celdas, origen]);
  const r = 29 * (RADIO_MAPA * 1.75 + 1); // metros que caben del centro al borde
  const vb = viewBox({ x: -r * 4 / 3, y: -r, ancho: (r * 8) / 3, alto: 2 * r }, 0);
  const giro = rumboTel == null ? 0 : -rumboTel;
  const objetivoXY = objetivo && encontrado ? centroDe(objetivo, origen) : null;
  return (
    <svg className="radar" viewBox={vb} role="img" aria-label="Mapa de la zona alrededor de ustedes. Toquen una celda para marcar dónde están.">
      <g transform={`rotate(${giro})`}>
        {poligonos.map((p) => {
          const et = etiquetas(p.celda);
          const clase = p.celda === centro ? 'aqui' : objetivo === p.celda && encontrado ? 'hallado' : et.includes('agua') ? 'agua' : et.includes('cruce') ? 'cruce' : et.includes('biblioteca') ? 'bib' : '';
          return <polygon key={p.celda} points={p.puntos} className={clase} style={clase === 'hallado' ? { fill: `var(--c${canal.n})` } : undefined} onClick={() => alMarcar(p.celda)} />;
        })}
        {objetivoXY && <circle cx={objetivoXY[0]} cy={objetivoXY[1]} r="9" className="punto" />}
      </g>
      {flecha != null && !encontrado && (
        <g className="flecha" transform={`rotate(${flecha})`}>
          <path d="M0,-70 L18,-34 L6,-38 L6,-14 L-6,-14 L-6,-38 L-18,-34 Z" />
        </g>
      )}
      {conEquipo && <circle cx="0" cy="0" r="7" className="equipo" />}
      {rumboTel == null && <text x={r * 4 / 3 - 14} y={-r + 26} className="norte">N</text>}
    </svg>
  );
}

/**
 * Antena: siguen los rastros que dejan los vecinos alrededor de la Biblioteca El Parque.
 * El tubo muestra estática que se aclara al acercarse a un rastro; la flecha da el rumbo.
 * Cerca del rastro aparece el recorte con el color del canal, y «Registrar este rastro»
 * abre la cámara con ese canal. Los vecinos no hablan: solo dejan rastros.
 */
export default function Antena({ vecinos, dePrueba, canales, pausa, alRegistrar }) {
  const [mirar, setMirar] = useState(false);
  const [t, setT] = useState(Date.now);
  useEffect(() => {
    if (pausa) return;
    const id = setInterval(() => setT(Date.now()), TIC_MS);
    return () => clearInterval(id);
  }, [pausa]);

  const { pos, fallo, marcar, usarGps } = useUbicacion(!pausa);
  const brujula = useBrujula();
  const cam = useCamara(mirar && !pausa);
  const video = useRef(null);
  useEffect(() => { if (video.current && cam.flujo) video.current.srcObject = cam.flujo; }, [cam.flujo, mirar]);

  const dentro = pos && enZona(pos.celda);
  const hallazgo = useMemo(() => (dentro && vecinos.length ? rastroMasCercano(pos.celda, vecinos, t) : null), [dentro, pos?.celda, vecinos, t]);
  const encontrado = !!hallazgo?.encontrado;
  const senal = hallazgo?.senal || 0;
  // fuera de la zona, la flecha lleva a la biblioteca
  const destino = dentro ? hallazgo?.celda : pos ? CELDA_BIBLIOTECA : null;
  const rumboDestino = pos && destino && destino !== pos.celda ? rumbo(pos.celda, destino) : null;
  const flecha = rumboDestino == null ? null : brujula.rumboTel == null ? rumboDestino : delta(rumboDestino, brujula.rumboTel);
  const canal = hallazgo ? canales[hallazgo.vecino.canal - 1] : canales[0];
  const lejos = pos && !dentro ? distancia(pos.celda, CELDA_BIBLIOTECA) : null;

  // estática: casi tapa el tubo lejos del rastro y se abre al llegar
  const estatica = encontrado ? 0 : 0.92 - 0.7 * senal;
  const barras = encontrado ? 5 : Math.min(4, Math.ceil(senal * 5)); // la quinta barra, solo al encontrar el rastro

  // en Mirar, el recorte se ubica según el rumbo: centrado si no hay brújula
  const desvio = encontrado && brujula.rumboTel != null && rumboDestino != null ? delta(rumboDestino, brujula.rumboTel) : 0;
  const enCuadro = Math.abs(desvio) <= CAMPO_VISUAL / 2 + 8;
  const xRecorte = 50 + (desvio / CAMPO_VISUAL) * 100;

  return (
    <>
      <div className="principal tv"><div className="cq">
        <div className="antb">
          <div className={`tube antena-tubo ${mirar ? 'mirar' : ''}`} aria-live="polite">
            {mirar && (cam.flujo ? <video ref={video} autoPlay playsInline muted /> : <div className="vacio">{cam.fallo || 'Abriendo la cámara…'}</div>)}
            {!mirar && (pos
              ? <MapaTubo centro={dentro ? pos.celda : CELDA_BIBLIOTECA} conEquipo={dentro} objetivo={hallazgo?.celda} encontrado={encontrado} rumboTel={brujula.rumboTel} flecha={flecha} alMarcar={marcar} canal={canal} />
              : <MapaTubo centro={CELDA_BIBLIOTECA} conEquipo={false} objetivo={null} encontrado={false} rumboTel={null} flecha={null} alMarcar={marcar} canal={canal} />)}
            <div className="ruido sin-senal" style={{ opacity: estatica }} aria-hidden="true" />
            <div className="grano" aria-hidden="true" />
            {encontrado && (!mirar || enCuadro) && (
              <Recorte canal={canal} estilo={mirar ? { left: `${Math.max(12, Math.min(88, xRecorte))}%` } : undefined} />
            )}
            {encontrado && mirar && !enCuadro && (
              <div className={`borde-flecha ${desvio > 0 ? 'der' : 'izq'}`} aria-hidden="true">{desvio > 0 ? '→' : '←'}</div>
            )}
            <div className="hud">
              {hallazgo
                ? <><div className={`n num ${canal.n === 9 ? 'k9-t' : ''}`} style={{ background: `var(--c${canal.n})` }}>{encontrado ? canal.n : '?'}</div>{encontrado && <div className="nm tit">{canal.nombre}</div>}</>
                : <div className="nm tit">Antena</div>}
            </div>
            <div className="dt">{pos ? (pos.fuente === 'manual' ? 'Marcado a mano' : `±${Math.round(pos.precision || 0)} m`) : 'Sin ubicación'}</div>
          </div>
          <div className="ants">
            <div className="barras" role="img" aria-label={`Señal ${barras} de 5`}>
              {[1, 2, 3, 4, 5].map((b) => <i key={b} className={b <= barras ? 'on' : ''} style={{ height: `${20 + b * 16}%` }} />)}
            </div>
            <button className={`btn-a ${mirar ? 'on' : ''}`} onClick={() => setMirar((m) => !m)} aria-pressed={mirar} aria-label={mirar ? 'Volver al mapa' : 'Mirar con la cámara'}>
              {mirar
                ? <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 4 24 9.5v9L14 24 4 18.5v-9Z" fill="none" stroke="currentColor" strokeWidth="2.6" /></svg>
                : <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M2 14s4.5-7 12-7 12 7 12 7-4.5 7-12 7S2 14 2 14Z" fill="none" stroke="currentColor" strokeWidth="2.6" /><circle cx="14" cy="14" r="3.6" fill="currentColor" /></svg>}
            </button>
            {brujula.disponible && (
              <button className={`btn-a ${brujula.activa ? 'on' : ''}`} onClick={brujula.activar} disabled={brujula.activa} aria-label={brujula.activa ? 'Brújula encendida' : 'Encender la brújula'}>
                <svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="10.5" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="m14 6 3.5 8H10.5Z" fill="currentColor" /><path d="m14 22-3.5-8h7Z" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
              </button>
            )}
          </div>
        </div>
      </div></div>

      <div className="lateral">
        {encontrado ? (
          <>
            <p className="lente-lat">{canal.lente}</p>
            <p className="etq">Rastro de «{hallazgo.vecino.nombre}»</p>
            <div className="acciones">
              <button className="btn" onClick={() => alRegistrar({ canal: canal.n, celda: hallazgo.celda, vecino: hallazgo.vecino.id })}>Registrar este rastro</button>
            </div>
          </>
        ) : !vecinos.length ? (
          <p className="aviso">Esta mesa todavía no tiene vecinos.</p>
        ) : !pos ? (
          <p className="aviso">{fallo ? `${fallo} Toquen en el mapa la celda donde están.` : 'Buscando dónde están…'}</p>
        ) : !dentro ? (
          <p className="aviso">Están fuera del parque de juego{Number.isFinite(lejos) ? `, a ${lejos} celdas` : ''}. La flecha lleva a la biblioteca.</p>
        ) : (
          <p className="lente-lat">{senal > 0.6 ? 'Muy cerca.' : senal > 0.25 ? 'Hay señal. Sigan la flecha.' : 'Solo estática. Caminen y miren si se aclara.'}</p>
        )}
        {pos?.fuente === 'gps' && pos.precision > PRECISION_DEBIL && <p className="etq">Ubicación débil: ±{Math.round(pos.precision)} m</p>}
        {pos?.fuente === 'manual' && <button className="enlace etq" onClick={usarGps}>Usar la ubicación del teléfono</button>}
        {dePrueba && <p className="etq">Vecinos de prueba · solo en este teléfono</p>}
        <p className="etq">Cuidado con la orilla y las vías.</p>
      </div>
    </>
  );
}
