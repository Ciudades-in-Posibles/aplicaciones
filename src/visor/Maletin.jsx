import { useCallback, useEffect, useRef, useState } from 'react';
import { alternarPantallaCompleta } from '../comun/local/pantalla.js';
import { normalizarCodigo } from '../comun/dominio/mesa.js';
import { CITA, DIGITOS_CLAVE, claveDesdeHash, comprobarClave, maletinDeMesa } from '../comun/dominio/maletin.js';
import { unirPantalla } from '../comun/red/mesa.js';
import { escucharMesa } from '../comun/red/muro.js';

// El maletín en 3D (/maletin): un objeto del juego que se gira en la pantalla. Pide la clave de seis
// dígitos (por teclado o desde la Consola) y, si coincide con la del enlace (#NNN-NNN), se acuesta,
// abre la tapa y deja ver la cita pegada adentro. three.js llega solo con esta vista.
const MODELO = '/modelos/maletin.glb';
const POSTER = '/modelos/maletin.webp';
const QUIETO_MS = 3000; // sin mover el mouse, se ocultan cursor y controles
const LLAVE_CLAVE = 'maletin-clave'; // sessionStorage: la clave aguanta una recarga en esta pestaña
const MS_DIGITO = 260; // los dígitos que manda la Consola llegan uno por uno
const MS_ABRIR = 6000;
const MS_CERRAR = 4000;

// la hoja pegada en la tapa: 40 × 29 cm sobre el forro (la tapa mide 45 × 33)
const HOJA_M = [0.4, 0.29];
const HOJA_PX = [2048, Math.round(2048 * HOJA_M[1] / HOJA_M[0])];

const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function leerClave() {
  const delEnlace = claveDesdeHash(location.hash);
  try {
    if (delEnlace) sessionStorage.setItem(LLAVE_CLAVE, delEnlace);
    else return sessionStorage.getItem(LLAVE_CLAVE) || '';
  } catch { /* sin sessionStorage, la clave vive solo en memoria */ }
  return delEnlace;
}

/** La cita en papel, con tinta negra: Gabarito para leer, Plex Mono para el crédito. */
function dibujarHoja(canvas) {
  const [W, H] = HOJA_PX;
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = '#f5f3ea';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#0b0b0c';
  g.textBaseline = 'alphabetic';

  const margen = W * 0.085;
  const ancho = W - 2 * margen;
  let t = 100;
  g.font = `400 ${t}px Gabarito, system-ui, sans-serif`;
  const masAncha = Math.max(...CITA.lineas.map((l) => g.measureText(l).width));
  t = Math.floor(t * ancho / masAncha);
  const credito = Math.round(t * 0.5);
  const paso = t * 1.36;
  const alto = paso * (CITA.lineas.length - 1) + t + credito * 3.2;
  if (alto > H - 2 * margen * 0.8) t = Math.floor(t * (H - 2 * margen * 0.8) / alto);
  const pasoF = t * 1.36;
  const altoF = pasoF * (CITA.lineas.length - 1) + t + Math.round(t * 0.5) * 3.2;

  let y = (H - altoF) / 2 + t * 0.8;
  g.font = `400 ${t}px Gabarito, system-ui, sans-serif`;
  for (const linea of CITA.lineas) { g.fillText(linea, margen, y); y += pasoF; }
  const c = Math.round(t * 0.5);
  g.font = `500 ${c}px "IBM Plex Mono", ui-monospace, monospace`;
  g.fillText(`${CITA.autor} · ${CITA.obra}`.toUpperCase(), margen, y - pasoF + c * 3.2);
}

export default function Maletin({ raiz = '' }) {
  const escena = useRef(null);
  const visor = useRef(null);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState('');
  const [girando, setGirando] = useState(() => !reducido());
  const [quieto, setQuieto] = useState(false);

  const [clave] = useState(leerClave);
  const [entrada, setEntrada] = useState('');
  const [mal, setMal] = useState(false);
  const [estado, setEstado] = useState('cerrado'); // cerrado · abriendo · abierto · cerrando
  const [mesa] = useState(() => { try { return normalizarCodigo(localStorage.getItem('transmisor-pantalla')); } catch { return ''; } });
  const [conMesa, setConMesa] = useState(false);
  const quiereAbierto = useRef(false);
  const relojes = useRef([]);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const entradaRef = useRef(entrada);
  entradaRef.current = entrada;

  // la clave no se queda en la barra de direcciones
  useEffect(() => {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }, []);

  const limpiarRelojes = () => { relojes.current.forEach(clearTimeout); relojes.current = []; };
  const despues = (ms, fn) => { relojes.current.push(setTimeout(fn, ms)); };

  const abrir = useCallback((inmediato = false) => {
    quiereAbierto.current = true;
    setGirando(false);
    visor.current?.abrir(inmediato || reducido());
  }, []);

  const cerrar = useCallback((inmediato = false) => {
    quiereAbierto.current = false;
    limpiarRelojes();
    setEntrada('');
    visor.current?.cerrar(inmediato || reducido());
  }, []);

  const probar = useCallback((digitos) => {
    if (comprobarClave(digitos, clave)) {
      despues(350, () => { setEntrada(''); abrir(); });
    } else {
      setMal(true);
      despues(700, () => { setMal(false); setEntrada(''); });
    }
  }, [clave, abrir]);

  // proyectando: cursor y controles solo al mover el mouse; F alterna pantalla completa
  useEffect(() => {
    let t = setTimeout(() => setQuieto(true), QUIETO_MS);
    const mover = () => { setQuieto(false); clearTimeout(t); t = setTimeout(() => setQuieto(true), QUIETO_MS); };
    window.addEventListener('pointermove', mover);
    return () => { clearTimeout(t); window.removeEventListener('pointermove', mover); };
  }, []);

  // el atajo: escribir los dígitos en cualquier momento; Retroceso borra, Esc cancela
  useEffect(() => {
    const tecla = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') { alternarPantallaCompleta(); return; }
      if (estadoRef.current !== 'cerrado' || mal) return;
      const d = entradaRef.current;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        if (d.length >= DIGITOS_CLAVE) return;
        const nueva = d + e.key;
        entradaRef.current = nueva;
        setEntrada(nueva);
        if (nueva.length === DIGITOS_CLAVE) probar(nueva);
      } else if (e.key === 'Backspace') {
        entradaRef.current = d.slice(0, -1);
        setEntrada(entradaRef.current);
      } else if (e.key === 'Escape') {
        entradaRef.current = '';
        setEntrada('');
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [mal, probar]);

  // desde la Consola: cada envío nuevo llega dígito por dígito; vacío cierra la tapa
  useEffect(() => {
    if (!mesa) return;
    let vivo = true;
    let parar = () => {};
    let ultimo = null;
    unirPantalla(mesa).then(() => {
      if (!vivo) return;
      setConMesa(true);
      parar = escucharMesa(mesa, (datos) => {
        const m = maletinDeMesa(datos);
        const n = m?.n ?? 0; // una mesa que nunca usó el maletín cuenta como 0 envíos
        if (ultimo === null) {
          ultimo = n;
          // al recargar: si la Consola ya lo abrió, se muestra abierto sin repetir la escena
          if (m && comprobarClave(m.digitos, clave)) abrir(true);
          return;
        }
        if (!m || n === ultimo) return;
        ultimo = n;
        limpiarRelojes();
        setMal(false);
        if (!m.digitos) { cerrar(); return; }
        if (estadoRef.current !== 'cerrado') return;
        setEntrada('');
        [...m.digitos].forEach((_, i) => despues(MS_DIGITO * (i + 1), () => setEntrada(m.digitos.slice(0, i + 1))));
        if (m.digitos.length === DIGITOS_CLAVE) despues(MS_DIGITO * (DIGITOS_CLAVE + 1), () => probar(m.digitos));
      }, () => setConMesa(false));
    }).catch(() => vivo && setConMesa(false));
    return () => { vivo = false; parar(); limpiarRelojes(); };
  }, [mesa, clave, abrir, cerrar, probar]);

  useEffect(() => {
    let vivo = true;
    let limpiar = () => {};
    (async () => {
      const [THREE, { GLTFLoader }, { OrbitControls }, { RoomEnvironment }, { MeshoptDecoder }] = await Promise.all([
        import('three'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        import('three/examples/jsm/environments/RoomEnvironment.js'),
        import('three/examples/jsm/libs/meshopt_decoder.module.js')
      ]);
      if (!vivo) return;
      const caja = escena.current;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.toneMapping = THREE.AgXToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      caja.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = entorno;
      scene.environmentIntensity = 0.55;

      // en glTF el frente del maletín mira a +Z y arriba es +Y; mide 45 × 33 × 8,7 cm.
      // La junta está en z = 0 y la bisagra en la arista de abajo (y = 0).
      const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
      const objetivo = new THREE.Vector3(0, 0.19, 0);
      const inicio = new THREE.Vector3(0.45, 0.5, 1).normalize().multiplyScalar(1.3).add(objetivo);
      camera.position.copy(inicio);

      const luz = new THREE.DirectionalLight(0xfff4e6, 2.2);
      luz.position.set(0.9, 1.1, 1.0);
      luz.castShadow = true;
      luz.shadow.mapSize.set(1024, 1024);
      Object.assign(luz.shadow.camera, { left: -0.5, right: 0.5, top: 0.5, bottom: -0.5, near: 0.1, far: 4 });
      luz.shadow.radius = 6;
      scene.add(luz);
      const contra = new THREE.DirectionalLight(0xffffff, 1.0);
      contra.position.set(-0.4, 0.9, -1.2);
      scene.add(contra);

      const suelo = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.ShadowMaterial({ opacity: 0.35 }));
      suelo.rotation.x = -Math.PI / 2;
      suelo.receiveShadow = true;
      scene.add(suelo);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(objetivo);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.minDistance = 0.5;
      controls.maxDistance = 1.8;
      controls.maxPolarAngle = Math.PI * 0.52; // sin mirar por debajo del suelo
      controls.autoRotateSpeed = 1.2;
      controls.update();

      const ajustar = () => {
        const { width, height } = caja.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(ajustar);
      ro.observe(caja);
      ajustar();

      // el maletín: la base (frente, con asa y cerraduras) y la tapa, que gira en la bisagra
      const cuerpo = new THREE.Group();
      const tapa = new THREE.Group();
      cuerpo.add(tapa);
      scene.add(cuerpo);

      // la hoja con la cita, pegada sobre el forro de la tapa (su cara interior está en z ≈ -0,7 mm)
      const lienzo = document.createElement('canvas');
      dibujarHoja(lienzo);
      const textura = new THREE.CanvasTexture(lienzo);
      textura.colorSpace = THREE.SRGBColorSpace;
      textura.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const hoja = new THREE.Mesh(
        new THREE.PlaneGeometry(...HOJA_M),
        new THREE.MeshStandardMaterial({ map: textura, emissiveMap: textura, emissive: 0xffffff, emissiveIntensity: 0.42, roughness: 0.92 })
      );
      hoja.position.set(0, 0.165, -0.0004);
      hoja.receiveShadow = true;
      tapa.add(hoja);
      document.fonts?.ready.then(() => Promise.all([
        document.fonts.load('400 64px Gabarito'),
        document.fonts.load('500 32px "IBM Plex Mono"')
      ])).then(() => { if (vivo) { dibujarHoja(lienzo); textura.needsUpdate = true; } }).catch(() => {});

      // pose: p = 0 cerrado y de pie; hasta 0,4 se acuesta con el asa hacia quien mira; después abre la tapa
      const ACOSTAR = Math.PI / 2;
      const ABRIR = THREE.MathUtils.degToRad(104);
      const GRUESO = 0.0448; // del frente a la junta: lo que sube para quedar sobre el suelo
      const suave = (x) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
      let p = 0;
      const posar = (q) => {
        const a = ACOSTAR * suave(q / 0.4);
        cuerpo.rotation.x = a;
        cuerpo.position.y = GRUESO * Math.sin(a);
        tapa.rotation.x = -ABRIR * suave((q - 0.4) / 0.6);
      };

      // a dónde va la cámara con la tapa abierta: de frente a la hoja, que la llene
      const vistaHoja = () => {
        const antes = p;
        posar(1);
        cuerpo.updateMatrixWorld(true);
        const centro = hoja.getWorldPosition(new THREE.Vector3());
        const normal = hoja.getWorldDirection(new THREE.Vector3());
        posar(antes);
        cuerpo.updateMatrixWorld(true);
        const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const dist = Math.max((HOJA_M[1] / 2) * 1.14 / tan, (HOJA_M[0] / 2) * 1.14 / (tan * camera.aspect));
        return { objetivo: centro, posicion: centro.clone().addScaledVector(normal, dist), dist };
      };

      // de paso, una vista general desde arriba y al frente: se ve acostarse el maletín y abrirse la tapa
      const general = { objetivo: new THREE.Vector3(0, 0.13, 0.08), posicion: new THREE.Vector3(0.22, 0.78, 1.18) };

      let tween = null;
      const ir = (hasta, ms, alTerminar) => {
        const fin = hasta === 1 ? vistaHoja() : { objetivo, posicion: inicio, dist: 0 };
        controls.autoRotate = false;
        // lo que quedó del giro o del arrastre se aplica ya, para que no tuerza la vista al final
        controls.enableDamping = false;
        controls.update();
        controls.enableDamping = true;
        controls.enabled = false;
        tween = {
          p0: p, p1: hasta, t0: performance.now(), ms,
          c0: camera.position.clone(), c1: fin.posicion,
          o0: controls.target.clone(), o1: fin.objetivo,
          fin: () => {
            controls.minDistance = hasta === 1 ? Math.min(0.5, fin.dist * 0.6) : 0.5;
            controls.enabled = true;
            controls.update();
            alTerminar();
          }
        };
      };

      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      loader.load(MODELO, (gltf) => {
        if (!vivo) return;
        // el GLB es una sola malla; cada material se parte por la junta (centro de cada triángulo)
        const mallas = [];
        gltf.scene.traverse((o) => { if (o.isMesh) mallas.push(o); });
        for (const m of mallas) {
          const g = m.geometry;
          const pos = g.attributes.position;
          const idx = g.index;
          const lados = [[], []]; // tapa (z < 0), base
          for (let t = 0; t < idx.count; t += 3) {
            const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
            const z = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
            lados[z < 0 ? 0 : 1].push(a, b, c);
          }
          lados.forEach((indices, i) => {
            if (!indices.length) return;
            const parte = new THREE.BufferGeometry();
            for (const [nombre, attr] of Object.entries(g.attributes)) parte.setAttribute(nombre, attr);
            parte.setIndex(indices);
            parte.computeBoundingSphere();
            const malla = new THREE.Mesh(parte, m.material);
            malla.castShadow = true;
            malla.receiveShadow = true;
            (i === 0 ? tapa : cuerpo).add(malla);
          });
        }
        setListo(true);
        if (quiereAbierto.current) visor.current?.abrir(true);
      }, undefined, () => vivo && setError('No se pudo cargar el maletín. Revisen la conexión y recarguen la página.'));

      visor.current = {
        girar: (on) => { if (!tween && p === 0) controls.autoRotate = on; },
        encuadrar: () => {
          if (tween) return;
          if (p === 1) { const v = vistaHoja(); camera.position.copy(v.posicion); controls.target.copy(v.objetivo); }
          else { camera.position.copy(inicio); controls.target.copy(objetivo); }
          controls.update();
        },
        rotar: (paso) => {
          const off = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), paso);
          camera.position.copy(controls.target).add(off);
          controls.update();
        },
        abrir: (inmediato) => {
          if (p === 1 && !tween) return;
          setEstado('abriendo');
          ir(1, inmediato ? 0 : MS_ABRIR, () => setEstado('abierto'));
        },
        cerrar: (inmediato) => {
          if (p === 0 && !tween) return;
          setEstado('cerrando');
          ir(0, inmediato ? 0 : MS_CERRAR, () => { setEstado('cerrado'); if (!reducido()) setGirando(true); });
        }
      };
      visor.current.girar(girando);

      renderer.setAnimationLoop((ahora) => {
        if (tween) {
          const k = tween.ms ? Math.min(1, (ahora - tween.t0) / tween.ms) : 1;
          // el maletín se mueve en el centro del recorrido; la cámara va y viene de la vista general
          p = tween.p0 + (tween.p1 - tween.p0) * Math.min(1, Math.max(0, (k - 0.1) / 0.72));
          posar(p);
          const ida = suave(k / 0.42), vuelta = suave((k - 0.6) / 0.4);
          if (k < 0.6) {
            camera.position.lerpVectors(tween.c0, general.posicion, ida);
            controls.target.lerpVectors(tween.o0, general.objetivo, ida);
          } else {
            camera.position.lerpVectors(general.posicion, tween.c1, vuelta);
            controls.target.lerpVectors(general.objetivo, tween.o1, vuelta);
          }
          camera.lookAt(controls.target);
          if (k >= 1) { const t = tween; tween = null; p = t.p1; t.fin(); }
        } else {
          controls.update();
        }
        renderer.render(scene, camera);
      });

      limpiar = () => {
        renderer.setAnimationLoop(null);
        ro.disconnect();
        controls.dispose();
        scene.traverse((o) => {
          o.geometry?.dispose();
          [].concat(o.material || []).forEach((m) => { Object.values(m).forEach((v) => v?.isTexture && v.dispose()); m.dispose(); });
        });
        entorno.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        visor.current = null;
      };
    })().catch(() => vivo && setError('Esta pantalla no puede mostrar el maletín en 3D.'));
    return () => { vivo = false; limpiar(); };
    // girando se aplica aparte; el visor se arma una sola vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { visor.current?.girar(girando); }, [girando]);

  const tecla = (e) => {
    const paso = { ArrowLeft: 0.12, ArrowRight: -0.12 }[e.key];
    if (paso === undefined) return;
    e.preventDefault();
    visor.current?.rotar(paso);
  };

  const cerrado = estado === 'cerrado';
  const casillas = Array.from({ length: DIGITOS_CLAVE }, (_, i) => i < entrada.length);

  return (
    <main className={`al-aire maletin-v ${quieto ? 'quieto' : ''}`}>
      <p className="marca-v wm" aria-label="Ciudades(In)Posibles"><span className="tira">Ciudades<span className="in">(In)</span>Posibles</span></p>
      <div
        ref={escena}
        className={`escena-m ${listo ? 'listo' : ''}`}
        tabIndex={0}
        role="img"
        aria-label={estado === 'abierto'
          ? `Maletín abierto. En la tapa, una hoja dice: ${CITA.lineas.join(' ')} ${CITA.autor}, ${CITA.obra}.`
          : 'Maletín de cuero café con asa acolchada y dos cerraduras doradas de combinación. Se gira arrastrando o con las flechas.'}
        onKeyDown={tecla}
      >
        <img src={POSTER} alt="" />
      </div>
      {cerrado && (entrada || mal) && (
        <div className={`cerraduras-m ${mal ? 'mal' : ''}`} role="status" aria-label={`${entrada.length} de ${DIGITOS_CLAVE} dígitos`}>
          {[0, 1].map((c) => (
            <span className="cerradura-m" key={c}>
              {casillas.slice(c * 3, c * 3 + 3).map((lleno, i) => <i key={i} className={lleno ? 'lleno' : ''} />)}
            </span>
          ))}
        </div>
      )}
      {error && <p className="aviso-visor" role="alert">{error}</p>}
      <footer className="pie">
        <span className="pie-a">
          <span>Maletín</span>
          {!clave && <span className="nota-m">Sin clave</span>}
          {mesa && !conMesa && <span className="nota-m">Sin mesa</span>}
        </span>
        <span className="mandos">
          <button onClick={alternarPantallaCompleta}>Pantalla completa</button>
          {cerrado && <button aria-pressed={girando} onClick={() => setGirando((g) => !g)}>{girando ? 'Detener giro' : 'Girar'}</button>}
          {estado === 'abierto' && <button onClick={() => cerrar()}>Cerrar</button>}
          <button onClick={() => visor.current?.encuadrar()}>Encuadre</button>
          <a href={raiz || '/'}>Televisor</a>
        </span>
        <span>{cerrado ? 'Arrastren para girar' : ''}</span>
      </footer>
    </main>
  );
}
