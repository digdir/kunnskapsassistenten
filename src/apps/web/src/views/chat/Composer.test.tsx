import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepDraft, noteSignedIn, resetDraftSources } from '../../api/session';
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

  /** A draft as a 401 keeps it, written by `user-a`. */
  const keptFor = (path: string) =>
    sessionStorage.setItem(KEY, JSON.stringify({ text: 'Utkastet', path, user: 'user-a' }));

  afterEach(() => {
    window.history.replaceState(null, '', '/');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('puts a draft kept for this thread back in the field, once, and does not send it', async () => {
    noteSignedIn('user-a');
    keptFor('/threads/conv-1');
    const onSubmit = vi.fn();

    const first = render(<Field onSubmit={onSubmit} />);
    await waitFor(() => expect(field().value).toBe('Utkastet'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(KEY)).toBeNull();

    // A reload, or the thread opened again: the draft is not put back twice.
    first.unmount();
    render(<Field />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(field().value).toBe('');
  });

  it('leaves a draft from another thread for that thread', async () => {
    noteSignedIn('user-a');
    keptFor('/threads/conv-2');

    render(<Field />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(field().value).toBe('');
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
  });

  it('lets a draft written by someone else go, without putting it in the field', async () => {
    // A shared machine: the session ran out for one reader, and another
    // signed in in the same tab.
    vi.stubEnv('VITE_API_MODE', 'bff');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ authEnabled: true, userId: 'user-b', user: { name: 'Neste' } }),
      ),
    );
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ text: 'Utkastet', path: '/threads/conv-1', user: 'user-a' }),
    );

    render(<Field />);

    await waitFor(() => expect(sessionStorage.getItem(KEY)).toBeNull());
    expect(field().value).toBe('');
  });

  it('puts the draft back for the one who wrote it, once the BFF has said who that is', async () => {
    vi.stubEnv('VITE_API_MODE', 'bff');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ authEnabled: true, userId: 'user-a', user: { name: 'Samme' } }),
      ),
    );
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ text: 'Utkastet', path: '/threads/conv-1', user: 'user-a' }),
    );

    render(<Field />);

    await waitFor(() => expect(field().value).toBe('Utkastet'));
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  /** `/api/me` in bff mode, answering when the test says so. */
  function meAnswersLater(userId: string) {
    let answer = () => {};
    const answered = new Promise<Response>((resolve) => {
      answer = () => resolve(Response.json({ authEnabled: true, userId, user: { name: 'Samme' } }));
    });
    vi.stubEnv('VITE_API_MODE', 'bff');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => answered),
    );
    return answer;
  }

  it('leaves what the reader has written since, when the answer comes late', async () => {
    keptFor('/threads/conv-1');
    const answer = meAnswersLater('user-a');

    render(<Field />);
    fireEvent.change(field(), { target: { value: 'Noe nytt' } });
    answer();

    await waitFor(() => expect(sessionStorage.getItem(KEY)).toBeNull());
    expect(field().value).toBe('Noe nytt');
  });

  it('stops waiting when the field goes, and leaves the draft for the next', async () => {
    keptFor('/threads/conv-1');
    const answer = meAnswersLater('user-a');

    const { unmount } = render(<Field />);
    unmount();
    answer();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sessionStorage.getItem(KEY)).not.toBeNull();
  });

  it('says what it holds, so a 401 can keep it', () => {
    noteSignedIn('user-a');
    render(<Field />);
    fireEvent.change(field(), { target: { value: 'Et spørsmål under arbeid' } });

    keepDraft();

    expect(JSON.parse(sessionStorage.getItem(KEY) ?? 'null')).toEqual({
      text: 'Et spørsmål under arbeid',
      path: '/threads/conv-1',
      user: 'user-a',
    });
  });
});
