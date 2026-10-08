import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SourceDocument } from '../../model';
import { KudosDocuments } from './DocumentsList';

/**
 * The heading over the document list names the corpus the documents came
 * from.
 *
 * It said «Fra Kudos» four lines under a corpus line that said «Dokumenter
 * fra Wikipedia (NorQuAD)» — the same claim #106 took out of the line, one
 * element further down the same panel (brukerblikk 5, funn 1).
 *
 * `useCorpus` is the shell's and reads a module store fixed at startup, so
 * standing in for it is the only way to see a second corpus. Its own file for
 * the reason `FiltersView.corpus.test.tsx` is: `vi.mock` is per file, and
 * `DocumentsList.test.tsx` should keep meeting the real store.
 */
const corpus = vi.hoisted(() => ({
  option: undefined as { key: string; label: string } | undefined,
}));

vi.mock('../../layout/useCorpus', () => ({
  useCorpus: () => ({
    options: corpus.option ? [corpus.option] : [],
    active: corpus.option?.key,
    option: corpus.option,
    choosable: false,
    set: () => {},
  }),
}));

const documents: SourceDocument[] = [
  {
    id: 'doc-1',
    title: 'Årsrapport 2024',
    url: 'https://kudos.dfo.no/dokument/1',
    documentType: 'Årsrapport',
    organisation: 'Digdir',
    year: 2024,
    excerpts: [],
  },
];

function renderList() {
  return render(
    <MemoryRouter>
      <KudosDocuments documents={documents} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  corpus.option = { key: 'mock', label: 'Kudos, 938 dokumenter (mock)' };
});

describe('overskriften over dokumentlista', () => {
  it('bruker korpusets korte navn', () => {
    // Samme forkorting som korpuslinja: etiketten er skrevet for en rad i en
    // velger, overskriften vil ha navnet.
    renderList();

    expect(screen.getByRole('heading', { level: 4, name: 'Fra Kudos' })).toBeTruthy();
  });

  it('bytter når korpuset byttes', () => {
    corpus.option = { key: 'norquad-docs', label: 'Wikipedia (NorQuAD)' };
    renderList();

    expect(screen.getByRole('heading', { level: 4, name: 'Fra Wikipedia (NorQuAD)' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Fra Kudos' })).toBeNull();
  });

  it('sier «standardkorpuset» når ingen er kjent, som korpuslinja', () => {
    corpus.option = undefined;
    renderList();

    expect(screen.getByRole('heading', { level: 4, name: 'Fra standardkorpuset' })).toBeTruthy();
  });

  it('lar lista hete det samme som overskriften', () => {
    // Lista er merket av overskriften, så navnet følger med av seg selv — og
    // det er navnet en skjermleser hører når lista vokser.
    corpus.option = { key: 'kudos-pilot', label: 'Kudos-pilot' };
    renderList();

    expect(screen.getByRole('list', { name: 'Fra Kudos-pilot' })).toBeTruthy();
  });
});
