import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUserId, resetUserId } from './userId';

beforeEach(() => {
  window.localStorage.clear();
  resetUserId();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('currentUserId', () => {
  it('lager en id med randomUUID første gang, og husker den', () => {
    const id = currentUserId();

    expect(id).toMatch(/^ka-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(window.localStorage.getItem('ka.user.v1')).toBe(id);
    resetUserId();
    expect(currentUserId()).toBe(id);
  });

  it('bruker getRandomValues og ikke Math.random der randomUUID mangler', () => {
    // `randomUUID` is only there in a secure context: a page served over
    // plain http from anything but localhost has `getRandomValues` alone.
    const random = vi.spyOn(Math, 'random');
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', {
      getRandomValues: <T extends ArrayBufferView<ArrayBuffer>>(array: T) =>
        real.getRandomValues(array),
    });

    const id = currentUserId();
    resetUserId();
    window.localStorage.clear();
    const other = currentUserId();

    expect(random).not.toHaveBeenCalled();
    expect(id).toMatch(/^ka-[0-9a-f]{32}$/);
    expect(other).not.toBe(id);
  });
});
