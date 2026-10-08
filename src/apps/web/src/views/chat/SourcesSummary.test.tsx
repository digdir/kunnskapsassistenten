import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { userDocumentSource } from '../../api/mock/fixtures';
import type { Message, SourceDocument } from '../../model';
import { MessageList } from './MessageList';
import { SourcesSummary } from './SourcesSummary';
import { CLOSING_QUESTION } from './text';

/**
 * «Kilder brukt i svaret», issue 113: dokumentene svaret bygger på,
 * under svaret, som en vei inn i kildepanelet.
 */
function documentWith(id: string, title: string, numbers: (number | undefined)[]): SourceDocument {
  return {
    id,
    title,
    excerpts: numbers.map((number, index) => ({
      id: `${id}-${index}`,
      relevance: 'high' as const,
      text: `Sitat ${index + 1} fra ${title}.`,
      ...(number === undefined ? {} : { citationNumber: number }),
    })),
  };
}

const documents = [
  documentWith('a', 'Årsrapport Nkom 2025', [2, 1]),
  documentWith('b', 'Tildelingsbrev Nkom 2026', [3, 5]),
  documentWith('c', 'Instruks for økonomistyring', [undefined]),
];

describe('SourcesSummary', () => {
  it('har ett dokument per rad, i panelets rekkefølge, med utdragene markørene peker på', () => {
    render(<SourcesSummary documents={documents} onSelectSource={() => {}} />);

    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Årsrapport Nkom 2025Utdrag 1–2',
      'Tildelingsbrev Nkom 2026Utdrag 3, 5',
      'Instruks for økonomistyring',
    ]);
  });

  it('åpner kildepanelet på dokumentets første utdrag, som en markør gjør', () => {
    // Det første etter nummer, ikke etter rekkefølge: Årsrapporten har
    // utdragene i rekkefølgen 2, 1, og [1] er det svaret viser til først.
    const onSelectSource = vi.fn();
    render(<SourcesSummary documents={documents} onSelectSource={onSelectSource} />);

    fireEvent.click(screen.getByRole('link', { name: 'Årsrapport Nkom 2025' }));
    fireEvent.click(screen.getByRole('link', { name: 'Tildelingsbrev Nkom 2026' }));

    expect(onSelectSource.mock.calls).toEqual([[1], [3]]);
    expect(screen.getByRole('link', { name: 'Årsrapport Nkom 2025' }).getAttribute('href')).toBe(
      '#excerpt-1',
    );
  });

  it('lar et dokument uten nummer stå som tekst, fordi det ikke er noe å gå til', () => {
    render(<SourcesSummary documents={documents} onSelectSource={() => {}} />);

    expect(screen.getByText('Instruks for økonomistyring').closest('a')).toBeNull();
  });

  it('er åpen fra start, som Figma tegner den', () => {
    const { container } = render(
      <SourcesSummary documents={documents} onSelectSource={() => {}} />,
    );

    expect(container.querySelector('details')?.open).toBe(true);
    expect(container.querySelector('summary')?.textContent).toBe('Kilder brukt i svaret');
  });

  it('sier at et opplastet dokument er ditt, uten å endre synlig tekst', () => {
    // Et filnavn kan se ut akkurat som et korpusdokument, og en liste med
    // lenker leses ut av sammenheng. Dette sto i «Snarveier til dokumentene»
    // til lista ble tatt ut av kildepanelet (issue 113).
    const own = userDocumentSource(
      {
        id: 'doc-egen',
        name: 'Årsrapport Nkom 2025',
        type: 'pdf',
        size: 1024,
        status: 'ready',
        progress: 100,
        uploadedAt: '2026-09-21T09:00:00.000Z',
      },
      1,
    );
    render(<SourcesSummary documents={[own]} onSelectSource={() => {}} />);

    const link = screen.getByRole('link', { name: 'Årsrapport Nkom 2025, ditt dokument' });
    const visible = [...link.childNodes]
      .filter((node) => !(node instanceof HTMLElement && node.classList.contains('ds-sr-only')))
      .map((node) => node.textContent)
      .join('');
    expect(visible).toBe('Årsrapport Nkom 2025');
  });

  it('gir to dokumenter med samme tittel hvert sitt nummer, som kortene i panelet', () => {
    // Målt 05.10: indeksen har «Årsrapport Datatilsynet 2023» som 90777 og
    // 88640, og lista under svaret fikk to lenker med samme navn.
    render(
      <SourcesSummary
        documents={[
          documentWith('90777', 'Årsrapport Datatilsynet 2023', [1, 2]),
          documentWith('12', 'Tildelingsbrev 2026', [4]),
          documentWith('88640', 'Årsrapport Datatilsynet 2023', [3]),
        ]}
        onSelectSource={() => {}}
      />,
    );

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Årsrapport Datatilsynet 2023, dokument 90777',
      'Tildelingsbrev 2026',
      'Årsrapport Datatilsynet 2023, dokument 88640',
    ]);
  });

  it('tegner ingenting uten dokumenter', () => {
    const { container } = render(<SourcesSummary documents={[]} onSelectSource={() => {}} />);

    expect(container.childElementCount).toBe(0);
  });
});

describe('SourcesSummary i svaret', () => {
  const answer: Message = {
    id: 'a1',
    role: 'assistant',
    content: 'Nkom måler måloppnåelse mot tildelingsbrevet [1][3].',
    createdAt: '2026-10-05T09:00:00Z',
    citations: [],
    status: 'complete',
    sources: documents,
  };

  function show(message: Message, onSelectSource = vi.fn()) {
    render(
      <MessageList
        foundNothing={() => false}
        messages={[message]}
        onRegenerate={() => {}}
        onSelectSource={onSelectSource}
      />,
    );
    return onSelectSource;
  }

  it('står under svaret og over avslutningsspørsmålet', () => {
    show(answer);

    const summary = screen.getByText('Kilder brukt i svaret');
    const closing = screen.getByText(CLOSING_QUESTION);
    expect(
      summary.compareDocumentPosition(closing) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('sender med hvilket svar markøren hører til, så panelet kan bytte til det', () => {
    const onSelectSource = show(answer);

    fireEvent.click(screen.getByRole('link', { name: 'Tildelingsbrev Nkom 2026' }));

    expect(onSelectSource).toHaveBeenCalledWith(3, 'a1');
  });

  it('kommer først når svaret er ferdig', () => {
    // Kildene kommer i siste ramme. En liste som vokste mens teksten ble
    // skrevet, ville flyttet seg under den.
    show({ ...answer, status: 'streaming' });

    expect(screen.queryByText('Kilder brukt i svaret')).toBeNull();
  });

  it('er borte når svaret ble stoppet, for da kom ingen kilder', () => {
    show({ ...answer, status: 'aborted' });

    expect(screen.queryByText('Kilder brukt i svaret')).toBeNull();
  });
});
