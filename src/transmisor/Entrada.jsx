import { useState } from 'react';

/** Aviso para un equipo que ya está en una mesa y abre el enlace de otra. */
export const otraMesa = (nueva, actual) => `Este código es de la mesa ${nueva}. Para unirse, primero salgan de la mesa ${actual}.`;

/** Formulario para unirse a la mesa: código de mesa y nombre de equipo. */
export function FormularioMesa({ alUnirse, alCancelar, textoCancelar, codigoInicial = '' }) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    if (!navigator.onLine) { setError('Sin señal por ahora. Pueden jugar en este teléfono y unirse después.'); return; }
    setEnviando(true);
    try {
      await alUnirse(codigo, nombre);
    } catch (err) {
      setError(err.message || 'No pudimos unirnos a la mesa. ¿Otra vez?');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <div className="campo">
        <label htmlFor="codigo">Código de mesa</label>
        <input id="codigo" autoCapitalize="characters" autoComplete="off" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
      </div>
      <div className="campo">
        <label htmlFor="nombre">Nombre del equipo</label>
        <input id="nombre" maxLength={32} autoComplete="off" autoFocus={Boolean(codigoInicial)} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      </div>
      {error && <p className="aviso mal" role="alert">{error}</p>}
      <div className="acciones">
        <button className="btn aire" type="submit" disabled={enviando}>{enviando ? 'Uniéndonos…' : 'Unirse a la mesa'}</button>
        {alCancelar && <button className="btn sec" type="button" onClick={alCancelar}>{textoCancelar || 'Ahora no'}</button>}
      </div>
    </form>
  );
}

/** `codigoEnlace`: el código que trajo el enlace del QR de la mesa (`?mesa=…`), o ''. */
export default function Entrada({ equipo, alEntrar, alUnirse, alSalirDeMesa, codigoEnlace = '' }) {
  const [mesa, setMesa] = useState(() => Boolean(codigoEnlace) && !equipo);
  return (
    <main className="entrada">
      <div className="ent-a">
      <div className="pastillas" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <i key={n} style={{ background: `var(--c${n})` }} />)}
      </div>
      <h1 className="wm"><span className="tira">Ciudades<span className="in">(In)</span>Posibles</span><span className="tira sub-t">Transmisor</span></h1>
      </div>
      <div className="ent-b">
      <p className="lema">Sintonicen un canal, registren lo que pide su lente y transmítanlo a la mesa.</p>
      {equipo ? (
        <>
          <p className="dato">En la mesa {equipo.mesa} como {equipo.nombre}.</p>
          {codigoEnlace && codigoEnlace !== equipo.mesa && <p className="aviso">{otraMesa(codigoEnlace, equipo.mesa)}</p>}
          <div className="acciones">
            <button className="btn aire" onClick={alEntrar}>Seguir transmitiendo</button>
            <button className="btn sec" onClick={alSalirDeMesa}>Salir de la mesa</button>
          </div>
        </>
      ) : mesa ? (
        <FormularioMesa alUnirse={alUnirse} alCancelar={() => setMesa(false)} textoCancelar="Volver" codigoInicial={codigoEnlace} />
      ) : (
        <div className="acciones">
          <button className="btn aire" onClick={() => setMesa(true)}>Unirse a la mesa</button>
          <button className="btn sec" onClick={alEntrar}>Jugar en este teléfono</button>
        </div>
      )}
      </div>
    </main>
  );
}
