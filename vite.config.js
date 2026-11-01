import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['estatica.jpg', '*.woff2', 'icono.svg'],
      manifest: {
        name: 'Transmisor · Ciudades(In)Posibles',
        short_name: 'Transmisor',
        lang: 'es',
        description: 'Sintonizar, registrar y transmitir los canales de la ciudad.',
        start_url: '/',
        display: 'standalone',
        orientation: 'any', // la entrada gira libre; los aparatos piden horizontal
        background_color: '#2a2a2d',
        theme_color: '#0b0b0c',
        icons: [
          { src: '/icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icono-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,jpg,svg,png}'],
        navigateFallback: '/index.html'
      }
    })
  ]
});
