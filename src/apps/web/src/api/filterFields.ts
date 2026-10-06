import { parseFilterFields } from '../../shared/filterFields.ts';
import type { DatasetFilterFields } from '../../shared/filterFields.ts';
import { kaEnv } from './runtimeConfig';

/**
 * What a corpus calls the three dimensions the design draws.
 *
 * The filter panel offers «Dokumenttyper», «Virksomheter» and «År». The
 * backend's filter wants the corpus's own field names, and those differ from
 * corpus to corpus: Kudos has `type`, `orgs_long` and `concerned_years`, the
 * next corpus will have three other names, and one of them may well have no
 * year at all.
 *
 * **That translation is knowledge about a corpus, so it is configuration and
 * not code** (src/decisions/0004-corpus-knowledge-and-facets.md, alternative
 * D: the mechanism ships in code, the policy lives per dataset). A field name
 * written into `src/` would be a frontend that only works against Kudos, and
 * the next corpus would be a pull request rather than an environment
 * variable. So nothing here names a field; it reads them.
 *
 * Read the same way as `VITE_KA_DATASETS` in corpus.ts, deliberately: one
 * variable, semicolons between entries, one bad entry dropped with a single
 * warning rather than an exception. A deployment setting is read at startup,
 * and a typo should cost that entry and not the app.
 *
 * A dimension with no entry is **not sent, and never guessed**. Sending a
 * guessed field name is worse than sending nothing: Typesense answers a
 * filter on a field it does not know with an error or with nothing, and the
 * reader would see «ingen treff» for a corpus that has the documents.
 *
 * The grammar itself is in shared/filterFields.ts, because the server reads
 * the same variable to count the facets. This module is the client's reading
 * of it.
 */

export { parseFilterFields } from '../../shared/filterFields.ts';
export type {
  DatasetFilterFields,
  FilterFieldConfig,
  FilterFieldMapping,
} from '../../shared/filterFields.ts';

/*
 * Read once, at import, like the corpus list: this is a deployment's
 * statement about its datasets and it does not change while the app runs.
 * `kaEnv()` and not `import.meta.env`, so one container image can be pointed
 * at another corpus without a rebuild — and so the module survives plain
 * Node, where Playwright loads spec files that reach it.
 */
const filterFields = parseFilterFields(kaEnv().VITE_KA_FILTER_FIELDS);

/**
 * The field names for one dataset, or undefined when none are configured.
 *
 * Undefined for an unknown dataset and for `undefined` itself — which is the
 * live client with no tenant and dataset pair set, where the backend picks a
 * dataset and nothing on this side knows which one it picked. No dataset
 * means no field names, and no field names means no filter on the wire.
 */
export function filterFieldsFor(datasetKey: string | undefined): DatasetFilterFields | undefined {
  return datasetKey ? filterFields[datasetKey] : undefined;
}
