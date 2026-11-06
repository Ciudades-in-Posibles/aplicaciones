import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useJuego } from './estado.js';
import { enPantallaCompleta, pedirPantallaCompleta, salirDePantallaCompleta } from '../comun/local/pantalla.js';
import Televisor from './aparatos/Televisor.jsx';
import Camara from './aparatos/Camara.jsx';
import MesaTransmision from './aparatos/MesaTransmision.jsx';
import { CartaCanal, CartaToma, CartaSenal } from './aparatos/Cartas.jsx';
import Entrada, { FormularioMesa, otraMesa } from './Entrada.jsx';
import { codigoDeEnlace } from '../comun/dominio/mesa.js';

// El QR de la mesa abre el Transmisor con ?mesa=CÓDIGO. Se lee una vez y se quita de la URL,
// para que recargar no vuelva a pedir unirse (se guarda aquí: el modo estricto llama dos veces).
let enlace = null;
function tomarEnlace() {
  if (enlace !== null) return enlace;
  enlace = codigoDeEnlace(location.search);
  const u = new URL(location.href);
  if (u.searchParams.has('mesa')) {
    u.searchParams.delete('mesa');
    history.replaceState(history.state, '', `${u.pathname}${u.search}${u.hash}`);
  }
  return enlace;
}

// la Antena trae h3-js: se carga solo al abrirla
const Antena = lazy(() => import('./aparatos/Antena.jsx'));

const APARATOS = [
  { id: 'tv', nombre: 'Sintonizar', icono: <svg viewBox="0 0 28 28" aria-hidden="true"><rect x="3" y="6" width="22" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2.4" /><circle cx="21" cy="14" r="1.6" fill="currentColor" /></svg> },
  { id: 'antena', nombre: 'Rastrear', icono: <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 15 7 4M14 15l7-11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><rect x="5" y="15" width="18" height="9" rx="3" fill="currentColor" /></svg> },
  { id: 'camara', nombre: 'Registrar', icono: <svg viewBox="0 0 28 28" aria-hidden="true"><rect x="3" y="8" width="22" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="2.4" /><circle cx="14" cy="15.5" r="4" fill="none" stroke="currentColor" strokeWidth="2.4" /><rect x="9" y="4.5" width="10" height="4" rx="1" fill="currentColor" /></svg> },
  { id: 'mesa', nombre: 'Transmitir', icono: <svg viewBox="0 0 28 28" aria-hidden="true"><rect x="2.5" y="6" width="10" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="2.2" /><rect x="15.5" y="6" width="10" height="8" rx="2" fill="currentColor" /><path d="M3 20h22" stroke="currentColor" strokeWidth="2.4" strokeDasharray="4 2.5" /></svg> }
];

export default function App() {
  const j = useJuego();
  const [aparato, setAparato] = useState('tv');
  const [carta, setCarta] = useState(null); // {tipo, ...}
  const [rastro, setRastro] = useState(null); // {canal, celda, vecino}: la próxima toma nace de este rastro
  const [codigoEnlace, setCodigoEnlace] = useState(tomarEnlace);

  // ya dentro de la app: el enlace abre «Unirse» con el código puesto, o avisa si el equipo está en otra mesa
  useEffect(() => {
    if (!j.listo || !j.inicio || !codigoEnlace) return;
    if (!j.equipo) setCarta({ tipo: 'unirse', codigo: codigoEnlace });
    else if (j.equipo.mesa !== codigoEnlace) setCarta({ tipo: 'equipo', otraMesa: codigoEnlace });
    setCodigoEnlace('');
  }, [j.listo, j.inicio, j.equipo, codigoEnlace]);

  useEffect(() => {
    if (!j.aviso) return;
    const t = setTimeout(() => j.setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [j.aviso]);

  const ultimaToma = useMemo(() => j.tomas.reduce((u, t) => (!u || t.creada > u.creada ? t : u), null), [j.tomas]);
  const tomaAbierta = useMemo(() => (carta?.tipo === 'toma' ? j.tomas.find((t) => t.id === carta.id) : null), [carta, j.tomas]);

  // dentro de la app: pantalla completa y horizontal. El navegador la quita al recargar,
  // al pedir permiso de cámara o al abrir la cámara del teléfono; el siguiente toque la recupera.
  // (en el celular solo «click» cuenta como gesto; «pointerdown» no)
  useEffect(() => {
    if (!j.inicio) return;
    const alTocar = (e) => {
      // los toques que piden un permiso (ubicación, brújula) no piden además pantalla completa: se cruzarían
      if (enPantallaCompleta() || e.target.closest?.('.salir, [data-permiso]')) return;
      pedirPantallaCompleta({ horizontal: true });
    };
    window.addEventListener('click', alTocar, true);
    return () => window.removeEventListener('click', alTocar, true);
  }, [j.inicio]);

  const entrar = () => { pedirPantallaCompleta({ horizontal: true }); return j.entrar(); };
  const unirse = (codigo, nombre) => { pedirPantallaCompleta({ horizontal: true }); return j.unirse(codigo, nombre); };
  const salir = () => { try { screen.orientation?.unlock?.(); } catch { /* sin soporte */ } salirDePantallaCompleta(); return j.salir(); };

  if (!j.listo) return null;
  if (!j.inicio) return <Entrada equipo={j.equipo} alEntrar={entrar} alUnirse={unirse} alSalirDeMesa={j.salirDeMesa} codigoEnlace={codigoEnlace} />;

  const mandar = j.mandarAlAire;

  return (
    <div className="app">
      <div className="girar" role="alert">
        <svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="20" width="44" height="26" rx="5" fill="none" stroke="currentColor" strokeWidth="4" /><circle cx="48" cy="33" r="2.5" fill="currentColor" /><path d="M20 12a16 16 0 0 1 22 0" fill="none" stroke="currentColor" strokeWidth="3.5" /><path d="M42 6v7h-7" fill="none" stroke="currentColor" strokeWidth="3.5" /></svg>
        <p>Giren el teléfono.<br />El Transmisor se usa de lado.</p>
      </div>
      <aside className="riel">
        <p className="marca wm"><span className="tira">Ciudades<span className="in">(In)</span>Posibles</span><span className="tira sub-t">Transmisor</span></p>
        <nav className="nav" aria-label="Aparatos">
          {APARATOS.map((a) => (
            <button key={a.id} aria-current={aparato === a.id ? 'page' : undefined} onClick={() => setAparato(a.id)}>
              {a.icono}{a.nombre}
            </button>
          ))}
        </nav>
        <button className="estado" onClick={() => setCarta({ tipo: j.equipo ? 'equipo' : 'unirse' })}>
          <i className={`dot ${j.equipo && j.enLinea ? 'on' : ''}`} />
          <span>{j.equipo ? 'Abierto' : 'Local'}{j.cola.length > 0 && ` · ${j.cola.length}`}</span>
        </button>
        <button className="salir" onClick={salir}>← Salir</button>
      </aside>

      <main className="escena" aria-live="polite">
        {j.aviso && <p className={`aviso toast ${j.aviso.mal ? "mal" : ""}`} role="status">{j.aviso.texto}</p>}
        {aparato === 'tv' && (
          <Televisor
            canal={j.canal} canales={j.canales} muro={j.muro} pausa={!!carta} alSintonizar={j.sintonizar}
            alAbrirCanal={(c) => setCarta({ tipo: 'canal', canal: c })}
            alAbrirSenal={(s) => setCarta(s.pendiente || s.prueba ? { tipo: 'toma', id: s.id } : { tipo: 'senal', senal: s })}
          />
        )}
        {aparato === 'antena' && (
          <Suspense fallback={null}>
            <Antena
              vecinos={j.vecinos} dePrueba={j.dePrueba} canales={j.canales} pausa={!!carta}
              alRegistrar={(r) => { setRastro(r); setAparato('camara'); }}
            />
          </Suspense>
        )}
        {aparato === 'camara' && (
          <Camara
            totalTomas={ultimaToma?.numero || 0} ultima={ultimaToma} alAbrirToma={(t) => setCarta({ tipo: 'toma', id: t.id })}
            rastro={rastro && j.canales[rastro.canal - 1]} alSoltarRastro={() => setRastro(null)}
            alRegistrar={async (datos) => {
              await j.registrar({ ...datos, rastro });
              j.setAviso({ texto: rastro ? `Toma guardada en el canal ${rastro.canal}. En la mesa la mandan al aire.` : 'Toma guardada. En la mesa le asignan un canal.' });
              setRastro(null);
            }}
          />
        )}
        {aparato === 'mesa' && (
          <MesaTransmision
            tomas={j.tomas} canales={j.canales} equipo={j.equipo} enLinea={j.enLinea}
            alAbrirToma={(t) => setCarta({ tipo: 'toma', id: t.id })}
            alAsignar={async (ids, n) => { const k = await j.asignar(ids, n); j.setAviso({ texto: `${k === 1 ? 'Una toma pasó' : `${k} tomas pasaron`} al canal ${n}.` }); }}
            alMandar={j.mandarVarias} alBorrar={j.borrarVarias} alSacar={j.sacarDelAire} alUnirse={() => setCarta({ tipo: 'unirse' })}
          />
        )}
      </main>


      {carta?.tipo === 'canal' && <CartaCanal canal={carta.canal} alGuardar={j.guardarAbierto} alCerrar={() => setCarta(null)} />}
      {carta?.tipo === 'toma' && tomaAbierta && (
        <CartaToma
          toma={tomaAbierta} canales={j.canales} equipo={j.equipo}
          alEditar={j.editar} alBorrar={j.borrar} alMandar={mandar} alCancelar={j.cancelarEnvio} alSacar={j.sacarDelAire} alCerrar={() => setCarta(null)}
        />
      )}
      {carta?.tipo === 'senal' && (
        <CartaSenal senal={carta.senal} alCerrar={() => setCarta(null)} />
      )}
      {carta?.tipo === 'unirse' && (
        <div className="velo" onClick={(e) => e.target === e.currentTarget && setCarta(null)}>
          <div className="carta" role="dialog" aria-modal="true" aria-label="Unirse a la mesa" style={{ background: 'var(--fondo)', color: 'var(--tinta)' }}>
            <div className="cab"><h2>Unirse a la mesa</h2></div>
            <p>Para transmitir, el equipo se une con el código de la mesa. Solo sale del teléfono lo que manden al aire.</p>
            <FormularioMesa alUnirse={async (c, n) => { await j.unirse(c, n); setCarta(null); }} alCancelar={() => setCarta(null)} codigoInicial={carta.codigo} />
          </div>
        </div>
      )}
      {carta?.tipo === 'equipo' && j.equipo && (
        <div className="velo" onClick={(e) => e.target === e.currentTarget && setCarta(null)}>
          <div className="carta" role="dialog" aria-modal="true" aria-label="Equipo">
            <div className="cab"><h2>{j.equipo.nombre}</h2><button className="cerrar" onClick={() => setCarta(null)} aria-label="Cerrar">×</button></div>
            <p className="dato">Mesa {j.equipo.mesa} · {j.enLinea ? 'con señal' : 'sin señal'} · {j.cola.length} en cola</p>
            {carta.otraMesa && <p className="aviso">{otraMesa(carta.otraMesa, j.equipo.mesa)}</p>}
            <p>Las tomas viven en este teléfono. Solo sale lo que mandan al aire.</p>
            <div className="acciones"><button className="btn sec" onClick={async () => { setCarta(null); await j.salirDeMesa(); salir(); }}>Salir de la mesa en este teléfono</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
