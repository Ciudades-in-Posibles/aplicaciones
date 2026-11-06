import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { CANALES, girarDial } from '../comun/dominio/canales.js';
import { normalizarCodigo } from '../comun/dominio/mesa.js';
import { unirPantalla } from '../comun/red/mesa.js';
import { escucharAbierta, escucharMuro, escucharVecinos } from '../comun/red/muro.js';
import { alternarPantallaCompleta, pedirPantallaCompleta } from '../comun/local/pantalla.js';

// el mapa de rastros trae h3-js: se carga solo en /rastros
const Rastros = lazy(() => import('./Rastros.jsx'));

const TIC_MS = 1000; // en cada tic cambia una pantalla: la sintonía recorre el muro como una ola
const FOCO_TICS = 12; // cada cuántos tics el rótulo pasa a otra pantalla

const motivo = (err) => (err.code === 'permission-denied' ? 'Esta pantalla no tiene permiso para ver esa mesa.' : err.message);
const QUIETO_MS = 3000; // sin mover el mouse, se ocultan cursor y controles


/** Pantallas y proyectores: que no se apaguen, y cursor y controles solo al mover el mouse. */
function usePantalla(activa) {
  const [quieto, setQuieto] = useState(false);
  useEffect(() => {
    if (!activa) return;
    let candado = null;
    const pedir = () => navigator.wakeLock?.request('screen').then((c) => { candado = c; }).catch(() => {});
    const alVolver = () => document.visibilityState === 'visible' && pedir();
    pedir();
    document.addEventListener('visibilitychange', alVolver);
    let t = setTimeout(() => setQuieto(true), QUIETO_MS);
    const mover = () => { setQuieto(false); clearTimeout(t); t = setTimeout(() => setQuieto(true), QUIETO_MS); };
    const tecla = (e) => { if (e.key === 'f' || e.key === 'F') alternarPantallaCompleta(); };
    window.addEventListener('pointermove', mover);
    window.addEventListener('keydown', tecla);
    return () => {
      candado?.release().catch(() => {});
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('keydown', tecla);
      clearTimeout(t);
    };
  }, [activa]);
  return quieto;
}

function hora(s) {
  const t = s?.hora?.toDate ? s.hora.toDate() : new Date(s?.creada || Date.now());
  return t.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

/** Una de las nueve pantallas: un canal fijo con su señal del momento, o nieve si no tiene. */
function Pantalla({ c, s, nombre, enFoco, nueva, mayor, alTocar }) {
  return (
    <div
      className={`tb crt pant ${mayor ? 'mayor' : ''} ${enFoco ? 'on' : ''} ${nueva ? 'nueva' : ''}`}
      onClick={alTocar} role={alTocar ? 'button' : undefined} aria-label={alTocar ? `Sintonizar el canal ${c.n}, ${nombre}` : undefined}
    >
      {/* key: cada señal entra con la sintonía y el ruido del tubo */}
      {s && <img key={s.id} className="senal" src={s.imagen} alt={s.descripcion || ''} />}
      <div key={`r-${s?.id || ''}`} className={`ruido ${s ? '' : 'sin-senal'}`} aria-hidden="true" />
      <div className="grano" aria-hidden="true" />
      <div className="hud">
        <span className={`k ${c.n === 9 ? 'k9-t' : ''}`} style={{ background: `var(--c${c.n})` }}>{c.n}</span>
        <span className="nm">{nombre}</span>
      </div>
      <span className="dt">{s ? `${s.equipo} · ${hora(s)}` : 'Sin señal'}</span>
    </div>
  );
}

/** Carta de ajuste en blanco y negro: cuadrícula, escala de grises y círculo. */
function Ajuste({ enTubo }) {
  return (
    <div className={`ajuste ${enTubo ? 'en-tubo' : ''}`} role="alert">
      <div className="rejilla" aria-hidden="true" />
      <div className="circulo" aria-hidden="true">
        <div className="grises">{[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <i key={n} />)}</div>
        <div className="cruz" />
      </div>
      <div className="ruido sin-senal" aria-hidden="true" />
      <div className="aviso-ajuste">
        <p className="tit">No hay transmisión en este momento</p>
        <p>Ciudades(In)Posibles</p>
      </div>
    </div>
  );
}

/** El televisor portátil del sitio (viewBox 400×336): antenas, pantalla, perilla, «i» y parlante. */
function CuerpoTele() {
  return (
    <svg className="svg-tv" viewBox="0 0 400 336" aria-hidden="true" focusable="false">
      <path d="M170 30L118 4M230 30L284 8" stroke="var(--calle)" strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="118" cy="4" r="5" fill="var(--calle)" /><circle cx="284" cy="8" r="5" fill="var(--calle)" />
      <path d="M38,26H380A20,20 0 0 1 400,46V282A40,40 0 0 1 360,322H22A22,22 0 0 1 0,300V64A38,38 0 0 1 38,26Z" fill="var(--calle)" />
      <path d="M40,320H104V326A8,8 0 0 1 96,334H48A8,8 0 0 1 40,326Z" fill="var(--calle)" /><path d="M300,320H364V326A8,8 0 0 1 356,334H308A8,8 0 0 1 300,326Z" fill="var(--calle)" />
      <path d="M38,32H282A14,14 0 0 1 296,46V282A34,34 0 0 1 262,316H22A16,16 0 0 1 6,300V64A32,32 0 0 1 38,32Z" fill="var(--amarillo)" />
      <path d="M316,32H364A30,30 0 0 1 394,62V112A12,12 0 0 1 382,124H318A16,16 0 0 1 302,108V46A14,14 0 0 1 316,32Z" fill="var(--turquesa)" />
      <path d="M314,130H380A14,14 0 0 1 394,144V192A30,30 0 0 1 364,222H314A12,12 0 0 1 302,210V142A12,12 0 0 1 314,130Z" fill="var(--naranja-claro)" />
      <path d="M316,228H382A12,12 0 0 1 394,240V284A32,32 0 0 1 362,316H316A14,14 0 0 1 302,302V242A14,14 0 0 1 316,228Z" fill="var(--lima)" />
      <circle cx="348" cy="78" r="30" fill="var(--calle)" />
      <g stroke="var(--calle)" strokeWidth="4" strokeLinecap="round"><path d="M320 252H376" /><path d="M320 264H376" /><path d="M320 276H376" /><path d="M320 288H376" /><path d="M320 300H376" /></g>
      <path d="M45,44H257A26,26 0 0 1 283,70V220A26,26 0 0 1 257,246H45A26,26 0 0 1 19,220V70A26,26 0 0 1 45,44Z" fill="var(--calle)" />
    </svg>
  );
}

/**
 * El televisor del juego con la pantalla principal adentro; sin emisión, la carta de ajuste.
 * El dial sintoniza un canal (tocar el sintonizado vuelve a Auto); la perilla gira con el canal en pantalla
 * y cada toque pasa al siguiente; la «i» abre y cierra el rótulo.
 */
function Tele({ c, s, nombre, sintonia, alSintonizar, nombreDe, porCanal, sinEmision, conRotulo, alRotulo }) {
  return (
    <figure className="tv-p">
      <CuerpoTele />
      <div className="hueco">
        {sinEmision ? <Ajuste enTubo /> : <Pantalla c={c} s={s} nombre={nombre} mayor />}
      </div>
      <div className="tira-dial">
        <div className="dial-n" role="radiogroup" aria-label="Sintonizar el televisor">
          {CANALES.map((k) => (
            <button
              key={k.n} role="radio" aria-checked={sintonia === k.n} className={`${k.n === c.n ? 'on' : ''} ${porCanal[k.n].length ? '' : 'vacio'}`}
              onClick={() => alSintonizar(sintonia === k.n ? null : k.n)} aria-label={`Canal ${k.n}, ${nombreDe(k)}`}
            >{k.n}</button>
          ))}
        </div>
        <span className="aguja" style={{ '--p': c.n }} aria-hidden="true" />
      </div>
      <button
        className="perilla" style={{ '--ang': `${(c.n - 5) * 30}deg` }}
        onClick={() => alSintonizar(girarDial(c.n, 1))} aria-label={`Girar la perilla al canal ${girarDial(c.n, 1)}`}
      />
      <button className="btn-i" onClick={alRotulo} aria-expanded={conRotulo} aria-label="Información de la señal">i</button>
    </figure>
  );
}

/**
 * Visor: la salida al aire para pantallas y proyectores. A la izquierda la pantalla principal,
 * con su selector de canal; a la derecha el muro de nueve tubos, uno por canal.
 * Cada canal rota sus señales; una señal nueva entra de una vez en su canal.
 * En «Auto» la principal salta entre los canales con señal y sigue a las nuevas.
 * Por defecto la principal va dentro del televisor del juego, y la «i» abre el rótulo al lado;
 * en /mosaico se ve con el muro de los nueve canales.
 */
export default function AlAire({ mosaico = false, rastros = false, raiz = '' }) {
  const [mesa, setMesa] = useState(() => normalizarCodigo(localStorage.getItem('transmisor-pantalla')));
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [senales, setSenales] = useState([]);
  const [abierta, setAbierta] = useState(true);
  const [vecinos, setVecinos] = useState([]);
  const quieto = usePantalla(!!mesa);
  useEffect(() => { document.title = 'Visor · Ciudades(In)Posibles'; }, []);

  useEffect(() => {
    if (!mesa) return;
    let parar = () => {};
    let vivo = true;
    unirPantalla(mesa).then(() => {
      if (!vivo) return;
      const pararMuro = escucharMuro(mesa, (x) => { setSenales(x); setError(''); }, (err) => setError(motivo(err)));
      const pararMesa = escucharAbierta(mesa, setAbierta, (err) => setError(motivo(err)));
      const pararVecinos = rastros ? escucharVecinos(mesa, setVecinos, (err) => setError(motivo(err))) : () => {};
      parar = () => { pararMuro(); pararMesa(); pararVecinos(); };
    }).catch((err) => { setError(motivo(err)); setMesa(''); localStorage.removeItem('transmisor-pantalla'); });
    return () => { vivo = false; parar(); };
  }, [mesa, rastros]);

  // reloj del muro: un tic por segundo; el canal n cambia en los tics que le tocan
  const [tic, setTic] = useState(0);
  useEffect(() => {
    if (!mesa) return;
    const t = setInterval(() => setTic((x) => x + 1), TIC_MS);
    return () => clearInterval(t);
  }, [mesa]);

  const porCanal = useMemo(() => {
    const m = Object.fromEntries(CANALES.map((c) => [c.n, []]));
    for (const x of senales) m[x.canal]?.push(x);
    return m;
  }, [senales]);

  // la señal recién llegada se queda en su canal y en el rótulo hasta su próximo turno
  const [nueva, setNueva] = useState(null);
  const vista = useRef(null);
  useEffect(() => {
    const ultima = senales[0];
    if (!ultima) return;
    // por la hora de creación: si se saca una del aire, la anterior no cuenta como nueva
    if (vista.current && ultima.creada > vista.current) setNueva({ id: ultima.id, canal: ultima.canal, hasta: tic + 9 });
    vista.current = Math.max(vista.current || 0, ultima.creada || 0);
  }, [senales]); // eslint-disable-line react-hooks/exhaustive-deps
  const vigente = nueva && tic < nueva.hasta ? nueva : null;

  function senalDe(n) {
    const lista = porCanal[n];
    if (!lista.length) return null;
    if (vigente?.canal === n) return lista.find((x) => x.id === vigente.id) || lista[0];
    const vuelta = Math.floor(Math.max(tic - (n - 1), 0) / 9);
    return lista[vuelta % lista.length];
  }

  // sintonía de la pantalla principal: un canal fijo, o null para «Auto»
  const [sintonia, setSintonia] = useState(null);
  const [conRotulo, setConRotulo] = useState(false); // en el televisor, el rótulo se abre con la «i»
  useEffect(() => {
    if (!mesa) return;
    // con teclado: 1–9 sintonizan, 0 vuelve a Auto
    const tecla = (e) => { if (/^[0-9]$/.test(e.key)) setSintonia(e.key === '0' ? null : Number(e.key)); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [mesa]);

  const conSenal = CANALES.filter((c) => porCanal[c.n].length).map((c) => c.n);
  const auto = vigente ? vigente.canal : conSenal[Math.floor(tic / FOCO_TICS) % Math.max(conSenal.length, 1)] || 1;
  const foco = sintonia || auto;
  const s = senalDe(foco);

  // los canales abiertos (8 y 9) toman el nombre que traen sus señales
  const nombreDe = (c) => (c.abierto && porCanal[c.n][0]?.canalNombre) || c.nombre;

  if (!mesa) {
    return (
      <main className="entrada">
        <div className="ent-a">
          <div className="pastillas" aria-hidden="true">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <i key={n} style={{ background: `var(--c${n})` }} />)}
          </div>
          <h1 className="wm"><span className="tira">Ciudades<span className="in">(In)</span>Posibles</span><span className="tira sub-t">Visor</span></h1>
        </div>
        <div className="ent-b">
        <p className="lema">La salida al aire de la mesa, para pantallas y proyectores.</p>
        <form onSubmit={(e) => {
          // el código va normalizado: en el teléfono el teclado suele poner minúsculas («Prueba1»)
          e.preventDefault(); setError(''); const m = normalizarCodigo(codigo);
          localStorage.setItem('transmisor-pantalla', m); setMesa(m); pedirPantallaCompleta();
        }}>
          <div className="campo">
            <label htmlFor="cp">Código de mesa</label>
            <input id="cp" autoCapitalize="characters" autoComplete="off" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
          </div>
          {error && <p className="aviso mal">{error}</p>}
          <div className="acciones"><button className="btn aire" type="submit">Proyectar</button></div>
        </form>
        </div>
      </main>
    );
  }

  const rotulo = (
    <aside className="rotulo" aria-live="polite">
      {s ? (
        <>
          <h2>{s.equipo}</h2>
          <p className="r-hora">{nombreDe(CANALES[s.canal - 1])} · {hora(s)}</p>
          {s.descripcion && <p>{s.descripcion}</p>}
        </>
      ) : (
        <h2>{senales.length ? 'Este canal aún no tiene señal' : 'Esperando la primera señal'}</h2>
      )}
    </aside>
  );

  const tele = (
    <>
      <p className="marca-v wm" aria-label="Ciudades(In)Posibles"><span className="tira">Ciudades<span className="in">(In)</span>Posibles</span></p>
      <section className="principal-t" aria-label="Televisor">
        <Tele
          c={CANALES[foco - 1]} s={s} nombre={nombreDe(CANALES[foco - 1])} sintonia={sintonia} alSintonizar={setSintonia}
          nombreDe={nombreDe} porCanal={porCanal} sinEmision={!abierta || !senales.length}
          conRotulo={conRotulo} alRotulo={() => setConRotulo((x) => !x)}
        />
      </section>
      {conRotulo && rotulo}
    </>
  );

  const muro = (
    <>
      <section className="principal-v" aria-label="Pantalla principal">
        <Pantalla c={CANALES[foco - 1]} s={s} nombre={nombreDe(CANALES[foco - 1])} mayor />
        <div className="selector" role="radiogroup" aria-label="Sintonizar la pantalla principal">
          <button role="radio" aria-checked={!sintonia} className={`auto ${!sintonia ? 'on' : ''}`} onClick={() => setSintonia(null)}>Auto</button>
          {CANALES.map((c) => (
            <button
              key={c.n} role="radio" aria-checked={sintonia === c.n} className={`k ${c.n === 9 ? 'k9-t' : ''} ${sintonia === c.n ? 'on' : ''} ${porCanal[c.n].length ? '' : 'vacio'}`}
              style={{ background: `var(--c${c.n})`, '--color': `var(--c${c.n})` }} onClick={() => setSintonia(c.n)} aria-label={`Canal ${c.n}, ${nombreDe(c)}`}
            >{c.n}</button>
          ))}
        </div>
      </section>
      <section className="lado">
        <div className="paik" aria-label="Los nueve canales">
          {CANALES.map((c) => (
            <Pantalla key={c.n} c={c} s={senalDe(c.n)} nombre={nombreDe(c)} enFoco={c.n === foco} nueva={vigente?.canal === c.n} alTocar={() => setSintonia(c.n)} />
          ))}
        </div>
        {rotulo}
      </section>
    </>
  );

  return (
    <main className={`al-aire ${mosaico || rastros ? '' : 'tele'} ${rastros ? 'con-rastros' : ''} ${quieto ? 'quieto' : ''}`}>
      {rastros ? <Suspense fallback={null}><Rastros vecinos={vecinos} senales={senales} /></Suspense> : mosaico ? muro : tele}
      {mosaico && !abierta && <Ajuste />}
      {/* proyectando, los errores también se ven: si no, la pantalla solo parece vacía */}
      {error && <p className="aviso-visor" role="alert">{error} Toquen «Cambiar mesa» y vuelvan a escribir el código.</p>}
      <footer className="pie">
        <span className="pie-a">
          {/* en el mosaico la marca va en el pie; en el televisor ya está arriba a la izquierda */}
          {mosaico && <span className="marca-m wm" aria-label="Ciudades(In)Posibles"><span className="tira">Ciudades<span className="in">(In)</span>Posibles</span></span>}
          <span>{abierta ? <><i className="dot" />Al aire</> : 'Fuera del aire'}</span>
        </span>
        <span className="mandos">
          <button onClick={alternarPantallaCompleta}>Pantalla completa</button>
          <a href={mosaico || rastros ? raiz || '/' : `${raiz}/mosaico`}>{mosaico || rastros ? 'Televisor' : 'Mosaico'}</a>
          {!rastros && <a href={`${raiz}/rastros`}>Rastros</a>}
          <a href={`${raiz}/maletin`}>Maletín</a>
          <button onClick={() => { localStorage.removeItem('transmisor-pantalla'); setSenales([]); setMesa(''); }}>Cambiar mesa</button>
        </span>
        <span>{senales.length === 1 ? '1 señal' : `${senales.length} señales`} · {conSenal.length} de 9 canales</span>
      </footer>
    </main>
  );
}
