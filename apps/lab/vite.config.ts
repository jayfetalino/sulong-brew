import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  server: {
    // host: true lets an iPhone on the same Wi-Fi open the dev server.
    host: true,
    port: 5173,
  },
});
