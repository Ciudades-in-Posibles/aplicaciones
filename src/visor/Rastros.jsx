import { useEffect, useMemo, useState } from 'react';
import { CELDAS, CELDA_BIBLIOTECA, CENTRO, etiquetas, enZona } from '../comun/dominio/zona.js';
import { rastrosDelVecino, ANDARES } from '../comun/dominio/vecinos.js';
import { dibujarCeldas, centroDe, viewBox } from '../comun/dominio/mapa.js';
import { CANALES } from '../comun/dominio/canales.js';

const TIC_MS = 15000;

/**
 * Mapa de rastros (visor…/rastros): la zona en hexágonos H3 alrededor de la biblioteca, los senderos
 * de los vecinos (sus rastros, que se desvanecen) y las tomas que salieron al aire desde un rastro,
 * cada una en su celda. Un vecino con al menos una toma al aire tiene escaño.
 */
export default function Rastros({ vecinos, senales }) {
  const [t, setT] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), TIC_MS);
    return () => clearInterval(id);
  }, []);

  const { poligonos, caja } = useMemo(() => dibujarCeldas(CELDAS, CENTRO), []);
  const bib = useMemo(() => centroDe(CELDA_BIBLIOTECA, CENTRO), []);
  const senderos = useMemo(() => vecinos.map((v) => ({
    v,
    rastros: rastrosDelVecino(v, t).map((r) => ({ ...r, xy: centroDe(r.celda, CENTRO) }))
  })), [vecinos, t]);

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
      <svg className="mapa-r" viewBox={viewBox(caja, 16)} role="img" aria-label="Mapa de rastros alrededor de la Biblioteca El Parque">
        <defs>
          <clipPath id="hex-foto"><polygon points="0,-13 11.3,-6.5 11.3,6.5 0,13 -11.3,6.5 -11.3,-6.5" /></clipPath>
        </defs>
        {poligonos.map((p) => {
          const et = etiquetas(p.celda);
          const clase = et.includes('biblioteca') ? 'bib' : et.includes('agua') ? 'agua' : et.includes('cruce') ? 'cruce' : et.includes('arboles') ? 'arb' : et.includes('orilla') ? 'orilla' : '';
          return <polygon key={p.celda} points={p.puntos} className={clase} />;
        })}
        {senderos.map(({ v, rastros }) => (
          <g key={v.id} style={{ '--c': `var(--c${v.canal})` }}>
            {rastros.length > 1 && <polyline className="sendero" points={rastros.map((r) => r.xy.join(',')).join(' ')} />}
            {rastros.map((r) => <circle key={r.celda} className="rastro" cx={r.xy[0]} cy={r.xy[1]} r={3 + 5 * r.intensidad} style={{ opacity: 0.25 + 0.75 * r.intensidad }} />)}
            {rastros[0] && <text className="num-r" x={rastros[0].xy[0]} y={rastros[0].xy[1] + 3}>{v.canal}</text>}
          </g>
        ))}
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
        {vecinos.length === 0 && <p>La mesa todavía no tiene vecinos.</p>}
        <ul>
          {vecinos.map((v) => {
            const c = CANALES[v.canal - 1];
            return (
              <li key={v.id}>
                <span className={`k ${v.canal === 9 ? 'k9-t' : ''}`} style={{ background: `var(--c${v.canal})` }}>{v.canal}</span>
                <span><b>{v.nombre}</b><small>{ANDARES[v.andar]?.nombre || ''} · {c?.nombre}{porVecino[v.id] ? ` · con escaño (${porVecino[v.id]})` : ''}</small></span>
              </li>
            );
          })}
        </ul>
        <p className="pie-r">{conRastro.length === 1 ? '1 toma' : `${conRastro.length} tomas`} desde un rastro</p>
      </aside>
    </div>
  );
}
