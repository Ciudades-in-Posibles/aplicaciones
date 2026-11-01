# Arquitectura local-first

**Fecha:** 2026-10-29 · **Estado:** en prueba

## Organización del código

`src/` se divide por aplicación; las tres salen del mismo build y `src/main.jsx` elige la vista por el hostname.

- `src/comun/`: lo compartido. `dominio/` (lógica pura, sin React ni Firebase, con tests), `local/pantalla.js`, `red/` (`firebase.js`, `mesa.js`, `muro.js`), `estilos/app.css` y `Confirmar.jsx`.
- `src/transmisor/`: la app del teléfono. `App.jsx`, `Entrada.jsx`, `estado.js`, `appcheck.js`, `aparatos/` (Televisor, Camara, MesaTransmision, Cartas), `local/` (`db.js`, `foto.js`) y `red/transmitir.js`.
- `src/visor/`: `AlAire.jsx`, la vista de solo lectura.
- `src/consola/`: `Consola.jsx` y `red/consola.js`, la administración de la mesa. Además: `archivo.js` (Archivo Ucrónico en .zip: `tomas/<canal>-<nombre>/<codigo>-<equipo>.jpg`, `archivo.csv` con BOM y `LEEME.txt`), `Cartas.jsx` + `cartas.css` (impresión de cartas con `window.print()`) y `red/borrar.js` (borrar mesa: respuestas, señales, equipos, nombres, pantallas y mesa, en lotes de 450; idempotente).
- `functions/`: el servidor del Transmisor (codebase `aplicaciones`): la callable `transmisorTransmitir`, con su propio `package.json` y sus tests.

Una aplicación importa de `comun/`, nunca de otra aplicación. La norma de redacción de los avisos está en `docs/guia-de-voz.md`.

## En el teléfono (siempre)

IndexedDB (`transmisor`) tiene cuatro almacenes:
- `tomas`: `{id, numero, codigo T-NN, canal, creada, nota, pregunta (siempre vacía), estado, lectura, motivo, imagen}`. La imagen es un data URL JPEG de 960×720 en blanco y negro.
- `ajustes`: equipo, inicio, canal, tira, canales abiertos y contador.
- `cola`: lo que espera señal, `{id, tipo: senal, ref, intentos, siguiente, datos?}`.
- `muro`: copia de las señales de la mesa, para verlas sin señal.

Estados de la toma: `local → en-cola → al-aire`. Si la lectura no pasa el filtro, el estado es `en-cola → rechazada`, y desde ahí la toma puede volver a `local` para editarla o reenviarla. El equipo también puede **sacar del aire** su toma (`al-aire → local`): se borra la señal, con las respuestas que hubiera recibido antes de que se retirara esa función, y la toma vuelve a la mesa de edición con su nota. Si se reenvía, el servidor la vuelve a leer: el teléfono ya no guarda lecturas previas (el campo `lecturaPrevia` de tomas viejas se ignora).

## En red (cuando el equipo se une a la mesa)

La base Firestore es `transmisor`, en el proyecto `ciudades-in-posibles` (nam5):

```
mesas/{CODIGO}                         ← se crea en la Consola: {nombre, abierta, creada}
  nombres/{llave}                      ← nombre único de equipo: {uid}
  equipos/{uid}                        ← {nombre, llave, creado, lecturas}; `lecturas: {ventana, n}` lo escribe solo el servidor (tope por hora)
  pantallas/{uid}                      ← proyección en visor.ciudadesinposibles.net (o /al-aire)
  senales/{idToma}                     ← {uid, equipo, canal, canalNombre, lente, codigo, nota, pregunta, descripcion, imagen, creada, hora}
    respuestas/{id}                    ← heredadas: ya no se crean ni se muestran; las reglas aún las permiten
```

La imagen va dentro del documento de la señal (menos de 900 KB), así que no se usa Storage.

La cola de salida (`src/transmisor/red/transmitir.js`) trabaja así:
1. Cada 15 s, al volver la señal y después de cada acción, toma los elementos listos.
2. Para una señal, llama a la callable `transmisorTransmitir` (región `us-central1`, 90 s) con `{mesa, toma: {id, canal, codigo, nota, imagen, creada, abierto?}}`. `abierto` ({nombre, lente}) va solo en los canales 8 y 9; en los otros siete, el nombre y la lente salen del servidor.
3. El servidor responde `{estado: 'al-aire', descripcion}` o `{estado: 'rechazada', motivo}`. Con `al-aire` la toma local pasa a `al-aire` con esa descripción; con `rechazada` (un rostro o algo inadecuado) queda `rechazada` con el motivo y no sube.
4. Errores de la callable:
   - `failed-precondition` (mesa cerrada o inexistente): `estadoEnMesa` confirma; con la mesa cerrada se reintenta cada minuto y el equipo ve un aviso, y si la mesa ya no existe se trata como `fuera`;
   - `permission-denied` (el equipo no está en la mesa): `estadoEnMesa` dice por qué; si la Consola liberó al equipo, el teléfono sale de la mesa, lo que estaba en cola vuelve a la mesa de edición y se descartan los elementos que no sean señales; si la mesa está abierta y el equipo sigue, la toma queda `rechazada`;
   - `resource-exhausted` (el equipo pasó su tope de lecturas por hora): toda la cola se aplaza 5 minutos y el equipo ve «Llegaron al tope de tomas por hora. Se mandan solas más tarde.»;
   - `invalid-argument` (la toma no cumple lo que pide el servidor): la toma queda `rechazada` con el mensaje;
   - `internal` (el modelo no respondió) y los de red: reintenta con una espera que se duplica cada vez, hasta 5 minutos.
5. Lo mismo que `fuera` pasa si el muro pierde el permiso.

## En el servidor

`functions/` es el codebase `aplicaciones` del proyecto (el sitio tiene el suyo, `default`). `transmisorTransmitir` es una callable v2 en `us-central1`, con el secreto `OPENROUTER_API_KEY`, 90 s y 512 MiB. Para cada llamada:
1. Exige sesión. App Check queda en modo monitor (`EXIGIR_APP_CHECK = false` en `functions/index.js`): solo se registra en el log si llega el token. Hacia el 10 de noviembre se pasa a `true`. Nunca se exige App Check en Firestore.
2. Valida la entrada con los mismos límites que las reglas: canal entero de 1 a 9, nota de hasta 280 caracteres, imagen JPEG en data URL de menos de 900000 caracteres, id de toma de 8 a 64 caracteres.
3. Comprueba que la mesa existe y está abierta, y que quien llama es un equipo de esa mesa. El nombre del equipo sale de su documento.
4. Si la señal con ese id ya existe, responde `al-aire` con su descripción, sin volver a leer.
5. Cuenta la lectura en el documento del equipo (`lecturas.ventana` es la hora y `lecturas.n` las lecturas de esa hora) dentro de una transacción. El tope es de 60 por hora.
6. Lee la toma con el LLM (OpenRouter) con el prompt de `functions/src/lectura.js`. Con `LECTURA_FALSA=1` (en `functions/.env.local`, ignorado por git) devuelve una lectura falsa válida, sin red.
7. Si pasa el filtro, escribe la señal con el Admin SDK, con el id de la toma, `pregunta: ''` y `hora` del servidor.

`functions/src/canales.js` es copia exacta de `src/comun/dominio/canales.js`; un test lo comprueba byte a byte.

Las reglas (`firestore.rules`):
- Solo los equipos y las pantallas de la mesa leen.
- Las señales las escribe solo el servidor (Admin SDK); las reglas no dejan crearlas desde el cliente. Nadie las edita.
- El código de mesa se pide por id; solo la Consola lista las mesas.
- Con `abierta: false` no se unen equipos nuevos ni se crean señales o respuestas, pero lo que ya está al aire se sigue viendo. Si falta el campo, la mesa cuenta como abierta.
- La Consola (`esConsola()`: correo verificado que esté en el campo `correos` del documento `admin/consola`, que ningún cliente lee) crea mesas, cambia `nombre` y `abierta`, lista equipos, nombres y pantallas, y borra señales, respuestas, equipos y nombres. Las mesas no se borran.

## Retirado

El dictado por voz y la pregunta abierta con sus respuestas ya no están en la app. Se conservan, a propósito:
- el campo `pregunta` de la toma y de la señal, siempre `''`: las tomas viejas guardadas en IndexedDB siguen abriendo y `firestore.rules` lo sigue exigiendo en `senales`;
- los datos heredados en Firestore (preguntas y subcolecciones `respuestas`), que la Consola borra al sacar una señal del aire;
- un elemento viejo de la cola de tipo `respuesta` se descarta sin enviarse.

## Pendiente

- Traspaso de la partida a otro teléfono (con un QR).
- Entrevista de 30 s con transcripción.
- Guía de canales (parrilla G1).
