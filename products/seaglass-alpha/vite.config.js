import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5183, host: true, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1200 },
});
