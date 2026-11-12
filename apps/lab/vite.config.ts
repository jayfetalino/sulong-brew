import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      // The app updates itself quietly: a new version is fetched in the background
      // and takes over the next time the app is opened.
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Sulong Brew Lab',
        short_name: 'Brew Lab',
        description: 'Private roast, recipe and brew log for Sulong Coffee.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#2b2d1f',
        theme_color: '#2b2d1f',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // The logo sits inside the central 62% of the square, so round masks never clip it.
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Keep the app, the Latin fonts and the icons for offline use. Other font alphabets
        // are skipped to keep the download small; they only matter if you type those letters.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}', '**/*-latin-*-normal-*.woff2'],
        // Offline, any page request is answered with the app itself.
        navigateFallback: 'index.html',
      },
    }),
  ],
  server: {
    // host: true lets an iPhone on the same Wi-Fi open the dev server.
    host: true,
    port: 5173,
  },
});
