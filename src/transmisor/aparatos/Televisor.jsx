import { useEffect, useMemo, useState } from 'react';
import { girarDial } from '../../comun/dominio/canales.js';

function hora(s) {
  const t = s?.hora?.toDate ? s.hora.toDate() : new Date(s?.creada || Date.now());
  return t.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const PASO_MS = 5000; // cada cuánto pasa a la siguiente toma del canal

/**
 * Televisor (Sintonizar): el tubo muestra lo que está al aire en el canal (y las tomas que el equipo
 * le asignó y aún no transmite) y va pasando
 * solo de una toma a otra. Las tomas se ven solo dentro del tubo.
 * Pastillas y dial cambian de canal; la «i» abre la carta del canal.
 * El tubo tiene efectos CRT: barrido, parpadeo, franja que rueda y ruido al sintonizar.
 */
export default function Televisor({ canal, canales, muro, pausa, alSintonizar, alAbrirCanal, alAbrirSenal }) {
  const c = canales[canal - 1];
  const delCanal = useMemo(() => muro.filter((s) => s.canal === canal), [muro, canal]);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [canal]);
  useEffect(() => {
    if (pausa || delCanal.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % delCanal.length), PASO_MS);
    return () => clearInterval(t);
  }, [pausa, delCanal.length, canal]);
  const s = delCanal[i % Math.max(delCanal.length, 1)];
  const n = delCanal.length ? (i % delCanal.length) + 1 : 0;

  return (
    <>
      <div className="principal tv"><div className="cq">
        <div className="tvb">
          <button
            className="tube"
            onClick={() => (s ? alAbrirSenal(s) : alAbrirCanal(c))}
            aria-label={s ? `Canal ${c.n}, ${c.nombre}: toma de ${s.equipo}. Abrir carta.` : `Canal ${c.n}, ${c.nombre}, sin señal. Abrir lente.`}
          >
            {/* key: al cambiar de canal o de toma se reinicia la sintonía del tubo */}
            {s && <img key={`${canal}-${s.id}`} className="senal" src={s.imagen} alt="" width="960" height="720" />}
            <div key={`r-${canal}-${s?.id || ''}`} className={`ruido ${s ? '' : 'sin-senal'}`} aria-hidden="true" />
            <div className="grano" aria-hidden="true" />
            <div className="hud">
              <div className={`n num ${c.n === 9 ? 'k9-t' : ''}`} style={{ background: `var(--c${c.n})` }}>{c.n}</div>
              <div className="nm tit">{c.nombre}</div>
            </div>
            <div className="dt">{s ? `${s.equipo} · ${hora(s)}` : '— · —'}</div>
          </button>
          <div className="tvs">
            <div className="pips" role="group" aria-label="Canales">
              {canales.map((k) => (
                <button
                  key={k.n}
                  className={k.n === canal ? 'on' : ''}
                  style={{ background: `var(--c${k.n})` }}
                  onClick={() => alSintonizar(k.n)}
                  aria-label={`Canal ${k.n}, ${k.nombre}`}
                  aria-pressed={k.n === canal}
                />
              ))}
            </div>
            <button className="btn-i" onClick={() => alAbrirCanal(c)} aria-label={`Lente del canal ${c.n}`}>i</button>
            <button
              className="dial"
              style={{ transform: `rotate(${(canal - 1) * 40}deg)` }}
              onClick={() => alSintonizar(girarDial(canal, 1))}
              aria-label="Girar el dial al canal siguiente"
            />
          </div>
        </div>
      </div></div>

      <div className="lateral">
      <p className="lente-lat">{c.lente}</p>
      <p className="etq">
        {delCanal.length ? `Canal ${c.n} · ${n} de ${delCanal.length}` : `Canal ${c.n} · sin señal todavía`}
      </p>
      {s?.aviso && <p className="etq">{s.aviso}</p>}
      </div>
    </>
  );
}
