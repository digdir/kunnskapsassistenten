import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PreviewPanel } from './PreviewPanel';
import '../../../styles/global.css';

// Dev only, at /src/views/sources/preview/index.html; `vite build` builds only the
// root `index.html`. Delete `preview/` once its states are reachable in the app.
createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <PreviewPanel />
  </StrictMode>,
);
