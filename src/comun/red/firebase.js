import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Mismo proyecto del sitio; base de datos propia «transmisor». La función transmisorTransmitir vive en este repo (functions/).
const firebaseConfig = {
  apiKey: 'AIzaSyCO9eTe5SaaS2ncHQG43fSRFyQn_XhMjBA',
  authDomain: 'ciudades-in-posibles.firebaseapp.com',
  projectId: 'ciudades-in-posibles',
  storageBucket: 'ciudades-in-posibles.firebasestorage.app',
  messagingSenderId: '1000818729379',
  appId: '1:1000818729379:web:0c918f3e09f12ab46b7a16' // app web «Transmisor» (App Check propio; la 8836… es del Cronista)
};

export const app = getApps()[0] || initializeApp(firebaseConfig);

// La caché de Firestore guarda el muro para verlo sin señal.
export const db = initializeFirestore(app, { localCache: persistentLocalCache() }, 'transmisor');
export const auth = getAuth(app);
export const functions = getFunctions(app, 'us-central1');

if (import.meta.env?.DEV && import.meta.env?.VITE_EMULADORES === '1') {
  connectFirestoreEmulator(db, '127.0.0.1', 8085);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
