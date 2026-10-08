import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Message, ThinkingStep } from '../../model';
import { AnswerMessage } from './AnswerMessage';
import { setDisplayLevel } from './displayLevel';

/**
 * Stegene rapporterer til sammen fire sekunder. Den målte ventetiden er to.
 * Det er nettopp der de to tallene spriker at feilen er synlig.
 */
const steps: ThinkingStep[] = [
  { id: 's1', kind: 'reasoning', label: 'Jeg deler spørsmålet i to.', durationMs: 2000 },
  { id: 's2', kind: 'search', label: 'Jeg søker i årsrapportene.', durationMs: 2000 },
];

/** Søket eies av `MessageList`; disse testene handler om noe annet. */
const utenSok = {
  searchOpen: false,
  searchQuery: '',
  onSearchQueryChange: () => {},
  onToggleSearch: () => {},
  onCloseSearch: () => {},
  searchLabel: 'Søk i svaret',
};

function answerWith(thoughtMs?: number): Message {
  return {
    id: 'a1',
    role: 'assistant',
    content: 'Nkom måler måloppnåelse mot målene i tildelingsbrevet.',
    createdAt: '2026-09-15T09:00:00Z',
    citations: [],
    thinkingSteps: steps,
    ...(thoughtMs === undefined ? {} : { thoughtMs }),
    status: 'complete',
  };
}

function show(message: Message) {
  return render(
    <ol>
      <AnswerMessage
        {...utenSok}
        message={message}
        onRegenerate={() => {}}
        onSelectSource={() => {}}
      />
    </ol>,
  );
}

describe('«Tenkte i N sekunder» over et svar', () => {
  /*
   * Tenkepanelet er det detaljerte nivået etter issue 88. Standard
   * tegner «Fremgangsmåte» i stedet, uten tider — så disse påstandene, som
   * handler om tallet, hører hjemme på nivået som viser det.
   */
  beforeEach(() => {
    setDisplayLevel('detaljert');
  });

  it('viser den målte tiden, ikke summen av det stegene rapporterte', () => {
    /*
     * Feilen dette dekker: svaret sendte aldri `thoughtMs` videre til panelet,
     * så panelet falt tilbake på summen av stegenes egne `durationMs`. Målt
     * ventetid var to sekunder, summen fire, og «Tenkte i 2 sekunder» ble
     * «Tenkte i 4 sekunder» for en tur som ikke hadde endret seg
     * (brukerblikk runde 2, funn 5). Avklaringsveien i `MessageList` sendte
     * den alt; svarveien gjorde det ikke.
     */
    show(answerWith(2000));

    expect(screen.getByText('Tenkte i 2 sekunder')).toBeTruthy();
    expect(screen.queryByText('Tenkte i 4 sekunder')).toBeNull();
  });

  it('faller tilbake på stegene når ingen målte turen', () => {
    // En lagret samtale ingen satt og så på: da er summen det eneste som
    // finnes, og den er bedre enn ingenting.
    show(answerWith(undefined));

    expect(screen.getByText('Tenkte i 4 sekunder')).toBeTruthy();
  });

  it('sier «Tenkte» uten tall når verken måling eller steg har en varighet', () => {
    // Å finne på et tall ut av antall steg ville vært en gjetning forkledd
    // som en måling.
    show({
      ...answerWith(undefined),
      thinkingSteps: steps.map(({ durationMs, ...step }) => {
        void durationMs;
        return step;
      }),
    });

    expect(screen.getByText('Tenkte')).toBeTruthy();
  });
});
