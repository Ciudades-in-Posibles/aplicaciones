import { useState } from 'react';

/**
 * Botón con confirmación dentro de la app (sin confirm() del navegador).
 * Con `exigir`, además hay que escribir ese texto (sin importar mayúsculas) para que «Sí» se active.
 */
export default function Confirmar({ texto, pregunta, alConfirmar, className = 'btn sec peq', disabled = false, exigir = '' }) {
  const [abierto, setAbierto] = useState(false);
  const [haciendo, setHaciendo] = useState(false);
  const [escrito, setEscrito] = useState('');
  if (!abierto) return <button className={className} disabled={disabled} onClick={() => setAbierto(true)}>{texto}</button>;
  const coincide = !exigir || escrito.trim().toUpperCase() === exigir.toUpperCase();
  return (
    <span className="confirmar" role="group" aria-label={pregunta}>
      <span>{pregunta}</span>
      {exigir && (
        <input
          className="confirmar-texto" value={escrito} onChange={(e) => setEscrito(e.target.value)} autoFocus autoComplete="off" autoCapitalize="characters"
          aria-label={`Escriban ${exigir} para confirmar`} placeholder={exigir}
        />
      )}
      <button className="btn peq mal" disabled={haciendo || !coincide} onClick={async () => { setHaciendo(true); try { await alConfirmar(); } finally { setHaciendo(false); setAbierto(false); setEscrito(''); } }}>Sí</button>
      <button className="btn sec peq" onClick={() => { setAbierto(false); setEscrito(''); }}>No</button>
    </span>
  );
}
