import { describe, expect, it } from 'vitest';
import { emptyFilterSelection } from '../../model';
import { filterSummaryText } from './filterSummary';

describe('filterSummaryText', () => {
  it('says nothing when nothing was narrowed', () => {
    expect(filterSummaryText(emptyFilterSelection)).toBeUndefined();
  });

  it('names the values in the order the filter panel lists them', () => {
    expect(
      filterSummaryText({
        documentType: ['Årsrapport'],
        organisation: ['Nasjonal kommunikasjonsmyndighet'],
        year: ['2023'],
      }),
    ).toBe('Årsrapport · Nasjonal kommunikasjonsmyndighet · 2023');
  });

  it('lists several values from the same dimension', () => {
    expect(
      filterSummaryText({ ...emptyFilterSelection, documentType: ['Årsrapport', 'Evaluering'] }),
    ).toBe('Årsrapport · Evaluering');
  });
});
