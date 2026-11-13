// The state the blocks share and the events that change it, lifted from the UI blocks preview's
// App.tsx so any layout can be drawn from it. The blocks stay as they are: data in, events out
// (ADR 0046). What happens when a partner block is off follows the app builder plan's wiring table:
// - without Tråder, one thread per visit, and a new one from the greeting;
// - without Filter, the question goes to the collection from the setup, narrowed by nothing, and
//   there is no «Endre»;
// - without the corpus choice, the collection is the service's own, with no choice shown; a
//   service with no collection, a plain chat, is asked with none;
// - without Kilder, a footnote opens the document in Dokumentvisning; without both, no footnotes
//   (V2-0010 pairs every footnote with an excerpt);
// - without Fremgangsmåte, no steps are asked for;
// - without Innstillinger, the defaults;
// - with one variant, no picker.
import {
  answerCitations,
  blockSpec,
  documentCount,
  factsFromModels,
  isDisplayLevel,
  isEmptySelection,
  isOn,
  narrowing,
  needMet,
  optionInForce,
  sameSelection,
  serviceOf,
  settingsOf,
  templateLook,
  zoneOf,
  type AssistantLayout,
  type BlockId,
  type Channel,
  type ColorScheme,
  type ConversationScope,
  type ConversationTarget,
  type ConversationTurn,
  type CorpusOption,
  type DisplayLevel,
  type DocumentItem,
  type DocumentInScope,
  type DocumentQuestion,
  type DocumentViewReturn,
  type FilterField,
  type FilterSelection,
  type ModelRow,
  type Need,
  type ShellLayout,
  type ShellRequest,
  type SourceTarget,
  type VariantOption,
} from '@genai/ui-blocks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  failureOf,
  filterSet,
  HttpError,
  sourceFromWire,
  type AnswerData,
  type AssistantApi,
  type ThreadRow,
  type Turn,
} from './api.js';
import { useT } from './i18n.js';
import type { StepFrame } from './procedure.js';
import type { AssistantProfile, FieldSpec } from './profile.js';
import { useStoredValue, type AssistantStorage } from './storage.js';

export interface AssistantFeedback {
  answerId: string;
  /** genki's run (`task` in `POST /api/feedback`), when given; see the component page. */
  runId?: string | undefined;
  rating: 'up' | 'down';
  reasons: readonly string[];
  comment?: string | undefined;
}

export interface AssistantOptions {
  api: AssistantApi;
  layout: AssistantLayout;
  /** The genki service, `kunnskapsassistenten`. */
  service: string;
  tenant: string;
  /** The variant to start from, a model id; the service's default without it. */
  model?: string | undefined;
  profile?: AssistantProfile | undefined;
  /** The channels the client is given; all three by default. */
  channels?: readonly Channel[] | undefined;
  /**
   * The assistant owns the page: the thread in the address as `?t=` (only with Tråder), so a
   * reload opens it again; «Innstillinger» as `#innstillinger`, or at its own path with `paths`;
   * and the tab's title.
   */
  threadInUrl?: boolean | undefined;
  /**
   * With `threadInUrl`, where the pages live in the address. Without it, the assistant is a page
   * in its host's: «Innstillinger» is `#innstillinger`, and the rest of the address is kept, as
   * the app builder's `/prov?layout=…` needs. With it, each page has a path of its own and the
   * query holds only the thread, as a site that is only the assistant has it:
   * `{ home: '/', settings: '/innstillinger' }`.
   */
  paths?: { home: string; settings: string } | undefined;
  /**
   * List every thread the key can read, of any service. Without it, only the threads of the
   * service and its family, as a host for one service shows them.
   */
  allThreads?: boolean | undefined;
  /** Where the reader's choices are kept; nothing past the page without it. */
  storage?: AssistantStorage | undefined;
  /** Something the reader should hear about, such as a new thread after a new collection. */
  onNotice?: ((text: string) => void) | undefined;
  /** The reader's colour scheme, kept by the host, which «Innstillinger» changes. */
  colorScheme?: ColorScheme | undefined;
  onColorSchemeChange?: ((scheme: ColorScheme) => void) | undefined;
  /** Feedback on an answer. Without it, no feedback is offered. */
  onFeedback?: ((feedback: AssistantFeedback) => Promise<void> | void) | undefined;
  /** A thread renamed or deleted in the list. Without them, neither is offered. */
  onRename?: ((thread: ThreadRow, title: string) => Promise<void>) | undefined;
  onDelete?: ((thread: ThreadRow) => Promise<void>) | undefined;
  /** The thread on screen changed: its id, or `undefined` for a new one. */
  onThreadChange?: ((id: string | undefined) => void) | undefined;
  /** An answer asked with steps came back with them, or without any. */
  onStepsReported?: ((reported: boolean) => void) | undefined;
}

export type View = 'new' | 'loading' | 'ready' | 'notfound' | 'error';
export type Page = 'chat' | 'settings';

/** The document open in Dokumentvisning: the answer it is from, where in it, and the way back. */
export interface OpenDocument {
  turnId: string;
  target: SourceTarget;
  returnTo: DocumentViewReturn;
  /** The secondary panel's tool before it opened, shown again on the way back. */
  toolBefore: string | undefined;
}

/** A question on its way: from the field, again in an answer's place, or about a document. */
interface Asking {
  question: string;
  /** «Generer på nytt» or «Prøv igjen»: the turn it is asked again in place of. */
  replaces?: string | undefined;
  /** Typed in the field, which then empties. A question from elsewhere leaves the field alone. */
  fromField?: boolean | undefined;
  /** Asked in Dokumentvisning, about this document, as the block hands it over. */
  about?: DocumentQuestion | undefined;
}

// kunnskapsassistenten's threadHeading.ts: the first sentence, cut on a word at 80.
// A stop then a space ends it. One character each and a scan for the stops at its end, never a
// repeated stop in a pattern, so a question of nothing but «!» is read in linear time.
/** «Dokumentene som blir med» lists the documents when the filter keeps at most this many. */
export const IN_SCOPE_LISTED = 50;

const stops = new Set(['.', '?', '!', '…']);
export const shortTitle = (text: string) => {
  const flat = text.trim().replace(/\s+/g, ' ');
  const space = flat.search(/[.?!…] /u);
  let end = space < 0 ? flat.length : space + 1;
  while (end > 0 && stops.has(flat[end - 1] ?? '')) end -= 1;
  const sentence = flat.slice(0, end);
  if (sentence.length <= 80) return sentence;
  const cut = sentence.lastIndexOf(' ', 80);
  return `${sentence.slice(0, cut > 0 ? cut : 80).trimEnd()} …`;
};

/** The answer's text without its footnotes, for a layout that shows none. */
export const withoutFootnotes = (text: string) =>
  text.replace(/[ \u00a0]?\[\d+(?:\s*[,–-]\s*\d+)*\]/g, '');

/** A stored filter, as kunnskapsassistenten reads its own: a field whose values are not all strings is dropped. */
const readSelection = (stored: unknown): FilterSelection => {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {};
  return Object.fromEntries(
    Object.entries(stored).filter(
      (entry): entry is [string, string[]] =>
        Array.isArray(entry[1]) && entry[1].every((value) => typeof value === 'string'),
    ),
  );
};

/**
 * Each thread's kept filter (the next look), as `readSelection` reads one. A Map, since a thread's
 * id comes from the address, and an id such as `constructor` must not read an object's own.
 */
const readThreadFilters = (stored: unknown): ReadonlyMap<string, FilterSelection> => {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return new Map();
  return new Map(
    Object.entries(stored).map(([thread, selection]) => [thread, readSelection(selection)]),
  );
};
const storeThreadFilters = (filters: ReadonlyMap<string, FilterSelection>) =>
  Object.fromEntries(filters);

/** The first sentence of a service's description, as the picker's line under a variant, if short. */
const firstSentence = (text: string | undefined) => {
  const sentence = text?.split(/(?<=[.!?])\s/)[0]?.trim();
  return sentence && sentence.length <= 140 ? sentence : undefined;
};

const threadInAddress = () => new URLSearchParams(location.search).get('t') ?? undefined;

/** The answer with the markers its sources came with: `[N]` names an excerpt only with them. */
const withMarkers = (
  answer: AnswerData,
  markers: AnswerData['markers'] | undefined,
): AnswerData => {
  const next = { ...answer };
  delete next.markers;
  return markers ? { ...next, markers } : next;
};

export const useAssistant = ({
  api,
  layout,
  service,
  tenant,
  model: givenModel,
  profile,
  channels = ['conversations', 'facets', 'feedback'],
  threadInUrl = false,
  paths,
  allThreads = false,
  storage,
  onNotice,
  colorScheme = 'auto',
  onColorSchemeChange,
  onFeedback,
  onRename,
  onDelete,
  onThreadChange,
  onStepsReported,
}: AssistantOptions) => {
  // ── What the service can back, and what the layout holds ──
  const t = useT();
  const [models, setModels] = useState<ModelRow[]>();
  // Why genki could not say: the status it answered with, or none when it was not reached. The
  // error's own message is the browser's or genki's, in their language, so it goes to the console.
  const [modelsFailed, setModelsFailed] = useState<{ status?: number }>();
  const [modelsAttempt, setModelsAttempt] = useState(0);
  useEffect(() => {
    let gone = false;
    api.loadModels().then(
      (rows) => !gone && setModels(rows),
      (error: Error) => {
        if (gone) return;
        console.error('[assistant] models', error.message);
        setModelsFailed(error instanceof HttpError ? { status: error.status } : {});
      },
    );
    return () => {
      gone = true;
    };
  }, [api, modelsAttempt]);
  const retryModels = useCallback(() => {
    setModelsFailed(undefined);
    setModelsAttempt((n) => n + 1);
  }, []);
  const channelKey = channels.join(',');
  const facts = useMemo(
    () =>
      models
        ? factsFromModels(models, service, {
            channels: channelKey.split(',') as Channel[],
            family: profile?.family,
          })
        : undefined,
    [models, service, channelKey, profile],
  );
  // Until genki has said what the service backs, the layout is taken at its word: it comes from a
  // builder that checks the needs, and drawing nothing until `/v1/models` answers would move every
  // panel on every load.
  const met = useCallback((need: Need) => (facts ? needMet(facts, need) : true), [facts]);
  /** A block the layout places, that is built, and whose needs the service meets. */
  const has = useCallback(
    (id: BlockId) =>
      isOn(layout, id) &&
      blockSpec(id).status === 'built' &&
      blockSpec(id).needs.every((n) => n.startsWith('component:') || met(n)),
    [layout, met],
  );
  const where = (id: BlockId) => (has(id) ? zoneOf(layout, id) : undefined);
  const option = (id: BlockId, name: string) => has(id) && optionInForce(layout, id, name, met);

  const threadsOn = has('threads');
  const filterOn = has('filter');
  const sourcesOn = has('sources');
  const documentOn = has('document-view');
  const chatOn = has('chat');
  const chatZone = chatOn ? zoneOf(layout, 'chat') : undefined;
  const approachOn = has('approach');
  const settingsOn = has('settings');
  // A footnote goes to Kilder, or without it to Dokumentvisning; with neither, there are none.
  const footnotes = chatOn && option('chat', 'footnotes') && (sourcesOn || documentOn);
  const urlThreads = threadInUrl && threadsOn;

  const assistantName = profile?.assistantName ?? facts?.title ?? service;

  // The threads of this service and of its family are listed.
  const inFamily = useCallback(
    (other: string) => other === service || (profile?.family?.(other) ?? false),
    [service, profile],
  );
  // ── Variants: the rows the facts count, so the picker and `service:variants` are one rule ──
  const variants = useMemo<VariantOption[]>(() => {
    const counted = new Set(facts?.variants ?? []);
    return (models ?? [])
      .filter((row) => counted.has(row.id))
      .map((row) => {
        const description = firstSentence(row.description);
        return {
          id: row.id,
          title: row._variant_title ?? row.title ?? row.id,
          ...(description ? { description } : {}),
          ...(row._service_title ? { service: row._service_title } : {}),
        };
      });
  }, [models, facts]);
  const defaultModel = useMemo(() => {
    const own = (models ?? []).filter((row) => !row._alias_of && serviceOf(row) === service);
    return (
      (own.find((row) => row.id === `${service}__default`) ?? own[0])?.id ?? `${service}__default`
    );
  }, [models, service]);
  const [chosenModel, setModel] = useState<string>();
  const model = chosenModel ?? givenModel ?? defaultModel;

  // ── The collection: the service's own, or the reader's choice where the layout offers one ──
  const ownDataset = facts?.datasets[0];
  const corpusChoice = filterOn && option('filter', 'corpus');
  const [chosenCorpus, setChosenCorpus] = useStoredValue<string | undefined>(
    storage,
    'corpus',
    (stored) => (typeof stored === 'string' ? stored : undefined),
  );
  const corpusKey = (corpusChoice ? chosenCorpus : undefined) ?? ownDataset?.key;
  const [corpora, setCorpora] = useState<CorpusOption[]>([]);
  useEffect(() => {
    if (!corpusChoice) return;
    let gone = false;
    api.loadCorpora().then(
      (found) => !gone && setCorpora(found),
      (error: Error) => console.error('[assistant] corpora', error.message),
    );
    return () => {
      gone = true;
    };
  }, [api, corpusChoice]);
  const corpusLabel = (key: string) =>
    profile?.corpora?.[key]?.label ?? corpora.find((c) => c.key === key)?.label ?? key;
  const corpus: CorpusOption | undefined = corpusKey
    ? (corpora.find((c) => c.key === corpusKey) ?? {
        key: corpusKey,
        label: corpusLabel(corpusKey),
        ...(profile?.corpora?.[corpusKey]?.description
          ? { description: profile.corpora[corpusKey].description }
          : {}),
      })
    : undefined;
  const corpusProfile = corpusKey ? profile?.corpora?.[corpusKey] : undefined;
  // The field that holds a document's number, where the collection declares it as a filter on a
  // question (Kudos's `doc_num`): a question asked in Dokumentvisning searches that document only.
  const documentField = useMemo<FieldSpec | undefined>(() => {
    const idField = corpusProfile?.about?.idField;
    if (!idField || !corpusKey) return undefined;
    const declared = (models ?? [])
      .filter((row) => !row._alias_of && serviceOf(row) === service)
      .flatMap((row) => row._datasets ?? [])
      .find((dataset) => (dataset['dataset-config-key'] ?? dataset.id) === corpusKey)
      ?.filters?.find((field) => field.field === idField && field.kinds?.includes('multiselect'));
    if (!declared) return undefined;
    return {
      id: idField,
      label: idField,
      ...(declared['value-type'] === 'integer' ? { integer: true } : {}),
    };
  }, [models, service, corpusKey, corpusProfile]);

  // ── Threads ──
  const [loadedThreads, setThreads] = useState<ThreadRow[]>();
  const [threadsFailed, setThreadsFailed] = useState(false);
  // Maps, as every list here keyed by an id from genki or the address.
  const [renamed, setRenamed] = useState<ReadonlyMap<string, string>>(new Map());
  const [deleted, setDeleted] = useState<ReadonlySet<string>>(new Set());
  const reloadThreads = useCallback(() => {
    if (!threadsOn) return;
    setThreadsFailed(false);
    api.loadThreads().then(setThreads, (error: Error) => {
      console.error('[assistant] threads', error.message);
      setThreadsFailed(true);
    });
  }, [api, threadsOn]);
  useEffect(reloadThreads, [reloadThreads]);
  const threads = useMemo(
    () =>
      loadedThreads
        ?.filter(
          (thread) =>
            !deleted.has(thread.id) && (allThreads || !thread.service || inFamily(thread.service)),
        )
        .map((thread) =>
          renamed.has(thread.id)
            ? { ...thread, title: renamed.get(thread.id) ?? thread.title }
            : thread,
        ),
    [loadedThreads, renamed, deleted, inFamily, allThreads],
  );

  // ── The address: `#innstillinger` in the host's page, or a path per page with `paths` ──
  const home = paths?.home;
  const settingsPath = paths?.settings;
  const settingsHref = settingsPath ?? '#innstillinger';
  const onSettingsAddress = () =>
    settingsPath !== undefined
      ? location.pathname === settingsPath
      : location.hash === '#innstillinger';
  /** The address of the conversation on this thread, or on a new one, as a link's `href`. */
  const hrefOf = useCallback(
    (thread?: string) => {
      if (home !== undefined) return thread ? `${home}?t=${encodeURIComponent(thread)}` : home;
      const url = new URL(location.href);
      url.hash = '';
      if (thread) url.searchParams.set('t', thread);
      else url.searchParams.delete('t');
      return `${url.pathname}${url.search}`;
    },
    [home],
  );

  // ── The thread on screen ──
  const [pageShown, setPage] = useState<Page>(() =>
    threadInUrl && onSettingsAddress() ? 'settings' : 'chat',
  );
  // Without Innstillinger, the page is the chat everywhere: in the main column, the tab's title,
  // the thread list's current thread and the skip link.
  const page: Page = settingsOn ? pageShown : 'chat';
  const [currentId, setCurrentId] = useState<string | undefined>(() =>
    urlThreads ? threadInAddress() : undefined,
  );
  const [turns, setTurns] = useState<Turn[]>([]);
  const [threadCorpus, setThreadCorpus] = useState<string>();
  const [view, setView] = useState<View>(currentId ? 'loading' : 'new');
  // As `modelsFailed`: the status genki answered with, or none when it was not reached.
  const [viewError, setViewError] = useState<{ status?: number }>();
  const [reload, setReload] = useState(0);
  const ownThread = useRef<string>(undefined);
  const abort = useRef<AbortController>(undefined);
  const [working, setWorking] = useState(false);
  const [request, setRequest] = useState<ShellRequest>();
  // An assistant that goes stops its answer, and reports nothing after: a host that draws another
  // in its place, as the app builder does for each service, hears only from that one.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abort.current?.abort();
    };
  }, []);
  // Without Tråder, no thread is kept in the address, so a `?t=` there is taken away.
  useEffect(() => {
    if (!threadInUrl || urlThreads || !new URLSearchParams(location.search).has('t')) return;
    const url = new URL(location.href);
    url.searchParams.delete('t');
    history.replaceState(history.state, '', url);
  }, [threadInUrl, urlThreads]);

  const go = useCallback(
    (id: string | undefined, replace = false) => {
      if (urlThreads) history[replace ? 'replaceState' : 'pushState'](null, '', hrefOf(id));
      else if (threadInUrl && home !== undefined) {
        if (location.pathname !== home) history.pushState(null, '', home);
      } else if (threadInUrl && location.hash) {
        const url = new URL(location.href);
        url.hash = '';
        history.pushState(null, '', url);
      }
      setPage('chat');
      setCurrentId(id);
    },
    [urlThreads, threadInUrl, hrefOf, home],
  );
  /** Opening a thread or «Ny tråd» shuts an open drawer, which would cover it. */
  const leave = useCallback(
    (id: string | undefined) => {
      abort.current?.abort();
      setRequest({ action: 'close-drawers' });
      go(id);
    },
    [go],
  );
  useEffect(() => {
    if (!threadInUrl) return;
    const onPop = () => {
      abort.current?.abort();
      setPage(onSettingsAddress() ? 'settings' : 'chat');
      if (urlThreads) setCurrentId(threadInAddress());
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
    // `onSettingsAddress` reads only `settingsPath`.
  }, [threadInUrl, urlThreads, settingsPath]);
  const reported = useRef(onThreadChange);
  useEffect(() => {
    reported.current = onThreadChange;
  });
  useEffect(() => reported.current?.(currentId), [currentId]);

  const [activeId, setActiveId] = useState<string>();
  const [sourceTarget, setSourceTarget] = useState<SourceTarget>();
  const [answerTarget, setAnswerTarget] = useState<ConversationTarget>();
  const lastFollowed = useRef<ConversationTarget>(undefined);
  const [tool, setTool] = useState<string>();
  const [openDoc, setOpenDoc] = useState<OpenDocument>();
  // What had the focus when a document was opened from Kilder, to have it again on the way back.
  const opener = useRef<HTMLElement>(undefined);
  const [refocus, setRefocus] = useState<{ element: HTMLElement }>();
  useEffect(() => {
    if (refocus?.element.isConnected) refocus.element.focus();
  }, [refocus]);

  useEffect(() => {
    setSourceTarget(undefined);
    setAnswerTarget(undefined);
    setOpenDoc(undefined);
    setActiveId(undefined);
    setThreadCorpus(undefined);
    if (!currentId) {
      setTurns([]);
      setView('new');
      return;
    }
    // The thread a question just made: its turns are on screen already, streaming.
    if (ownThread.current === currentId) {
      ownThread.current = undefined;
      return;
    }
    let gone = false;
    setTurns([]);
    setView('loading');
    api.loadThread(currentId).then(
      (thread) => {
        if (gone) return;
        setTurns(thread.turns);
        setThreadCorpus(thread.corpus);
        setView('ready');
        if (sourcesOn && thread.turns.some((t) => (t.answer?.sources?.length ?? 0) > 0))
          setRequest({ action: 'offer', side: 'secondary' });
      },
      (error: Error) => {
        if (gone) return;
        if (error instanceof HttpError && error.status === 404) setView('notfound');
        else {
          console.error('[assistant] thread', error.message);
          setViewError(error instanceof HttpError ? { status: error.status } : {});
          setView('error');
        }
      },
    );
    return () => {
      gone = true;
    };
    // `sourcesOn` only decides whether to offer the panel once the thread is read.
  }, [api, currentId, reload]);

  // ── Filter fields and facets, only with Filter placed ──
  const [fields, setFields] = useState<readonly FieldSpec[]>();
  useEffect(() => {
    if (!filterOn || !corpusKey) return;
    let gone = false;
    setFields(undefined);
    api.loadFields(corpusKey).then(
      (found) => !gone && setFields(found),
      (error: Error) => {
        console.error('[assistant] fields', error.message);
        if (!gone) setFields(corpusProfile?.fields ?? []);
      },
    );
    return () => {
      gone = true;
    };
  }, [api, filterOn, corpusKey]);

  // The filter is kept as kunnskapsassistenten keeps it: a field whose values are not all strings
  // is dropped.
  const [chosenSelection, setSelection] = useStoredValue<FilterSelection>(
    storage,
    'filter',
    readSelection,
  );
  // Without Filter, nothing narrows the question: the setup's collection as a whole.
  const selection = filterOn ? chosenSelection : {};

  // In the next look the filter belongs to the thread («9 · Filtrering», choices 1 to 3): the filter
  // of each thread's last question asked here is kept, and opening the thread brings it back.
  // genki keeps no filter with a turn, so a thread asked elsewhere leaves the filter as it is.
  const look = templateLook(layout.template);
  const threadFiltersOn = look === 'next' && filterOn;
  const [threadFilters, setThreadFilters] = useStoredValue(
    storage,
    'threadFilters',
    readThreadFilters,
    storeThreadFilters,
  );
  const keepFilter = (thread: string, asked: FilterSelection) => {
    if (threadFiltersOn) setThreadFilters(new Map(threadFilters).set(thread, asked));
  };
  useEffect(() => {
    if (!threadFiltersOn || !currentId) return;
    const kept = threadFilters.get(currentId);
    if (kept && !sameSelection(kept, chosenSelection)) setSelection(kept);
    // Only when another thread opens: a change made in the thread stays.
  }, [currentId, threadFiltersOn]);
  const [facets, setFacets] = useState<FilterField[]>();
  const [baseFacets, setBaseFacets] = useState<FilterField[]>();
  const [facetsFailed, setFacetsFailed] = useState(false);
  const [facetsKey, setFacetsKey] = useState(0);
  useEffect(() => {
    if (!filterOn || !fields || !corpusKey) return;
    let gone = false;
    setFacetsFailed(false);
    api.loadFacets(selection, corpusKey, fields).then(
      (found) => {
        if (gone) return;
        setFacets(found);
        if (isEmptySelection(selection)) setBaseFacets(found);
      },
      (error: Error) => {
        if (gone) return;
        console.error('[assistant] facets', error.message);
        setFacetsFailed(true);
      },
    );
    return () => {
      gone = true;
    };
    // `selection` is new on every render without Filter; with it, it is the state.
  }, [api, filterOn, chosenSelection, facetsKey, corpusKey, fields]);
  useEffect(() => {
    if (!filterOn || baseFacets || isEmptySelection(chosenSelection) || !fields || !corpusKey)
      return;
    api.loadFacets({}, corpusKey, fields).then(setBaseFacets, () => {});
  }, [api, filterOn, baseFacets, chosenSelection, corpusKey, fields]);

  // «Dokumentene som blir med»: the documents themselves, once the filter keeps few enough to read
  // through. A host or a genki without the list keeps the count alone.
  const narrowed = filterOn ? narrowing(selection, facets) : undefined;
  const readsFrom = filterOn
    ? documentCount(facets, narrowed ?? {}, corpusProfile?.typeField)
    : undefined;
  const narrowedKey = JSON.stringify(narrowed ?? null);
  const [inScope, setInScope] = useState<{ key: string; documents: DocumentInScope[] }>();
  useEffect(() => {
    if (
      !api.loadDocuments ||
      !narrowed ||
      !fields ||
      !corpusKey ||
      readsFrom === undefined ||
      readsFrom === 0 ||
      readsFrom > IN_SCOPE_LISTED
    )
      return;
    let gone = false;
    const key = `${corpusKey}:${narrowedKey}`;
    api.loadDocuments(narrowed, corpusKey, fields, IN_SCOPE_LISTED).then(
      (page) => {
        if (!gone) setInScope({ key, documents: page.documents });
      },
      (error: Error) => {
        if (!gone) console.warn('[assistant] documents in scope', error.message);
      },
    );
    return () => {
      gone = true;
    };
    // `narrowed` is new on every render; its key says when it changed.
  }, [api, corpusKey, fields, narrowedKey, readsFrom]);

  const chooseCorpus = (key: string) => {
    // A new collection starts a new thread with an empty filter (kunnskapsassistenten's useCorpus).
    setChosenCorpus(key);
    setSelection({});
    setBaseFacets(undefined);
    leave(undefined);
    onNotice?.(t('assembly.corpusChanged', { corpus: corpusLabel(key) }));
  };

  // ── The answer shown in Sources and Fremgangsmåte ──
  const active = useMemo(
    () =>
      turns.find((t) => t.id === activeId && t.answer) ??
      [...turns].reverse().find((t) => t.answer && (t.answer.sources?.length ?? 0) > 0) ??
      [...turns].reverse().find((t) => t.answer),
    [turns, activeId],
  );
  const activeAnswer = active?.answer;
  const citations = useMemo(
    () =>
      activeAnswer && footnotes
        ? answerCitations(activeAnswer.text, activeAnswer.sources, activeAnswer.markers)
        : undefined,
    [activeAnswer, footnotes],
  );
  const answered = turns.filter((t) => t.answer);
  const shownIndex = Math.max(
    0,
    answered.findIndex((t) => t.id === active?.id),
  );

  // The line under each title in «Dokumenter», where the profile says how to find it.
  const documentsOn = filterOn && option('filter', 'documents');
  const [about, setAbout] = useState<ReadonlyMap<string, readonly string[]>>(new Map());
  const sourceKey =
    documentsOn && corpusKey
      ? (activeAnswer?.sources ?? [])
          .map((s) => s.documentId)
          .filter(Boolean)
          .join(',')
      : '';
  useEffect(() => {
    if (!sourceKey || !corpusKey) return;
    let gone = false;
    for (const id of sourceKey.split(','))
      void api.loadAbout(corpusKey, id).then((line) => {
        if (!gone && line) setAbout((all) => (all.has(id) ? all : new Map(all).set(id, line)));
      });
    return () => {
      gone = true;
    };
  }, [api, sourceKey, corpusKey]);
  const documents = useMemo<DocumentItem[] | undefined>(
    () =>
      activeAnswer?.sources?.map((s, i) => {
        const line = s.documentId ? about.get(s.documentId) : undefined;
        return {
          id: s.documentId ?? `${i}-${s.title}`,
          // Documents names no untitled source itself; Sources' word for one.
          title: s.title || t('sources.untitled'),
          ...(s.url ? { url: s.url } : {}),
          ...(line ? { about: line } : {}),
        };
      }),
    [activeAnswer, about, t],
  );

  // ── Asking ──
  const [draft, setDraft] = useState('');
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [focusField, setFocusField] = useState(0);
  useEffect(() => {
    if (focusField > 0) fieldRef.current?.focus();
  }, [focusField]);
  const stepsReported = useRef(onStepsReported);
  useEffect(() => {
    stepsReported.current = onStepsReported;
  });

  /**
   * Asks now, or as soon as it can: once genki has said what the service backs, which decides the
   * collection, and once an answer still coming has ended. A failed `/v1/models` is tried again,
   * and if it fails again the question waits in the field, under the failure.
   */
  const [waiting, setWaiting] = useState<Asking>();
  const send = (question: string, options: Omit<Asking, 'question'> = {}) => {
    const asking = { question, ...options };
    if (!working && models) {
      void start(asking);
      return;
    }
    if (modelsFailed) retryModels();
    setWaiting(asking);
  };
  useEffect(() => {
    if (!waiting) return;
    if (modelsFailed) setWaiting(undefined);
    else if (models && !working) {
      setWaiting(undefined);
      void start(waiting);
    }
    // `start` is new on every render; what it waits for is what starts it.
  }, [waiting, models, modelsFailed, working]);

  const start = async ({ question: typed, replaces, fromField, about }: Asking) => {
    const controller = new AbortController();
    abort.current = controller;
    const startedIn = currentId;
    const id = `local-${Date.now()}`;
    setSourceTarget(undefined);
    // A question about a document names it, in the thread and to the model, and searches only that
    // document where the collection lets a question be narrowed by its number.
    const documentId = about?.source.documentId;
    const toDocument = about && documentField && documentId ? documentField : undefined;
    const aboutTitle = about ? about.source.title.trim() || t('sources.untitled') : undefined;
    const question = aboutTitle
      ? t('assembly.aboutDocument', { title: aboutTitle, question: typed })
      : typed;
    const narrowedTo =
      toDocument && aboutTitle
        ? [aboutTitle]
        : (facets ?? []).flatMap((field) => [...(selection[field.id] ?? [])]);
    const filters =
      toDocument && documentId
        ? filterSet({ [toDocument.id]: [documentId] }, [toDocument])
        : filterOn
          ? filterSet(narrowing(selection, facets), fields ?? [])
          : undefined;
    // What the filter was, and how many documents it read from, for the answer's «Fremgangsmåte».
    const askedWith = filterOn && !toDocument ? narrowing(selection, facets) : undefined;
    const readFrom = askedWith
      ? documentCount(facets, askedWith, corpusProfile?.typeField)
      : undefined;
    if (askedWith && startedIn) keepFilter(startedIn, askedWith);
    const change = (update: (turn: Turn) => Turn) =>
      setTurns((all) => all.map((t) => (t.id === id ? update(t) : t)));
    const update = (patch: (answer: AnswerData) => AnswerData) =>
      change((t) => (t.answer ? { ...t, answer: patch(t.answer) } : t));
    const finish = () =>
      change((t) =>
        t.approach ? { ...t, approach: { ...t.approach, finishedAt: Date.now() } } : t,
      );
    let frames = 0;
    setWorking(true);
    // Only a question sent from the field empties it, and only of what was sent.
    if (fromField) setDraft((draft) => (draft.trim() === typed.trim() ? '' : draft));
    setView('ready');
    setActiveId(id);
    const asked: Turn = {
      id,
      question,
      askedAt: Date.now(),
      answer: { text: '', status: 'streaming', created: Date.now() },
      ...(approachOn ? { approach: { frames: [], startedAt: Date.now() } } : {}),
      scope: {
        narrowedTo,
        ...(corpusKey ? { corpus: corpusKey } : {}),
        ...(askedWith ? { selection: askedWith } : {}),
        ...(readFrom === undefined ? {} : { documents: readFrom }),
      },
    };
    setTurns((all) =>
      replaces && all.some((t) => t.id === replaces)
        ? all.map((t) => (t.id === replaces ? asked : t))
        : [...all, asked],
    );
    const fromWire = (raw: Parameters<typeof sourceFromWire>[0], at: number) =>
      sourceFromWire(raw, corpusProfile, at);
    try {
      for await (const event of api.ask({
        question,
        model,
        conversationId: startedIn,
        filters,
        dataset: corpusKey ? { tenant: ownDataset?.tenant || tenant, key: corpusKey } : undefined,
        steps: approachOn,
        signal: controller.signal,
      })) {
        if (!alive.current) break;
        if (event.type === 'conversation' && !startedIn) {
          if (askedWith) keepFilter(event.conversationId, askedWith);
          ownThread.current = event.conversationId;
          go(event.conversationId, true);
          reloadThreads();
        } else if (event.type === 'step') {
          frames += 1;
          const frame = event.step as StepFrame;
          change((t) =>
            t.approach
              ? { ...t, approach: { ...t.approach, frames: [...t.approach.frames, frame] } }
              : t,
          );
        } else if (event.type === 'text') update((a) => ({ ...a, text: a.text + event.text }));
        else if (event.type === 'retract') update((a) => ({ ...a, text: '' }));
        else if (event.type === 'sources') {
          update((a) => withMarkers({ ...a, sources: event.sources.map(fromWire) }, event.markers));
          if (sourcesOn && event.sources.length > 0)
            setRequest({ action: 'offer', side: 'secondary' });
        } else if (event.type === 'done') {
          finish();
          update((a) =>
            withMarkers(
              {
                ...a,
                text: event.answer.text || a.text,
                sources: event.answer.sources.map(fromWire),
                noAnswer: event.answer.noAnswer,
                status: 'complete',
                created: Date.now(),
                ...(event.answer.taskId ? { runId: event.answer.taskId } : {}),
              },
              event.answer.markers,
            ),
          );
          if (sourcesOn && event.answer.sources.length > 0)
            setRequest({ action: 'offer', side: 'secondary' });
          if (approachOn) stepsReported.current?.(frames > 0);
          reloadThreads();
        }
      }
    } catch (error) {
      const aborted = controller.signal.aborted;
      if (!aborted) console.error('[assistant] ask', (error as Error).message);
      finish();
      update((a) => ({
        ...a,
        status: aborted ? 'aborted' : 'failed',
        error: (error as Error).message,
        ...(aborted ? {} : { failure: failureOf(error) }),
      }));
      if (!aborted) reloadThreads();
    } finally {
      setWorking(false);
      if (abort.current === controller) abort.current = undefined;
    }
  };

  // ── The conversation as the blocks take it ──
  const filterInApproach = threadFiltersOn && approachOn;
  const conversation = useMemo<ConversationTurn[]>(
    () =>
      turns.flatMap((turn): ConversationTurn[] => {
        const scopeOf = (): { scope?: ConversationScope } => {
          const asked = turn.scope?.corpus ?? threadCorpus;
          const other = asked && asked !== corpusKey ? corpusLabel(asked) : undefined;
          // The next look says the filter inside «Fremgangsmåte», not under the answer.
          const narrowedTo = filterInApproach ? [] : (turn.scope?.narrowedTo ?? []);
          if (!other && narrowedTo.length === 0) return {};
          return { scope: { narrowedTo, ...(other ? { corpus: other } : {}) } };
        };
        const answer = turn.answer;
        return [
          ...(turn.question
            ? [{ kind: 'question' as const, id: `${turn.id}-q`, text: turn.question }]
            : []),
          ...(answer
            ? [
                {
                  kind: 'answer' as const,
                  id: turn.id,
                  // Without footnotes, no `[N]` and no sources: a footnote never points nowhere.
                  text: footnotes ? answer.text : withoutFootnotes(answer.text),
                  status: answer.status,
                  ...(footnotes ? { sources: answer.sources, markers: answer.markers } : {}),
                  noAnswer: answer.noAnswer,
                  failure: answer.failure,
                  ...scopeOf(),
                  ...(answer.status === 'complete' ? { createdAt: answer.created } : {}),
                },
              ]
            : []),
        ];
      }),
    // `corpusLabel` reads `corpora` and the profile.
    [turns, corpusKey, corpora, threadCorpus, footnotes, filterInApproach],
  );

  const firstQuestion = turns.find((t) => t.question)?.question ?? '';
  const named = ((currentId && threads?.find((t) => t.id === currentId)?.title) || '').trim();
  const repeatsQuestion = !named || named === firstQuestion.trim().replace(/\s+/g, ' ');
  // Each thread gives the tab its own title (WCAG 2.4.2), as kunnskapsassistenten's PageTitle.
  const heading =
    view === 'notfound'
      ? t('assembly.threadNotFoundTitle')
      : named || shortTitle(firstQuestion) || t('threads.newThread');
  // The thread's title as the page names it: the tab, and the next look's `h1`.
  const threadTitle = repeatsQuestion ? shortTitle(heading) : heading;
  useEffect(() => {
    if (!threadInUrl) return;
    const name = page === 'settings' ? t('settings.title') : threadTitle;
    document.title = t('assembly.tabTitle', { page: name, assistant: assistantName });
  }, [threadInUrl, page, threadTitle, assistantName, t]);

  // Each row names its collection only when the list mixes several, by the collection's name.
  const threadRows = useMemo(() => {
    const own = ownDataset?.key ?? '';
    const mixed = new Set((threads ?? []).map((t) => t.dataset ?? own)).size > 1;
    return threads?.map(({ dataset, service: _service, ...thread }) =>
      mixed ? { ...thread, dataset: corpusLabel(dataset ?? own) } : thread,
    );
    // `corpusLabel` reads the profile and `corpora`.
  }, [threads, ownDataset, corpora]);

  // The panels as the reader left them.
  const [shellLayout] = useState(() => storage?.read('layout') as ShellLayout | undefined);

  /**
   * The answer in sight again, for a way back to it: a document standing in the conversation's
   * place closes, and Chat's own tool is shown where it shares the secondary panel, whose drawer
   * then opens on a phone. With Chat in the main column, a drawer over it shuts.
   */
  const showChat = () => {
    if (documentOverChat) setOpenDoc(undefined);
    if (chatZone === 'secondary') {
      setTool('chat');
      setRequest({ action: 'open', side: 'secondary' });
    } else setRequest({ action: 'close-drawers' });
  };

  // Chat in the secondary panel: the panel opens from the start, as a drawer on a phone, or there
  // would be nowhere to ask.
  useEffect(() => {
    if (chatZone === 'secondary') setRequest({ action: 'open', side: 'secondary' });
  }, [chatZone]);

  /** A footnote or a document asks for Kilder: the panel opens, on the Kilder tool. */
  const showSources = (turnId: string, target: SourceTarget) => {
    setActiveId(turnId);
    setSourceTarget({ ...target });
    setTool('sources');
    setRequest({ action: 'open', side: 'secondary' });
  };

  // ── Dokumentvisning ──
  const documentZone = documentOn ? zoneOf(layout, 'document-view') : undefined;
  // In the main column beside Chat, an open document stands in the conversation's place.
  const documentOverChat = documentZone === 'main' && where('chat') === 'main';
  const documentTurn = openDoc ? turns.find((t) => t.id === openDoc.turnId) : undefined;
  const documentAnswer = documentTurn?.answer;
  // The document keeps to the answer it was opened from, whichever answer Kilder shows after.
  const documentCitations = useMemo(
    () =>
      documentAnswer && footnotes
        ? answerCitations(documentAnswer.text, documentAnswer.sources, documentAnswer.markers)
        : undefined,
    [documentAnswer, footnotes],
  );

  /**
   * A footnote, a document under the answer or «Vis i dokumentet» in Kilder opens the document:
   * in the secondary panel on the Dokumentvisning tool, or in the main column.
   */
  const openDocument = (turnId: string, target: SourceTarget, returnTo: DocumentViewReturn) => {
    const focused = document.activeElement;
    opener.current = focused instanceof HTMLElement ? focused : undefined;
    setOpenDoc({ turnId, target: { ...target }, returnTo, toolBefore: tool });
    if (documentZone === 'secondary') {
      setTool('document-view');
      setRequest({ action: 'open', side: 'secondary' });
    } else setRequest({ action: 'close-drawers' });
  };

  /** «Tilbake»: the document closes, and the focus goes back to where the reader came from. */
  const returnFromDocument = () => {
    const doc = openDoc;
    setOpenDoc(undefined);
    if (!doc) return;
    if (documentZone === 'secondary') setTool(doc.toolBefore);
    if (doc.returnTo === 'sources') {
      setTool('sources');
      // From the main column, Kilder's drawer opens again on a phone.
      if (documentZone === 'main') setRequest({ action: 'open', side: 'secondary' });
      const element = opener.current;
      if (element?.isConnected) setRefocus({ element });
      else {
        setActiveId(doc.turnId);
        setSourceTarget({ ...doc.target });
      }
    } else {
      if (lastFollowed.current) setAnswerTarget({ ...lastFollowed.current });
      showChat();
    }
  };

  /**
   * A question about the document goes into the thread, with the document as the block hands it
   * over, and the answer is put in sight. One asked while an answer is still coming waits for it.
   * Where putting the answer in sight hides the document, and the field the question was typed
   * in with it, the focus goes on to Chat's field rather than falling to the page: a document in
   * the conversation's place closes, and one sharing the secondary panel with Chat gives way to
   * Chat's tool.
   */
  const askAboutDocument = (ask: DocumentQuestion) => {
    const hidesDocument =
      documentOverChat || (documentZone === 'secondary' && chatZone === 'secondary');
    if (hidesDocument) setFocusField((n) => n + 1);
    showChat();
    send(ask.question, { about: ask });
  };

  // ── Settings ──
  // The setup's level, checked as the reader's is: a layout is stored and read back.
  const setupLevel = approachOn ? settingsOf(layout, 'approach').level : undefined;
  const defaultLevel: DisplayLevel = isDisplayLevel(setupLevel) ? setupLevel : 'standard';
  const [chosenLevel, setLevel] = useStoredValue<DisplayLevel | undefined>(
    storage,
    'displayLevel',
    (stored) => (isDisplayLevel(stored) ? stored : undefined),
  );
  // The trials the reader turned on, of those the profile offers.
  const [flagList, setFlagList] = useStoredValue<readonly string[]>(storage, 'flags', (stored) =>
    Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [],
  );
  const offered = new Set((profile?.experiments ?? []).map((e) => e.id));
  const flags: ReadonlySet<string> = new Set(
    settingsOn ? flagList.filter((id) => offered.has(id)) : [],
  );
  const setFlag = (id: string, on: boolean) =>
    setFlagList(on ? [...new Set([...flagList, id])] : flagList.filter((f) => f !== id));
  /** «Slå av alle»: every trial the profile offers off, in one write. */
  const flagsOff = () => setFlagList(flagList.filter((id) => !offered.has(id)));
  // Without Innstillinger, the setup's level stands.
  const level = (settingsOn ? chosenLevel : undefined) ?? defaultLevel;

  return {
    // what is placed
    layout,
    // The template's look: `next` draws the dev boards' frame, titles and profile menu.
    look,
    facts,
    modelsFailed,
    // From a failed `/v1/models` until the rows come: the failure's region stays drawn while it is
    // tried again, so a second failure is announced.
    serviceTrouble: !models && (modelsFailed !== undefined || modelsAttempt > 0),
    retryModels,
    has,
    where,
    option,
    footnotes,
    assistantName,
    profile,
    // variants
    variants,
    model,
    setModel,
    // collection and filter
    corpus,
    corpora,
    corpusKey,
    corpusChoice,
    chooseCorpus,
    fields,
    selection,
    setSelection,
    facets,
    baseFacets,
    facetsFailed,
    retryFacets: () => setFacetsKey((n) => n + 1),
    // How many documents the next question reads from, and the collection in all, exactly from the
    // facets; undefined while a count is missing.
    readFrom: readsFrom,
    // Only the list for the filter and collection on screen: an older one is not shown meanwhile.
    inScope:
      readsFrom !== undefined &&
      readsFrom <= IN_SCOPE_LISTED &&
      inScope?.key === `${corpusKey}:${narrowedKey}`
        ? inScope.documents
        : undefined,
    collectionSize: filterOn ? documentCount(baseFacets, {}, corpusProfile?.typeField) : undefined,
    documents,
    // threads
    threads,
    threadRows,
    // «Logg ut» forgets what this browser kept of the reader's choices, as kunnskapsassistenten's
    // beforeLogout: the next person on a shared machine starts without them. Then the host's own.
    signOut: () => {
      storage?.remove('filter');
      storage?.remove('flags');
      storage?.remove('corpus');
      storage?.remove('threadFilters');
      profile?.signOut?.onSignOut?.();
    },
    threadsFailed,
    reloadThreads,
    renameThread: onRename
      ? async (thread: ThreadRow, title: string) => {
          await onRename(thread, title);
          setRenamed((all) => new Map(all).set(thread.id, title));
        }
      : undefined,
    deleteThread: onDelete
      ? async (thread: ThreadRow) => {
          await onDelete(thread);
          setDeleted((all) => new Set(all).add(thread.id));
          if (thread.id === currentId) leave(undefined);
        }
      : undefined,
    currentId,
    named,
    repeatsQuestion,
    threadTitle,
    leave,
    urlThreads,
    newThread: () => {
      setSelection({});
      leave(undefined);
      setFocusField((n) => n + 1);
    },
    page,
    showSettings: () => {
      if (threadInUrl && !onSettingsAddress()) {
        if (settingsPath !== undefined) history.pushState(null, '', settingsPath);
        else {
          const url = new URL(location.href);
          url.hash = 'innstillinger';
          history.pushState(null, '', url);
        }
      }
      setPage('settings');
      setRequest({ action: 'close-drawers' });
    },
    settingsHref,
    /** «Tilbake til trådene» from «Innstillinger»: the thread on screen, its answer left running. */
    backToThreads: () => go(currentId),
    hrefOf,
    // the thread on screen
    view,
    viewError,
    retryThread: () => setReload((n) => n + 1),
    turns,
    conversation,
    // A question waiting to go counts as work: the field offers to stop it.
    working: working || waiting !== undefined,
    cancel: () => {
      setWaiting(undefined);
      abort.current?.abort();
    },
    send,
    draft,
    setDraft,
    fieldRef,
    // sources and approach
    active,
    activeAnswer,
    citations,
    answered,
    shownIndex,
    sourceTarget,
    answerTarget,
    lastFollowed,
    showSources,
    showAnswer: (index: number) => {
      const turn = answered[index];
      if (!turn) return;
      setActiveId(turn.id);
      setSourceTarget(undefined);
    },
    goToUse: (citation: number) => {
      if (!active) return;
      setAnswerTarget({ turnId: active.id, citation });
      showChat();
    },
    returnToAnswer: () => {
      if (lastFollowed.current) setAnswerTarget({ ...lastFollowed.current });
      showChat();
    },
    // the document view
    documentZone,
    documentOverChat,
    openDoc,
    documentAnswer,
    documentCitations,
    documentIndex: Math.max(
      0,
      answered.findIndex((t) => t.id === documentTurn?.id),
    ),
    openDocument,
    returnFromDocument,
    askAboutDocument,
    /** «Utdrag N»'s link back from the document: that footnote in its answer. */
    showDocumentUse: (citation: number) => {
      if (!openDoc) return;
      setAnswerTarget({ turnId: openDoc.turnId, citation });
      showChat();
    },
    // the shell
    request,
    shellLayout,
    onShellLayout: (next: ShellLayout) => storage?.write('layout', next),
    tool,
    setTool,
    /** A tool's own button on the folded panel (dev-verktoy-4): the panel opens on that tool. */
    showTool: (id: string) => {
      setTool(id);
      setRequest({ action: 'open', side: 'secondary' });
    },
    // settings
    level,
    setLevel,
    flags,
    setFlag,
    flagsOff,
    threadInUrl,
    colorScheme,
    onColorSchemeChange,
    onFeedback,
  };
};

export type AssistantState = ReturnType<typeof useAssistant>;
