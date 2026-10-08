import { beforeEach, describe, expect, it, vi } from 'vitest';
import { beforeLogout } from '../api/session';
import { turnOnFromLink } from './flagLink';
import {
  FLAGS,
  FLAGS_STORAGE_KEY,
  forgetFlags,
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

describe('funksjonsflaggene', () => {
  it('har det første flagget, med tittel, beskrivelse og issue', () => {
    const flag = FLAGS.find((candidate) => candidate.id === 'mobile-top-row');
    expect(flag?.title).toBeTruthy();
    expect(flag?.description).toBeTruthy();
    expect(flag?.issue).toBe('https://github.com/digdir/kunnskapsassistenten/issues/120');
  });

  it('er av når ingenting er lagret', () => {
    expect(isFlagOn('mobile-top-row')).toBe(false);
  });

  it('husker et flagg som er slått på, også etter en reload', () => {
    setFlag('mobile-top-row', true);

    expect(JSON.parse(localStorage.getItem(FLAGS_STORAGE_KEY) ?? 'null')).toEqual([
      'mobile-top-row',
    ]);
    reload();
    expect(isFlagOn('mobile-top-row')).toBe(true);
  });

  it('tar nøkkelen bort når det siste flagget slås av', () => {
    setFlag('mobile-top-row', true);
    setFlag('mobile-top-row', false);

    expect(localStorage.getItem(FLAGS_STORAGE_KEY)).toBeNull();
    reload();
    expect(isFlagOn('mobile-top-row')).toBe(false);
  });

  it('leser ukjente id-er og ødelagt lager som av', () => {
    localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(['finnes-ikke']));
    reload();
    expect(isFlagOn('mobile-top-row')).toBe(false);

    localStorage.setItem(FLAGS_STORAGE_KEY, '{ikke json');
    reload();
    expect(isFlagOn('mobile-top-row')).toBe(false);

    localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify({ 'mobile-top-row': true }));
    reload();
    expect(isFlagOn('mobile-top-row')).toBe(false);
  });

  it('virker for siden selv når lageret kaster', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      setFlag('mobile-top-row', true);
      expect(isFlagOn('mobile-top-row')).toBe(true);
    } finally {
      setItem.mockRestore();
    }
  });

  it('sier fra til den som lytter, men bare når noe endres', () => {
    const listener = vi.fn();
    const stop = subscribeToFlags(listener);

    setFlag('mobile-top-row', true);
    setFlag('mobile-top-row', true);
    stop();
    setFlag('mobile-top-row', false);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('avviser et flagg som ikke finnes', () => {
    // @ts-expect-error: an id outside the list is what this test is about.
    expect(() => setFlag('finnes-ikke', true)).toThrow('Ukjent flagg');
  });
});

describe('lenken som slår på et flagg', () => {
  it('slår på flagget lenken nevner', () => {
    expect(turnOnFromLink(['mobile-top-row'])).toEqual(['mobile-top-row']);
    expect(isFlagOn('mobile-top-row')).toBe(true);
  });

  it('tar flere flagg med komma eller gjentatt parameter, og hopper over ukjente', () => {
    expect(turnOnFromLink(['finnes-ikke, mobile-top-row', 'heller-ikke'])).toEqual([
      'mobile-top-row',
    ]);
    expect(isFlagOn('mobile-top-row')).toBe(true);
  });

  it('gjør ingenting med en lenke uten kjente flagg', () => {
    expect(turnOnFromLink(['finnes-ikke'])).toEqual([]);
    expect(localStorage.getItem(FLAGS_STORAGE_KEY)).toBeNull();
  });
});

describe('«Logg ut»', () => {
  it('glemmer flaggene, så neste leser i nettleseren starter med alt av', () => {
    setFlag('mobile-top-row', true);

    beforeLogout();

    expect(localStorage.getItem(FLAGS_STORAGE_KEY)).toBeNull();
    expect(isFlagOn('mobile-top-row')).toBe(false);
    reload();
    expect(isFlagOn('mobile-top-row')).toBe(false);
  });

  it('sier fra til den som lytter, så en side som står åpen tegner om', () => {
    setFlag('mobile-top-row', true);
    const listener = vi.fn();
    const stop = subscribeToFlags(listener);

    forgetFlags();
    stop();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
