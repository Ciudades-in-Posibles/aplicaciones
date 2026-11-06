import { useEffect, useMemo, useRef, useState } from 'react';
import { CELDAS, CELDA_BIBLIOTECA, CENTRO, etiquetas, enZona } from '../comun/dominio/zona.js';
import { rastrosDelVecino, recorridoDelDia, casaDe, inicioDelDia, ANDARES, VECINOS_DE_PRUEBA } from '../comun/dominio/vecinos.js';
import { dibujarCeldas, centroDe, viewBox, teselas, trazo, proyeccion } from '../comun/dominio/mapa.js';
import { MAPA_BASE } from './mapaBase.js';
import { CANALES } from '../comun/dominio/canales.js';

const TIC_MS = 15000;
const CUADRO_MS = 100; // en el repaso el reloj avanza 10 veces por segundo
const VELOCIDADES = [60, 300]; // ×60: el día en 24 min · ×300: en unos 5 min
const SALTO_MS = 10 * 60 * 1000; // ← y → mueven el reloj 10 minutos
const HORA = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const FONDOS = [['no', 'No'], ['dibujado', 'Dibujado'], ['osm', 'OSM']];
const CLAVE_FONDO = 'transmisor-rastros-fondo';
const CLAVE_VECINOS = 'transmisor-rastros-vecinos';
const MARGEN_VISTA = 16; // metros alrededor de la zona
// metros de mapa más allá de la vista, para que llene la pantalla: la zona es angosta y la pantalla ancha
const MARGEN_FONDO = { x: 360, y: 160 };
const NOMBRADAS = ['primary', 'secondary', 'tertiary'];

function fondoGuardado() {
  try {
    const f = localStorage.getItem(CLAVE_FONDO);
    return FONDOS.some(([k]) => k === f) ? f : 'no';
  } catch {
    return 'no';
  }
}

/** Una etiqueta por nombre de vía mayor: en la mitad de su tramo más largo, girada con el tramo. */
function etiquetasDeVias(vias, centro) {
  const p = proyeccion(centro);
  const mejor = {};
  for (const v of vias) {
    if (!v.nombre || !NOMBRADAS.includes(v.tipo)) continue;
    for (let i = 0; i < v.pts.length - 1; i++) {
      const a = p(...v.pts[i]);
      const b = p(...v.pts[i + 1]);
      const largo = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (largo > (mejor[v.nombre]?.largo || 0)) mejor[v.nombre] = { largo, a, b };
    }
  }
  return Object.entries(mejor).filter(([, m]) => m.largo > 40).map(([nombre, { a, b }]) => {
    let ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    if (ang > 90) ang -= 180;
    if (ang < -90) ang += 180;
    return { nombre, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, ang };
  });
}

/** El mapa dibujado con los datos de OpenStreetMap (src/visor/mapaBase.js). */
function MapaDibujado() {
  const capas = useMemo(() => ({
    parque: trazo(MAPA_BASE.parque, CENTRO),
    prado: MAPA_BASE.prado.map((l) => trazo(l, CENTRO)),
    arboles: MAPA_BASE.arboles.map((l) => trazo(l, CENTRO)),
    agua: MAPA_BASE.agua.map((l) => trazo(l, CENTRO)),
    edificios: MAPA_BASE.edificios.map((l) => trazo(l, CENTRO)),
    caminos: MAPA_BASE.caminos.map((c) => ({ tipo: c.tipo, pts: trazo(c.pts, CENTRO) })),
    vias: MAPA_BASE.vias.map((v) => ({ tipo: v.tipo, pts: trazo(v.pts, CENTRO) })),
    nombres: etiquetasDeVias(MAPA_BASE.vias, CENTRO)
  }), []);
  return (
    <g className="base" aria-hidden="true">
      <polygon className="parque" points={capas.parque} />
      {capas.prado.map((pts, i) => <polygon key={`p${i}`} className="prado" points={pts} />)}
      {capas.arboles.map((pts, i) => <polygon key={`a${i}`} className="arb" points={pts} />)}
      {capas.agua.map((pts, i) => <polyline key={`w${i}`} className="agua" points={pts} />)}
      {capas.edificios.map((pts, i) => <polygon key={`e${i}`} className="edif" points={pts} />)}
      {capas.caminos.map((c, i) => <polyline key={`c${i}`} className={`camino ${c.tipo}`} points={c.pts} />)}
      {capas.vias.map((v, i) => <polyline key={`v${i}`} className={`via ${v.tipo}`} points={v.pts} />)}
      {capas.nombres.map((n) => (
        <text key={n.nombre} className="nombre-via" transform={`translate(${n.x.toFixed(1)},${n.y.toFixed(1)}) rotate(${n.ang.toFixed(1)})`} dy="3">{n.nombre}</text>
      ))}
    </g>
  );
}

/** Las teselas de OpenStreetMap (tile.openstreetmap.org), en gris. Sin red, no cargan y no pasa nada. */
function Teselas({ caja }) {
  const lista = useMemo(() => teselas(caja, CENTRO, 18), [caja]);
  return (
    <g className="teselas" aria-hidden="true">
      {lista.map((t) => (
        <image key={`${t.x}/${t.y}`} href={t.url} x={t.rect.x.toFixed(2)} y={t.rect.y.toFixed(2)} width={(t.rect.ancho + 0.5).toFixed(2)} height={(t.rect.alto + 0.5).toFixed(2)} preserveAspectRatio="none" />
      ))}
    </g>
  );
}

/** «Cada 10 min» o, para el andar de noche, «17:30–6:00, cada 5 min». */
function ritmo(andar) {
  const a = ANDARES[andar];
  if (!a) return '';
  const paso = `cada ${a.pasoMin} min`;
  return a.noche ? `17:30–6:00, ${paso}` : paso;
}

/**
 * El reloj del mapa. «Ahora» va en vivo (un tic cada 15 s). El repaso corre el día desde las 6:00
 * a ×60 o ×300, o queda quieto donde lo deja el deslizador; al alcanzar la hora real vuelve a vivo.
 */
function useReloj() {
  const [ahora, setAhora] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), TIC_MS);
    return () => clearInterval(id);
  }, []);
  const [repaso, setRepaso] = useState(null); // null = en vivo; si no, el instante que se ve
  const [corre, setCorre] = useState(false);
  const [velocidad, setVelocidad] = useState(VELOCIDADES[0]);

  const enRepaso = repaso !== null;
  useEffect(() => {
    if (!enRepaso || !corre) return undefined;
    const id = setInterval(() => setRepaso((r) => (r === null ? r : Math.min(r + CUADRO_MS * velocidad, Date.now()))), CUADRO_MS);
    return () => clearInterval(id);
  }, [enRepaso, corre, velocidad]);
  // el repaso que alcanza la hora real vuelve a vivo
  useEffect(() => {
    if (enRepaso && repaso >= Date.now() - 1000) { setRepaso(null); setCorre(false); }
  }, [enRepaso, repaso]);

  const desde = inicioDelDia(ahora);
  const ir = (t) => { const n = Math.max(desde, Math.min(Date.now(), t)); setRepaso(n >= Date.now() - 1000 ? null : n); };
  return {
    t: repaso ?? ahora,
    enVivo: repaso === null,
    corre,
    velocidad,
    desde,
    ahora,
    repasar: () => { setRepaso(desde); setCorre(true); },
    alternar: () => { if (repaso === null) { setRepaso(desde); setCorre(true); } else setCorre((c) => !c); },
    vivo: () => { setRepaso(null); setCorre(false); },
    ir: (t) => { setCorre(false); ir(t); },
    mover: (dt) => { setCorre(false); ir((repaso ?? Date.now()) + dt); },
    setVelocidad
  };
}

function Reloj({ reloj }) {
  const { t, enVivo, corre, velocidad, desde, ahora } = reloj;
  return (
    <div className="reloj-r" role="group" aria-label="Reloj del mapa (espacio, ← →, A)">
      <div className="reloj-fila">
        <output className="reloj-hora" aria-live="off">{HORA.format(t)}</output>
        <span className="reloj-modo">{enVivo ? 'En vivo' : corre ? `Repaso ×${velocidad}` : 'Repaso en pausa'}</span>
      </div>
      <input
        type="range" min={desde} max={ahora} step={60000} value={Math.min(t, ahora)}
        aria-label="Hora del día del juego" aria-valuetext={HORA.format(t)}
        onChange={(e) => reloj.ir(Number(e.target.value))}
      />
      <div className="reloj-fila">
        <span>6:00</span>
        <span>{HORA.format(ahora)}</span>
      </div>
      <div className="fondo-r">
        {enVivo
          ? <button onClick={reloj.repasar}>Repasar el día</button>
          : <button onClick={reloj.alternar} aria-label={corre ? 'Pausar' : 'Seguir'}>{corre ? '❚❚ Pausa' : '▶ Seguir'}</button>}
        {VELOCIDADES.map((v) => (
          <button key={v} className={velocidad === v ? 'on' : ''} aria-pressed={velocidad === v} onClick={() => reloj.setVelocidad(v)}>×{v}</button>
        ))}
        <button className={enVivo ? 'on' : ''} aria-pressed={enVivo} onClick={reloj.vivo}>Ahora</button>
      </div>
    </div>
  );
}

/**
 * Mapa de rastros (visor…/rastros): la zona en hexágonos H3 alrededor de la biblioteca, los senderos
 * de los vecinos (sus rastros, que se desvanecen) y las tomas que salieron al aire desde un rastro,
 * cada una en su celda. Un vecino con al menos una toma al aire tiene escaño.
 */
export default function Rastros({ vecinos: vecinosMesa, senales }) {
  // una mesa sin vecinos muestra los de prueba, como la Antena
  const dePrueba = vecinosMesa.length === 0;
  const vecinos = dePrueba ? VECINOS_DE_PRUEBA : vecinosMesa;
  const reloj = useReloj();
  const { t } = reloj;
  const [seguido, setSeguido] = useState(null);
  const seguir = (id) => setSeguido((s) => (s === id ? null : id));
  const teclas = useRef(reloj);
  teclas.current = reloj;
  useEffect(() => {
    const tecla = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      if (e.key === ' ' && e.target instanceof HTMLElement && e.target.closest('button')) return; // el botón ya responde al espacio
      const r = teclas.current;
      if (e.key === ' ') { e.preventDefault(); r.alternar(); }
      else if (e.key === 'ArrowLeft') r.mover(-SALTO_MS);
      else if (e.key === 'ArrowRight') r.mover(SALTO_MS);
      else if (e.key === 'a' || e.key === 'A') r.vivo();
      else if (e.key === 'Escape') setSeguido(null);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  const [fondo, setFondo] = useState(fondoGuardado);
  useEffect(() => {
    try { localStorage.setItem(CLAVE_FONDO, fondo); } catch { /* sin almacenamiento: solo dura esta vez */ }
  }, [fondo]);
  // la capa de vecinos (senderos, casa y camino) se puede quitar para ver solo las tomas
  const [conVecinos, setConVecinos] = useState(() => {
    try { return localStorage.getItem(CLAVE_VECINOS) !== 'no'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(CLAVE_VECINOS, conVecinos ? 'si' : 'no'); } catch { /* solo dura esta vez */ }
    if (!conVecinos) setSeguido(null);
  }, [conVecinos]);
  useEffect(() => {
    const tecla = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
      if (e.key === 'v' || e.key === 'V') { setConVecinos((x) => !x); return; }
      if (e.key !== 'm' && e.key !== 'M') return;
      setFondo((f) => FONDOS[(FONDOS.findIndex(([k]) => k === f) + 1) % FONDOS.length][0]);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  const { poligonos, caja } = useMemo(() => dibujarCeldas(CELDAS, CENTRO), []);
  const cajaFondo = useMemo(() => {
    const mx = MARGEN_VISTA + MARGEN_FONDO.x;
    const my = MARGEN_VISTA + MARGEN_FONDO.y;
    return { x: caja.x - mx, y: caja.y - my, ancho: caja.ancho + 2 * mx, alto: caja.alto + 2 * my };
  }, [caja]);
  const bib = useMemo(() => centroDe(CELDA_BIBLIOTECA, CENTRO), []);
  const senderos = useMemo(() => vecinos.map((v) => ({
    v,
    rastros: rastrosDelVecino(v, t).map((r) => ({ ...r, xy: centroDe(r.celda, CENTRO) }))
  })), [vecinos, t]);
  const puntosDe = useMemo(() => Object.fromEntries(poligonos.map((p) => [p.celda, p.puntos])), [poligonos]);
  const vSeguido = vecinos.find((v) => v.id === seguido) || null;
  const camino = useMemo(() => {
    if (!vSeguido) return null;
    const celdas = recorridoDelDia(vSeguido, t);
    return { casa: casaDe(vSeguido), pasos: celdas.length - 1, puntos: celdas.map((c) => centroDe(c, CENTRO).join(',')).join(' ') };
  }, [vSeguido, t]);

  const conRastro = useMemo(() => senales.filter((s) => enZona(s.celda)), [senales]);
  const porVecino = useMemo(() => {
    const m = {};
    for (const s of conRastro) m[s.vecino] = (m[s.vecino] || 0) + 1;
    return m;
  }, [conRastro]);
  // varias tomas en la misma celda se reparten alrededor de su centro
  const fotos = useMemo(() => {
    const vistas = {};
    return conRastro.slice(0, 60).map((s) => {
      const k = vistas[s.celda] = (vistas[s.celda] || 0) + 1;
      const [x, y] = centroDe(s.celda, CENTRO);
      const ang = (k - 1) * 2.4;
      const r = k === 1 ? 0 : 8 + 3 * k;
      return { s, x: x + Math.cos(ang) * r, y: y + Math.sin(ang) * r };
    });
  }, [conRastro]);

  return (
    <div className="rastros">
      <svg className={`mapa-r ${fondo !== 'no' ? 'con-fondo' : ''} ${reloj.enVivo ? '' : 'repaso'} ${vSeguido ? 'siguiendo' : ''}`} viewBox={viewBox(caja, MARGEN_VISTA)} role="img" aria-label="Mapa de rastros alrededor de la Biblioteca El Parque">
        <defs>
          <clipPath id="hex-foto"><polygon points="0,-13 11.3,-6.5 11.3,6.5 0,13 -11.3,6.5 -11.3,-6.5" /></clipPath>
        </defs>
        {fondo === 'dibujado' && <MapaDibujado />}
        {fondo === 'osm' && <Teselas caja={cajaFondo} />}
        <g className="celdas">
          {poligonos.map((p) => {
            const et = etiquetas(p.celda);
            const clase = et.includes('biblioteca') ? 'bib' : et.includes('agua') ? 'agua' : et.includes('cruce') ? 'cruce' : et.includes('arboles') ? 'arb' : et.includes('orilla') ? 'orilla' : '';
            return <polygon key={p.celda} points={p.puntos} className={clase} />;
          })}
        </g>
        {conVecinos && vSeguido && camino && (
          <g className="camino-r" style={{ '--c': `var(--c${vSeguido.canal})` }}>
            <polygon className="casa-r" points={puntosDe[camino.casa]} />
            {camino.pasos > 0 && <polyline className="dia-r" points={camino.puntos} />}
          </g>
        )}
        {conVecinos && senderos.map(({ v, rastros }) => {
          const cabeza = rastros[0];
          return (
            <g key={v.id} className={`vecino-r ${seguido && seguido !== v.id ? 'apagado' : ''}`} style={{ '--c': `var(--c${v.canal})` }}>
              {rastros.length > 1 && <polyline className="sendero" points={rastros.map((r) => r.xy.join(',')).join(' ')} />}
              {rastros.slice(1).map((r) => <circle key={r.celda} className="rastro" cx={r.xy[0]} cy={r.xy[1]} r={3 + 5 * r.intensidad} style={{ opacity: 0.25 + 0.75 * r.intensidad }} />)}
              {cabeza && (
                <g className="cabeza-r" style={{ transform: `translate(${cabeza.xy[0]}px, ${cabeza.xy[1]}px)` }} onClick={() => seguir(v.id)}>
                  <circle className="rastro" r={8} />
                  <text className="num-r" y={3}>{v.canal}</text>
                </g>
              )}
            </g>
          );
        })}
        {fotos.map(({ s, x, y }) => (
          <g key={s.id} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} className="foto-r">
            <image href={s.imagen} x="-13" y="-13" width="26" height="26" preserveAspectRatio="xMidYMid slice" clipPath="url(#hex-foto)" />
            <polygon points="0,-13 11.3,-6.5 11.3,6.5 0,13 -11.3,6.5 -11.3,-6.5" style={{ stroke: `var(--c${s.canal})` }} />
          </g>
        ))}
        <text className="bib-t" x={bib[0]} y={bib[1] - 22}>Biblioteca</text>
      </svg>

      <aside className="leyenda-r">
        <h2>Rastros</h2>
        {conVecinos && dePrueba && <p className="aviso-r">Vecinos de prueba · la mesa todavía no tiene vecinos</p>}
        {conVecinos && <Reloj reloj={reloj} />}
        {conVecinos && <ul>
          {vecinos.map((v) => {
            const c = CANALES[v.canal - 1];
            const on = seguido === v.id;
            return (
              <li key={v.id}>
                <button className={`vecino-l ${on ? 'on' : ''} ${seguido && !on ? 'apagado' : ''}`} aria-pressed={on} onClick={() => seguir(v.id)}>
                  <span className={`k ${v.canal === 9 ? 'k9-t' : ''}`} style={{ background: `var(--c${v.canal})` }}>{v.canal}</span>
                  <span>
                    <b>{v.nombre}</b>
                    <small>{ANDARES[v.andar]?.nombre || ''} · {ritmo(v.andar)} · {c?.nombre}{porVecino[v.id] ? ` · escaño (${porVecino[v.id]})` : ''}{on && camino ? ` · ${camino.pasos === 1 ? '1 paso' : `${camino.pasos} pasos`} hoy` : ''}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>}
        {seguido && <p className="pie-r">Tóquenlo otra vez o Esc para soltarlo</p>}
        <p className="pie-r">{conRastro.length === 1 ? '1 toma' : `${conRastro.length} tomas`} desde un rastro</p>
        <div className="fondo-r" role="group" aria-label="Mapa debajo de los hexágonos (tecla M)">
          <span>Mapa</span>
          {FONDOS.map(([k, etiqueta]) => (
            <button key={k} className={fondo === k ? 'on' : ''} aria-pressed={fondo === k} onClick={() => setFondo(k)}>{etiqueta}</button>
          ))}
        </div>
        <div className="fondo-r" role="group" aria-label="Capa de vecinos (tecla V)">
          <span>Vecinos</span>
          <button className={conVecinos ? 'on' : ''} aria-pressed={conVecinos} onClick={() => setConVecinos(true)}>Sí</button>
          <button className={conVecinos ? '' : 'on'} aria-pressed={!conVecinos} onClick={() => setConVecinos(false)}>No</button>
        </div>
        {fondo === 'dibujado' && <p className="atrib-r">Datos © colaboradores de OpenStreetMap (ODbL)</p>}
        {fondo === 'osm' && <p className="atrib-r">Mapa © colaboradores de OpenStreetMap</p>}
      </aside>
    </div>
  );
}
