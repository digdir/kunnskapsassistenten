/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  test: {
    environment: 'jsdom',
    globals: false,
    restoreMocks: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        // SSE dies if the proxy times the connection out.
        timeout: 0,
        proxyTimeout: 0,
      },
      '/auth': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
});
