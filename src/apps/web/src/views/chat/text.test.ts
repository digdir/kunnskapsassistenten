import { afterEach, describe, expect, it, vi } from 'vitest';
import { shortcutHint } from './text';

/** Swaps the user agent for one line, the way a real machine would report it. */
function onPlatform(userAgent: string) {
  vi.stubGlobal('navigator', { ...navigator, userAgent });
}

afterEach(() => vi.unstubAllGlobals());

describe('shortcutHint', () => {
  it('names Cmd on a Mac', () => {
    onPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15');
    expect(shortcutHint()).toBe('Trykk Cmd + / for å hoppe hit');
  });

  it('names Ctrl everywhere else', () => {
    onPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    expect(shortcutHint()).toBe('Trykk Ctrl + / for å hoppe hit');
  });

  it('falls back to Ctrl rather than guessing', () => {
    // Both modifiers work; this only decides which word to show, so an
    // unknown machine gets the one more keyboards have.
    onPlatform('noe helt annet');
    expect(shortcutHint()).toBe('Trykk Ctrl + / for å hoppe hit');
  });
});
