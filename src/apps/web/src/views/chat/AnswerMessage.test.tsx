import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Message } from '../../model';
import { MessageList } from './MessageList';
import { CLOSING_QUESTION } from './text';

const answer: Message = {
  id: 'a1',
  role: 'assistant',
  content: [
    '### Måloppnåelse i Nkom',
    '',
    'Nkom måler måloppnåelse mot målene i tildelingsbrevet.',
    '',
    'Andre avsnitt uten det ordet.',
  ].join('\n'),
  createdAt: '2026-09-15T09:00:00Z',
  citations: [],
  status: 'complete',
};

// Through `MessageList`, as the chat draws an answer.
function show(message: Message = answer, foundNothing?: boolean) {
  return render(
    <MessageList
      foundNothing={() => foundNothing ?? false}
      messages={[message]}
      onRegenerate={() => {}}
      onSelectSource={() => {}}
    />,
  );
}

describe('AnswerMessage without «Søk i svaret»', () => {
  it('has no search in the answer, and keeps copying the answer and its link', () => {
    show();

    expect(screen.queryByRole('button', { name: 'Søk i svaret' })).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Kopier svaret' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Kopier lenke til tråden/u })).toBeTruthy();
  });
});

describe('AnswerMessage og avslutningsspørsmålet', () => {
  it('avslutter et vanlig svar med spørsmålet', () => {
    show();
    expect(screen.getByText(CLOSING_QUESTION)).toBeTruthy();
  });

  it('lar det være under et svar som ikke fant noe', () => {
    // «Er det noe mer jeg kan hjelpe deg med?» inviterer til en oppfølging av
    // et svar som ikke fant noe. Samme regel som chipsene (KA CC, 2026-09-15).
    show(answer, true);
    expect(screen.queryByText(CLOSING_QUESTION)).toBeNull();
  });
});
