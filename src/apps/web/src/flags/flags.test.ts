import { beforeEach, describe, expect, it, vi } from 'vitest';
import { beforeLogout } from '../api/session';
import { turnOnFromLink } from './flagLink';
import {
  FLAGS,
  FLAGS_STORAGE_KEY,
  forgetFlags,
  isFlagId,
  isFlagOn,
  resetFlags,
  setFlag,
  subscribeToFlags,
} from './flags';

beforeEach(() => {
  localStorage.clear();
  resetFlags();
});

/** What a reload does to the module: it reads storage again. */
function reload() {
  resetFlags();
}

/** Every flag that is on, as the menu and the app see it. */
function flagsOn() {
  return FLAGS.map((flag) => flag.id).filter((id) => isFlagOn(id));
}

describe('the feature flags', () => {
  it('each have a title, a description and an issue', () => {
    for (const flag of FLAGS) {
      expect(flag.title, flag.id).toBeTruthy();
      expect(flag.description, flag.id).toBeTruthy();
      expect(flag.issue, flag.id).toMatch(
        /^https:\/\/github\.com\/digdir\/kunnskapsassistenten\/issues\/\d+$/u,
      );
    }
  });

  it('are off when nothing is stored', () => {
    expect(isFlagOn('year-ranges')).toBe(false);
  });

  it('remember a flag that is turned on, also after a reload', () => {
    setFlag('year-ranges', true);

    expect(JSON.parse(localStorage.getItem(FLAGS_STORAGE_KEY) ?? 'null')).toEqual(['year-ranges']);
    reload();
    expect(isFlagOn('year-ranges')).toBe(true);
  });

  it('remove the key when the last flag is turned off', () => {
    setFlag('year-ranges', true);
    setFlag('year-ranges', false);

    expect(localStorage.getItem(FLAGS_STORAGE_KEY)).toBeNull();
    reload();
    expect(isFlagOn('year-ranges')).toBe(false);
  });

  it('read unknown ids and broken storage as off', () => {
    localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(['finnes-ikke']));
    reload();
    expect(isFlagOn('year-ranges')).toBe(false);

    localStorage.setItem(FLAGS_STORAGE_KEY, '{ikke json');
    reload();
    expect(isFlagOn('year-ranges')).toBe(false);

    localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify({ 'year-ranges': true }));
    reload();
    expect(isFlagOn('year-ranges')).toBe(false);
  });

  it('work for the page even when storage throws', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      setFlag('year-ranges', true);
      expect(isFlagOn('year-ranges')).toBe(true);
    } finally {
      setItem.mockRestore();
    }
  });

  it('tell a listener, but only when something changes', () => {
    const listener = vi.fn();
    const stop = subscribeToFlags(listener);

    setFlag('year-ranges', true);
    setFlag('year-ranges', true);
    stop();
    setFlag('year-ranges', false);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reject a flag that does not exist', () => {
    // @ts-expect-error: an id outside the list is what this test is about.
    expect(() => setFlag('finnes-ikke', true)).toThrow('Unknown flag');
  });
});

/**
 * `mobile-top-row` was a flag until the top row became standard below 774 px
 * (digdir/kunnskapsassistenten#120). Browsers that tried it still have it
 * stored, and links to it are still around.
 */
describe('the retired flag mobile-top-row', () => {
  it('is no longer a flag', () => {
    expect(isFlagId('mobile-top-row')).toBe(false);
  });

  it('reads as off when stored alone, and the page loads with every flag off', () => {
    localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(['mobile-top-row']));
    reload();

    expect(flagsOn()).toEqual([]);
  });

  it('leaves the flags stored beside it on, and is dropped on the next write', () => {
    localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(['mobile-top-row', 'year-ranges']));
    reload();
    expect(flagsOn()).toEqual(['year-ranges']);

    setFlag('compact-filter-chips', true);

    expect(JSON.parse(localStorage.getItem(FLAGS_STORAGE_KEY) ?? 'null')).toEqual([
      'year-ranges',
      'compact-filter-chips',
    ]);
  });

  it('turns nothing on from a link, and writes nothing', () => {
    expect(turnOnFromLink(['mobile-top-row'])).toEqual([]);

    expect(flagsOn()).toEqual([]);
    expect(localStorage.getItem(FLAGS_STORAGE_KEY)).toBeNull();
  });
});

describe('the link that turns a flag on', () => {
  it('turns on the flag the link names', () => {
    expect(turnOnFromLink(['year-ranges'])).toEqual(['year-ranges']);
    expect(isFlagOn('year-ranges')).toBe(true);
  });

  it('takes several flags by comma or repeated parameter, and skips unknown ones', () => {
    expect(turnOnFromLink(['finnes-ikke, year-ranges', 'heller-ikke'])).toEqual(['year-ranges']);
    expect(isFlagOn('year-ranges')).toBe(true);
  });

  it('does nothing with a link that names no known flag', () => {
    expect(turnOnFromLink(['finnes-ikke'])).toEqual([]);
    expect(localStorage.getItem(FLAGS_STORAGE_KEY)).toBeNull();
  });
});

describe('«Logg ut»', () => {
  it('forgets the flags, so the next reader in the browser starts with all off', () => {
    setFlag('year-ranges', true);

    beforeLogout();

    expect(localStorage.getItem(FLAGS_STORAGE_KEY)).toBeNull();
    expect(isFlagOn('year-ranges')).toBe(false);
    reload();
    expect(isFlagOn('year-ranges')).toBe(false);
  });

  it('tells a listener, so a page that is open draws again', () => {
    setFlag('year-ranges', true);
    const listener = vi.fn();
    const stop = subscribeToFlags(listener);

    forgetFlags();
    stop();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
