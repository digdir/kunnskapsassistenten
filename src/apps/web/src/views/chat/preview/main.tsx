import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import '../../../styles/global.css';
import { Preview } from './Preview';

// `useCorpus` navigates when the corpus is SET, so the view needs a router
// even on a page with nowhere to navigate to. A memory router is somewhere
// for the address to go that is not the browser's.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter>
      <Preview />
    </MemoryRouter>
  </StrictMode>,
);
