import { useEffect, useRef, useState } from 'react';
import { tomaDesde, tomaDesdeArchivo } from '../local/foto.js';
import { MAX_NOTA, codigoToma } from '../../comun/dominio/toma.js';

function ahora() {
  return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Cámara (Registrar): visor 4:3 en blanco y negro con tercios, esquinas y obturador.
 * No elige canal: eso se hace en la mesa de edición.
 * Usa la cámara en vivo; si no hay permiso, ofrece abrir la cámara del teléfono.
 * Lo que se vio se escribe, y es opcional.
 */
export default function Camara({ totalTomas, ultima, alAbrirToma, alRegistrar }) {
  const video = useRef(null);
  const archivo = useRef(null);
  const [flujo, setFlujo] = useState(null);
  const [fallo, setFallo] = useState('');
  const [foto, setFoto] = useState(null);
  const [destello, setDestello] = useState(false);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let s = null;
    let vivo = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setFallo('Este navegador no deja usar la cámara en vivo.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((st) => {
        if (!vivo) { st.getTracks().forEach((t) => t.stop()); return; }
        s = st;
        setFlujo(st);
      })
      .catch(() => setFallo('Sin permiso de cámara. Pueden abrir la cámara del teléfono.'));
    return () => { vivo = false; s?.getTracks().forEach((t) => t.stop()); };
  }, []);

  useEffect(() => {
    if (video.current && flujo) video.current.srcObject = flujo;
  }, [flujo, foto]);

  function disparar() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setFoto(tomaDesde(v, v.videoWidth, v.videoHeight));
    setDestello(true);
    setTimeout(() => setDestello(false), 400);
  }

  async function desdeArchivo(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFoto(await tomaDesdeArchivo(f));
  }

  async function guardar() {
    setGuardando(true);
    try {
      await alRegistrar({ imagen: foto, nota });
      setFoto(null); setNota('');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="principal cam"><div className="cq">
        <div className="camb">
          <div className="vf">
            {foto ? <img src={foto} alt="Toma registrada" /> : flujo ? <video ref={video} autoPlay playsInline muted /> : <div className="vacio">{fallo || 'Abriendo la cámara…'}</div>}
            {!foto && <div className="tercios" aria-hidden="true"><i /><i /><i /><i /></div>}
            <b className="a" /><b className="b" /><b className="c" /><b className="d" />
            <span className="rec">{foto ? 'Registrada' : 'Encuadrando'}</span>
            <div className="bar"><span>4:3 · B/N</span><span>{ahora()}</span><span>{codigoToma(totalTomas + 1)}</span></div>
            <div className={`destello ${destello ? 'on' : ''}`} />
          </div>
          <div className="cs">
            {ultima ? (
              <button className="ultima" onClick={() => alAbrirToma(ultima)} aria-label={`Ver la última toma, ${ultima.codigo}`}>
                <img src={ultima.imagen} alt="" />
              </button>
            ) : <span className="ultima vacia" aria-hidden="true" />}
            <p className="etq2">Toma {totalTomas + 1}</p>
            <button className="shut" onClick={disparar} disabled={!flujo || !!foto} aria-label="Registrar toma" />
          </div>
        </div>
      </div></div>

      <div className="lateral">
      {!foto && (
        <>
          <p className="aviso">Encuadren y disparen. El canal lo asignan después en la mesa.</p>
          <div className="acciones">
            <button className="btn sec peq" onClick={() => archivo.current?.click()}>Abrir la cámara del teléfono</button>
            <input ref={archivo} className="sr" type="file" accept="image/*" capture="environment" onChange={desdeArchivo} />
          </div>
        </>
      )}

      {foto && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="campo">
            <label htmlFor="nota">Lo que se vio (opcional)</label>
            <textarea id="nota" maxLength={MAX_NOTA} value={nota} onChange={(e) => setNota(e.target.value)} />
          </div>
          <div className="acciones">
            <button className="btn" onClick={guardar} disabled={guardando}>Guardar</button>
            <button className="btn sec" onClick={() => setFoto(null)} disabled={guardando}>Repetir</button>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
