import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import '../../../styles/global.css';
import { Preview } from './Preview';

/*
 * The chat view reads the active corpus to pick its three suggestions, and
 * `useCorpus` navigates when the corpus is SET — so the view needs a router
 * even on a page that has nowhere to navigate to. A memory router is exactly
 * that: somewhere for the address to go that is not the browser's.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter>
      <Preview />
    </MemoryRouter>
  </StrictMode>,
);
