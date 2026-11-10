import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths, so the built folder works on any static host or sub-folder.
  base: './',
  server: { host: true, port: 5174 },
});
