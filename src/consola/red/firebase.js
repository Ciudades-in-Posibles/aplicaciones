import { conectar } from '../../comun/red/firebase.js';

// La Consola entra con Google y usa su propia app de Firebase: en el mismo origen, su sesión
// (y su caché de Firestore) queda aparte de la sesión anónima de los equipos del Transmisor.
export const { app, db, auth } = conectar('consola', { cacheLocal: false });
