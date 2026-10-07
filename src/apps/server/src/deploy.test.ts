import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseDataset, parseFilterFields } from './datasetConfig.ts';

/*
 * The deployment template and the settings this server reads. On main the
 * filter fields were code; here they come only from `KA_FILTER_FIELDS`, so a
 * deployment without it has no filter panel.
 */
const template = readFileSync(new URL('../../../deploy/main.bicep', import.meta.url), 'utf8');

/** The default of a `param <name> string = '…'` in the template. */
function defaultOf(name: string): string | undefined {
  return new RegExp(`^param ${name} string = '([^']*)'$`, 'm').exec(template)?.[1];
}

test('the template passes the filter fields and the dataset name to the container', () => {
  assert.match(template, /name: 'KA_FILTER_FIELDS', value: '\$\{digdirDatasetConfigKey\}=/);
  assert.match(template, /name: 'KA_DATASETS', value: '\$\{digdirDatasetConfigKey\}=/);
});

test("the template's default fields are Kudos's three, with the year as an integer", () => {
  const dataset = defaultOf('digdirDatasetConfigKey');
  assert.equal(dataset, 'kudos');
  const fields = parseFilterFields(`${dataset}=${defaultOf('kaFilterFields')}`, dataset);
  assert.deepEqual(
    fields.map((f) => [f.id, f.field, f.valueType]),
    [
      ['documentType', 'type', undefined],
      ['organisation', 'orgs_long', undefined],
      // Without `integer` a year finds nothing.
      ['year', 'concerned_years', 'integer'],
    ],
  );
});

test("the template's default dataset name is Kudos", () => {
  const dataset = defaultOf('digdirDatasetConfigKey') ?? '';
  assert.equal(parseDataset(`${dataset}=${defaultOf('kaDataset')}`, dataset)?.label, 'Kudos');
});
