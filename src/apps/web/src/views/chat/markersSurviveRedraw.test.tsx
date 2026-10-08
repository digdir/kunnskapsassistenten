import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Message, SourceDocument } from '../../model';
import { MessageList } from './MessageList';

/**
 * Et klikk på en markør skal ikke bytte ut markøren.
 *
 * Målt av #4 mot poden: ett klikk på `[n]` tegnet svaret på nytt, og
 * react-markdown monterte alle avsnittene på nytt — fire markørnoder fjernet
 * og fire lagt til. Fokus mistet målet sitt, fordi noden det sto i var borte.
 *
 * `Markdown` memoiserer allerede `components`, men avhengighetene kom nye ved
 * hver tegning: `citations={citationTargets(...)}` er en ny liste, og
 * `onCitationActivate={(n) => ...}` en ny funksjon. Da bytter komponentene i
 * `components` identitet, og React ser dem som andre komponenttyper og river
 * treet.
 *
 * Testen måler nodene og ikke rendringstellere: det er noden fokus står i som
 * er saken, og en teller ville sagt fra om noe helt annet.
 */
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

const documents: SourceDocument[] = [
  {
    id: '372017',
    title: 'Årsrapport Nkom 2023',
    excerpts: [
      { id: 'c1', citationNumber: 1, relevance: 'high', text: 'Første utdrag.' },
      { id: 'c2', citationNumber: 2, relevance: 'medium', text: 'Andre utdrag.' },
    ],
  },
];

const answer: Message = {
  id: 'a1',
  role: 'assistant',
  content: 'Nkom måler måloppnåelse mot tildelingsbrevet [1], og rapporterer årlig [2].',
  createdAt: '2026-09-15T09:00:00Z',
  citations: [],
  status: 'complete',
  sources: documents,
};

/**
 * Som skallet: et klikk på en markør får noe utenfor til å endre seg, og
 * listen tegnes på nytt. Uten den tegningen ville feilen ikke vise seg, og
 * testen ville vært grønn av feil grunn.
 */
function Skall() {
  const [valgt, setValgt] = useState<number | undefined>(undefined);
  return (
    <>
      <p data-testid="valgt">{valgt ?? 'ingen'}</p>
      <MessageList
        foundNothing={() => false}
        messages={[answer]}
        onRegenerate={() => {}}
        onSelectSource={(number) => setValgt(number)}
      />
    </>
  );
}

const markers = () => screen.getAllByRole('link', { name: /^Kilde \d/u });

describe('markørene overlever at svaret tegnes på nytt', () => {
  it('lar den samme noden stå etter et klikk', () => {
    render(<Skall />);
    const before = markers();
    expect(before).toHaveLength(2);

    fireEvent.click(before[0]!);

    // Skallet har tegnet på nytt: det er selve forutsetningen for prøven.
    expect(screen.getByTestId('valgt').textContent).toBe('1');

    const after = markers();
    expect(after).toHaveLength(2);
    // Node for node, ikke tekst for tekst: en ny node med samme tekst er
    // nettopp feilen — fokus sto i den gamle.
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
  });

  it('lar avsnittet rundt markørene stå også', () => {
    render(<Skall />);
    const before = markers()[0]!.closest('p');
    expect(before).not.toBeNull();

    fireEvent.click(markers()[0]!);

    expect(markers()[0]!.closest('p')).toBe(before);
  });

  it('holder fokus i markøren leseren trykket på', () => {
    render(<Skall />);
    const marker = markers()[0]!;
    marker.focus();
    fireEvent.click(marker);

    // Fokus følger noden. Byttes noden ut, faller fokus til <body>.
    expect(document.activeElement).toBe(markers()[0]);
  });
});
