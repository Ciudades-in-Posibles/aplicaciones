# Stack

**Fecha:** 2026-10-29 · **Estado:** acordado (React + Vite + Firebase, elección de MangleRojo)

| Dependencia | Por qué |
|---|---|
| react, react-dom | Interfaz de los tres aparatos y las cartas; es el mismo stack del Cronista y el Cartógrafo. |
| vite, @vitejs/plugin-react | Servidor de desarrollo y build. |
| vite-plugin-pwa | Service worker y manifiesto: la app se instala y abre sin señal. |
| idb | Envoltorio mínimo de IndexedDB, donde viven las tomas en el teléfono. |
| firebase | Relevo: auth anónima, Firestore (base `transmisor`) y la llamada a la Function del LLM. |

No hay Tailwind ni router. Los estilos son CSS plano con los tokens del DS, y las rutas son dos: `/` y `/al-aire`.
