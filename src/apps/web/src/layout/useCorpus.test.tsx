import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The React end of the corpus store: what a view reads, and what switching
 * costs.
 *
 * Modules are reset per test and the environment stubbed before importing,
 * the same way src/api/corpusStore.test.ts does it, and for the same reason:
 * the store resolves its list from `import.meta.env` once at import time. It
 * is also what lets each case say which corpora exist: live mode gets the two
 * from the stubbed variable, mock mode gets its own two. A hook about
 * choosing is not worth much measured where there is nothing to choose.
 */
const CORPORA = 'norquad-docs=Wikipedia (NorQuAD)|351 artikler;kudos-pilot=Kudos-pilot';

async function mount({ path = '/threads/nkom', datasets = CORPORA, mode = 'live' } = {}) {
  vi.stubEnv('VITE_API_MODE', mode);
  vi.stubEnv('VITE_KA_DATASETS', datasets);
  vi.stubEnv('VITE_KA_DATASET_CONFIG_KEY', '');
  vi.resetModules();

  const { useCorpus } = await import('./useCorpus');

  function Probe() {
    const corpus = useCorpus();
    const location = useLocation();

    return (
      <>
        <output data-testid="active">{corpus.active ?? 'ingen'}</output>
        <output data-testid="label">{corpus.option?.label ?? 'ingen'}</output>
        <output data-testid="description">{corpus.option?.description ?? 'ingen'}</output>
        <output data-testid="choosable">{String(corpus.choosable)}</output>
        <output data-testid="count">{corpus.options.length}</output>
        <output data-testid="path">{location.pathname}</output>
        {corpus.options.map((option) => (
          <button key={option.key} type="button" onClick={() => corpus.set(option.key)}>
            Bytt til {option.label}
          </button>
        ))}
      </>
    );
  }

  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Probe />} />
        <Route path="/threads/:threadId" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const read = (id: string) => screen.getByTestId(id).textContent;
const switchTo = (label: string) => screen.getByRole('button', { name: `Bytt til ${label}` });

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllEnvs());

describe('hva et view får vite', () => {
  it('gir etikett og beskrivelse, ikke bare nøkkelen', async () => {
    // Korpuslinja i filterpanelet skal ikke si «Kudos» når det er
    // norquad-docs som er valgt. Bedt om av #2, 21.09.
    await mount();

    expect(read('active')).toBe('norquad-docs');
    expect(read('label')).toBe('Wikipedia (NorQuAD)');
    expect(read('description')).toBe('351 artikler');
  });

  it('sier at det er noe å velge mellom når det er flere korpus', async () => {
    await mount();
    expect(read('choosable')).toBe('true');
    expect(read('count')).toBe('2');
  });

  it('sier at det er noe å velge i mock også, uten env', async () => {
    // Mock har to korpus siden #129: en velger med én oppføring tegner
    // ingenting, og da kunne bytte verken ses i mock eller måles i e2e.
    await mount({ mode: 'mock', datasets: '' });

    expect(read('choosable')).toBe('true');
    expect(read('count')).toBe('2');
    expect(read('active')).toBe('mock');
  });
});

describe('å bytte korpus', () => {
  it('går til forsida, så neste spørsmål starter en ny tråd', async () => {
    // En tråd hører til korpuset sitt: svarene i den siterer dokumenter som
    // bare finnes der. Å fortsette den mot et annet korpus ville gitt en
    // samtale med kilder fra to dokumentsett og ingenting som sa hvilket.
    await mount({ path: '/threads/nkom' });
    expect(read('path')).toBe('/threads/nkom');

    act(() => switchTo('Kudos-pilot').click());

    expect(read('path')).toBe('/');
    expect(read('active')).toBe('kudos-pilot');
    expect(read('label')).toBe('Kudos-pilot');
  });

  it('lar leseren bli stående når de velger det som alt er valgt', async () => {
    // Ellers ville et klikk på det aktive korpuset kastet dem ut av tråden de
    // satt i, uten at noe som helst endret seg.
    await mount({ path: '/threads/nkom' });

    act(() => switchTo('Wikipedia (NorQuAD)').click());

    expect(read('path')).toBe('/threads/nkom');
  });

  it('husker valget til neste gang', async () => {
    await mount();
    act(() => switchTo('Kudos-pilot').click());

    expect(localStorage.getItem('ka.corpus.v1')).toBe('kudos-pilot');
  });
});
