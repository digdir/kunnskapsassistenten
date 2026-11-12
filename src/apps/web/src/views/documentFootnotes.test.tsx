import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { citationTargets, type Message, type SourceDocument } from '../model';
import { referenceList } from './chat/answerText';
import { MessageList } from './chat/MessageList';
import { SourcesSummary } from './chat/SourcesSummary';
import { SourcesView } from './sources/SourcesView';

/*
 * Issue 235. When the service cites by document, `[n]` names document n and not one of its
 * excerpts, so the reader is sent to the document and told that it is the document. The shape is
 * that of the genki-test answer in `api/fixtures/`: three reports, several excerpts each.
 */
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

function report(id: string, year: number, number: number, excerpts: number): SourceDocument {
  return {
    id,
    title: `Årsrapport Nasjonal kommunikasjonsmyndighet ${year}`,
    url: `https://kudos.example/documents/${id}`,
    citationNumber: number,
    excerpts: Array.from({ length: excerpts }, (_, index) => ({
      id: `${id}-${index}`,
      text: `Sitat ${index + 1} fra ${year}.`,
      relevance: 'high' as const,
    })),
  };
}

const documents = [report('8652', 2020, 1, 4), report('33189', 2022, 2, 2)];

const answer: Message = {
  id: 'a1',
  role: 'assistant',
  content: 'I 2020 var bevilgningen 712,4 millioner kroner [1]. I 2022 var det 169 ansatte [2].',
  createdAt: '2026-11-12T09:00:00Z',
  citations: [],
  sources: documents,
  status: 'complete',
};

describe('a footnote that names a document', () => {
  it('is named and linked as the document, never as an excerpt', () => {
    expect(citationTargets(documents)).toEqual([
      {
        number: 1,
        targetId: 'kilde-dokument-8652-tittel',
        label: 'Kilde 1: Årsrapport Nasjonal kommunikasjonsmyndighet 2020',
        documentId: '8652',
      },
      {
        number: 2,
        targetId: 'kilde-dokument-33189-tittel',
        label: 'Kilde 2: Årsrapport Nasjonal kommunikasjonsmyndighet 2022',
        documentId: '33189',
      },
    ]);
  });

  it('opens the document when activated, with the answer it is in', () => {
    const onSelectSource = vi.fn();
    const onSelectDocument = vi.fn();
    render(
      <MessageList
        messages={[answer]}
        onRegenerate={() => {}}
        onSelectSource={onSelectSource}
        onSelectDocument={onSelectDocument}
      />,
    );

    const marker = screen.getByRole('link', {
      name: 'Kilde 2: Årsrapport Nasjonal kommunikasjonsmyndighet 2022',
    });
    expect(marker.getAttribute('href')).toBe('#kilde-dokument-33189-tittel');
    fireEvent.click(marker);

    expect(onSelectDocument).toHaveBeenCalledWith('33189', 'a1');
    expect(onSelectSource).not.toHaveBeenCalled();
  });
});

describe('the sources panel, for an answer that cites documents', () => {
  function show() {
    render(
      <SourcesView
        answers={[
          {
            messageId: 'a1',
            status: 'complete',
            documents,
            uses: { 1: 1, 2: 1 },
          },
        ]}
      />,
    );
  }

  it('shows the number on the document, the way the footnote reads', () => {
    show();
    const card = document.getElementById('kilde-dokument-33189')!;

    expect(within(card).getByText('Kilde 2')).toBeTruthy();
    expect(
      within(card).getByRole('button', { name: 'Vis hvor svaret bruker kilde 2' }),
    ).toBeTruthy();
  });

  it('numbers the excerpts within their document, and calls none of them uncited', () => {
    show();
    const card = document.getElementById('kilde-dokument-8652')!;

    expect(
      within(card)
        .getAllByRole('heading', { level: 4 })
        .map((heading) => heading.textContent),
    ).toEqual(['Utdrag 1 av 4', 'Utdrag 2 av 4', 'Utdrag 3 av 4', 'Utdrag 4 av 4']);
    expect(within(card).queryByText('Ikke vist til i svaret')).toBeNull();
    // No excerpt takes a footnote's place: `#excerpt-n` would be a footnote's target.
    expect(card.querySelector('[id^="excerpt-"]')).toBeNull();
  });
});

describe('«Kilder brukt i svaret», for an answer that cites documents', () => {
  it('links each document the answer cites, with no excerpt numbers', () => {
    render(<SourcesSummary documents={documents} onSelectDocument={() => {}} />);

    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Årsrapport Nasjonal kommunikasjonsmyndighet 2020',
      'Årsrapport Nasjonal kommunikasjonsmyndighet 2022',
    ]);
    expect(within(rows[1]!).getByRole('link').getAttribute('href')).toBe(
      '#kilde-dokument-33189-tittel',
    );
  });
});

describe('the reference list under a copied answer, for an answer that cites documents', () => {
  it('has one line per document, under its footnote number', () => {
    expect(referenceList(documents)).toEqual([
      '[1] Årsrapport Nasjonal kommunikasjonsmyndighet 2020. https://kudos.example/documents/8652',
      '[2] Årsrapport Nasjonal kommunikasjonsmyndighet 2022. https://kudos.example/documents/33189',
    ]);
  });
});
