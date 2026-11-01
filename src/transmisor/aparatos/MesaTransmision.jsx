import { useEffect, useMemo, useState } from 'react';
import { editable } from '../../comun/dominio/toma.js';
import Confirmar from '../../comun/Confirmar.jsx';

const ETIQUETA = { local: '', 'en-cola': 'En cola', rechazada: 'No salió', 'al-aire': 'Al aire' };

function Pastilla({ n }) {
  return <span className={`k ${n === 9 ? 'k9-t' : ''}`} style={{ background: `var(--c${n})` }}>{n}</span>;
}

/**
 * Mesa de edición (Transmitir): arriba se elige un canal y se ven las tomas que el equipo
 * le asignó; el monitor muestra la toma en foco. Se seleccionan varias tomas para asignarlas
 * a un canal, mandarlas al aire o borrarlas.
 */
export default function MesaTransmision({ tomas, canales, equipo, enLinea, alAbrirToma, alAsignar, alMandar, alBorrar, alSacar, alUnirse }) {
  const [seguro, setSeguro] = useState(null); // id de la toma al aire que se va a sacar
  const ordenadas = useMemo(() => [...tomas].sort((a, b) => b.creada - a.creada), [tomas]);
  const [filtro, setFiltro] = useState(() => (tomas.some((t) => !t.canal) ? 'sin' : 'todas'));
  const [sel, setSel] = useState(() => new Set());
  const [foco, setFoco] = useState(null);

  const cuenta = useMemo(() => {
    const c = { todas: tomas.length, sin: 0 };
    for (const t of tomas) { if (t.canal) c[t.canal] = (c[t.canal] || 0) + 1; else c.sin += 1; }
    return c;
  }, [tomas]);

  const visibles = useMemo(() => ordenadas.filter((t) =>
    filtro === 'todas' ? true : filtro === 'sin' ? !t.canal : t.canal === filtro), [ordenadas, filtro]);

  // la selección y el foco solo viven entre las tomas visibles
  useEffect(() => {
    const ids = new Set(visibles.filter(editable).map((t) => t.id));
    setSel((s) => { const n = new Set([...s].filter((id) => ids.has(id))); return n.size === s.size ? s : n; });
    if (!foco || !visibles.some((t) => t.id === foco)) setFoco(visibles[0]?.id || null);
  }, [visibles, foco]);

  const enFoco = visibles.find((t) => t.id === foco) || null;
  const elegidas = visibles.filter((t) => sel.has(t.id));
  const seleccionables = visibles.filter(editable);
  const enCola = tomas.filter((t) => t.estado === 'en-cola').length;

  function tocar(t) {
    setFoco(t.id);
    if (!editable(t)) return;
    setSel((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; });
  }

  return (
    <>
      <div className="principal mesa-p"><div className="mesa">
        <div className="filtro" role="tablist" aria-label="Tomas por canal">
          <button role="tab" aria-selected={filtro === 'todas'} onClick={() => setFiltro('todas')}>Todas <b>{cuenta.todas}</b></button>
          <button role="tab" aria-selected={filtro === 'sin'} onClick={() => setFiltro('sin')}>Sin canal <b>{cuenta.sin}</b></button>
          {canales.map((c) => (
            <button key={c.n} role="tab" className="fk" aria-selected={filtro === c.n} onClick={() => setFiltro(c.n)} aria-label={`Canal ${c.n}, ${c.nombre}: ${cuenta[c.n] || 0} tomas`}>
              <Pastilla n={c.n} />{cuenta[c.n] ? <b>{cuenta[c.n]}</b> : null}
            </button>
          ))}
        </div>

        <div className="edicion">
          <div className="monitor">
            <span className="lb">{enFoco ? `${enFoco.codigo} · ${enFoco.canal ? canales[enFoco.canal - 1].nombre : 'sin canal'}` : 'Monitor'}</span>
            <button className="tb" onClick={() => enFoco && alAbrirToma(enFoco)} aria-label={enFoco ? `Ver toma ${enFoco.codigo}` : 'Sin toma'}>
              {enFoco ? <img src={enFoco.imagen} alt="" /> : <span className="vacio">{tomas.length ? 'No hay tomas aquí' : 'Registren una toma con la cámara'}</span>}
              {enFoco?.canal ? <Pastilla n={enFoco.canal} /> : null}
            </button>
          </div>

          <div className="hoja" role="list" aria-label="Tomas">
            {visibles.map((t) => (
              <button
                key={t.id} role="listitem"
                className={`mini ${sel.has(t.id) ? 'sel' : ''} ${t.id === foco ? 'on' : ''} ${editable(t) ? '' : 'fija'}`}
                onClick={() => tocar(t)} aria-pressed={sel.has(t.id)}
                aria-label={`Toma ${t.codigo}${t.canal ? `, canal ${t.canal}` : ', sin canal'}${ETIQUETA[t.estado] ? `, ${ETIQUETA[t.estado]}` : ''}`}
              >
                <img src={t.imagen} alt="" />
                {t.canal ? <Pastilla n={t.canal} /> : <span className="k sin">–</span>}
                {sel.has(t.id) && <span className="check" aria-hidden="true">✓</span>}
                {ETIQUETA[t.estado] && <span className="marca-e">{t.estado === 'en-cola' && <i className="dot" />}{ETIQUETA[t.estado]}</span>}
              </button>
            ))}
          </div>
        </div>
      </div></div>

      <div className="lateral">
        <p className="datos">
          {elegidas.length} seleccionadas
          {seleccionables.length > 0 && <> · <button className="enlace" onClick={() => setSel(new Set(seleccionables.map((t) => t.id)))}>Todas</button></>}
          {elegidas.length > 0 && <> · <button className="enlace" onClick={() => setSel(new Set())}>Ninguna</button></>}
          {enCola ? ` · ${enCola} en cola${enLinea ? '' : ' (sin señal)'}` : ''}
        </p>

        <div className="campo">
          <span className="etq">Asignar a canal</span>
          <div className="asignar" role="group" aria-label="Asignar las seleccionadas a un canal">
            {canales.map((c) => (
              <button key={c.n} disabled={!elegidas.length} onClick={async () => { await alAsignar(elegidas.map((t) => t.id), c.n); setSel(new Set()); }} aria-label={`Asignar al canal ${c.n}, ${c.nombre}`}>
                <Pastilla n={c.n} />
              </button>
            ))}
          </div>
        </div>

        <div className="acciones">
          {/* en Local no hay al aire: las tomas solo se asignan a los canales de este teléfono */}
          {equipo && (
            <button className="btn aire" disabled={!elegidas.length} onClick={() => { alMandar(elegidas); setSel(new Set()); }}>Al aire</button>
          )}
          <button className="btn sec peq" disabled={!enFoco} onClick={() => alAbrirToma(enFoco)}>Ver</button>
          <Confirmar
            texto="Borrar" disabled={!elegidas.length}
            pregunta={elegidas.length === 1 ? '¿Borrar esta imagen? No se puede recuperar.' : `¿Borrar estas ${elegidas.length} imágenes? No se pueden recuperar.`}
            alConfirmar={() => { alBorrar(elegidas.map((t) => t.id)); setSel(new Set()); }}
          />
        </div>

        {enFoco?.estado === 'al-aire' && (seguro === enFoco.id ? (
          <div className="aviso mal">
            {enFoco.prueba ? 'La toma vuelve a la mesa de edición.' : 'Se borra de la mesa y vuelve a la mesa de edición.'}{' '}
            <button className="enlace" onClick={async () => { await alSacar(enFoco); setSeguro(null); }}>Sí, sacarla</button>{' · '}
            <button className="enlace" onClick={() => setSeguro(null)}>No</button>
          </div>
        ) : (
          <div className="acciones"><button className="btn sec peq" onClick={() => setSeguro(enFoco.id)}>Sacar del aire {enFoco.codigo}</button></div>
        ))}
        {enFoco?.estado === 'rechazada' && <p className="aviso mal">{enFoco.motivo || 'Esta toma no salió al aire.'}</p>}
        {!equipo && (
          <p className="aviso">
            En Local, las tomas asignadas se ven en su canal del televisor de este teléfono.{' '}
            <button className="enlace" onClick={alUnirse}>Unirse a la mesa</button> para mandarlas al aire.
          </p>
        )}
      </div>
    </>
  );
}
