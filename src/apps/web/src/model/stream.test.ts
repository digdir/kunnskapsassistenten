import { describe, expect, it } from 'vitest';
import { chatErrorCode } from './stream';

describe('chatErrorCode', () => {
  it('keeps a code it knows', () => {
    expect(chatErrorCode('retrieval-unavailable')).toBe('retrieval-unavailable');
    expect(chatErrorCode('no-hits')).toBe('no-hits');
  });

  it('falls back to unknown for a code it has never heard of', () => {
    // The backend does not send codes yet (API-bestilling A16), and the day it
    // does it will send some this frontend was not written for. That has to
    // read as the generic failure, never crash a turn.
    expect(chatErrorCode('quota-exceeded')).toBe('unknown');
    expect(chatErrorCode('AGENT_ERROR')).toBe('unknown');
  });

  it('falls back to unknown for anything that is not a string', () => {
    for (const value of [undefined, null, 42, {}, ['timeout']]) {
      expect(chatErrorCode(value)).toBe('unknown');
    }
  });
});
