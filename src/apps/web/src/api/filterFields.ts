import { parseFilterFields } from '../../shared/filterFields.ts';
import type { DatasetFilterFields } from '../../shared/filterFields.ts';
import { kaEnv } from './runtimeConfig';

/**
 * What a corpus calls the three filter dimensions: configuration, not code
 * (src/decisions/0004-corpus-knowledge-and-facets.md). Never guess a missing one:
 * Typesense answers an unknown field with an error or nothing («ingen treff»).
 */

export { parseFilterFields } from '../../shared/filterFields.ts';
export type {
  DatasetFilterFields,
  FilterFieldConfig,
  FilterFieldMapping,
} from '../../shared/filterFields.ts';

// Read once, at import. `kaEnv()`, not `import.meta.env`, so an image can be
// pointed at another corpus without a rebuild, and plain Node can load this.
const filterFields = parseFilterFields(kaEnv().VITE_KA_FILTER_FIELDS);

/**
 * The field names for one dataset, or undefined when none are configured or
 * there is no dataset (live where the backend picks). Undefined sends no filter.
 */
export function filterFieldsFor(datasetKey: string | undefined): DatasetFilterFields | undefined {
  return datasetKey ? filterFields[datasetKey] : undefined;
}
