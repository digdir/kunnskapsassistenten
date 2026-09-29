import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseDataset, parseFilterFields } from './datasetConfig.ts';

const KUDOS =
  'kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer';

describe('parseFilterFields', () => {
  test('reads the entry for this dataset, with the default labels', () => {
    assert.deepEqual(parseFilterFields(KUDOS, 'kudos-full'), [
      { id: 'documentType', field: 'type', label: 'dokumenttyper' },
      { id: 'organisation', field: 'orgs_long', label: 'virksomheter' },
      { id: 'year', field: 'concerned_years', valueType: 'integer', label: 'år' },
    ]);
  });

  test('another dataset in the same variable is not this one', () => {
    const raw = `norquad-docs=documentType:kategori;${KUDOS}`;
    assert.deepEqual(
      parseFilterFields(raw, 'norquad-docs').map((f) => f.field),
      ['kategori'],
    );
    assert.equal(parseFilterFields(raw, 'kudos-full').length, 3);
    assert.deepEqual(parseFilterFields(raw, 'default'), []);
  });

  test('a label can be set as a fourth part, with or without a value type', () => {
    const raw = 'd=documentType:kategori::artikkeltyper|year:aar:integer:utgivelsesår';
    assert.deepEqual(
      parseFilterFields(raw, 'd').map((f) => [f.label, f.valueType]),
      [
        ['artikkeltyper', undefined],
        ['utgivelsesår', 'integer'],
      ],
    );
  });

  test('drops an unknown id, a missing field, an unknown value type and a repeat', () => {
    const warn = console.warn;
    const warnings: string[] = [];
    console.warn = (msg: string) => void warnings.push(msg);
    try {
      const raw = 'd=topic:x|documentType:|year:aar:integr|documentType:a|documentType:b';
      assert.deepEqual(
        parseFilterFields(raw, 'd').map((f) => f.field),
        ['a'],
      );
      assert.equal(warnings.length, 1);
    } finally {
      console.warn = warn;
    }
  });

  test('unset is no fields, not guessed ones', () => {
    assert.deepEqual(parseFilterFields(undefined, 'kudos-full'), []);
    assert.deepEqual(parseFilterFields('', 'kudos-full'), []);
  });
});

describe('parseDataset', () => {
  test('reads the label and the description for this dataset', () => {
    assert.deepEqual(
      parseDataset('kudos-full=Kudos|10 064 dokumenter fra kudos.dfo.no', 'kudos-full'),
      { key: 'kudos-full', label: 'Kudos', description: '10 064 dokumenter fra kudos.dfo.no' },
    );
  });

  test('the description is optional', () => {
    assert.deepEqual(parseDataset('a=A;kudos-full=Kudos', 'kudos-full'), {
      key: 'kudos-full',
      label: 'Kudos',
    });
  });

  test('no entry or no label is no dataset', () => {
    assert.equal(parseDataset(undefined, 'kudos-full'), undefined);
    assert.equal(parseDataset('kudos-full=|beskrivelse', 'kudos-full'), undefined);
    assert.equal(parseDataset('other=Other', 'kudos-full'), undefined);
  });
});
