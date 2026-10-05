import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Message } from '../../model';
import { MessageList } from './MessageList';

/**
 * The reader's question and the answer under it are told apart (Simens
 * issue 117). Plain and larger than the answer, the question read as a
 * heading over the answer card; it is a box at the end of the line now.
 *
 * What the eye sees is measured in the browser — the side, the ground, the
 * width. What is asserted here is the structure those come from, and the one
 * thing a screen reader has: the words «Du skrev:».
 */

const at = '2026-10-05T10:00:00Z';
const question: Message = {
  id: 'u1',
  role: 'user',
  content: 'Hva sier rapporten om tilsyn?',
  createdAt: at,
  citations: [],
  status: 'complete',
};
const answer: Message = {
  id: 'a1',
  role: 'assistant',
  content: 'Rapporten sier at tilsynet er styrket.',
  createdAt: at,
  citations: [],
  status: 'complete',
};

function show() {
  return render(
    <MessageList messages={[question, answer]} onRegenerate={() => {}} onSelectSource={() => {}} />,
  );
}

describe('the reader’s question', () => {
  it('stands in a tinted box of its own, in the one blue', () => {
    show();

    const box = screen.getByText(question.content).closest('.ka-message__bubble');
    expect(box).not.toBeNull();
    expect(box?.classList.contains('ds-card')).toBe(true);
    expect(box?.getAttribute('data-variant')).toBe('tinted');
    expect(box?.getAttribute('data-color')).toBe('accent');
  });

  it('is written in the size of the answer, not larger', () => {
    show();

    // `lg` is what made it read as a heading. No size is the answer's size.
    expect(screen.getByText(question.content).getAttribute('data-size')).toBeNull();
  });

  it('is said to be the reader’s, in words', () => {
    const { container } = show();

    const item = container.querySelector('.ka-message--user');
    expect(item?.querySelector('.ds-sr-only')?.textContent).toBe('Du skrev:');
  });

  it('is the only thing in such a box: the answer is not', () => {
    const { container } = show();

    expect(container.querySelectorAll('.ka-message__bubble')).toHaveLength(1);
    expect(screen.getByText(answer.content).closest('.ka-message__bubble')).toBeNull();
  });
});
