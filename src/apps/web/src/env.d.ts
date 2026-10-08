/** Variables Vite exposes to the client. Only `VITE_` names reach the bundle: no secrets here. */
interface ImportMetaEnv {
  /** `mock`, `live` or `bff`, read when the app is built. See src/api/apiMode.ts. */
  readonly VITE_API_MODE?: 'mock' | 'live' | 'bff';
  /** Which corpus live mode asks: both or neither, since the backend honours only the pair. */
  readonly VITE_KA_TENANT?: string;
  readonly VITE_KA_DATASET_CONFIG_KEY?: string;
  /**
   * Corpora for the chooser, `key=Name|description;…`; unset means no chooser. See api/corpus.ts.
   */
  readonly VITE_KA_DATASETS?: string;
  /**
   * Fields for the three filter dimensions, `key=dimension:field[:type]|…;…`. See filterFields.ts.
   */
  readonly VITE_KA_FILTER_FIELDS?: string;
  /**
   * Document links, `key=numberTemplate|uuidTemplate;…` with `{doc_num}`. See documentUrls.ts.
   */
  readonly VITE_KA_DOCUMENT_URLS?: string;
  /** Mock mode's answer speed; `realistic` by default. See src/api/mock/MockChatClient.ts. */
  readonly VITE_MOCK_SPEED?: 'fast' | 'realistic' | 'slow';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
