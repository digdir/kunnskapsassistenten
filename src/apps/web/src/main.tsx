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

// Applies the stored colour scheme and exposes window.ka.colorScheme before
// the first render. colorSchemeBoot.js has already applied the same value, so
// this installs the console API rather than preventing a flash.
initColorScheme();

// The boundary is outermost, outside the router, so the page it draws on a
// crash depends on nothing that may have been what failed. See
// src/layout/AppErrorBoundary.tsx.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
