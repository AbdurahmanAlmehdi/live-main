import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

// `livemain serve` serves dist/ and the API on one port; in dev, Vite proxies /v1 to it.
export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, proxy: { '/v1': { target: 'http://localhost:8787', changeOrigin: true } } },
  build: { outDir: 'dist', sourcemap: true },
  test: { environment: 'jsdom' },
});
