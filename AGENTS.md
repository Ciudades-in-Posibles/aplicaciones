# AGENTS.md — Transmisor · Ciudades(In)Posibles

Guía de contexto para agentes (humanos y de IA). **Idioma de trabajo: español latino neutro.** Los textos de interfaz, los comentarios y los commits van en español; los identificadores, en inglés o en español sin tildes, como ya están.

GitHub: `Ciudades-in-Posibles/aplicaciones` (`origin`, público). El sitio vive aparte, en `Ciudades-in-Posibles/web`.

## Qué es

**Transmisor** es la app del juego emersivo de Ciudades(In)Posibles. Se publica en `transmisor.ciudadesinposibles.net`. La interfaz cambia de aparato en cada momento:

| Momento | Aparato | Qué hace |
|---|---|---|
| Sintonizar | Televisor | Elige uno de los 9 canales. Las tomas del canal pasan solas dentro del tubo, sin miniaturas fuera: en la mesa, solo lo que está al aire; en Local, todas las tomas con ese canal, también las que salieron al aire en una mesa. La «i» abre la lente. |
| Rastrear | Antena | Sigue los rastros de los vecinos de la mesa alrededor de la Biblioteca El Parque, en celdas H3 de resolución 12 (≈ 11 m de lado), todas del lado de la biblioteca de la Avenida Carrera 5. La ubicación se vuelve celda en el teléfono y **nunca sale de él**. La estática se aclara al acercarse y la flecha usa la brújula. A dos celdas o menos (≈ 40 m, por el error del GPS) aparece el recorte del canal, y con «Mirar» se ve sobre la cámara. «Registrar este rastro» abre la Cámara con canal, celda y vecino. Sin GPS se marca la celda tocando el mapa; para probar, `?celda=<h3>`. |
| Registrar | Cámara | Visor 4:3 en blanco y negro con tercios; solo obturador, sin elegir canal. La toma se guarda sin canal, salvo que venga de un rastro: entonces nace con su canal, su celda y su vecino. La nota («lo que se vio») es opcional y se escribe; ya no hay dictado por voz ni pregunta. |
| Transmitir | Mesa de edición | Filtro por canal (Todas, Sin canal, 1–9), monitor y hoja de contactos. Se seleccionan varias tomas para asignarlas a un canal, mandarlas al aire, verlas o borrarlas. En Local (sin mesa) no hay «Al aire»: las tomas solo se asignan a los canales y se ven en el televisor de este teléfono. |

Del mismo build salen otros dos sitios, que se eligen por el hostname en `src/main.jsx`:
- **Visor** (`visor.ciudadesinposibles.net`, respaldo `/al-aire`): la vista de solo lectura para pantallas y proyectores. Por defecto muestra el televisor portátil del sitio (el mismo SVG de `el-juego`) con la pantalla principal adentro y la marca arriba a la izquierda: el dial 1–9 sintoniza (tocar el canal sintonizado vuelve a Auto), la perilla gira con el canal en pantalla y cada toque pasa al siguiente, y la «i» abre o cierra el rótulo de la señal a la derecha (oculto al empezar); sin emisión (mesa cerrada o sin señales), el tubo muestra la carta de ajuste. En `/rastros` (respaldo `/al-aire/rastros`): el mapa hexagonal de la zona, con los senderos de los vecinos, las señales que salieron de un rastro en su celda y la leyenda (un vecino con al menos una señal tiene escaño). En la leyenda, «Mapa» (o la tecla M) pone debajo de los hexágonos un mapa dibujado con los datos de OSM del repo (`src/visor/mapaBase.js`, sin red) o las teselas de tile.openstreetmap.org; la elección se guarda en el navegador. En `/mosaico` (respaldo `/al-aire/mosaico`): a la izquierda la pantalla principal con un selector de canal (Auto o 1–9, también con las teclas 0–9 o tocando un tubo); a la derecha el muro de 3×3 tubos, uno por canal, que rotan sus señales en cascada, y el rótulo de la señal principal. Si la mesa se cierra, muestra una carta de ajuste en blanco y negro con «No hay transmisión en este momento». En `/maletin` (respaldo `/al-aire/maletin`): el maletín de cuero en 3D, que se gira arrastrando o con las flechas, sin leer la mesa. Usa three.js, que se carga solo en esa vista y queda fuera de la caché del service worker. El modelo (`public/modelos/maletin.glb`, GLB con meshopt) y su imagen fija salen del `.blend` que se hizo en Blender.
- **Consola** (`consola.ciudadesinposibles.net`, respaldo `/consola`): la administración de la mesa, para computador. Se entra con Google. Permite crear mesas, abrirlas o cerrarlas, ver equipos y tomas, sacar tomas del aire y liberar nombres. En «Vecinos» crea, cambia o quita los vecinos de la mesa (nombre, canal y andar). También imprime cada señal en la térmica PeriPage A6, como carta (48 × 88 mm) o solo la imagen, horizontal (48 × 36 mm) o girada (48 × 64 mm), (papel de 57 mm, 384 puntos), una por una desde el detalle o todas desde «Imprimir cartas». Va por Web Bluetooth en Chrome de computador, sin emparejar la impresora en macOS; si no aparece, se usa el puerto serie que crea macOS al emparejarla.

Se sigue la línea mínima del DS de la app: carcasa `papel`, tubo, pastillas, dial y visor con esquinas. Usa Gabarito y IBM Plex Mono, la paleta v18 y la textura barrido + estática. Es una interfaz con poco texto.

## Reglas

1. **Local primero.** La app funciona entera sin cuenta ni red, y la fuente de verdad es IndexedDB (`src/transmisor/local/db.js`).
2. **Solo sale lo que se transmite.** Una toma sale del teléfono únicamente cuando el equipo la manda al aire. Antes el servidor la pasa por el filtro de rostros y de contenido inadecuado; si falla, queda `rechazada` y no sube.
3. **Una sola mesa.** El equipo se une con el código de mesa y su nombre (auth anónima, sin correo). Las mesas se crean en la Consola. Solo la administran los correos del campo `correos` del documento `admin/consola` (base `transmisor`), que lee `esConsola()` en `firestore.rules`. Para sumar a alguien se edita ese documento en la consola de Firebase; no hace falta publicar reglas. Ningún correo de administración va en el código.
4. **Lógica sin interfaz.** `src/comun/dominio/` no importa React ni Firebase y tiene tests (`npm test`) con respuestas del LLM grabadas. `functions/` tiene los suyos (`npm test` dentro de `functions/`).
5. **La IA y la escritura de señales viven en el servidor.** La callable `transmisorTransmitir` (`functions/`) arma el prompt, llama al LLM, aplica el filtro, cuenta el tope de 60 lecturas por hora y escribe la señal. La clave de OpenRouter es un secreto que solo ve la función; el cliente nunca manda el prompt ni escribe señales. `functions/src/canales.js` debe seguir idéntico a `src/comun/dominio/canales.js` (un test lo comprueba).
6. **Vecinos sin red.** La posición de cada vecino sale de una fórmula determinista (`src/comun/dominio/vecinos.js`): los teléfonos y el Visor calculan lo mismo con el mismo reloj, y nadie la escribe. En Firestore solo están `nombre`, `canal` y `andar`. La zona (`src/comun/dominio/zona.js`) se genera con `npm run zona` desde `scripts/zona/` (datos de OpenStreetMap, ODbL), que escribe también `functions/src/zona.js`; las dos deben seguir idénticas (un test lo comprueba). Ninguna celda toca una vía primaria o secundaria: el generador falla si pasa. A la mesa solo llega la celda del rastro, y solo con una toma mandada al aire.
7. **Voz del juego.** Los avisos siguen `docs/guia-de-voz.md`, la norma de redacción (se dirigen a ustedes, sin jerga técnica, sin sermón) y nunca hablan en nombre de los seres: los vecinos solo dejan rastros.

## Estructura

`src/` se organiza por aplicación. Cada carpeta de aplicación importa de `comun/` y nunca de otra aplicación; `main.jsx` elige la vista por el hostname.

```
src/main.jsx                  elige la vista según el hostname (carga Visor y Consola de forma diferida)
src/comun/                    lo que comparten las tres aplicaciones
  dominio/                    canales, toma (estados), tira, lectura (prompt + filtro), mesa, cola, archivo (zip/CSV/LEEME/cartas), borrado (plan), zona (celdas H3 y etiquetas), andares, vecinos (movimiento y rastros), mapa (SVG de celdas), termica (difuminado y bytes de la PeriPage)   ← puro, con tests
  local/pantalla.js           pantalla completa
  red/                        firebase.js, mesa.js (unirse), muro.js (escuchar señales, vecinos y si la mesa está abierta)
  estilos/app.css             el DS: papel, tubo, pastillas, textura
  Confirmar.jsx               diálogo de confirmación (Cartas, MesaTransmision y Consola); con `exigir` pide escribir un texto (p. ej. el código de la mesa) antes de aceptar
src/transmisor/               la app del teléfono (transmisor.ciudadesinposibles.net)
  App.jsx, Entrada.jsx        raíz y entrada a la mesa
  appcheck.js                 App Check (reCAPTCHA Enterprise); solo se inicializa si existe VITE_RECAPTCHA_SITE_KEY
  estado.js                   hook useJuego: une local, cola y muro
  aparatos/                   Televisor, Antena (diferida, con h3-js), Camara, MesaTransmision, Cartas (canal, toma, señal)
  local/                      db.js (IndexedDB), foto.js (recorte 4:3, B/N, JPEG 960×720)
  red/transmitir.js           cola de salida: llama a la callable transmisorTransmitir
src/visor/AlAire.jsx          el Visor (visor.ciudadesinposibles.net)
src/visor/Rastros.jsx         mapa de rastros (diferido), con mapaBase.js (generado) debajo
src/visor/Maletin.jsx         el maletín en 3D (diferido, con three.js); modelo en public/modelos/
src/consola/                  la Consola (consola.ciudadesinposibles.net)
  Consola.jsx
  red/consola.js              administración de la mesa (lecturas completas y borrar mesa)
  red/borrar.js               borrado en lotes de ≤450, recibe `db` (se prueba con el emulador)
  archivo.js                  Archivo Ucrónico: arma y descarga el .zip (jszip se carga con import() diferido)
  Cartas.jsx, cartas.css      vista «Imprimir cartas»: 6 cartas de 63×88 mm por hoja carta/A4 horizontal
  impresora/                  PeriPage A6 térmica: peripage.js (Web Bluetooth, respaldo Web Serial), cartaTermica.js (carta 48×88 mm o solo la imagen, en canvas), Termica.jsx (detalle de la señal y lote en «Imprimir cartas»)
functions/                    servidor (codebase «aplicaciones»)
  index.js                    callable transmisorTransmitir; EXIGIR_APP_CHECK
  src/                        transmitir (núcleo), entrada (validación), tope (60 por hora), lectura, canales, zona, openrouter
  test/                       node --test; .env.local con LECTURA_FALSA=1 (ignorado por git)
```

## Comandos

- `npm test`: tests del dominio, sin red.
- `npm run emuladores` en una terminal y `npm run dev:local` en otra: emuladores de Functions (5001), Firestore (8085) y Auth (9099). La lectura falsa vive en el servidor (`functions/.env.local`, `LECTURA_FALSA=1`), no en el cliente.
- `npm test` dentro de `functions/`: tests del servidor.
- `npm run zona`: regenera la zona de los vecinos (las dos copias de `zona.js`) y el mapa dibujado del Visor (`src/visor/mapaBase.js`) desde `scripts/zona/`. Después, `npm test` aquí y en `functions/`.
- `npm run build`, y después `npx -y firebase-tools@latest deploy --only hosting:transmisor,hosting:visor,hosting:consola` para publicar.
- `npx -y firebase-tools@latest deploy --only firestore:transmisor` para publicar las reglas.
- `npx -y firebase-tools@latest deploy --only functions:aplicaciones` para publicar la función (necesita el secreto `OPENROUTER_API_KEY` en Secret Manager).
- App Check: la clave de reCAPTCHA Enterprise («Transmisor», solo dominios del Transmisor) está en `.env.production` como `VITE_RECAPTCHA_SITE_KEY` desde el 1 nov 2026. Hacia el 10 nov se pasa `EXIGIR_APP_CHECK` a `true` en `functions/index.js`. Nunca se exige en Firestore.

Ver `docs/arquitectura.md` y `docs/stack.md`.
