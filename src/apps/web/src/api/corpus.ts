import { kaEnv } from './runtimeConfig';

// Which corpus the assistant searches: the list from the environment, the
// choice per browser. A module store, not a React context, because the chat
// client is not a component and reads the active key when it builds a request.

/** One corpus a reader can pick, as the environment names it. */
export type CorpusOption = {
  /** `dataset_config_key` on the wire. See src/api/live/mcp.ts. */
  key: string;
  /** What the reader sees. Norwegian, from the environment. */
  label: string;
  /** What is in this corpus; the filter panel's corpus line must change with it. */
  description?: string;
};

/**
 * `"norquad-docs=Wikipedia (NorQuAD)|351 artikler;kudos-pilot=Kudos-pilot"`: only
 * the first `=` splits, and `|description` is optional. Malformed entries are
 * dropped with one console warning, so a typo costs that entry and not the app.
 */
export function parseCorpusOptions(raw: string | undefined): CorpusOption[] {
  if (!raw?.trim()) return [];

  const options: CorpusOption[] = [];
  const dropped: string[] = [];

  for (const entry of raw.split(';')) {
    if (!entry.trim()) continue;

    const split = entry.indexOf('=');
    const key = (split === -1 ? entry : entry.slice(0, split)).trim();
    const rest = split === -1 ? '' : entry.slice(split + 1);
    const pipe = rest.indexOf('|');
    const label = (pipe === -1 ? rest : rest.slice(0, pipe)).trim();
    const description = pipe === -1 ? undefined : rest.slice(pipe + 1).trim() || undefined;

    // A key with no label draws a nameless row; a label with no key names nothing.
    if (!key || !label) {
      dropped.push(entry.trim());
      continue;
    }
    // First wins: a repeated key is one corpus written twice.
    if (options.some((option) => option.key === key)) continue;

    options.push({ key, label, ...(description ? { description } : {}) });
  }

  if (dropped.length > 0) {
    console.warn(
      `KA: hopper over ${dropped.length} ugyldig(e) oppføring(er) i VITE_KA_DATASETS. ` +
        `Formatet er "nøkkel=Navn|beskrivelse;nøkkel=Navn", der beskrivelsen er valgfri. ` +
        `Hoppet over: ${dropped.join(', ')}`,
    );
  }

  return options;
}

/**
 * The list this deployment offers, and which entry starts selected. The
 * configured key picks the start and is added if the list lacks it, so a key
 * that reaches the backend keeps doing so.
 */
export function resolveCorpus(
  datasets: string | undefined,
  configured: string | undefined,
): { options: CorpusOption[]; fallback: string | undefined } {
  const options = parseCorpusOptions(datasets);
  const key = configured?.trim() || undefined;

  if (key && !options.some((option) => option.key === key)) {
    options.unshift({ key, label: key });
  }

  return { options, fallback: key ?? options[0]?.key };
}

/** Marks a thread's corpus in `tags`, which the backend also uses for its own labels. */
export const CORPUS_TAG_PREFIX = 'corpus:';

/** The corpus a stored thread belongs to, or undefined if it records none. */
export function corpusKeyFromTags(tags: string[] | null | undefined): string | undefined {
  const tag = tags?.find((value) => value.startsWith(CORPUS_TAG_PREFIX));
  return tag?.slice(CORPUS_TAG_PREFIX.length) || undefined;
}

/** Where the choice is remembered. Versioned like `ka.layout.v1`. */
export const CORPUS_STORAGE_KEY = 'ka.corpus.v1';

/**
 * The corpus mock mode starts on. Its key is no real dataset, only there so
 * mock and live look alike downstream; `(mock)` keeps a demo from passing as
 * the pilot.
 */
export const MOCK_CORPUS: CorpusOption = {
  key: 'mock',
  label: 'Kudos, 938 dokumenter (mock)',
  description:
    'Årsrapporter, strategi og plan, tildelingsbrev, statusrapporter og evalueringer, 2020–2027.',
};

/**
 * A second mock corpus, because a chooser with one entry draws nothing and
 * switching could not be seen in mock or tested in e2e. Modelled on
 * `norquad-docs`; its invented documents are in mock/corpus/wikipedia.ts.
 */
export const MOCK_WIKIPEDIA_CORPUS: CorpusOption = {
  key: 'norquad-mock',
  label: 'Wikipedia (mock)',
  description: 'Åtte artikler fra norsk Wikipedia, satt sammen for å vise korpusbytte.',
};

// `kaEnv()`, not `import.meta.env`: an image can be pointed at another corpus
// without a rebuild, and plain Node (Playwright specs) can load this.
const env = kaEnv();

/**
 * The corpora a mode can reach. `bff` has one at most: the BFF answers from the
 * dataset in its own environment and takes none from the browser, so a chooser
 * would change the label and not the answer.
 */
export function corpusForMode(
  mode: string,
  datasets: string | undefined,
  configured: string | undefined,
): { options: CorpusOption[]; fallback: string | undefined } {
  if (mode === 'live') return resolveCorpus(datasets, configured);
  if (mode === 'bff') {
    const { options, fallback } = resolveCorpus(datasets, configured);
    return { options: options.filter((option) => option.key === fallback), fallback };
  }
  return { options: [MOCK_CORPUS, MOCK_WIKIPEDIA_CORPUS], fallback: MOCK_CORPUS.key };
}

const { options: corpusOptions, fallback } = corpusForMode(
  env.VITE_API_MODE ?? 'mock',
  env.VITE_KA_DATASETS,
  env.VITE_KA_DATASET_CONFIG_KEY,
);

export { corpusOptions };

/** One corpus means no chooser; its key still travels on every call. */
export const corpusIsChoosable = corpusOptions.length > 1;

function readStored(): string | undefined {
  try {
    const stored = localStorage.getItem(CORPUS_STORAGE_KEY) ?? undefined;
    // A stored key the list no longer holds is a corpus taken away since the
    // reader chose it. Falling back beats asking for a dataset that is gone.
    return stored && corpusOptions.some((option) => option.key === stored) ? stored : undefined;
  } catch {
    // Private mode, blocked storage. The choice is a convenience; losing it
    // must not stop the app reading its own configuration.
    return undefined;
  }
}

let active = readStored() ?? fallback;
const listeners = new Set<() => void>();

/** The key that goes on the wire right now. Undefined means «backend picks». */
export function activeCorpusKey(): string | undefined {
  return active;
}

/** The whole entry for a key, for anything that needs more than the key. */
export function corpusOption(key: string | undefined): CorpusOption | undefined {
  return corpusOptions.find((option) => option.key === key);
}

export function corpusLabel(key: string | undefined): string | undefined {
  return corpusOption(key)?.label;
}

// The label up to its first comma, for a sentence: «Kudos, 938 dokumenter
// (mock)» carries a count the sentence gives itself.
function corpusName(corpus?: CorpusOption): string | undefined {
  const label = corpus?.label.split(',')[0]?.trim();
  return label === '' ? undefined : label;
}

// For live with no dataset set: the backend picks, and this side cannot know which.
const UNNAMED_CORPUS = 'standardkorpuset';

/**
 * What to call the corpus on screen: its short name, or the stand-in above.
 * Here and not in a panel, so the places that name the corpus cannot drift apart.
 */
export function corpusDisplayName(corpus?: CorpusOption): string {
  return corpusName(corpus) ?? UNNAMED_CORPUS;
}

/**
 * The same name, from a key: an answer carries the key of the corpus it came
 * from, which need not be the one chosen now. Undefined gets the stand-in.
 */
export function corpusDisplayNameFor(key: string | undefined): string {
  return corpusDisplayName(corpusOption(key));
}

/** Change the corpus. Starting a new thread for it is the shell's job (`useCorpus`). */
export function setActiveCorpusKey(key: string): void {
  if (key === active || !corpusOptions.some((option) => option.key === key)) return;
  active = key;
  revision += 1;

  try {
    localStorage.setItem(CORPUS_STORAGE_KEY, key);
  } catch {
    // Remembered for this page at least. See `readStored`.
  }

  for (const listener of [...listeners]) listener();
}

/**
 * For «Logg ut» (`beforeLogout` in session.ts): the choice is kept per
 * browser and not per user, so the next reader in this browser starts on the
 * default corpus.
 */
export function forgetCorpusChoice(): void {
  try {
    localStorage.removeItem(CORPUS_STORAGE_KEY);
  } catch {
    // Not writable. The page is about to leave anyway.
  }
}

export function subscribeToCorpus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Bumped on every change, also when the BFF renames the corpus under the same
// key, which the key alone would not redraw.
let revision = 0;

export type ActiveCorpusSnapshot = {
  key: string | undefined;
  option: CorpusOption | undefined;
};

let snapshot: (ActiveCorpusSnapshot & { revision: number }) | undefined;

/** The active corpus; the same object until the store changes (`useSyncExternalStore`). */
export function activeCorpus(): ActiveCorpusSnapshot {
  if (snapshot?.revision !== revision) {
    snapshot = { revision, key: active, option: corpusOption(active) };
  }
  return snapshot;
}

/**
 * The corpus as the BFF names it (`GET /api/capabilities`), bff mode only. It
 * replaces the build's option, unstored: the server's fact, not the reader's
 * choice (src/decisions/0006-filter-fields-and-corpus-from-the-bff.md).
 */
export function adoptServerCorpus(corpus: CorpusOption): void {
  if (kaEnv().VITE_API_MODE !== 'bff' || !corpus.key || !corpus.label) return;
  const current = corpusOptions.length === 1 ? corpusOptions[0] : undefined;
  if (
    active === corpus.key &&
    current?.key === corpus.key &&
    current.label === corpus.label &&
    current.description === corpus.description
  ) {
    return;
  }
  corpusOptions.splice(0, corpusOptions.length, {
    key: corpus.key,
    label: corpus.label,
    ...(corpus.description ? { description: corpus.description } : {}),
  });
  active = corpus.key;
  revision += 1;
  for (const listener of [...listeners]) listener();
}
