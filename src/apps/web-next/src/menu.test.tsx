import { BookIcon } from '@navikt/aksel-icons';
import { isValidElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ABOUT_PATH, CHANGELOG_PATH, menuFor } from './menu';

afterEach(() => history.replaceState(null, '', '/'));

describe("KA's entries in the profile menu", () => {
  it('gives «Om prosjektet» the book, not an icon that reads as a download', () => {
    const about = menuFor().extra?.find((entry) => entry.id === 'about');
    expect(isValidElement(about?.icon) && about.icon.type).toBe(BookIcon);
  });

  it('has the two pages and nothing else of the host', () => {
    const menu = menuFor();
    expect(Object.keys(menu).sort()).toEqual(['changelog', 'extra']);
    expect(menu.extra?.map((entry) => entry.id)).toEqual(['about']);
  });

  it('opens the pages with the address the person left, for the way back', () => {
    history.replaceState(null, '', '/?t=abc');
    const go = vi.fn();
    const menu = menuFor(go);
    menu.changelog?.onSelect?.();
    expect(go).toHaveBeenLastCalledWith(`${CHANGELOG_PATH}?fra=%2F%3Ft%3Dabc`);
    menu.extra?.find((entry) => entry.id === 'about')?.onSelect?.();
    expect(go).toHaveBeenLastCalledWith(`${ABOUT_PATH}?fra=%2F%3Ft%3Dabc`);
  });
});
