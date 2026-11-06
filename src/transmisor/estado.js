/**
 * Estado del juego en el teléfono: une el almacenamiento local, la cola de salida y el muro.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as local from './local/db.js';
import { canalesConAbiertos } from '../comun/dominio/canales.js';
import { crearToma, editarToma, encolar, sacarDeCola as tomaFueraDeCola, volverALocal, deshacerPrueba, senalDePrueba, asignarCanal, sacarDelAire as tomaFueraDelAire } from '../comun/dominio/toma.js';
import { agregar, quitar, mover, sincronizar } from '../comun/dominio/tira.js';
import { nuevoElemento } from '../comun/dominio/cola.js';
import { iniciarAppCheck } from './appcheck.js';
import { VECINOS_DE_PRUEBA } from '../comun/dominio/andares.js';

// App Check se inicializa antes de cargar cualquier módulo que hable con Firebase (solo si hay clave)
const conAppCheck = (cargar) => async () => { await iniciarAppCheck(); return cargar(); };
const red = conAppCheck(() => import('./red/transmitir.js'));
const muroRed = conAppCheck(() => import('../comun/red/muro.js'));
const mesaRed = conAppCheck(() => import('../comun/red/mesa.js'));

export function useJuego() {
  const [listo, setListo] = useState(false);
  const [equipo, setEquipo] = useState(null); // {mesa, uid, nombre} o null
  const [inicio, setInicio] = useState(false); // ya pasó por la entrada
  const [canal, setCanal] = useState(1);
  const [abiertos, setAbiertos] = useState({});
  const [tomas, setTomas] = useState([]);
  const [tira, setTira] = useState([]);
  const [cola, setCola] = useState([]);
  const [muro, setMuro] = useState([]);
  const [vecinosMesa, setVecinosMesa] = useState([]);
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [aviso, setAviso] = useState(null);

  const canales = useMemo(() => canalesConAbiertos(abiertos), [abiertos]);
  const ctxRef = useRef(null);
  ctxRef.current = equipo ? { mesa: equipo.mesa, uid: equipo.uid, equipo: equipo.nombre, canales } : null;

  const recargar = useCallback(async () => {
    const [t, c, ti] = await Promise.all([local.listarTomas(), local.listarCola(), local.leerAjuste('tira', [])]);
    setTomas(t);
    setCola(c);
    const nueva = sincronizar(ti, t.filter((x) => x.estado !== 'al-aire').map((x) => x.id));
    setTira(nueva);
  }, []);

  // Carga inicial
  useEffect(() => {
    (async () => {
      setEquipo(await local.leerAjuste('equipo'));
      setInicio(await local.leerAjuste('inicio', false));
      setCanal(await local.leerAjuste('canal', 1));
      setAbiertos(await local.leerAjuste('abiertos', {}));
      setMuro(await local.leerMuro());
      setVecinosMesa(await local.leerAjuste('vecinos', []));
      // ya no hay «al aire de prueba»: las que quedaron así vuelven a la mesa de edición, con su canal
      for (const t of (await local.listarTomas()).filter((x) => x.prueba)) await local.guardarToma(deshacerPrueba(t));
      await recargar();
      setListo(true);
    })();
  }, [recargar]);

  useEffect(() => {
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Dejar la mesa: lo que estaba en cola vuelve a la mesa de edición (no sale a otra mesa)
  // y el televisor deja de mostrar el muro de esa mesa.
  const dejarMesa = useCallback(async () => {
    for (const e of await local.listarCola()) {
      await local.sacarDeCola(e.id);
      if (e.tipo !== 'senal') continue;
      const t = await local.leerToma(e.ref);
      if (t?.estado === 'en-cola') await local.guardarToma(tomaFueraDeCola(t));
    }
    await local.guardarAjuste('equipo', null);
    await local.guardarAjuste('vecinos', []);
    await local.guardarMuro([]);
    setMuro([]);
    setVecinosMesa([]);
    setEquipo(null);
    await recargar();
  }, [recargar]);

  // la Consola liberó al equipo (o la mesa ya no existe)
  const quedarFuera = useCallback(async () => {
    await dejarMesa();
    setAviso({ mal: true, texto: 'Su equipo ya no está en la mesa. Únanse de nuevo para transmitir; sus tomas siguen en este teléfono.' });
  }, [dejarMesa]);

  // Procesar la cola: al volver la señal, al cambiar algo y cada 15 s
  const avisoCerrada = useRef(0);
  const avisoTope = useRef(0);
  const procesar = useCallback(async () => {
    if (!ctxRef.current || !navigator.onLine) return;
    const { procesarCola } = await red();
    let fuera = false;
    await procesarCola(ctxRef.current, (e) => {
      if (e.resultado === 'rechazada') setAviso({ mal: true, texto: 'Una toma no salió al aire: aparece alguien o algo que no va. Quedó en la mesa para cambiarla.' });
      if (e.resultado === 'al-aire') setAviso({ texto: 'Una toma salió al aire.' });
      if (e.error === 'fuera') fuera = true;
      if (e.error === 'cerrada' && Date.now() - avisoCerrada.current > 5 * 60000) {
        avisoCerrada.current = Date.now();
        setAviso({ mal: true, texto: 'La mesa está cerrada por ahora. Lo que mandaron sale cuando la abran.' });
      }
      if (e.error === 'tope' && Date.now() - avisoTope.current > 5 * 60000) {
        avisoTope.current = Date.now();
        setAviso({ mal: true, texto: 'Llegaron al tope de tomas por hora. Se mandan solas más tarde.' });
      }
      if (e.error === 'no-aceptada') {
        setAviso({ mal: true, texto: 'La mesa no aceptó una toma. Quedó en la mesa de edición.' });
      }
    });
    if (fuera) await quedarFuera();
    else await recargar();
  }, [recargar, quedarFuera]);

  useEffect(() => {
    if (!equipo) return;
    procesar();
    const t = setInterval(procesar, 15000);
    return () => clearInterval(t);
  }, [equipo, enLinea, procesar]);

  // Escuchar el muro de la mesa
  useEffect(() => {
    if (!equipo) return;
    let parar = () => {};
    let vivo = true;
    (async () => {
      const { asegurarSesion } = await mesaRed();
      await asegurarSesion().catch(() => null);
      const { escucharMuro } = await muroRed();
      if (!vivo) return;
      parar = escucharMuro(equipo.mesa, (senales) => {
        setMuro(senales);
        local.guardarMuro(senales);
      }, async (err) => {
        console.warn('Muro:', err);
        if (err?.code !== 'permission-denied') return;
        const { estadoEnMesa } = await mesaRed();
        if ((await estadoEnMesa(equipo.mesa).catch(() => null)) === 'fuera') quedarFuera();
      });
    })();
    return () => { vivo = false; parar(); };
  }, [equipo, quedarFuera]);

  // Escuchar los vecinos de la mesa (la Antena los sigue); quedan guardados para verlos sin señal
  useEffect(() => {
    if (!equipo) return;
    let parar = () => {};
    let vivo = true;
    (async () => {
      const { asegurarSesion } = await mesaRed();
      await asegurarSesion().catch(() => null);
      const { escucharVecinos } = await muroRed();
      if (!vivo) return;
      parar = escucharVecinos(equipo.mesa, (v) => {
        const limpios = v.map(({ id, nombre, canal, andar }) => ({ id, nombre, canal, andar }));
        setVecinosMesa(limpios);
        local.guardarAjuste('vecinos', limpios);
      }, (err) => console.warn('Vecinos:', err));
    })();
    return () => { vivo = false; parar(); };
  }, [equipo]);

  // ---- acciones ----
  const sintonizar = useCallback((n) => { setCanal(n); local.guardarAjuste('canal', n); }, []);

  const entrar = useCallback(async () => { setInicio(true); await local.guardarAjuste('inicio', true); }, []);

  const unirse = useCallback(async (codigo, nombre) => {
    const { unirseAMesa } = await mesaRed();
    const e = await unirseAMesa(codigo, nombre);
    await local.guardarAjuste('equipo', e);
    await local.guardarAjuste('inicio', true);
    // las tomas al aire de prueba vuelven a la tira para transmitirlas de verdad
    const pruebas = (await local.listarTomas()).filter((t) => t.prueba);
    for (const t of pruebas) await local.guardarToma(deshacerPrueba(t));
    if (pruebas.length) {
      const ti = await local.leerAjuste('tira', []);
      await local.guardarAjuste('tira', pruebas.reduce((acc, t) => agregar(acc, t.id), ti));
      await recargar();
    }
    setEquipo(e);
    setInicio(true);
    return e;
  }, [recargar]);

  // vuelve a la entrada; las tomas y el equipo siguen en el teléfono
  const salir = useCallback(async () => { setInicio(false); await local.guardarAjuste('inicio', false); }, []);

  const salirDeMesa = dejarMesa;

  const guardarAbierto = useCallback(async (n, datos) => {
    const nuevos = { ...abiertos, [n]: datos };
    setAbiertos(nuevos);
    await local.guardarAjuste('abiertos', nuevos);
  }, [abiertos]);

  const registrar = useCallback(async ({ imagen, nota, rastro = null }) => {
    const numero = await local.siguienteNumero();
    // la toma nace sin canal (se asigna en la mesa de edición), salvo si viene de un rastro de la Antena:
    // entonces trae el canal del vecino, la celda del rastro y el vecino
    const toma = { ...crearToma({ id: local.nuevoId(), numero, creada: Date.now(), nota, canal: rastro?.canal ?? null, rastro }), imagen };
    await local.guardarToma(toma);
    const t = agregar(tira, toma.id);
    await local.guardarAjuste('tira', t);
    await recargar();
    return toma;
  }, [tira, recargar]);

  const editar = useCallback(async (toma, cambios) => {
    await local.guardarToma(editarToma(toma, cambios));
    await recargar();
  }, [recargar]);

  const borrarVarias = useCallback(async (ids) => {
    let t = tira;
    for (const id of ids) {
      await local.borrarToma(id);
      await local.sacarDeCola(id);
      t = quitar(t, id);
    }
    await local.guardarAjuste('tira', t);
    await recargar();
  }, [tira, recargar]);

  const borrar = useCallback((id) => borrarVarias([id]), [borrarVarias]);

  const asignar = useCallback(async (ids, n) => {
    const cambiadas = asignarCanal(tomas, ids, n);
    for (const t of cambiadas) await local.guardarToma(t);
    await recargar();
    return cambiadas.length;
  }, [tomas, recargar]);

  const moverEnTira = useCallback(async (id, paso) => {
    const t = mover(tira, id, paso);
    await local.guardarAjuste('tira', t);
    setTira(t);
  }, [tira]);

  // una toma con canal entra a la cola de salida de la mesa
  const enviar = useCallback(async (toma) => {
    const base = toma.estado === 'rechazada' ? volverALocal(toma) : toma;
    await local.guardarToma(encolar(base));
    await local.guardarEnCola(nuevoElemento({ id: toma.id, tipo: 'senal', ref: toma.id, ahora: Date.now() }));
  }, [equipo]);

  const mandarVarias = useCallback(async (lista) => {
    // en Local las tomas solo se asignan a los canales de este teléfono
    if (!equipo) { setAviso({ mal: true, texto: 'Para mandar al aire, únanse a la mesa.' }); return; }
    const listas = lista.filter((t) => t.canal && (t.estado === 'local' || t.estado === 'rechazada'));
    const faltan = lista.length - listas.length;
    for (const t of listas) await enviar(t);
    await recargar();
    const n = listas.length;
    const sinCanal = faltan ? ` ${faltan} sin canal quedaron en la mesa.` : '';
    if (!n) setAviso({ mal: true, texto: 'Asignen un canal antes de mandarlas al aire.' });
    else { setAviso({ texto: `${n === 1 ? 'Una toma va' : `${n} tomas van`} al aire.${sinCanal}` }); procesar(); }
  }, [enviar, equipo, recargar, procesar]);

  const mandarAlAire = useCallback((toma) => mandarVarias([toma]), [mandarVarias]);

  const cancelarEnvio = useCallback(async (toma) => {
    await local.sacarDeCola(toma.id);
    await local.guardarToma(tomaFueraDeCola(toma));
    await recargar();
  }, [recargar]);

  // el equipo saca su toma del aire para cambiarla: vuelve a la mesa de edición con su nota
  const sacarDelAire = useCallback(async (toma) => {
    if (!toma.prueba) {
      if (!equipo) { setAviso({ mal: true, texto: 'Esta toma salió en una mesa. Únanse a esa mesa para sacarla del aire.' }); return false; }
      if (!navigator.onLine) { setAviso({ mal: true, texto: 'Para sacarla del aire se necesita señal.' }); return false; }
      try {
        const { quitarMiSenal } = await red();
        await quitarMiSenal(equipo.mesa, toma.id);
      } catch {
        setAviso({ mal: true, texto: 'No se pudo sacar del aire. Intenten de nuevo.' });
        return false;
      }
    }
    await local.guardarToma(tomaFueraDelAire(toma));
    await recargar();
    setAviso({ texto: 'La toma salió del aire y volvió a la mesa de edición.' });
    return true;
  }, [equipo, recargar]);

  // en la mesa, el televisor muestra solo lo que está al aire;
  // en Local, todas las tomas con canal se ven en ese canal (solo en este teléfono),
  // también las que salieron al aire en una mesa
  const muroVisible = useMemo(() => {
    if (equipo) return muro;
    const asignadas = tomas.filter((t) => t.canal).sort((a, b) => b.creada - a.creada);
    return asignadas.map((t) => ({
      ...senalDePrueba(t, canales[t.canal - 1]), equipo: 'Local', prueba: false, pendiente: true, descripcion: t.lectura?.descripcion || '',
      aviso: t.estado === 'al-aire' ? 'Salió al aire en la mesa · en Local se ve solo en este teléfono' : 'Canal local · solo en este teléfono'
    }));
  }, [equipo, muro, tomas, canales]);

  // sin mesa, o con una mesa que aún no tiene vecinos, la Antena sigue a los vecinos de prueba
  const dePrueba = vecinosMesa.length === 0;
  const vecinos = dePrueba ? VECINOS_DE_PRUEBA : vecinosMesa;

  return {
    listo, equipo, inicio, canal, canales, tomas, tira, cola, muro: muroVisible, enLinea, aviso, setAviso, vecinos, dePrueba,
    sintonizar, entrar, salir, unirse, salirDeMesa, guardarAbierto, registrar, editar, borrar, borrarVarias, asignar, moverEnTira,
    mandarAlAire, mandarVarias, cancelarEnvio, sacarDelAire
  };
}
