/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/*
 * The next client, built from genki's UI blocks (decisions/0013). The blocks are the source
 * snapshot in vendor/genki, reached through the aliases below, so a bare import inside them
 * resolves from this folder's node_modules.
 *
 * Its files go to /next-assets/, not /assets/, so the server can serve both clients' files
 * whatever a browser chose, and only the page depends on the choice.
 */

const vendor = (path: string) =>
  fileURLToPath(new URL(`./vendor/genki/${path}`, import.meta.url));

const ASSETS = 'next-assets';

/**
 * The colour scheme before the first paint, as a file of its own: the server's CSP is
 * `script-src 'self'`, which refuses an inline script. Emitted with a hash in its name under
 * /next-assets/, and linked at the top of <head> as a blocking script.
 */
function colorSchemeScript(): Plugin {
  const path = 'src/colorSchemeBoot.js';
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 8);
  const fileName = `${ASSETS}/color-scheme-${hash}.js`;
  let serving = false;
  return {
    name: 'ka-next-color-scheme-script',
    configResolved(config) {
      serving = config.command === 'serve';
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName, source });
    },
    transformIndexHtml: () => [
      {
        tag: 'script',
        attrs: { src: serving ? `/${path}` : `/${fileName}` },
        injectTo: 'head-prepend',
      },
    ],
  };
}

/** In development, the KA server that holds the session and calls genki (`npm start` in src). */
const server = process.env.KA_SERVER_URL || 'http://localhost:8788';

export default defineConfig({
  plugins: [react(), colorSchemeScript()],
  resolve: {
    alias: [
      { find: /^@genai\/client$/, replacement: vendor('client/src/index.ts') },
      { find: /^@genai\/i18n\/react$/, replacement: vendor('i18n/src/react.tsx') },
      { find: /^@genai\/i18n$/, replacement: vendor('i18n/src/index.ts') },
      {
        find: /^@genai\/ui-blocks\/styles\.css$/,
        replacement: vendor('ui-blocks/src/ui-blocks.css'),
      },
      { find: /^@genai\/ui-blocks$/, replacement: vendor('ui-blocks/src/index.ts') },
      {
        find: /^@genai\/ui-assembly\/styles\.css$/,
        replacement: vendor('ui-assembly/src/ui-assembly.css'),
      },
      { find: /^@genai\/ui-assembly$/, replacement: vendor('ui-assembly/src/index.ts') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  // The blocks are one chunk of about 240 kB gzip; scripts/check-bundle-size.mjs holds the budget.
  build: { assetsDir: ASSETS, chunkSizeWarningLimit: 1000 },
  server: {
    proxy: {
      '/api': { target: server, changeOrigin: false },
      '/auth': { target: server, changeOrigin: false },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    ...(process.env.GITHUB_ACTIONS ? {} : { maxWorkers: 4 }),
  },
});
