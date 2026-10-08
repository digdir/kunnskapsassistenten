import type {
  Citation,
  FilterFacet,
  Message,
  RetrievalDetails,
  SourceDocument,
  Thread,
  ThreadDetail,
  ThinkingStep,
  UserDocument,
} from '../../model';
import { MOCK_CORPUS } from '../corpus';
import { daysAgo } from './clock';
import { scriptedThreads } from './conversations/threads';
import { sourceFrom } from './conversations/types';

/**
 * Norwegian fixtures for development without a backend.
 *
 * The text is taken from the September 2026 specifications in
 * design/omraader/september-2026/: the NKOM answer, the thread titles from
 * the thread list, the facet values and counts from the filter, and the
 * excerpt headings from the sources panel.
 *
 * Two deliberate departures from Figma's sample data:
 *
 *   1. The search keywords in Figma («Datadeling kunstig intelligens» …)
 *      belong to a different question than the NKOM answer they sit next to.
 *      The keywords here match the question instead, so the mock is coherent.
 *   2. Figma repeats «Årsrapport NKOM 2024» seven times in the document list.
 *      Distinct documents here, per answer 58.
 */

/** Timestamps relative to now, so the thread grouping has something to group. */

const NKOM_QUESTION =
  'Hvordan jobber Nasjonal kommunikasjonsmyndighet med måloppnåelse, og hvor kommer målene fra?';

/**
 * The answer, as markdown. Heading plus paragraph, with a list and a simple
 * table inside the flow (answer 14). The `[n]` markers are 1-indexed into
 * `nkomCitations`, the same convention the backend uses.
 */
const NKOM_ANSWER = `# Måloppnåelse i Nasjonal kommunikasjonsmyndighet

Nkom styres mot mål som settes i tildelingsbrevet og gjøres opp i
årsrapporten. De to dokumentene under er hver sin ende av den samme syklusen.

## Hva som gjøres opp

Årsrapporten oppsummerer virksomheten og hovedtallene for året, med
resultater, tilsynsaktivitet og ressursbruk [1]. Prioriteringene den
rapporterer mot er sikkerhet og beredskap, markedsregulering, frekvens- og
nummerforvaltning og digital bærekraft [2].

## Hvor målene kommer fra

Tildelingsbrevet fra Digitaliserings- og forvaltningsdepartementet gir Nkom
fullmakt til å disponere budsjettmidlene, og fastsetter hovedmål, delmål,
prioriteringer og rapporteringskrav [3]. Det inneholder også konkrete
oppdrag, frister og styringsparametere for rapporteringen [4].

## Prioriteringene det rapporteres mot

- Sikkerhet og beredskap for kritisk digital infrastruktur
- Framtidsrettede og konkurransedyktige nett og tjenester
- Forvaltning av frekvensressurser
- Redusert digitalt klima- og naturfotavtrykk

## Fra oppdrag til rapport

| Ledd | Dokument | År |
| --- | --- | --- |
| Mål og krav | Tildelingsbrev | 2026 |
| Oppfølging gjennom året | Instruks for økonomi- og virksomhetsstyring | 2024 |
| Resultat | Årsrapport | 2025 |

Selve oppfølgingen mellom de to endene er beskrevet i instruksen, som slår
fast at måloppnåelse vurderes gjennom året og ikke bare ved årsslutt [5].

Merk at årsrapporten i dette korpuset er for 2025 og tildelingsbrevet for
2026. De hører til hver sin runde av syklusen, så de beskriver den samme
styringsmodellen og ikke det samme året.`;

/**
 * The document the answer cites that is NOT in Kudos, and deliberately so.
 *
 * A corpus can be a folder as well as Kudos, and then the backend returns
 * `url: null` — the panel has to draw an excerpt with nowhere to go. Nothing
 * in the fetched corpus has a null URL (checked: 0 of 938), so the case can
 * only be covered by a document written here.
 *
 * Which also settles what may be invented. The text below is ours, and it
 * says so by belonging to a document that makes no claim to be in Kudos:
 * there is no link to be wrong and no real document to misquote. That is the
 * difference from what this fixture used to do, which was to put invented
 * text under invented Kudos addresses — eight links, all 404, measured by #4
 * in design/kudos-lenker-og-usikre-2026-09-16.md.
 */
const nkomInstruks: SourceDocument = {
  id: 'nkom-instruks-oekonomistyring',
  title: 'Instruks for økonomi- og virksomhetsstyring i Nkom',
  documentType: 'Instruks',
  organisation: 'Nasjonal kommunikasjonsmyndighet',
  year: 2024,
  // No url and no kudosUrl: this is the folder-corpus case.
  excerpts: [
    {
      id: 'nkom-instruks-1',
      citationNumber: 5,
      relevance: 'low',
      heading: 'Oppfølging gjennom året',
      text: 'Måloppnåelse vurderes gjennom året og ikke bare ved årsslutt. Avvik fra fastsatte mål tas opp i den løpende styringsdialogen.',
    },
  ],
};

/**
 * What the answer builds on: two real Kudos documents and one that is not in
 * Kudos at all.
 *
 * The two real ones go through `sourceFrom`, the same machinery the scripted
 * conversations use, so title, type, organisation, year and the Kudos URL all
 * come from the fetched corpus and none of them can drift from it. The
 * excerpts are literal sentences from each document's summary, which is the
 * rule `ExcerptDraft` states and `conversations.test.ts` enforces.
 *
 * These are the only two Nkom documents the corpus holds. The fixture used to
 * show three annual reports — 2021, 2022 and 2023 — and none of them exists:
 * the ids were slugs somebody wrote by hand, so a freely typed question gave
 * eight links that all 404, while a scripted conversation gave nine that all
 * answered 200.
 *
 * The 2025 annual report has no link since 30.09: Kudos answers 404 for its
 * page and for the document in its API, so the corpus carries `urlMissing`
 * instead (DEAD_LINKS in scripts/fetch-mock-corpus.mjs), and the panel says
 * «ingen offentlig lenke». Moving the fixture to a report Kudos still has is
 * for the next fetch of the corpus.
 *
 * No `page` on any excerpt any more. Kudos gives a summary per document and
 * no page for any part of it, the backend's chunk schema has no page either,
 * and `#page=N` only works on the PDF's own address, which the corpus does
 * not carry. A page number written over a sentence lifted from a summary
 * would be a new untruth in place of a broken link.
 */
export const nkomSources: SourceDocument[] = [
  sourceFrom('a1c6feb9-3a47-4889-b049-92adae575b9f', [
    {
      citationNumber: 1,
      relevance: 'high',
      heading: 'Virksomhet og hovedtall',
      text: 'Årsrapporten oppsummerer Nkoms virksomhet og hovedtall for 2025, inkludert resultater, tilsynsaktivitet og ressursbruk.',
    },
    {
      citationNumber: 2,
      relevance: 'medium',
      heading: 'Sentrale prioriteringer',
      text: 'Rapporten beskriver sentrale prioriteringer som sikkerhet og beredskap, markedsregulering, frekvens- og nummerforvaltning, samt arbeid med digital bærekraft.',
    },
  ]),
  sourceFrom('373e48ad-e5c6-4d8d-83b0-7670f344d7d9', [
    {
      citationNumber: 3,
      relevance: 'high',
      heading: 'Fullmakt, hovedmål og rapporteringskrav',
      text: 'Tildelingsbrevet frå Digitaliserings- og forvaltningsdepartementet gir Nasjonal kommunikasjonsmyndigheit (Nkom) fullmakt til å disponere budsjettmidlar for 2026 og fastset hovudmål, delmål, prioriteringar og rapporteringskrav.',
    },
    {
      citationNumber: 4,
      relevance: 'medium',
      heading: 'Oppdrag og styringsparameter',
      text: 'Det inneheld konkrete oppdrag, fristar og styringsparameterar for rapportering.',
    },
  ]),
  nkomInstruks,
];

/**
 * A source from one of the reader's OWN documents.
 *
 * Built per question rather than fixed, because the title is the file the
 * reader actually uploaded — a fixture cannot know it. `origin: 'user'` is
 * what the sources panel reads to tell it from a Kudos document (#4 asked for
 * it on the model rather than on the title), and there is no `kudosUrl`: it
 * is the reader's own file, and nobody else can open it.
 *
 * The excerpt text says it is mock data IN THE FIXTURE, not in any UI string.
 * Nothing draws this sentence as chrome — it is quoted as if it came out of
 * the document — so the honesty has to be in the words themselves, or a
 * screenshot of the mock would read as a real quotation from the reader's
 * file.
 */
export function userDocumentSource(document: UserDocument, citationNumber: number): SourceDocument {
  return {
    id: document.id,
    title: document.name,
    origin: 'user',
    excerpts: [
      {
        id: `${document.id}-1`,
        citationNumber,
        relevance: 'high',
        heading: 'Fra ditt eget dokument',
        text: `Dette utdraget er mock-data. Når opplasting finnes (API-bestilling A3), står det et ekte sitat fra «${document.name}» her.`,
      },
    ],
  };
}

export const nkomCitations: Citation[] = nkomSources.flatMap((document) =>
  document.excerpts
    .filter((excerpt) => excerpt.citationNumber !== undefined)
    .map((excerpt) => ({
      number: excerpt.citationNumber as number,
      excerptId: excerpt.id,
      documentId: document.id,
    })),
);

/**
 * «10 treff i 3 dokumenter», as the design writes it.
 *
 * `hitCount` counts what the SEARCH found — 10 relevant chunks — not what the
 * answer cited. The answer used 5 of them, which is why the sources below
 * hold five excerpts and not ten. That gap is normal and worth showing: it is
 * the difference between what was read and what was used.
 */
export const nkomRetrieval: RetrievalDetails = {
  hitCount: 10,
  documentCount: 3,
  keywords: [
    'Måloppnåelse Nkom',
    'Tildelingsbrev hovedmål',
    'Ressursbruk og tilsynsaktivitet',
    'Styringsparameter rapportering',
    'Økonomi- og virksomhetsstyring',
  ],
};

export const nkomThinkingSteps: ThinkingStep[] = [
  {
    id: 'step-1',
    kind: 'reasoning',
    label: 'Jeg deler spørsmålet i to: hvordan måloppnåelse gjøres opp, og hvor målene er satt.',
  },
  {
    id: 'step-2',
    kind: 'search',
    label: 'Jeg søker i årsrapporten og tildelingsbrevet.',
    queries: [
      'måloppnåelse Nkom',
      'tildelingsbrev Nkom hovedmål',
      'rapporteringskrav styringsparameter',
    ],
    detail: '60 utdrag funnet, 10 beholdt etter rangering.',
    durationMs: 2410,
  },
  {
    id: 'step-3',
    kind: 'read',
    label: 'Jeg leser de mest relevante utdragene.',
    detail: '5 utdrag fra 3 dokumenter.',
    durationMs: 980,
  },
  {
    id: 'step-4',
    kind: 'finalizing',
    label: 'Jeg skriver svaret med kildehenvisninger.',
    durationMs: 620,
  },
];

/**
 * The one thread written by hand, and the only one that is not a scripted
 * conversation.
 *
 * It stays because it is the only fixture with `page` on its excerpts — Kudos
 * gives a summary per document and no page for any part of it, so the
 * scripted conversations have none, and this is what keeps the sources
 * panel's page rendering drawn by something. It is also the thread the
 * end-to-end suite opens by name.
 */
const nkomThread: Thread = {
  id: 'nkom-maaloppnaaelse',
  title: 'NKOM måloppnåelse',
  /*
   * An hour later than a scripted conversation from the same day, which are
   * asked at 8 and answered at 9 (conversations/threads.ts). Sharing those
   * hours put this thread and «Regnskap og bevilgning i DSS» on the same
   * instant, and two rows at the same instant have no order — the list would
   * draw them either way round on different runs. Measured 2026-09-16.
   */
  createdAt: daysAgo(0, 9),
  updatedAt: daysAgo(0, 10),
  conversationId: 'conv-nkom-1',
  // Kudos, like the scripted ones: the answer under it cites Kudos documents.
  corpusKey: MOCK_CORPUS.key,
};

/** A `ThreadDetail` as it appears in the list, without its messages. */
function withoutMessages({ messages, ...thread }: ThreadDetail): Thread {
  void messages;
  return thread;
}

/**
 * The thread list.
 *
 * Every row has a conversation under it, which it did not until 2026-09-15:
 * the list was twelve titles and one of them had messages, so eleven of the
 * twelve threads a reader could open were empty. The scripted conversations
 * were sitting right there with the whole shape of a real turn — answer,
 * sources, thinking steps, «Fremgangsmåte» — and reachable only by typing the
 * question they answer. Punkt 16 på brukerreise-lista, målt av #4.
 *
 * Sorting is the list view's own business; it orders by `updatedAt`.
 */
export const threads: Thread[] = [nkomThread, ...scriptedThreads.map(withoutMessages)];

const nkomMessages: Message[] = [
  {
    id: 'msg-nkom-question',
    role: 'user',
    content: NKOM_QUESTION,
    createdAt: daysAgo(0, 9),
    citations: [],
    status: 'complete',
  },
  {
    id: 'msg-nkom-answer',
    role: 'assistant',
    content: NKOM_ANSWER,
    createdAt: daysAgo(0, 10),
    citations: nkomCitations,
    sources: nkomSources,
    retrieval: nkomRetrieval,
    thinkingSteps: nkomThinkingSteps,
    corpusKey: MOCK_CORPUS.key,
    status: 'complete',
  },
];

/** Threads whose messages are written out here rather than scripted. */
const messagesByThread: Record<string, Message[]> = {
  'nkom-maaloppnaaelse': nkomMessages,
};

export function findThread(threadId: string): ThreadDetail | null {
  const scripted = scriptedThreads.find((candidate) => candidate.id === threadId);
  if (scripted) return scripted;

  const thread = threads.find((candidate) => candidate.id === threadId);
  if (!thread) return null;
  return { ...thread, messages: messagesByThread[thread.id] ?? [] };
}

/**
 * The filter dropdowns. Values and counts are the ones drawn in
 * design/omraader/molecules/skjermer/filter.md. The counts are sample data:
 * no backend produces them yet (API-bestilling A2).
 */
export const facets: FilterFacet[] = [
  {
    dimension: 'documentType',
    label: 'Dokumenttyper',
    values: [
      { value: 'evaluering', label: 'Evaluering', count: 779 },
      { value: 'proposisjon', label: 'Proposisjon til Stortinget', count: 576 },
      { value: 'statusrapport', label: 'Statusrapport', count: 1084 },
      { value: 'strategi-plan', label: 'Strategi/plan', count: 267 },
      { value: 'tildelingsbrev', label: 'Tildelingsbrev', count: 2042 },
      { value: 'arsrapport', label: 'Årsrapport', count: 1032 },
    ],
  },
  {
    dimension: 'organisation',
    label: 'Virksomheter',
    values: [
      { value: '22-juli-senteret', label: '22. juli-senteret', count: 14 },
      { value: 'advokattilsynet', label: 'Advokattilsynet', count: 11 },
      { value: 'agder-fylkeskommune', label: 'Agder fylkeskommune', count: 3 },
      { value: 'as-vinmonopolet', label: 'AS Vinmonopolet', count: 7 },
      { value: 'digdir', label: 'Digitaliseringsdirektoratet', count: 96 },
      { value: 'nkom', label: 'Nasjonal kommunikasjonsmyndighet', count: 42 },
    ],
  },
  {
    dimension: 'year',
    label: 'År',
    values: [
      { value: '2025', label: '2025', count: 545 },
      { value: '2024', label: '2024', count: 854 },
      { value: '2023', label: '2023', count: 789 },
      { value: '2022', label: '2022', count: 456 },
      { value: '2021', label: '2021', count: 321 },
      { value: '2020', label: '2020', count: 123 },
    ],
  },
];

export const mockAnswerMarkdown = NKOM_ANSWER;
