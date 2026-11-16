import { afterEach, describe, expect, it } from 'vitest';
import { COLOR_SCHEME_KEY } from './App';
import { forgetPreviousClient, PREVIOUS_KEYS } from './previousClient';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('what the previous client kept in this browser', () => {
  it('is forgotten, its draft included, and nothing of this client’s', () => {
    for (const key of PREVIOUS_KEYS) localStorage.setItem(key, 'x');
    localStorage.setItem('ka-next.filter', 'kept');
    localStorage.setItem('kalender', 'someone else’s');
    sessionStorage.setItem('ka.draft.v1', '{"text":"Et utkast"}');
    forgetPreviousClient();
    expect(Object.keys(localStorage).sort()).toEqual(['ka-next.filter', 'kalender']);
    expect(sessionStorage.getItem('ka.draft.v1')).toBeNull();
  });

  it('keeps the colour scheme chosen there as this client’s, until one is chosen here', () => {
    localStorage.setItem('ka.color-scheme', 'dark');
    forgetPreviousClient();
    expect(localStorage.getItem(COLOR_SCHEME_KEY)).toBe('dark');
    expect(localStorage.getItem('ka.color-scheme')).toBeNull();

    localStorage.setItem('ka.color-scheme', 'dark');
    localStorage.setItem(COLOR_SCHEME_KEY, 'light');
    forgetPreviousClient();
    expect(localStorage.getItem(COLOR_SCHEME_KEY)).toBe('light');

    localStorage.clear();
    localStorage.setItem('ka.color-scheme', 'purple');
    forgetPreviousClient();
    expect(localStorage.getItem(COLOR_SCHEME_KEY)).toBeNull();
  });

  it('does nothing, and throws nothing, when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    } as unknown as Storage;
    expect(() => forgetPreviousClient(blocked, blocked)).not.toThrow();
    expect(() => forgetPreviousClient(undefined, undefined)).not.toThrow();
  });
});
