import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Lesehooken for korpus: hva et view får vite, og hva den ikke drar med seg.
 *
 * `useCorpus` bærer setteren, og et bytte starter en ny tråd — så den kaller
 * `useNavigate` og kan ikke brukes utenfor en ruter. Kildepanelet og
 * preview-inngangene leser bare, og leste butikka direkte med
 * `useSyncExternalStore` for å komme rundt det (#129). Det er den omveien
 * denne hooken erstatter, så testene her monterer med vilje uten ruter.
 *
 * Modulene nullstilles per test fordi butikka løser lista fra
 * `import.meta.env` ved import, slik corpusStore.test.ts gjør det.
 */
const CORPORA = 'norquad-docs=Wikipedia (NorQuAD)|351 artikler;kudos-pilot=Kudos, 1 200 dokumenter';

async function mount({ datasets = CORPORA, mode = 'live' } = {}) {
  vi.stubEnv('VITE_API_MODE', mode);
  vi.stubEnv('VITE_KA_DATASETS', datasets);
  vi.stubEnv('VITE_KA_DATASET_CONFIG_KEY', '');
  vi.resetModules();

  const { useActiveCorpus } = await import('./useActiveCorpus');
  const { setActiveCorpusKey } = await import('../api');

  function Probe() {
    const corpus = useActiveCorpus();

    return (
      <>
        <output data-testid="key">{corpus.key ?? 'ingen'}</output>
        <output data-testid="label">{corpus.option?.label ?? 'ingen'}</output>
        <output data-testid="description">{corpus.option?.description ?? 'ingen'}</output>
        <output data-testid="name">{corpus.displayName}</output>
      </>
    );
  }

  // Ingen MemoryRouter. Det er påstanden: hooken skal kunne monteres uten.
  render(<Probe />);
  return { setActiveCorpusKey };
}

const read = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllEnvs());

describe('useActiveCorpus', () => {
  it('monteres uten ruter', async () => {
    // Hele grunnen til at hooken finnes. `useCorpus` kaster «useNavigate()
    // may be used only in the context of a <Router>» her.
    await mount();

    expect(read('key')).toBe('norquad-docs');
  });

  it('gir etikett, beskrivelse og navnet til skjermen', async () => {
    await mount();

    expect(read('label')).toBe('Wikipedia (NorQuAD)');
    expect(read('description')).toBe('351 artikler');
    expect(read('name')).toBe('Wikipedia (NorQuAD)');
  });

  it('forkorter navnet ved første komma, som korpuslinja', async () => {
    // Etiketten er skrevet for en rad i velgeren. Navnet er det en setning
    // kan bruke, og det er én funksjon som bestemmer hvilket.
    const { setActiveCorpusKey } = await mount();

    act(() => setActiveCorpusKey('kudos-pilot'));

    expect(read('label')).toBe('Kudos, 1 200 dokumenter');
    expect(read('name')).toBe('Kudos');
  });

  it('følger butikka når noen andre bytter', async () => {
    // Samme abonnement som `useCorpus`, så panelet som bytter og panelene som
    // bare leser lander i samme tegning.
    const { setActiveCorpusKey } = await mount();

    act(() => setActiveCorpusKey('kudos-pilot'));

    expect(read('key')).toBe('kudos-pilot');
    expect(read('description')).toBe('ingen');
  });

  it('sier «standardkorpuset» når ingenting er satt opp', async () => {
    // Live uten liste og uten nøkkel: backend velger datasett. Da er det
    // ingen nøkkel å vise og ingenting som navngir korpuset.
    await mount({ datasets: '' });

    expect(read('key')).toBe('ingen');
    expect(read('label')).toBe('ingen');
    expect(read('name')).toBe('standardkorpuset');
  });
});
