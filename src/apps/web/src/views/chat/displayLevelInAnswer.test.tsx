import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Message } from '../../model';
import { AnswerMessage } from './AnswerMessage';
import { MessageList } from './MessageList';
import { resetDisplayLevel, setDisplayLevel } from './displayLevel';
import { resetViewport, setViewportWidth } from '../../test/matchMedia';

/*
 * Designsystemet's Skeleton asks for document.getAnimations, which jsdom
 * lacks. The empty answer card draws one while the first character is on its way.
 */
if (typeof document.getAnimations !== 'function') {
  document.getAnimations = () => [];
}

const answer: Message = {
  id: 'a1',
  role: 'assistant',
  content: 'Nkom måler måloppnåelse mot målene i tildelingsbrevet.',
  createdAt: '2026-09-15T09:00:00Z',
  citations: [],
  thinkingSteps: [
    { id: 's1', kind: 'reasoning', label: 'Jeg deler spørsmålet i to.', durationMs: 2000 },
    {
      id: 's2',
      kind: 'search',
      label: 'Jeg søker i årsrapportene.',
      detail: 'Fant 10 biter i 3 dokumenter.',
      queries: ['Nkom måloppnåelse 2025'],
      durationMs: 2000,
    },
  ],
  retrieval: { hitCount: 10, documentCount: 3, keywords: ['måloppnåelse', 'Nkom'] },
  thoughtMs: 4000,
  status: 'complete',
};

function showAnswer() {
  return render(
    <ol>
      <AnswerMessage
        message={answer}
        onRegenerate={() => {}}
        onSelectSource={() => {}}
        scope="Alle dokumentene i Kudos."
      />
    </ol>,
  );
}

describe('the display level in the answer', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDisplayLevel();
  });

  it('shows «Fremgangsmåte» as phases, with what was searched for and how long it took, at standard', () => {
    /*
     * The design canvas, board A1c: a numbered list of phases, each with what
     * the assistant actually did, and under the title what it did in all.
     * What each step measured on the wire stays at the detailed level.
     */
    const { container } = showAnswer();

    expect(screen.getByText('Fremgangsmåte')).toBeTruthy();
    expect(screen.getByText('Tok 4 sekunder')).toBeTruthy();

    const titles = container.querySelectorAll(
      '.ka-procedure__phases > li > .ka-procedure__phase-title',
    );
    expect([...titles].map((title) => title.textContent)).toEqual([
      'Forsto spørsmålet',
      'Så på hvilke kilder tråden leser fra',
      'Lette etter steder som handler om spørsmålet',
    ]);
    expect(screen.getByText('Jeg deler spørsmålet i to.')).toBeTruthy();
    expect(screen.getByText('Alle dokumentene i Kudos.')).toBeTruthy();
    expect(
      screen.getByRole('list', { name: 'Jeg lette etter omtale av disse temaene:' }).textContent,
    ).toBe('Nkom måloppnåelse 2025');

    expect(screen.queryByText('Jeg søker i årsrapportene.')).toBeNull();
    expect(screen.queryByText('Fant 10 biter i 3 dokumenter.')).toBeNull();
    expect(screen.queryByText('10 treff i 3 dokumenter')).toBeNull();
  });

  it('stands open where there is room, because what the answer is checked against should not be behind a click', () => {
    const { container } = showAnswer();

    const panel = container.querySelector('.ka-procedure');
    expect((panel as HTMLDetailsElement).open).toBe(true);
  });

  it('stands shut where the column is the whole window', () => {
    /*
     * Open with four steps and five keywords it was 450 px of 900 at 1440,
     * but 965 of 844 at 390: the procedure IS the screen then, and whoever
     * asked must scroll past all of it to reach the answer. 774 px is where
     * the column stops being a reading width between two rails and becomes
     * the whole window.
     */
    setViewportWidth(390);
    try {
      const { container } = showAnswer();

      const panel = container.querySelector('.ka-procedure');
      expect((panel as HTMLDetailsElement).open).toBe(false);
      // But it is there, with its name and what it did, one click away.
      expect(screen.getByText('Fremgangsmåte')).toBeTruthy();
      expect(screen.getByText('Tok 4 sekunder')).toBeTruthy();
    } finally {
      resetViewport();
    }
  });

  it('leaves out a search that is only the question over again', () => {
    /*
     * The agent plans its searches from the question, and the first one is
     * often the question itself: against the whole of Kudos the reader's own
     * sentence came back as one of the words it «searched for» (#4 on #208).
     * True, and it says nothing: the reader wrote it, two lines further up.
     *
     * Through `MessageList`, because it is the one that knows the question:
     * an answer does not carry it.
     */
    const question = 'Hva sier årsrapportene om måloppnåelse?';
    render(
      <ol>
        <MessageList
          messages={[
            {
              id: 'q1',
              role: 'user',
              content: question,
              createdAt: '2026-09-15T08:59:00Z',
              citations: [],
              status: 'complete',
            },
            {
              ...answer,
              thinkingSteps: [
                {
                  id: 's1',
                  kind: 'search',
                  label: 'Jeg søker i dokumentene.',
                  // Word for word, with another capital and no question mark.
                  queries: ['hva sier årsrapportene om måloppnåelse', 'måloppnåelse'],
                },
              ],
            },
          ]}
          onRegenerate={() => {}}
          onSelectSource={() => {}}
        />
      </ol>,
    );

    expect(
      screen.getByRole('list', { name: 'Jeg lette etter omtale av disse temaene:' }).textContent,
    ).toBe('måloppnåelse');
  });

  it('shows the thinking panel and the hits at detailed', () => {
    setDisplayLevel('detaljert');
    showAnswer();

    expect(screen.getByText('Tenkte i 4 sekunder')).toBeTruthy();
    expect(screen.getByText('10 treff i 3 dokumenter')).toBeTruthy();
    expect(screen.getByText('Nkom måloppnåelse 2025')).toBeTruthy();
  });
});
