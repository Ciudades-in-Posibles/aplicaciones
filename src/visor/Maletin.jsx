import { useEffect, useRef, useState } from 'react';
import { alternarPantallaCompleta } from '../comun/local/pantalla.js';

// El maletín en 3D (/maletin): un objeto del juego que se gira en la pantalla.
// No lee la mesa ni Firebase. three.js llega solo con esta vista.
const MODELO = '/modelos/maletin.glb';
const POSTER = '/modelos/maletin.webp';
const QUIETO_MS = 3000; // sin mover el mouse, se ocultan cursor y controles

export default function Maletin({ raiz = '' }) {
  const escena = useRef(null);
  const visor = useRef(null);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState('');
  const [girando, setGirando] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [quieto, setQuieto] = useState(false);

  // proyectando: cursor y controles solo al mover el mouse; F alterna pantalla completa
  useEffect(() => {
    let t = setTimeout(() => setQuieto(true), QUIETO_MS);
    const mover = () => { setQuieto(false); clearTimeout(t); t = setTimeout(() => setQuieto(true), QUIETO_MS); };
    const tecla = (e) => { if (e.key === 'f' || e.key === 'F') alternarPantallaCompleta(); };
    window.addEventListener('pointermove', mover);
    window.addEventListener('keydown', tecla);
    return () => { clearTimeout(t); window.removeEventListener('pointermove', mover); window.removeEventListener('keydown', tecla); };
  }, []);

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

      // en glTF el frente del maletín mira a +Z y arriba es +Y; mide 45 × 33 × 8,7 cm
      const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
      const objetivo = new THREE.Vector3(0, 0.19, 0);
      const inicio = new THREE.Vector3(0.45, 0.5, 1).normalize().multiplyScalar(1.3).add(objetivo);
      camera.position.copy(inicio);

      const clave = new THREE.DirectionalLight(0xfff4e6, 2.2);
      clave.position.set(0.9, 1.1, 1.0);
      clave.castShadow = true;
      clave.shadow.mapSize.set(1024, 1024);
      Object.assign(clave.shadow.camera, { left: -0.5, right: 0.5, top: 0.5, bottom: -0.5, near: 0.1, far: 4 });
      clave.shadow.radius = 6;
      scene.add(clave);
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

      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      loader.load(MODELO, (gltf) => {
        if (!vivo) return;
        gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        scene.add(gltf.scene);
        setListo(true);
      }, undefined, () => vivo && setError('No se pudo cargar el maletín. Revisen la conexión y recarguen la página.'));

      visor.current = {
        girar: (on) => { controls.autoRotate = on; },
        encuadrar: () => { camera.position.copy(inicio); controls.target.copy(objetivo); controls.update(); },
        rotar: (paso) => {
          const off = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), paso);
          camera.position.copy(controls.target).add(off);
          controls.update();
        }
      };
      visor.current.girar(girando);

      renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });

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

  return (
    <main className={`al-aire maletin-v ${quieto ? 'quieto' : ''}`}>
      <p className="marca-v wm" aria-label="Ciudades(In)Posibles"><span className="tira">Ciudades<span className="in">(In)</span>Posibles</span></p>
      <div
        ref={escena}
        className={`escena-m ${listo ? 'listo' : ''}`}
        tabIndex={0}
        role="img"
        aria-label="Maletín de cuero café con asa acolchada y dos cerraduras doradas de combinación. Se gira arrastrando o con las flechas."
        onKeyDown={tecla}
      >
        <img src={POSTER} alt="" />
      </div>
      {error && <p className="aviso-visor" role="alert">{error}</p>}
      <footer className="pie">
        <span className="pie-a"><span>Maletín</span></span>
        <span className="mandos">
          <button onClick={alternarPantallaCompleta}>Pantalla completa</button>
          <button aria-pressed={girando} onClick={() => setGirando((g) => !g)}>{girando ? 'Detener giro' : 'Girar'}</button>
          <button onClick={() => visor.current?.encuadrar()}>Encuadre</button>
          <a href={raiz || '/'}>Televisor</a>
        </span>
        <span>Arrastren para girar</span>
      </footer>
    </main>
  );
}
