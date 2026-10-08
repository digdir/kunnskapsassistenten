import { render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Message, ThinkingStep } from '../../model';
import { MessageList } from './MessageList';
import { resetDisplayLevel, setDisplayLevel } from './displayLevel';

beforeAll(() => {
  // jsdom lays nothing out and has no scrolling; the call the panel makes to
  // bring the current step into view has to go somewhere.
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  localStorage.clear();
  resetDisplayLevel();
});

/**
 * The agent's own words about what it is doing can BE the answer.
 *
 * headless-rag sends `agent/thinking` after every LLM response that has
 * content, and on an iteration with no tool call that content is the answer
 * itself. The BFF passes it on as `thinking`, `BffTurnState` makes it a
 * reasoning step, and the step is drawn above the answer — so the reader
 * reads the whole answer, and then reads it again (the review of #129).
 *
 * Measured here and not against a running backend: what is measured is what
 * this client does with a stream of that shape, which is the part this repo
 * owns. That headless-rag sends such a `thinking` is read in the review.
 */
const ANSWER = [
  '### Måloppnåelse i Nkom',
  '',
  'Nkom måler måloppnåelse mot målene i tildelingsbrevet, og rapporterer',
  'avvik kvartalsvis.',
].join('\n');

function turn(steps: ThinkingStep[]): Message {
  return {
    id: 'a1',
    role: 'assistant',
    content: ANSWER,
    createdAt: '2026-10-07T09:00:00Z',
    citations: [],
    thinkingSteps: steps,
    thoughtMs: 2400,
    status: 'complete',
  };
}

/** How many times a sentence from the answer stands in the rendered turn. */
function timesShown(container: HTMLElement): number {
  const needle = 'rapporterer avvik kvartalsvis';
  const text = (container.textContent ?? '').replace(/\s+/gu, ' ');
  return text.split(needle).length - 1;
}

function show(message: Message) {
  return render(
    <MessageList
      foundNothing={() => false}
      messages={[message]}
      onRegenerate={() => {}}
      onSelectSource={() => {}}
    />,
  );
}

describe('et tenkesteg som er hele svaret', () => {
  const asStep = (label: string): ThinkingStep => ({ id: 's1', kind: 'reasoning', label });
  const searched: ThinkingStep = {
    id: 's0',
    kind: 'search',
    label: 'Jeg søker i dokumentene.',
    queries: ['Nkom måloppnåelse'],
  };

  it.each([
    ['standard', 'standard'],
    ['detaljert', 'detaljert'],
  ] as const)('vises én gang på nivå %s', (_, level) => {
    setDisplayLevel(level);

    const { container } = show(turn([searched, asStep(ANSWER)]));

    expect(timesShown(container)).toBe(1);
  });

  it('lar de andre stegene stå', () => {
    setDisplayLevel('detaljert');

    const { container } = show(turn([searched, asStep(ANSWER)]));

    expect(container.textContent).toContain('Jeg søker i dokumentene.');
    expect(container.textContent).toContain('Nkom måloppnåelse');
  });

  it('rører ikke et tenkesteg som sier noe annet', () => {
    setDisplayLevel('detaljert');

    const { container } = show(turn([asStep('Jeg har nok til å svare.')]));

    expect(container.textContent).toContain('Jeg har nok til å svare.');
    expect(timesShown(container)).toBe(1);
  });
});
