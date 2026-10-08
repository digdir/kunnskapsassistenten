import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { AppErrorBoundary } from './layout/AppErrorBoundary';
import { initColorScheme } from './layout/colorScheme';
import './styles/global.css';

// Designsystemet's warnings help in development but are noise in production.
if (import.meta.env.PROD) {
  window.dsWarnings = false;
}

// colorSchemeBoot.js has already applied the stored scheme, so this installs
// the console API (window.ka.colorScheme) rather than preventing a flash.
initColorScheme();

// Outermost, outside the router, so the crash page depends on nothing that may
// have been what failed.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
