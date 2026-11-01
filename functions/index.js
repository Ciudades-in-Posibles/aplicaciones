/**
 * Funciones del Transmisor (base Firestore «transmisor» del proyecto ciudades-in-posibles).
 * Codebase «aplicaciones»; el sitio tiene la suya («default») con el Cronista.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { callOpenRouterBackend } from './src/openrouter.js';
import { transmitir } from './src/transmitir.js';

// Cambiar a true hacia el 10 de noviembre, cuando los clientes ya envíen App Check.
// Mientras sea false, solo se registra en el log si la llamada trae token.
const EXIGIR_APP_CHECK = false;

const openrouterKey = defineSecret('OPENROUTER_API_KEY');

const app = getApps()[0] || initializeApp();

export const transmisorTransmitir = onCall(
  {
    region: 'us-central1',
    secrets: [openrouterKey],
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 90,
    memory: '512MiB',
    enforceAppCheck: EXIGIR_APP_CHECK
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Hay que entrar a la mesa antes de transmitir.');
    }
    logger.info('transmisorTransmitir', { uid: request.auth.uid, appCheck: Boolean(request.app) });

    return transmitir({
      db: getFirestore(app, 'transmisor'),
      uid: request.auth.uid,
      datos: request.data,
      lecturaFalsa: process.env.LECTURA_FALSA === '1',
      llamarLLM: (messages) => callOpenRouterBackend({
        apiKey: openrouterKey.value(),
        messages,
        effort: 'low',
        maxTokens: 1024,
        timeoutMs: 75000
      })
    });
  }
);
