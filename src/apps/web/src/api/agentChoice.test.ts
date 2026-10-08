import { afterEach, describe, expect, it, vi } from 'vitest';
import { AGENT_STORAGE_KEY, forgetAgentChoice, storeAgentId, storedAgentId } from './agentChoice';
import { beforeLogout } from './session';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('agentChoice', () => {
  it('husker valget i nettleseren til neste gang', () => {
    storeAgentId('builtin/fact-checker-agent');

    expect(window.localStorage.getItem(AGENT_STORAGE_KEY)).toBe('builtin/fact-checker-agent');
    expect(storedAgentId()).toBe('builtin/fact-checker-agent');
  });

  it('husker ingenting når leseren går tilbake til standarden', () => {
    storeAgentId('builtin/fact-checker-agent');
    storeAgentId(undefined);

    expect(storedAgentId()).toBeUndefined();
  });

  it('er borte etter «Logg ut», sammen med resten av det nettleseren husket', () => {
    storeAgentId('builtin/fact-checker-agent');

    beforeLogout();

    expect(window.localStorage.getItem(AGENT_STORAGE_KEY)).toBeNull();
  });

  it('kaster aldri når lageret ikke kan brukes', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    expect(() => storeAgentId('builtin/fact-checker-agent')).not.toThrow();
    expect(storedAgentId()).toBeUndefined();
    expect(() => forgetAgentChoice()).not.toThrow();
  });
});
