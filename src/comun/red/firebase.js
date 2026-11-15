import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, memoryLocalCache, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Mismo proyecto del sitio; base de datos propia «transmisor». La función transmisorTransmitir vive en este repo (functions/).
export const firebaseConfig = {
  apiKey: 'AIzaSyCO9eTe5SaaS2ncHQG43fSRFyQn_XhMjBA',
  authDomain: 'ciudades-in-posibles.firebaseapp.com',
  projectId: 'ciudades-in-posibles',
  storageBucket: 'ciudades-in-posibles.firebasestorage.app',
  messagingSenderId: '1000818729379',
  appId: '1:1000818729379:web:0c918f3e09f12ab46b7a16' // app web «Transmisor» (App Check propio; la 8836… es del Cronista)
};

/**
 * Abre (o reutiliza) una conexión a Firebase. La app por defecto es la del Transmisor y el Visor;
 * la Consola usa una app con nombre, así que su sesión de Auth y su caché de Firestore quedan
 * aparte aunque compartan origen. `initializeFirestore` solo puede llamarse una vez por app:
 * por eso la conexión se arma aquí y cada nombre se guarda.
 */
const conexiones = new Map();

export function conectar(nombre, { cacheLocal = true } = {}) {
  if (conexiones.has(nombre)) return conexiones.get(nombre);

  const app = getApps().find((a) => a.name === nombre)
    || (nombre === '[DEFAULT]' ? initializeApp(firebaseConfig) : initializeApp(firebaseConfig, nombre));
  // La caché de Firestore guarda el muro para verlo sin señal.
  const db = initializeFirestore(app, { localCache: cacheLocal ? persistentLocalCache() : memoryLocalCache() }, 'transmisor');
  const auth = getAuth(app);
  const functions = getFunctions(app, 'us-central1');

  if (import.meta.env?.DEV && import.meta.env?.VITE_EMULADORES === '1') {
    connectFirestoreEmulator(db, '127.0.0.1', 8085);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }

  const conexion = { app, db, auth, functions };
  conexiones.set(nombre, conexion);
  return conexion;
}

// Conexión por defecto: Transmisor y Visor.
export const { app, db, auth, functions } = conectar('[DEFAULT]');
