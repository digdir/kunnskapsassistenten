import { beforeEach, describe, expect, it } from 'vitest';
import { getColorScheme, initColorScheme, setColorScheme, STORAGE_KEY } from './colorScheme';

describe('colorScheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-color-scheme');
  });

  it('follows the operating system until someone chooses', () => {
    expect(getColorScheme()).toBe('auto');
  });

  it('stores the choice and applies it to the document', () => {
    setColorScheme('dark');

    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');
    expect(getColorScheme()).toBe('dark');
  });

  it('ignores a stored value that is not a scheme', () => {
    localStorage.setItem(STORAGE_KEY, 'neon');
    expect(getColorScheme()).toBe('auto');
  });

  it('rejects an unknown scheme with a Norwegian message', () => {
    // @ts-expect-error the console is not type-checked, so the guard is real
    expect(() => setColorScheme('neon')).toThrow(/Ukjent fargemodus/);
  });

  it('exposes the console API', () => {
    initColorScheme();

    expect(window.ka?.colorScheme.get()).toBe('auto');
    window.ka?.colorScheme.set('light');
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('light');
  });
});
