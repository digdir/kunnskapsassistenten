import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Message } from '../../model';
import { MessageList } from './MessageList';
import { CLARIFICATION_TAG } from './text';

/**
 * «Avgrenset til» over a question back. The agent searches with the filter
 * before it asks, so the question is shaped by the filter as much as an answer
 * is (measured on the test site 15.10: three of three documents retrieved were
 * of the type in the filter).
 */

const at = '2026-10-15T10:00:00Z';
const question: Message = {
  id: 'u1',
  role: 'user',
  content: 'Hva sier evalueringene om kundetilfredshet?',
  createdAt: at,
  citations: [],
  status: 'complete',
};
const clarification: Message = {
  id: 'a1',
  role: 'assistant',
  content: 'Mener du evalueringen fra 2023 eller den fra 2024?',
  createdAt: at,
  citations: [],
  status: 'needs-clarification',
};

function show(filterSummary?: (messageId: string) => string | undefined) {
  return render(
    <MessageList
      filterSummary={filterSummary}
      messages={[question, clarification]}
      onRegenerate={() => {}}
      onSelectSource={() => {}}
    />,
  );
}

describe('the line over a clarifying question', () => {
  it('says what the clarifying question was asked with, over the card', () => {
    const { container } = show((id) => (id === 'a1' ? 'Avgrenset til: Evaluering' : undefined));

    const line = container.querySelector('.ka-filter-summary');
    expect(line?.textContent).toBe('Spørsmålet bygger på dokumenter Avgrenset til: Evaluering');
    // Over the card, as over an answer: a fact about what was searched, not
    // part of the question back.
    const card = screen.getByText(CLARIFICATION_TAG).closest('.ka-answer-card');
    expect(line?.compareDocumentPosition(card as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('is heard as documents from another corpus, not as a question fetched from it', () => {
    // Asked of the whole of another corpus, the line is «Hentet fra Kudos».
    // «Spørsmålet er hentet fra Kudos» would say the question was fetched.
    const { container } = show(() => 'Hentet fra Kudos');

    expect(container.querySelector('.ka-filter-summary')?.textContent).toBe(
      'Spørsmålet bygger på dokumenter Hentet fra Kudos',
    );
  });

  it('is absent when the question was asked of the whole corpus', () => {
    const { container } = show(() => undefined);

    expect(container.querySelector('.ka-filter-summary')).toBeNull();
    expect(screen.getByText(CLARIFICATION_TAG)).toBeTruthy();
  });
});
