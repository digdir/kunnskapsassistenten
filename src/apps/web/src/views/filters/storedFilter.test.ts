import { afterEach, describe, expect, it } from 'vitest';
import { FILTER_STORAGE_KEY, readStoredFilter } from '../../layout/persistence';
import { emptyFilterSelection } from '../../model';

/*
 * A filter stored before #288, when Enter in a field with no arrow first
 * chose «Ingen treff» and stored its value, ''. Read back as it was, it went
 * with every question and narrowed it to nothing, and the field said «1 av N
 * valgt» over an empty chip. Here, next to the field that made it;
 * `readStoredFilter` in persistence.ts is what drops it.
 */
describe('et lagret filter med en tom verdi fra før', () => {
  afterEach(() => localStorage.clear());

  it('kommer tilbake uten den tomme verdien', () => {
    localStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({ documentType: [''], organisation: ['Digdir'], year: ['2024', ''] }),
    );

    expect(readStoredFilter()).toEqual({
      documentType: [],
      organisation: ['Digdir'],
      year: ['2024'],
    });
  });

  it('er ingen avgrensning når den tomme verdien var det eneste', () => {
    localStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({ ...emptyFilterSelection, documentType: [''] }),
    );

    expect(readStoredFilter()).toEqual(emptyFilterSelection);
  });
});
