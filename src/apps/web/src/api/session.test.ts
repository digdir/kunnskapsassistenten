import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beforeLogout,
  keepDraft,
  noteQuestionInFlight,
  provideDraft,
  resetDraftSources,
  takeDraft,
} from './session';

const KEY = 'ka.draft.v1';

const stored = () => JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as unknown;

describe('the draft kept across a sign-in', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetDraftSources();
    window.history.replaceState(null, '', '/threads/conv-1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('keeps the text in the field, with the page it was written on', () => {
    provideDraft(() => 'Hva skriver DFØ om måloppnåelse?');

    keepDraft();

    expect(stored()).toEqual({ text: 'Hva skriver DFØ om måloppnåelse?', path: '/threads/conv-1' });
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

    expect(stored()).toEqual({ text: 'Hvor mange dokumenter finnes?', path: '/threads/conv-1' });
  });

  it('keeps what is in the field over a question on its way', () => {
    provideDraft(() => 'Neste spørsmål');
    noteQuestionInFlight('Det forrige');

    keepDraft();

    expect(stored()).toEqual({ text: 'Neste spørsmål', path: '/threads/conv-1' });
  });

  it('puts a question that would have started a thread back on the front page', () => {
    // The address is the stand-in the thread was filed under, which the BFF
    // never named: after the sign-in it would say «Fant ikke tråden».
    window.history.replaceState(null, '', '/threads/stand-in');
    provideDraft(() => '');
    noteQuestionInFlight('Hvor mange dokumenter finnes?', () => '/');

    expect(keepDraft()).toBe('/');
    expect(stored()).toEqual({ text: 'Hvor mange dokumenter finnes?', path: '/' });
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

  it('gives the draft back once, on its own page', () => {
    provideDraft(() => 'Utkastet');
    keepDraft();

    expect(takeDraft('/threads/conv-1')).toBe('Utkastet');
    expect(takeDraft('/threads/conv-1')).toBeUndefined();
  });

  it('leaves a draft from another page where it is', () => {
    provideDraft(() => 'Utkastet');
    keepDraft();

    expect(takeDraft('/threads/conv-2')).toBeUndefined();
    expect(takeDraft('/threads/conv-1')).toBe('Utkastet');
  });

  it('drops a stored value it cannot read', () => {
    sessionStorage.setItem(KEY, '{"text":42}');

    expect(takeDraft('/threads/conv-1')).toBeUndefined();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('is gone after «Logg ut», with the rest of what the browser kept', () => {
    provideDraft(() => 'Utkastet');
    keepDraft();

    beforeLogout();

    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('never stands in the way of the sign-in when storage is not there', () => {
    // A private window, or storage turned off: every call throws.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    provideDraft(() => 'Utkastet');

    expect(() => keepDraft()).not.toThrow();
    expect(takeDraft('/threads/conv-1')).toBeUndefined();
  });
});
