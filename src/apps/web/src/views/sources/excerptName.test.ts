import { describe, expect, test } from 'vitest';
import { excerptName } from './excerptName';

describe('excerptName', () => {
  test('et sitert utdrag heter det markøren i svaret heter', () => {
    expect(excerptName(3, 2, 5)).toBe('utdrag 3');
  });

  test('et usitert utdrag heter plassen sin i dokumentet', () => {
    expect(excerptName(undefined, 2, 5)).toBe('utdrag 2 av 5');
  });

  test('siterte utdrag i samme panel får hvert sitt navn', () => {
    // Siteringsnummeret er unikt i hele panelet, så to utdrag i samme dokument
    // kan ikke kollidere.
    const names = [excerptName(1, 1, 2), excerptName(2, 2, 2)];
    expect(new Set(names).size).toBe(names.length);
  });

  test('usiterte utdrag i samme dokument får hvert sitt navn', () => {
    const names = [excerptName(undefined, 1, 3), excerptName(undefined, 2, 3)];
    expect(new Set(names).size).toBe(names.length);
  });

  test('et sitert og et usitert utdrag kan ikke forveksles', () => {
    // «utdrag 2» og «utdrag 2 av 5» er to forskjellige strenger, og «av 5»
    // sier hvilken av de to slagsene navnet er.
    expect(excerptName(2, 9, 9)).not.toBe(excerptName(undefined, 2, 5));
  });
});
