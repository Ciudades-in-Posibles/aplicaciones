import { useEffect, useMemo, useState } from 'react';
import * as red from './red/consola.js';
import { CANALES } from '../comun/dominio/canales.js';
import { mesaAbierta, resumenMesa } from '../comun/dominio/mesa.js';
import Confirmar from '../comun/Confirmar.jsx';
import Cartas from './Cartas.jsx';
import { exportarArchivo } from './archivo.js';

// cuando visor.ciudadesinposibles.net esté conectado en Hosting, puede ir aquí
const VISOR = 'https://visor-ciudadesinposibles.web.app';

function hora(t) {
  const d = t?.toDate ? t.toDate() : t ? new Date(t) : null;
  return d ? d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
}

function Pastilla({ n }) {
  return <span className={`k ${n === 9 ? 'k9-t' : ''}`} style={{ background: `var(--c${n})` }}>{n}</span>;
}

function Wordmark() {
  return (
    <>
      <div className="pastillas" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <i key={n} style={{ background: `var(--c${n})` }} />)}
      </div>
      <h1 className="wm"><span className="tira">Ciudades<span className="in">(In)</span>Posibles</span><span className="tira sub-t">Consola</span></h1>
    </>
  );
}

function NuevaMesa({ alCrear, alCancelar }) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  return (
    <form className="nueva" onSubmit={async (e) => {
      e.preventDefault(); setError('');
      try { await alCrear(codigo, nombre); } catch (err) { setError(err.message); }
    }}>
      <div className="campo"><label htmlFor="nc">Código</label><input id="nc" autoCapitalize="characters" value={codigo} onChange={(e) => setCodigo(e.target.value)} required /></div>
      <div className="campo"><label htmlFor="nn">Nombre</label><input id="nn" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Parque Nacional · 13 nov" /></div>
      {error && <p className="aviso mal">{error}</p>}
      <div className="acciones"><button className="btn aire" type="submit">Crear mesa</button>{alCancelar && <button className="btn sec" type="button" onClick={alCancelar}>Cancelar</button>}</div>
    </form>
  );
}

function DetalleSenal({ mesa, senal, alCerrar }) {
  return (
    <div className="velo" onClick={(e) => e.target === e.currentTarget && alCerrar()}>
      <div className="carta" role="dialog" aria-modal="true" aria-label={`Toma de ${senal.equipo}`}>
        <div className="cab"><Pastilla n={senal.canal} /><h2>{senal.canalNombre} · {senal.equipo}</h2><button className="cerrar" onClick={alCerrar} aria-label="Cerrar">×</button></div>
        <div className="foto"><img src={senal.imagen} alt={senal.descripcion || ''} /></div>
        <p className="dato">{senal.codigo} · {hora(senal.hora)}</p>
        {senal.descripcion && <p>{senal.descripcion}</p>}
        {senal.nota && <p>«{senal.nota}»</p>}
        {senal.pregunta && <p className="preg">{senal.pregunta}</p>}
        <div className="acciones">
          <Confirmar texto="Sacar del aire" pregunta="¿Borrar esta imagen de la mesa para todos? Se pierden sus respuestas." className="btn" alConfirmar={async () => { await red.quitarSenal(mesa, senal.id); alCerrar(); }} />
        </div>
      </div>
    </div>
  );
}

function Mesa({ mesa }) {
  const [equipos, setEquipos] = useState([]);
  const [pantallas, setPantallas] = useState([]);
  const [senales, setSenales] = useState([]);
  const [filtro, setFiltro] = useState('todas');
  const [abierta, setAbierta] = useState(null);
  const [nombre, setNombre] = useState(mesa.nombre || '');
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState(null); // {texto, mal?, reintentar?}: lo que pasa con el archivo o el borrado
  const [trabajando, setTrabajando] = useState(false);
  const [cartas, setCartas] = useState(false);
  useEffect(() => setNombre(mesa.nombre || ''), [mesa.id, mesa.nombre]);

  useEffect(() => {
    const p = [
      red.escucharEquipos(mesa.id, setEquipos),
      red.escucharPantallas(mesa.id, setPantallas),
      red.escucharMuro(mesa.id, setSenales)
    ];
    return () => p.forEach((f) => f());
  }, [mesa.id]);

  const resumen = useMemo(() => resumenMesa(senales), [senales]);
  const visibles = filtro === 'todas' ? senales : senales.filter((s) => s.canal === filtro);
  const detalle = senales.find((s) => s.id === abierta);
  const esAbierta = mesaAbierta(mesa);

  async function exportar() {
    setTrabajando(true);
    setAviso({ texto: 'Leyendo las tomas de la mesa…' });
    try {
      const n = await exportarArchivo(mesa, (texto) => setAviso({ texto }));
      setAviso({ texto: `Listo. ${n} ${n === 1 ? 'toma' : 'tomas'} en el archivo ucrónico de ${mesa.id}.` });
    } catch (err) {
      console.warn('Archivo Ucrónico:', err);
      setAviso({ mal: true, texto: 'No pudimos armar el archivo. ¿Otra vez?' });
    } finally {
      setTrabajando(false);
    }
  }

  // el borrado se puede repetir: vuelve a listar lo que queda y sigue
  async function borrar() {
    setTrabajando(true);
    setAviso({ texto: 'Mirando qué hay en la mesa…' });
    try {
      await red.borrarMesa(mesa.id, (a) => setAviso({ texto: a.texto }));
    } catch (err) {
      console.warn('Borrar mesa:', err);
      setAviso({ mal: true, reintentar: true, texto: `El borrado se cortó (${err.code || err.message}). Lo que ya se borró no vuelve; se puede repetir.` });
      setTrabajando(false);
    }
  }

  const ordenEquipos = [...equipos].sort((a, b) => (a.creado?.seconds || 0) - (b.creado?.seconds || 0));

  return (
    <div className="c-mesa">
      <section className="c-col c-estado">
        <button className={`c-tecla ${esAbierta ? 'on' : ''}`} onClick={() => red.cambiarAbierta(mesa.id, !esAbierta)} aria-pressed={esAbierta}>
          <i className="dot" />{esAbierta ? 'Abierta' : 'Cerrada'}
        </button>
        <p className="etq">{esAbierta ? 'Los equipos pueden unirse y transmitir. Tocar para cerrar.' : 'Nadie se une ni transmite; lo que salió sigue al aire. Tocar para abrir.'}</p>
        <div className="c-codigo">
          <span className="etq">Código de mesa</span>
          <b>{mesa.id}</b>
          <button className="btn sec peq" onClick={async () => { await navigator.clipboard?.writeText(mesa.id); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}>{copiado ? 'Copiado' : 'Copiar'}</button>
        </div>
        <form className="campo" onSubmit={(e) => { e.preventDefault(); red.renombrar(mesa.id, nombre); }}>
          <label htmlFor="mn">Nombre de la mesa</label>
          <div className="fila-campo">
            <input id="mn" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            {nombre !== (mesa.nombre || '') && <button className="btn peq" type="submit">Guardar</button>}
          </div>
        </form>
        <p className="datos">{equipos.length} equipos · {pantallas.length} pantallas · {resumen.total} al aire</p>
        <a className="btn sec peq" href={VISOR} target="_blank" rel="noreferrer">Abrir el Visor</a>

        <div className="c-archivo">
          <h2 className="c-tit">Archivo</h2>
          <p className="etq">El archivo ucrónico guarda las tomas y lo que escribieron los equipos. Expórtenlo antes de borrar la mesa.</p>
          <div className="acciones">
            <button className="btn sec peq" onClick={exportar} disabled={trabajando}>Exportar archivo</button>
            <button className="btn sec peq" onClick={() => setCartas(true)} disabled={trabajando}>Imprimir cartas</button>
            <Confirmar
              texto="Borrar mesa" className="btn sec peq" disabled={trabajando} exigir={mesa.id}
              pregunta="Se borra la mesa con sus tomas, equipos y nombres, y no se puede deshacer. Escriban el código para confirmar."
              alConfirmar={borrar}
            />
          </div>
          {aviso && (
            <p className={`aviso ${aviso.mal ? 'mal' : ''}`} role="status">
              {aviso.texto}{' '}
              {aviso.reintentar && <button className="enlace" onClick={borrar} disabled={trabajando}>Reintentar</button>}
            </p>
          )}
        </div>
      </section>

      <section className="c-col">
        <h2 className="c-tit">Equipos <span>{equipos.length}</span></h2>
        {ordenEquipos.length === 0 && <p className="etq">Todavía no se une ningún equipo.</p>}
        <ul className="c-equipos">
          {ordenEquipos.map((e) => (
            <li key={e.id}>
              <div><b>{e.nombre}</b><span className="etq">{hora(e.creado)} · {resumen.porEquipo[e.id] || 0} al aire</span></div>
              <Confirmar texto="Liberar nombre" pregunta="¿Liberarlo?" alConfirmar={() => red.liberarEquipo(mesa.id, e.id, e.llave)} />
            </li>
          ))}
        </ul>
      </section>

      <section className="c-col c-aire">
        <h2 className="c-tit">Al aire <span>{resumen.total}</span></h2>
        <div className="filtro" role="tablist" aria-label="Señales por canal">
          <button role="tab" aria-selected={filtro === 'todas'} onClick={() => setFiltro('todas')}>Todas <b>{resumen.total}</b></button>
          {CANALES.map((c) => (
            <button key={c.n} role="tab" className="fk" aria-selected={filtro === c.n} onClick={() => setFiltro(c.n)} aria-label={`Canal ${c.n}: ${resumen.porCanal[c.n] || 0}`}>
              <Pastilla n={c.n} />{resumen.porCanal[c.n] ? <b>{resumen.porCanal[c.n]}</b> : null}
            </button>
          ))}
        </div>
        {visibles.length === 0 && <p className="etq">Nada al aire {filtro === 'todas' ? 'todavía' : 'en este canal'}.</p>}
        <div className="hoja">
          {visibles.map((s) => (
            <button key={s.id} className="mini" onClick={() => setAbierta(s.id)} aria-label={`Toma de ${s.equipo}, canal ${s.canal}`}>
              <img src={s.imagen} alt="" />
              <Pastilla n={s.canal} />
              <span className="marca-e">{s.equipo}</span>
            </button>
          ))}
        </div>
      </section>

      {cartas && <Cartas mesa={mesa} alCerrar={() => setCartas(false)} />}
      {detalle && <DetalleSenal mesa={mesa.id} senal={detalle} alCerrar={() => setAbierta(null)} />}
    </div>
  );
}

/**
 * Consola: crea mesas, las abre y las cierra, muestra equipos y señales,
 * saca tomas del aire, libera nombres de equipo, exporta el Archivo Ucrónico, imprime las cartas
 * y borra mesas. Se entra con Google.
 */
function motivoGoogle(e) {
  if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return '';
  if (e.code === 'auth/unauthorized-domain') return `Falta autorizar ${location.hostname} en Firebase: Authentication → Configuración → Dominios autorizados.`;
  if (e.code === 'auth/popup-blocked') return 'El navegador bloqueó la ventana de Google. Permitan las ventanas emergentes para este sitio.';
  return `No pudimos entrar con Google (${e.code || e.message}). ¿Otra vez?`;
}

export default function Consola() {
  const [usuario, setUsuario] = useState(undefined);
  const [mesas, setMesas] = useState(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [elegida, setElegida] = useState(() => localStorage.getItem('consola-mesa') || '');
  const [nueva, setNueva] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { document.title = 'Consola · Ciudades(In)Posibles'; }, []);
  useEffect(() => red.escucharSesion((u) => setUsuario(u && !u.isAnonymous ? u : null)), []);
  useEffect(() => {
    if (!usuario) { setMesas(null); setSinPermiso(false); return; }
    return red.escucharMesas((m) => { setMesas(m); setSinPermiso(false); }, (err) => { if (err.code === 'permission-denied') setSinPermiso(true); });
  }, [usuario]);
  useEffect(() => {
    if (mesas?.length && !mesas.some((m) => m.id === elegida)) setElegida(mesas[0].id);
  }, [mesas, elegida]);
  useEffect(() => { if (elegida) localStorage.setItem('consola-mesa', elegida); }, [elegida]);

  if (usuario === undefined) return null;

  if (!usuario || sinPermiso) {
    return (
      <main className="entrada">
        <div className="ent-a"><Wordmark /></div>
        <div className="ent-b">
          <p className="lema">{sinPermiso ? `La cuenta ${usuario.email} no administra mesas.` : 'Crear, abrir y cerrar mesas. Ver a los equipos y lo que sale al aire.'}</p>
          {error && <p className="aviso mal">{error}</p>}
          <div className="acciones">
            {sinPermiso
              ? <button className="btn sec" onClick={red.salir}>Salir</button>
              : <button className="btn aire" onClick={() => { setError(''); red.entrarConGoogle().catch((e) => setError(motivoGoogle(e))); }}>Entrar con Google</button>}
          </div>
        </div>
      </main>
    );
  }

  const mesa = mesas?.find((m) => m.id === elegida);

  return (
    <div className="consola">
      <header className="c-barra">
        <p className="marca wm"><span className="tira">Ciudades<span className="in">(In)</span>Posibles</span><span className="tira sub-t">Consola</span></p>
        <nav className="filtro c-mesas" aria-label="Mesas">
          {(mesas || []).map((m) => (
            <button key={m.id} role="tab" aria-selected={m.id === elegida} onClick={() => { setElegida(m.id); setNueva(false); }}>
              <i className={`dot ${mesaAbierta(m) ? 'on' : ''}`} />{m.id}
            </button>
          ))}
          <button onClick={() => setNueva(true)}>+ Nueva mesa</button>
        </nav>
        <span className="c-usuario"><span className="etq">{usuario.email}</span><button className="enlace" onClick={red.salir}>Salir</button></span>
      </header>

      {nueva || (mesas && !mesas.length) ? (
        <NuevaMesa
          alCrear={async (c, n) => { const id = await red.crearMesa(c, n); setElegida(id); setNueva(false); }}
          alCancelar={mesas?.length ? () => setNueva(false) : null}
        />
      ) : mesa ? <Mesa key={mesa.id} mesa={mesa} /> : null}
    </div>
  );
}
