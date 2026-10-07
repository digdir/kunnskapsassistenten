import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beforeLogout,
  fetchSession,
  keepDraft,
  noteQuestionInFlight,
  noteSignedIn,
  provideDraft,
  resetDraftSources,
  restoreDraft,
} from './session';

const KEY = 'ka.draft.v1';

const stored = () => JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as unknown;

/** What `restoreDraft` puts back on `path`, once it has heard who is signed in. */
async function restored(path: string): Promise<string | undefined> {
  let text: string | undefined;
  restoreDraft((kept) => (text = kept), path);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return text;
}

describe('the draft kept across a sign-in', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetDraftSources();
    noteSignedIn('user-a');
    window.history.replaceState(null, '', '/threads/conv-1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  it('keeps the text in the field, with the page it was written on', () => {
    provideDraft(() => 'Hva skriver DFØ om måloppnåelse?');

    keepDraft();

    expect(stored()).toEqual({
      text: 'Hva skriver DFØ om måloppnåelse?',
      path: '/threads/conv-1',
      user: 'user-a',
    });
  });

  it('keeps nothing when the field is empty, or only spaces', () => {
    provideDraft(() => '  \n ');

    keepDraft();

    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('keeps the question on its way when the field has just been emptied by sending it', () => {
    provideDraft(() => '');
    noteQuestionInFlight('Hvor mange dokumenter finnes?');

    keepDraft();

    expect(stored()).toEqual({
      text: 'Hvor mange dokumenter finnes?',
      path: '/threads/conv-1',
      user: 'user-a',
    });
  });

  it('keeps what is in the field over a question on its way', () => {
    provideDraft(() => 'Neste spørsmål');
    noteQuestionInFlight('Det forrige');

    keepDraft();

    expect(stored()).toEqual({ text: 'Neste spørsmål', path: '/threads/conv-1', user: 'user-a' });
  });

  it('puts a question that would have started a thread back on the front page', () => {
    // The address is the stand-in the thread was filed under, which the BFF
    // never named: after the sign-in it would say «Fant ikke tråden».
    window.history.replaceState(null, '', '/threads/stand-in');
    provideDraft(() => '');
    noteQuestionInFlight('Hvor mange dokumenter finnes?', () => '/');

    expect(keepDraft()).toBe('/');
    expect(stored()).toEqual({ text: 'Hvor mange dokumenter finnes?', path: '/', user: 'user-a' });
  });

  it('comes back to the page the reader is on otherwise', () => {
    window.history.replaceState(null, '', '/threads/conv-1?q=1');
    provideDraft(() => 'Utkastet');

    expect(keepDraft()).toBe('/threads/conv-1?q=1');
  });

  it('forgets the question once it has arrived', () => {
    const arrived = noteQuestionInFlight('Hvor mange dokumenter finnes?');
    arrived();

    keepDraft();

    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('reads no field that has gone', () => {
    const gone = provideDraft(() => 'Fra en tråd som er lukket');
    gone();

    keepDraft();

    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('keeps nothing before the BFF has said who is signed in', () => {
    resetDraftSources();
    provideDraft(() => 'Utkastet');

    keepDraft();

    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('gives the draft back once, on its own page', async () => {
    provideDraft(() => 'Utkastet');
    keepDraft();

    expect(await restored('/threads/conv-1')).toBe('Utkastet');
    expect(await restored('/threads/conv-1')).toBeUndefined();
  });

  it('leaves a draft from another page where it is', async () => {
    provideDraft(() => 'Utkastet');
    keepDraft();

    expect(await restored('/threads/conv-2')).toBeUndefined();
    expect(await restored('/threads/conv-1')).toBe('Utkastet');
  });

  it('throws away a draft written by somebody else, without giving it back', async () => {
    provideDraft(() => 'Utkastet');
    keepDraft();
    resetDraftSources();
    noteSignedIn('user-b');

    expect(await restored('/threads/conv-1')).toBeUndefined();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('gives it back once when two fields wait for the same answer', async () => {
    provideDraft(() => 'Utkastet');
    keepDraft();
    const put = vi.fn();

    restoreDraft(put, '/threads/conv-1');
    restoreDraft(put, '/threads/conv-1');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(put).toHaveBeenCalledExactlyOnceWith('Utkastet');
  });

  it('asks /api/me who is signed in when nobody has said yet', async () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ text: 'Utkastet', path: '/threads/conv-1', user: 'user-a' }),
    );
    resetDraftSources();
    vi.stubEnv('VITE_API_MODE', 'bff');
    const fetchMock = vi.fn(async () =>
      Response.json({ authEnabled: true, userId: 'user-a', user: { name: 'Samme' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    expect(await restored('/threads/conv-1')).toBe('Utkastet');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('leaves the draft where it is when /api/me does not answer', async () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ text: 'Utkastet', path: '/threads/conv-1', user: 'user-a' }),
    );
    resetDraftSources();
    vi.stubEnv('VITE_API_MODE', 'bff');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 502 })),
    );

    expect(await restored('/threads/conv-1')).toBeUndefined();
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
  });

  it('drops a stored value it cannot read, and one without a writer', async () => {
    for (const value of ['{"text":42}', '{"text":"Utkastet","path":"/threads/conv-1"}']) {
      sessionStorage.setItem(KEY, value);

      expect(await restored('/threads/conv-1')).toBeUndefined();
      expect(sessionStorage.getItem(KEY)).toBeNull();
    }
  });

  it('is gone after «Logg ut», with the rest of what the browser kept', () => {
    provideDraft(() => 'Utkastet');
    keepDraft();

    beforeLogout();

    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('never stands in the way of the sign-in when storage is not there', async () => {
    // A private window, or storage turned off: every call throws.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    provideDraft(() => 'Utkastet');

    expect(() => keepDraft()).not.toThrow();
    expect(await restored('/threads/conv-1')).toBeUndefined();
  });
});

describe('fetchSession', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('asks the BFF under /api/v2, as the rest of this client does', async () => {
    vi.stubEnv('VITE_API_MODE', 'bff');
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ authEnabled: true, user: { name: 'Kari' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchSession();

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v2/me');
  });
});
