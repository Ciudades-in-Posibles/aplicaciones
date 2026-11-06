import { useEffect, useRef, useState } from 'react';
import { peripage } from './peripage.js';
import { prepararCarta, FORMATOS } from './cartaTermica.js';
import { prepararQR } from './qrTermica.js';
import './termica.css';

const CLAVE_CONCENTRACION = 'consola-termica-concentracion';
const CLAVE_FORMATO = 'consola-termica-formato';
const CONCENTRACIONES = [['0', 'Clara'], ['1', 'Media'], ['2', 'Oscura']];

export function usePeriPage() {
  const [foto, setFoto] = useState(() => peripage.foto());
  useEffect(() => peripage.escuchar(setFoto), []);
  return foto;
}

function useGuardado(clave, inicial) {
  const [v, setV] = useState(() => localStorage.getItem(clave) || inicial);
  return [v, (nuevo) => { localStorage.setItem(clave, nuevo); setV(nuevo); }];
}

/** Tinta y formato, compartidos por el detalle y el lote, y recordados en este computador. */
function useAjustes() {
  const [concentracion, setConcentracion] = useGuardado(CLAVE_CONCENTRACION, '1');
  const [formato, setFormato] = useGuardado(CLAVE_FORMATO, 'carta');
  return { concentracion, setConcentracion, formato: FORMATOS.some(([f]) => f === formato) ? formato : 'carta', setFormato };
}

function motivo(e) {
  if (e?.name === 'NotFoundError') return ''; // cerraron el selector
  if (e?.message === 'sin-imagen') return 'Esta señal no trae su toma.';
  if (e?.message === 'sin-escritura') return 'Esa impresora no acepta envíos por esta vía. Prueben con el puerto serie.';
  return 'Se cortó la conexión con la impresora. Conecten de nuevo.';
}

/** Estado de la impresora con los botones para conectarla y la concentración. */
export function BarraImpresora({ ajustes, sinFormato = false }) {
  const { concentracion, setConcentracion, formato, setFormato } = ajustes;
  const { estado, nombre, hayBluetooth, haySerie } = usePeriPage();
  const [aviso, setAviso] = useState('');
  const conectar = (f) => async () => {
    setAviso('');
    try { await f(); } catch (e) { setAviso(motivo(e)); }
  };
  if (estado === 'sinSoporte') return <p className="tm-aviso">Esta impresora funciona en Chrome de computador.</p>;
  const conectada = estado === 'lista' || estado === 'imprimiendo';
  return (
    <div className="tm-barra">
      <span className={`tm-luz ${conectada ? 'on' : ''}`} aria-hidden="true" />
      <span className="tm-estado">
        {estado === 'conectando' ? 'Conectando…' : conectada ? nombre : 'Impresora sin conectar'}
      </span>
      {!conectada && estado !== 'conectando' && (
        <>
          {hayBluetooth && <button className="btn peq" onClick={conectar(() => peripage.conectarBluetooth())}>Conectar PeriPage</button>}
          {haySerie && <button className="enlace" onClick={conectar(() => peripage.conectarSerie())}>Usar puerto serie</button>}
        </>
      )}
      {conectada && <button className="enlace" onClick={() => peripage.desconectar()}>Soltar</button>}
      <span className="tm-ajustes">
        {!sinFormato && (
          <label className="tm-conc">
            <span className="etq">Formato</span>
            <select value={formato} onChange={(e) => setFormato(e.target.value)}>
              {FORMATOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
        )}
        <label className="tm-conc">
          <span className="etq">Tinta</span>
          <select value={concentracion} onChange={(e) => setConcentracion(e.target.value)}>
            {CONCENTRACIONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
      </span>
      {aviso && <p className="tm-aviso">{aviso}</p>}
    </div>
  );
}

/** En el detalle de una señal: vista previa en 1 bit y el botón para imprimirla. */
export function TermicaSenal({ senal }) {
  const { estado } = usePeriPage();
  const ajustes = useAjustes();
  const { concentracion, formato } = ajustes;
  const [carta, setCarta] = useState(null);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let vivo = true;
    setCarta(null); setAviso('');
    prepararCarta(senal, { concentracion: Number(concentracion), formato })
      .then((c) => vivo && setCarta(c))
      .catch((e) => vivo && setAviso(e?.message === 'sin-imagen' ? 'Esta señal no trae su toma.' : 'No pudimos armar la carta de esta toma.'));
    return () => { vivo = false; };
  }, [senal, concentracion, formato]);

  async function imprimir() {
    setAviso('');
    try { await peripage.enviar(carta.bytes); setAviso('Enviada a la impresora.'); }
    catch (e) { setAviso(motivo(e)); }
  }

  return (
    <div className="tm-senal">
      <div className="tm-papel">{carta ? <img src={carta.vista} alt="Vista de la impresión en papel térmico" /> : <span className="etq">Armando la carta…</span>}</div>
      <BarraImpresora ajustes={ajustes} />
      <div className="acciones">
        <button className="btn aire" onClick={imprimir} disabled={!carta || estado !== 'lista'}>{estado === 'imprimiendo' ? 'Imprimiendo…' : formato === 'carta' ? 'Imprimir carta' : 'Imprimir imagen'}</button>
      </div>
      {aviso && <p className="tm-aviso">{aviso}</p>}
    </div>
  );
}

/** En la Consola, junto al código de mesa: el ticket con el QR que abre el Transmisor con el código puesto. */
export function TermicaQR({ mesa }) {
  const { estado } = usePeriPage();
  const ajustes = useAjustes();
  const { concentracion } = ajustes;
  const [ticket, setTicket] = useState(null);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let vivo = true;
    setTicket(null); setAviso('');
    prepararQR(mesa, { concentracion: Number(concentracion) })
      .then((c) => vivo && setTicket(c))
      .catch(() => vivo && setAviso('No pudimos armar el QR de esta mesa.'));
    return () => { vivo = false; };
  }, [mesa.id, mesa.nombre, concentracion]);

  async function imprimir() {
    setAviso('');
    try { await peripage.enviar(ticket.bytes); setAviso('Enviado a la impresora.'); }
    catch (e) { setAviso(motivo(e)); }
  }

  return (
    <div className="tm-senal">
      <div className="tm-papel">{ticket ? <img src={ticket.vista} alt={`QR de la mesa ${mesa.id} en papel térmico`} /> : <span className="etq">Armando el QR…</span>}</div>
      <BarraImpresora ajustes={ajustes} sinFormato />
      <div className="acciones">
        <button className="btn aire" onClick={imprimir} disabled={!ticket || estado !== 'lista'}>{estado === 'imprimiendo' ? 'Imprimiendo…' : 'Imprimir QR'}</button>
      </div>
      {aviso && <p className="tm-aviso">{aviso}</p>}
    </div>
  );
}

/** En «Imprimir cartas»: manda todas las cartas, una tras otra, y retoma donde se cortó. */
export function TermicaLote({ senales }) {
  const { estado } = usePeriPage();
  const ajustes = useAjustes();
  const { concentracion, formato } = ajustes;
  const [hechas, setHechas] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const detener = useRef(false);

  useEffect(() => { setHechas(0); }, [senales]);

  async function imprimir() {
    detener.current = false;
    setCorriendo(true); setAviso('');
    let i = hechas >= senales.length ? 0 : hechas;
    try {
      for (; i < senales.length; i++) {
        if (detener.current) { setAviso(`Detenidas en la ${i + 1} de ${senales.length}. Pueden seguir desde ahí.`); break; }
        const { bytes } = await prepararCarta(senales[i], { concentracion: Number(concentracion), formato });
        await peripage.enviar(bytes);
        setHechas(i + 1);
      }
      if (i >= senales.length) setAviso(`Listas las ${senales.length}.`);
    } catch (e) {
      setAviso(`${motivo(e) || 'Se detuvo la impresión.'} Siguen desde la ${i + 1}.`);
    } finally {
      setCorriendo(false);
    }
  }

  const n = senales.length;
  const sigue = hechas > 0 && hechas < n;
  return (
    <div className="tm-lote">
      <BarraImpresora ajustes={ajustes} />
      {corriendo
        ? <button className="btn sec" onClick={() => { detener.current = true; }}>Detener ({hechas} de {n})</button>
        : <button className="btn aire" onClick={imprimir} disabled={!n || estado !== 'lista'}>{sigue ? `Seguir desde la ${hechas + 1} de ${n}` : `Imprimir ${n} en térmica`}</button>}
      {sigue && !corriendo && <button className="enlace" onClick={() => setHechas(0)}>Empezar de nuevo</button>}
      {aviso && <p className="tm-aviso">{aviso}</p>}
    </div>
  );
}
