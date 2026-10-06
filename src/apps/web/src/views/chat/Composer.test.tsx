import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepDraft, resetDraftSources } from '../../api/session';
import { Composer } from './Composer';
import { useAttachments } from './useAttachments';

const KEY = 'ka.draft.v1';

/** The field as the chat view holds it: the value in state, set by the field. */
function Field({ onSubmit = () => {} }: { onSubmit?: () => void }) {
  const [value, setValue] = useState('');
  const attachments = useAttachments();
  return (
    <Composer
      attachments={attachments}
      onCancel={() => {}}
      onChange={setValue}
      onFollowUp={() => {}}
      onSubmit={onSubmit}
      status="idle"
      value={value}
    />
  );
}

const field = () =>
  screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' }) as HTMLTextAreaElement;

describe('Composer, the draft kept across a sign-in', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetDraftSources();
    window.history.replaceState(null, '', '/threads/conv-1');
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('puts a draft kept for this thread back in the field, once, and does not send it', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ text: 'Utkastet', path: '/threads/conv-1' }));
    const onSubmit = vi.fn();

    const first = render(<Field onSubmit={onSubmit} />);
    expect(field().value).toBe('Utkastet');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(KEY)).toBeNull();

    // A reload, or the thread opened again: the draft is not put back twice.
    first.unmount();
    render(<Field />);
    expect(field().value).toBe('');
  });

  it('leaves a draft from another thread for that thread', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ text: 'Utkastet', path: '/threads/conv-2' }));

    render(<Field />);

    expect(field().value).toBe('');
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
  });

  it('says what it holds, so a 401 can keep it', () => {
    render(<Field />);
    fireEvent.change(field(), { target: { value: 'Et spørsmål under arbeid' } });

    keepDraft();

    expect(JSON.parse(sessionStorage.getItem(KEY) ?? 'null')).toEqual({
      text: 'Et spørsmål under arbeid',
      path: '/threads/conv-1',
    });
  });
});
