import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DISPLAY_LEVEL_STORAGE_KEY,
  getDisplayLevel,
  resetDisplayLevel,
  setDisplayLevel,
  subscribeToDisplayLevel,
} from './displayLevel';

/**
 * Visningsnivået: hvor mye av assistentens eget arbeid et svar viser.
 *
 * Standard er standard. Uten at noen har valgt noe, ser ingen det tekniske —
 * det var poenget med issue 88, og det er også det som gjør at en
 * lagret verdi ingen kjenner igjen ikke får lov til å slå gjennom.
 */
describe('visningsnivået', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDisplayLevel();
  });

  it('er standard uten at noen har valgt', () => {
    expect(getDisplayLevel()).toBe('standard');
  });

  it('husker valget i nettleseren', () => {
    setDisplayLevel('detaljert');

    expect(localStorage.getItem(DISPLAY_LEVEL_STORAGE_KEY)).toBe('detaljert');
    resetDisplayLevel();
    expect(getDisplayLevel()).toBe('detaljert');
  });

  it('faller tilbake på standard når det som er lagret er noe annet', () => {
    // En gammel nøkkel, en halvskrevet verdi, eller noen som har tullet i
    // konsollen. Ingen av delene skal gi et nivå som ikke finnes.
    localStorage.setItem(DISPLAY_LEVEL_STORAGE_KEY, 'verbose');

    expect(getDisplayLevel()).toBe('standard');
  });

  it('sier fra til den som lytter', () => {
    const heard = vi.fn();
    const stop = subscribeToDisplayLevel(heard);

    setDisplayLevel('detaljert');
    expect(heard).toHaveBeenCalledTimes(1);

    stop();
    setDisplayLevel('standard');
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('overlever et lager som kaster', () => {
    /*
     * Safari i privat modus og nettlesere med nettstedsdata blokkert kaster
     * på tilgang, de svarer ikke null. Et visningsnivå er aldri verdt en blank
     * side — samme vakt som colorScheme.ts har.
     */
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blokkert');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blokkert');
    });

    expect(getDisplayLevel()).toBe('standard');
    expect(() => setDisplayLevel('detaljert')).not.toThrow();
    // Og nivået gjelder for denne sidelastingen, selv om ingenting ble lagret.
    expect(getDisplayLevel()).toBe('detaljert');

    getItem.mockRestore();
    setItem.mockRestore();
  });

  it('nekter et nivå som ikke finnes', () => {
    expect(() => setDisplayLevel('verbose' as never)).toThrow(/Ukjent visningsnivå/u);
  });
});
