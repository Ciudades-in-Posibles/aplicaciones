/**
 * App Check del Transmisor (reCAPTCHA Enterprise). Solo lo llama el Transmisor:
 * el Visor y la Consola no lo cargan.
 *
 * La clave del sitio sale de VITE_RECAPTCHA_SITE_KEY. Si no existe (todavía no hay clave real),
 * no se inicializa y la app funciona igual: la función solo registra en el log si llega el token.
 * Con emuladores usa un token de depuración.
 */

let iniciado = null;

/** Inicializa App Check una sola vez, antes de que Firestore o las Functions manden su primera petición. */
export function iniciarAppCheck() {
  iniciado ??= (async () => {
    const llave = import.meta.env?.VITE_RECAPTCHA_SITE_KEY;
    if (!llave) return false;
    try {
      if (import.meta.env?.DEV && import.meta.env?.VITE_EMULADORES === '1') self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      const [{ initializeAppCheck, ReCaptchaEnterpriseProvider }, { app }] = await Promise.all([
        import('firebase/app-check'),
        import('../comun/red/firebase.js')
      ]);
      initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(llave), isTokenAutoRefreshEnabled: true });
      return true;
    } catch (err) {
      console.warn('App Check:', err);
      return false;
    }
  })();
  return iniciado;
}
