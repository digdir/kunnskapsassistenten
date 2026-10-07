/**
 * Environment variables Vite exposes to the client. Only `VITE_`-prefixed
 * names reach the bundle, which is the point: no secret belongs here.
 */
interface ImportMetaEnv {
  /** `mock`, `live` or `bff`, read when the app is built. See src/api/apiMode.ts. */
  readonly VITE_API_MODE?: 'mock' | 'live' | 'bff';
  /**
   * Which corpus live mode asks. Both or neither — the backend only honours
   * the pair. Unset means the backend picks, which today is the demo corpus.
   * Names of datasets, not credentials. See src/api/live/mcp.ts.
   */
  readonly VITE_KA_TENANT?: string;
  readonly VITE_KA_DATASET_CONFIG_KEY?: string;
  /**
   * The corpora this deployment can reach, for the runtime chooser:
   * `"norquad-docs=Wikipedia (NorQuAD)|351 artikler;kudos-pilot=Kudos-pilot"`.
   *
   * Semicolons between entries, `=` before the name, an optional `|` before a
   * description. Unset means one corpus and no chooser, which is how this
   * worked before. See src/api/corpus.ts.
   */
  readonly VITE_KA_DATASETS?: string;
  /**
   * What each corpus calls the design's three filter dimensions:
   * `"kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer"`.
   *
   * Semicolons between datasets, `=` after the dataset key, `|` between
   * dimensions and `:` inside one. Corpus knowledge, so it is configuration
   * and not code — a dimension with no entry is simply not filtered on. See
   * src/api/filterFields.ts.
   */
  readonly VITE_KA_FILTER_FIELDS?: string;
  /**
   * Where each corpus's documents can be read, with `{doc_num}` where the
   * document's number goes: a template for a number, then after `|` one for
   * a UUID, `"kudos-full=https://kudos.dfo.no/documents/{doc_num}|https://kudos.dfo.no/dokument/{doc_num}"`.
   * A dataset with no entry gets no link. See src/api/documentUrls.ts.
   */
  readonly VITE_KA_DOCUMENT_URLS?: string;
  /**
   * How fast mock mode answers: `fast`, `realistic` (default) or `slow`.
   * See `mockSpeeds` in src/api/mock/MockChatClient.ts.
   */
  readonly VITE_MOCK_SPEED?: 'fast' | 'realistic' | 'slow';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
