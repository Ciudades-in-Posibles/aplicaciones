import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as red from './red/consola.js';
import { enHojas, fechaCorta, textoDeCarta } from '../comun/dominio/archivo.js';
import { canalValido } from '../comun/dominio/canales.js';
import './cartas.css';
import { TermicaLote } from './impresora/Termica.jsx';

/** Carta de registro de una señal: la toma 4:3 en blanco y negro girada a sangre, la ficha del canal y la franja. */
function Carta({ senal }) {
  const n = canalValido(senal.canal) ? senal.canal : 0;
  return (
    <div className="cp-celda">
      <div className={`ct ct-toma ${n ? `k${n}` : ''}`}>
        <div className="ct-in">
          <span className="ct-foto"><img src={senal.imagen} alt="" /></span>
          <span className="ct-franja">
            <b>{textoDeCarta(senal)}</b>
            <span>{senal.equipo}</span>
            <span>{senal.codigo} · {fechaCorta(senal.hora || senal.creada)}</span>
          </span>
          <span className="ct-ficha" aria-hidden="true">
            <b>{n || '–'}</b>
            <em>{senal.canalNombre}</em>
            <span className="ct-dial">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => <i key={k} className={k === n ? 'on' : ''} />)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Vista de impresión: las cartas de registro de la mesa, seis por hoja (3 × 2) con marcas de corte.
 * El PDF sale con «Guardar como PDF» del diálogo de impresión del navegador.
 */
export default function Cartas({ mesa, alCerrar }) {
  const [senales, setSenales] = useState(null);
  const [error, setError] = useState('');
  const [termica, setTermica] = useState(false);

  useEffect(() => {
    let vivo = true;
    red.leerSenales(mesa.id)
      .then((s) => vivo && setSenales(s))
      .catch(() => vivo && setError('No pudimos leer las tomas de la mesa. ¿Otra vez?'));
    return () => { vivo = false; };
  }, [mesa.id]);

  // al imprimir, el resto de la Consola se oculta
  useEffect(() => {
    document.body.classList.add('cp-imprimiendo');
    return () => document.body.classList.remove('cp-imprimiendo');
  }, []);

  const hojas = senales ? enHojas(senales) : [];
  return createPortal(
    <div className="cp-capa" role="dialog" aria-modal="true" aria-label="Cartas para imprimir">
      <div className="cp-barra">
        <p>
          {error || (senales === null
            ? 'Preparando las cartas…'
            : senales.length
              ? `${senales.length} ${senales.length === 1 ? 'carta' : 'cartas'} en ${hojas.length} ${hojas.length === 1 ? 'hoja' : 'hojas'}, seis por hoja. En el diálogo elijan Carta u oficio horizontal, y «Guardar como PDF» si quieren el archivo.`
              : 'Todavía no hay tomas al aire en esta mesa.')}
        </p>
        <button className="btn aire" onClick={() => window.print()} disabled={!senales?.length}>Imprimir</button>
        <button className="btn sec" onClick={() => setTermica((t) => !t)} disabled={!senales?.length} aria-expanded={termica}>Térmica</button>
        <button className="btn sec" onClick={alCerrar}>Cerrar</button>
        {termica && senales?.length > 0 && <TermicaLote senales={senales} />}
      </div>
      <div className="cp-vista">
        {hojas.map((hoja, i) => (
          <section key={i} className="cp-hoja" aria-label={`Hoja ${i + 1}`}>
            <div className="cp-grilla">{hoja.map((s) => <Carta key={s.id} senal={s} />)}</div>
          </section>
        ))}
      </div>
    </div>,
    document.body
  );
}
