import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FOOTER_MODE_STORAGE_KEY,
  getFooterMode,
  resetFooterMode,
  setFooterMode,
  subscribeToFooterMode,
} from './footerMode';

/**
 * Valget for foten (digdir/kunnskapsassistenten#123): lagringen og
 * standarden. Hvor foten faktisk tegnes, står i sidebarFooterMode.test.tsx.
 */
beforeEach(() => {
  localStorage.clear();
  resetFooterMode();
});

describe('footerMode', () => {
  it('står på «ruller med» til noen velger noe annet', () => {
    expect(getFooterMode()).toBe('scrolls');
  });

  it('beholder «festet» for den som har valgt det', () => {
    // Festet var standard før 06.10. Et valg som er lagret, står.
    localStorage.setItem(FOOTER_MODE_STORAGE_KEY, 'pinned');

    expect(getFooterMode()).toBe('pinned');
  });

  it('husker valget i nettleseren', () => {
    setFooterMode('pinned');

    expect(localStorage.getItem(FOOTER_MODE_STORAGE_KEY)).toBe('pinned');
    resetFooterMode();
    expect(getFooterMode()).toBe('pinned');
  });

  it('ser bort fra noe lagret som ikke er en modus', () => {
    localStorage.setItem(FOOTER_MODE_STORAGE_KEY, 'midt-på');

    expect(getFooterMode()).toBe('scrolls');
  });

  it('sier fra når koden setter noe annet enn de to', () => {
    // @ts-expect-error — det er nettopp dette vakten er til for.
    expect(() => setFooterMode('festet')).toThrow(/Ukjent fotmodus/);
  });

  it('gir samme verdi to ganger, så useSyncExternalStore ikke går i løkke', () => {
    expect(getFooterMode()).toBe(getFooterMode());
  });

  it('sier fra til den som lytter, og slutter når den melder seg av', () => {
    const listener = vi.fn();
    const off = subscribeToFooterMode(listener);

    setFooterMode('scrolls');
    expect(listener).toHaveBeenCalledTimes(1);

    off();
    setFooterMode('pinned');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('gjelder for denne sida selv om lagring ikke går', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('site data blocked');
    });

    expect(() => setFooterMode('scrolls')).not.toThrow();
    expect(getFooterMode()).toBe('scrolls');

    setItem.mockRestore();
  });
});
