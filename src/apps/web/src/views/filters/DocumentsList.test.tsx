import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SourceDocument } from '../../model';
import { KudosDocuments } from './DocumentsList';

/**
 * Seven documents, as the `active` variant in Figma draws. The mock corpus
 * has three, which is one fewer than «Vis flere dokumenter» needs to appear
 * at all, so the case is made here rather than in `src/api/mock/`.
 */
const documents: SourceDocument[] = Array.from({ length: 7 }, (_, index) => ({
  id: `doc-${index}`,
  title: `Årsrapport Nasjonal kommunikasjonsmyndighet ${2018 + index}`,
  url: `https://kudos.dfo.no/dokument/nkom-${2018 + index}`,
  documentType: 'Årsrapport',
  organisation: 'Nasjonal kommunikasjonsmyndighet',
  year: 2018 + index,
  excerpts: [],
}));

/**
 * En fil leseren selv har lastet opp. `origin: 'user'` er det eneste som
 * skiller den; tittelen er et filnavn og ingenting i den sier hvor den kommer
 * fra (src/model/source.ts).
 */
const ownFile: SourceDocument = {
  id: 'own-1',
  title: 'Årsrapport 2025.pdf',
  origin: 'user',
  excerpts: [],
};

/**
 * The heading over the list names the corpus, and `useCorpus` navigates when
 * the corpus changes — so these components need a router the way the view
 * around them does.
 */
function renderInApp(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const titles = () => screen.getAllByRole('listitem').map((item) => item.textContent);

describe('KudosDocuments', () => {
  it('keeps the placeholder sentence when no answer has sources yet', () => {
    renderInApp(<KudosDocuments />);

    expect(screen.getByText('Dokumentene som er relevante for søket ditt vises her.')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Fra Kudos' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Vis flere dokumenter' })).toBeNull();
  });

  it('says the same about an answer that had no sources', () => {
    // undefined and [] differ in the sources panel — «loading» against
    // «nothing behind this answer» — but here both mean nothing to list.
    renderInApp(<KudosDocuments documents={[]} />);

    expect(screen.getByText('Dokumentene som er relevante for søket ditt vises her.')).toBeTruthy();
  });

  it('lists five of seven, and counts the rest', () => {
    renderInApp(<KudosDocuments documents={documents} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText('Viser 5 av 7 dokumenter.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vis flere dokumenter' })).toBeTruthy();
  });

  it('writes type, organisation and year under the title', () => {
    renderInApp(<KudosDocuments documents={documents} />);

    expect(screen.getByText('Årsrapport · Nasjonal kommunikasjonsmyndighet · 2018')).toBeTruthy();
  });

  it('links each title to the document on Kudos', () => {
    renderInApp(<KudosDocuments documents={documents} />);

    // A pattern, not the literal name: the accessible name drops the space
    // that separates the title from the sr-only warning.
    const link = screen.getByRole('link', {
      name: /^Årsrapport Nasjonal kommunikasjonsmyndighet 2018\s*\(åpnes i ny fane\)$/,
    });
    expect(link.getAttribute('href')).toBe('https://kudos.dfo.no/dokument/nkom-2018');
  });

  it('writes the title as text when the document has no public URL', () => {
    // Folder-based corpora come back with `url: null`. A dead link would be
    // worse than a plain title.
    const [first, ...rest] = documents;
    renderInApp(<KudosDocuments documents={[{ ...first, url: undefined }, ...rest]} />);

    expect(screen.getByText('Årsrapport Nasjonal kommunikasjonsmyndighet 2018')).toBeTruthy();
    expect(
      screen.queryByRole('link', { name: /Årsrapport Nasjonal kommunikasjonsmyndighet 2018/ }),
    ).toBeNull();
  });

  it('says why a document without a public address is not a link', () => {
    // The list drew some titles as links and some as plain text, and said
    // nothing about the difference — so a reader could only read it as a link
    // that had failed (brukerblikk 7, funn 2). The sources panel has said why
    // about the same document all along.
    const [first, ...rest] = documents;
    renderInApp(<KudosDocuments documents={[{ ...first, url: undefined }, ...rest]} />);

    expect(
      screen.getByText('Årsrapport · Nasjonal kommunikasjonsmyndighet · 2018, uten lenke'),
    ).toBeTruthy();
    // And a document that IS a link says nothing of the kind.
    expect(screen.getByText('Årsrapport · Nasjonal kommunikasjonsmyndighet · 2019')).toBeTruthy();
  });

  it('stands on its own when the document has no metadata either', () => {
    // A corpus that knows neither type, organisation nor year still has to
    // explain the missing link; the line is then that explanation alone.
    renderInApp(
      <KudosDocuments
        documents={[{ id: 'bare-tittel', title: 'Notat uten data', excerpts: [] }]}
      />,
    );

    expect(screen.getByText('Uten lenke')).toBeTruthy();
  });

  it('shows the rest, drops the button, and leaves focus on the list', () => {
    renderInApp(<KudosDocuments documents={documents} />);

    fireEvent.click(screen.getByRole('button', { name: 'Vis flere dokumenter' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    // The button is conditional on the state it changes, so it is gone. Focus
    // would otherwise be on <body>, a whole page away from the list that grew.
    expect(screen.queryByRole('button', { name: 'Vis flere dokumenter' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('list', { name: 'Fra Kudos' }));
    // Nothing to count once everything is listed.
    expect(screen.queryByText(/^Viser /)).toBeNull();
  });

  it('lists everything and offers no button when there are five or fewer', () => {
    renderInApp(<KudosDocuments documents={documents.slice(0, 3)} />);

    expect(titles()).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Vis flere dokumenter' })).toBeNull();
    expect(screen.queryByText(/^Viser /)).toBeNull();
  });

  it('leaves an uploaded file to «Dine dokumenter»', () => {
    // brukerblikk 6, funn 1: samme fil sto både her og under «Dine
    // dokumenter», under en overskrift som sier at den kommer fra korpuset.
    renderInApp(<KudosDocuments documents={[ownFile, ...documents]} />);

    expect(screen.queryByText('Årsrapport 2025.pdf')).toBeNull();
    // Og den teller ikke: sju korpusdokumenter, ikke åtte.
    expect(screen.getByText('Viser 5 av 7 dokumenter.')).toBeTruthy();
    expect(titles()).toHaveLength(5);
  });

  it('lists nothing when the answer only used an uploaded file', () => {
    renderInApp(<KudosDocuments documents={[ownFile]} />);

    expect(screen.getByText('Dokumentene som er relevante for søket ditt vises her.')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Fra Kudos' })).toBeNull();
  });

  it('starts over at five when the next answer brings other documents', () => {
    const { rerender } = renderInApp(<KudosDocuments documents={documents} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vis flere dokumenter' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(7);

    // A new answer, a new array. An expanded list carried over from the previous
    // one would show seven rows the reader never asked to see.
    rerender(
      <MemoryRouter>
        <KudosDocuments documents={documents.map((source) => ({ ...source }))} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Vis flere dokumenter' })).toBeTruthy();
  });
});
