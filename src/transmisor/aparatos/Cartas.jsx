import { useEffect, useState } from 'react';
import { MAX_NOMBRE_CANAL, MAX_LENTE } from '../../comun/dominio/canales.js';
import { MAX_NOTA } from '../../comun/dominio/toma.js';
import Confirmar from '../../comun/Confirmar.jsx';

function Hoja({ titulo, canal, alCerrar, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [alCerrar]);
  return (
    <div className="velo" onClick={(e) => e.target === e.currentTarget && alCerrar()}>
      <div className="carta" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="cab">
          {canal && <span className={`k ${canal === 9 ? 'k9-t' : ''}`} style={{ background: `var(--c${canal})` }}>{canal}</span>}
          <h2>{titulo}</h2>
          <button className="cerrar" onClick={alCerrar} aria-label="Cerrar">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Carta de canal: la lente. En los canales abiertos, el equipo escribe nombre y lente. */
export function CartaCanal({ canal, alGuardar, alCerrar }) {
  const [nombre, setNombre] = useState(canal.abierto && canal.nombre !== 'Abierto' ? canal.nombre : '');
  const [lente, setLente] = useState(canal.abierto && !canal.lente.startsWith('La mesa escribe') ? canal.lente : '');
  return (
    <Hoja titulo={canal.nombre} canal={canal.n} alCerrar={alCerrar}>
      <p className="dato">Lente</p>
      <p className="lente">{canal.lente}</p>
      {canal.abierto && (
        <form onSubmit={(e) => { e.preventDefault(); alGuardar(canal.n, { nombre, lente }); alCerrar(); }} style={{ display: 'grid', gap: 12 }}>
          <div className="campo">
            <label htmlFor="cn">Nombre del canal</label>
            <input id="cn" maxLength={MAX_NOMBRE_CANAL} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="cl">Lente (empieza con «Encuadra…»)</label>
            <textarea id="cl" maxLength={MAX_LENTE} value={lente} onChange={(e) => setLente(e.target.value)} />
          </div>
          <div className="acciones"><button className="btn" type="submit">Guardar canal</button></div>
        </form>
      )}
    </Hoja>
  );
}

/** Carta de toma: ver, editar nota y canal, borrar o (con mesa) mandar al aire. */
export function CartaToma({ toma, canales, equipo, alEditar, alBorrar, alMandar, alCancelar, alSacar, alCerrar }) {
  const [nota, setNota] = useState(toma.nota);
  const [seguro, setSeguro] = useState(false); // confirmación de «Sacar del aire»
  const editable = toma.estado === 'local' || toma.estado === 'rechazada';
  const c = canales[toma.canal - 1];
  const cambio = nota !== toma.nota;
  return (
    <Hoja titulo={`${c ? c.nombre : 'Sin canal'} · ${toma.codigo}`} canal={toma.canal} alCerrar={alCerrar}>
      <div className="foto"><img src={toma.imagen} alt={`Toma ${toma.codigo}`} /></div>
      {toma.estado === 'rechazada' && <p className="aviso">{toma.motivo}</p>}
      {toma.estado === 'al-aire' && toma.lectura?.descripcion && <p>{toma.lectura.descripcion}</p>}
      {editable ? (
        <>
          <div className="campo">
            <label htmlFor="tn">Lo que se vio</label>
            <textarea id="tn" maxLength={MAX_NOTA} value={nota} onChange={(e) => setNota(e.target.value)} />
          </div>
          <div className="campo">
            <label>Canal</label>
            <div className="pastillas">
              {canales.map((k) => (
                <button key={k.n} type="button" onClick={() => alEditar(toma, { canal: k.n })} aria-pressed={k.n === toma.canal}
                  aria-label={`Canal ${k.n}`} style={{ width: 28, height: 28, borderRadius: '30%', border: 0, background: `var(--c${k.n})`, outline: k.n === toma.canal ? '3px solid var(--calle)' : 'none', outlineOffset: 2 }} />
              ))}
            </div>
          </div>
          <div className="acciones">
            {cambio && <button className="btn" onClick={() => alEditar(toma, { nota })}>Guardar</button>}
            {/* en Local no hay al aire: la toma solo se ve en su canal de este teléfono */}
            {equipo && (
              <button className="btn aire" disabled={!toma.canal} onClick={async () => { if (cambio) await alEditar(toma, { nota }); alMandar(cambio ? { ...toma, nota } : toma); alCerrar(); }}>
                {toma.canal ? 'Mandar al aire' : 'Asignen un canal'}
              </button>
            )}
            <Confirmar texto="Borrar" className="btn sec" pregunta="¿Borrar esta imagen? No se puede recuperar." alConfirmar={() => { alBorrar(toma.id); alCerrar(); }} />
          </div>
        </>
      ) : (
        <>
          {toma.nota && <p>{toma.nota}</p>}
          <p className="dato">{toma.estado === 'en-cola' ? 'En cola: sale cuando haya señal' : toma.prueba ? 'Al aire de prueba · solo en este teléfono' : 'Al aire en la mesa'}</p>
          {toma.estado === 'en-cola' && <div className="acciones"><button className="btn sec" onClick={() => { alCancelar(toma); alCerrar(); }}>Sacar de la cola</button></div>}
          {toma.estado === 'al-aire' && (seguro ? (
            <>
              <p className="aviso mal">{toma.prueba ? 'La toma vuelve a la mesa de edición.' : 'Se borra de la mesa y la toma vuelve a la mesa de edición.'}</p>
              <div className="acciones">
                <button className="btn" onClick={async () => { if (await alSacar(toma)) alCerrar(); else setSeguro(false); }}>Sí, sacarla</button>
                <button className="btn sec" onClick={() => setSeguro(false)}>No</button>
              </div>
            </>
          ) : (
            <div className="acciones"><button className="btn sec" onClick={() => setSeguro(true)}>Sacar del aire</button></div>
          ))}
        </>
      )}
    </Hoja>
  );
}

/** Carta de señal (del muro): la toma de un equipo, solo para verla. */
export function CartaSenal({ senal, alCerrar }) {
  return (
    <Hoja titulo={`${senal.canalNombre} · ${senal.codigo}`} canal={senal.canal} alCerrar={alCerrar}>
      <div className="foto"><img src={senal.imagen} alt={senal.descripcion || `Toma ${senal.codigo}`} /></div>
      <p className="dato">{senal.equipo}</p>
      {senal.descripcion && <p>{senal.descripcion}</p>}
      {senal.nota && <p>«{senal.nota}»</p>}
    </Hoja>
  );
}
