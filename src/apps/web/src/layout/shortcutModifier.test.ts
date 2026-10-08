import { afterEach, describe, expect, it, vi } from 'vitest';
import { shortcutModifier } from './shortcutModifier';

/**
 * Hvilket ord hopplenka skal si om hurtigtasten.
 *
 * Bare ordet. Begge tastene virker overalt — håndtereren tar `ctrlKey` eller
 * `metaKey` — så et feil valg koster leseren én forvirrende etikett og ikke
 * en hurtigtast.
 */
function withUserAgent(value: string): void {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(value);
}

afterEach(() => vi.restoreAllMocks());

describe('shortcutModifier', () => {
  it('sier Cmd på Mac', () => {
    withUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    expect(shortcutModifier()).toBe('Cmd');
  });

  it('sier Cmd på iPad og iPhone, som har det samme tastaturet tilkoblet', () => {
    withUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    expect(shortcutModifier()).toBe('Cmd');

    withUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect(shortcutModifier()).toBe('Cmd');
  });

  it('sier Ctrl på Windows', () => {
    withUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    expect(shortcutModifier()).toBe('Ctrl');
  });

  it('sier Ctrl på Linux', () => {
    withUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36');
    expect(shortcutModifier()).toBe('Ctrl');
  });

  it('sier Ctrl når den ikke kjenner igjen noe', () => {
    // Ctrl og ikke ingenting: en ukjent maskin skal få det vanligste ordet,
    // ikke en lenke som mangler hintet sitt.
    withUserAgent('');
    expect(shortcutModifier()).toBe('Ctrl');

    withUserAgent('en helt ukjent nettleser');
    expect(shortcutModifier()).toBe('Ctrl');
  });
});
