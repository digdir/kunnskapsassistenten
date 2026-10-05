import { describe, expect, it } from 'vitest';
import { emptyFilterSelection, type FilterFacet, type FilterSelection } from '../../model';
import { valuesWithoutField } from './withoutField';

const selection: FilterSelection = {
  documentType: ['Årsrapport'],
  organisation: ['Advokattilsynet', 'Datatilsynet'],
  year: ['2024'],
};

const typesOnly: FilterFacet[] = [
  {
    dimension: 'documentType',
    label: 'Dokumenttyper',
    values: [{ value: 'Årsrapport', label: 'Årsrapport' }],
  },
];

describe('valuesWithoutField', () => {
  it('gives every chosen value, in the panel’s order, when there are no facets', () => {
    expect(valuesWithoutField(selection, [])).toEqual([
      { dimension: 'documentType', value: 'Årsrapport' },
      { dimension: 'organisation', value: 'Advokattilsynet' },
      { dimension: 'organisation', value: 'Datatilsynet' },
      { dimension: 'year', value: '2024' },
    ]);
    expect(valuesWithoutField(selection, undefined)).toHaveLength(4);
  });

  it('leaves out a dimension that has its field', () => {
    expect(valuesWithoutField(selection, typesOnly).map(({ value }) => value)).toEqual([
      'Advokattilsynet',
      'Datatilsynet',
      '2024',
    ]);
  });

  it('gives nothing when nothing is chosen', () => {
    expect(valuesWithoutField(emptyFilterSelection, [])).toEqual([]);
  });
});
