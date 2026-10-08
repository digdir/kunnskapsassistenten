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

// Fixtures for development without a backend. Unlike Figma's sample data, the keywords match
// the NKOM question and the documents are distinct.

const NKOM_QUESTION =
  'Hvordan jobber Nasjonal kommunikasjonsmyndighet med måloppnåelse, og hvor kommer målene fra?';

/** The answer as markdown; `[n]` is 1-indexed into `nkomCitations`, as the backend does. */
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

// Not in Kudos, on purpose: covers the folder-corpus `url: null` case, which no fetched document
// has. Its text is ours, so it claims no Kudos address; never put invented text under one.
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
 * The only two Nkom documents in the corpus (via `sourceFrom`, so metadata cannot drift) and one
 * outside Kudos. The 2025 report has no link (Kudos 404, see DEAD_LINKS in
 * scripts/fetch-mock-corpus.mjs). No `page`: summaries have none, and a made-up one is untrue.
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
 * A source from the reader's OWN upload, built per question (the title is the file name), with
 * `origin: 'user'` and no `kudosUrl`. Its text says it is mock data, or a screenshot would pass
 * for a real quote.
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
 * «10 treff i 3 dokumenter». `hitCount` is what the SEARCH found, not what the
 * answer cited (five excerpts below): the gap between read and used is normal
 * and worth showing.
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

// The one hand-written thread: the only one with a non-Kudos document (`nkomInstruks`), and
// the end-to-end suite opens it by name.
const nkomThread: Thread = {
  id: 'nkom-maaloppnaaelse',
  title: 'NKOM måloppnåelse',
  // An hour after the scripted conversations (asked at 8, answered at 9), so no two rows share
  // an instant and the list order is stable.
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
 * The thread list. Every row has a full conversation under it, so no thread
 * opened from the list is empty. The list view sorts by `updatedAt` itself.
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

/** The filter dropdowns, with the values the design draws. The counts are sample data. */
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
