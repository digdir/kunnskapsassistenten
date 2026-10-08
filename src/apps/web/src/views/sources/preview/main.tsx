import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PreviewPanel } from './PreviewPanel';
import '../../../styles/global.css';

/**
 * DEV ONLY entry point for the sources preview.
 *
 * It is its own HTML entry inside this folder, so it never reaches the
 * production bundle: `vite build` builds `index.html` at the repo root and
 * nothing else. Open it on the dev server at
 * /src/views/sources/preview/index.html
 *
 * Delete the whole `preview/` folder once the shell mounts the view and the
 * loading, empty and collapsed states can be reached in the real app.
 */
createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <PreviewPanel />
  </StrictMode>,
);
