import { BookIcon } from '@navikt/aksel-icons';
import { isValidElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ABOUT_PATH, CHANGELOG_PATH, menuFor } from './menu';

afterEach(() => history.replaceState(null, '', '/'));

describe("KA's entries in the profile menu", () => {
  it("gives «Om prosjektet» apps/web's icon for the page, not one that reads as a download", () => {
    const about = menuFor(vi.fn()).extra?.find((entry) => entry.id === 'about');
    expect(isValidElement(about?.icon) && about.icon.type).toBe(BookIcon);
  });

  it("opens apps/web's pages with the address the person left, for the way back", () => {
    history.replaceState(null, '', '/?t=abc');
    const go = vi.fn();
    const menu = menuFor(vi.fn(), go);
    menu.changelog?.onSelect?.();
    expect(go).toHaveBeenLastCalledWith(`${CHANGELOG_PATH}?fra=%2F%3Ft%3Dabc`);
    menu.extra?.find((entry) => entry.id === 'about')?.onSelect?.();
    expect(go).toHaveBeenLastCalledWith(`${ABOUT_PATH}?fra=%2F%3Ft%3Dabc`);
  });
});
