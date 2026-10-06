import { filterDimensions } from '../../model';
import type {
  Citation,
  Excerpt,
  FilterSelection,
  RelevanceLevel,
  RetrievalDetails,
  SourceDocument,
  StreamEvent,
  ThinkingStep,
} from '../../model';
import { documentUrl } from '../documentUrls';
import type { DatasetFilterFields } from '../filterFields';

/**
 * The MCP wire format, translated into our own events.
 *
 * The protocol is documented in design/eksisterende/api-for-frontend.md,
 * which was written against a running server. Where the documentation and
 * the server disagreed, that file follows the server, and so does this.
 */

/** The only revision the server accepts. Not a range, not a minimum. */
export const MCP_PROTOCOL_VERSION = '2026-07-28';

/**
 * The agent to ask. Thirteen tools are exposed, one per (agent × mode), and
 * four of them are end-to-end test fixtures. The frontend picks one and hides
 * the rest; this is the one the server marks as default.
 *
 * In production this belongs on the server that holds the API key, together
 * with the tenant and the dataset: the browser sends a question, not a
 * target. Here it is a constant because the Vite proxy cannot rewrite a body.
 */
export const DEFAULT_TOOL_NAME = 'builtin.agent-rag-agent__agent-rag-graph-bundled';

/**
 * Which corpus to ask, as `tools/call` arguments, or nothing.
 *
 * The backend takes `tenant` and `dataset_config_key` beside the query and
 * resolves them to a dataset. Left out, it falls back to the scopes on the
 * API key and then to its own `TENANT` / `DATASET_CONFIG_KEY`, which on the
 * local stack is the demo corpus. That fallback is the behaviour this
 * function must not disturb when nothing is configured.
 *
 * **Both or neither, and that is the backend's rule rather than a preference
 * of ours.** `resolve-dataset-scope` in server/src/digdir/mcp/tools.clj builds
 * the scope with `(when (and tenant dataset_config_key) ...)`, so one alone is
 * dropped on the floor and the call quietly answers from the default corpus
 * instead. A half-configured frontend would then look like it was pointed at
 * the pilot and answer from the demo data — which is the one failure worth
 * guarding against here, because nothing downstream could tell the difference.
 *
 * Snake case on the wire on purpose: the server reads `dataset_config_key`
 * exactly, and only converts to its internal `:dataset-config-key` after.
 */
export function datasetArguments(
  tenant: string | undefined,
  datasetConfigKey: string | undefined,
): { tenant: string; dataset_config_key: string } | Record<string, never> {
  const both = tenant && datasetConfigKey;
  if (both) return { tenant, dataset_config_key: datasetConfigKey };

  if (tenant || datasetConfigKey) {
    // Not an error the user can act on and not worth failing the question
    // over, but the developer who set one of the two has to hear about it.
    console.warn(
      'KA: VITE_KA_TENANT og VITE_KA_DATASET_CONFIG_KEY må settes sammen. ' +
        'Bare den ene er satt, så begge er utelatt og backend velger datasett selv.',
    );
  }

  return {};
}

/** One field of the backend's own filter, as it is spelled on the wire. */
type WireFilterField = {
  field: string;
  'selected-options': string[];
  'value-type'?: string;
};

/** `overrides` as `tools/call` takes it, or nothing at all. */
export type FilterArguments =
  { overrides: { 'retrieve-filter-by': { fields: WireFilterField[] } } } | Record<string, never>;

/**
 * The reader's filter, as the backend's own filter format, or nothing.
 *
 * `overrides.retrieve-filter-by` is not an interface built for us: it is the
 * per-call form of the setting the backend already filters by, and the same
 * shape its auto-filter and the agent's own search tool use. That is why the
 * filter belongs on the wire this way and why this function is generic — it
 * knows the three dimensions the design draws, and nothing about any corpus.
 * The field names come from `fields`, which is configuration
 * (src/api/filterFields.ts).
 *
 * The backend ANDs the fields and ORs the values inside one, so three ticked
 * years and one document type is «årsrapport fra 2022, 2023 eller 2024».
 * Nothing here has to say so; it is what `:=[a,b]` means over there.
 *
 * Four ways to send nothing, and each is a different fact:
 * - nothing ticked anywhere — the reader is asking the whole corpus
 * - a dimension with nothing ticked — no restriction on that one
 * - a dimension with no configured field — this corpus has not said what it
 *   calls it, and a guessed name would filter on a field Typesense does not
 *   have. Silence is the honest answer (src/decisions/0004)
 * - no configured fields at all, which includes the dataset the backend
 *   picked for itself
 *
 * All four leave `overrides` out of the arguments entirely rather than
 * sending an empty one, because an empty override is still an override: it
 * would replace whatever the backend had configured for the dataset with a
 * filter that matches nothing in particular, and the difference between «no
 * opinion» and «an empty opinion» is not one worth testing against a running
 * backend on every release.
 *
 * `value-type` rides along only when the configuration gives one. Measured
 * 2026-09-24: `concerned_years = 2024` without it gives 0 hits, because a
 * quoted number is not a number to Typesense. The values themselves stay
 * strings — the type is stated beside them, not by rewriting them.
 */
export function filterArguments(
  selection: FilterSelection | undefined,
  fields: DatasetFilterFields | undefined,
): FilterArguments {
  if (!selection || !fields) return {};

  const wire: WireFilterField[] = [];

  // Walked in the design's order rather than the selection's own key order,
  // so the same choice builds the same request every time. See
  // `filterDimensions`.
  for (const dimension of filterDimensions) {
    const mapping = fields[dimension];
    if (!mapping) continue;

    // A blank is a value nobody can have ticked, and it would reach the
    // backend as `field:=[""]`. Dropping it here keeps a stray one from
    // turning a working filter into no hits at all.
    const values = (selection[dimension] ?? []).map((value) => value.trim()).filter(Boolean);
    if (values.length === 0) continue;

    wire.push({
      field: mapping.field,
      'selected-options': values,
      ...(mapping.valueType ? { 'value-type': mapping.valueType } : {}),
    });
  }

  if (wire.length === 0) return {};
  return { overrides: { 'retrieve-filter-by': { fields: wire } } };
}

type ProgressMeta = {
  event?: string;
  delta?: string;
  reasoning?: string;
  iteration?: number;
  'tool-calls'?: ToolCall[];
};

type ToolCall = {
  tool?: string;
  'duration-ms'?: number;
  args?: { queries?: string[]; query?: string; chunk_ids?: string[] };
  'result-summary'?: string;
};

export type McpChunk = {
  chunk_id?: string;
  doc_num?: string;
  /**
   * The document's title, under whichever of three names the path in question
   * happens to use.
   *
   * Measured 21.09: a live `tools/call` against `kudos-pilot` sends `title`,
   * and stored messages read back from `/api/conversations` send `docTitle`.
   * `doc_title` is the third spelling the backend uses elsewhere. Nothing
   * downstream can tell the difference between «no title» and «a title under
   * a name we did not read», so all three are read here rather than in the
   * caller. API-bestilling: one name would be better than three.
   */
  title?: string;
  doc_title?: string;
  docTitle?: string;
  url?: string | null;
  metadata?: string;
};

/**
 * The document title a chunk carries, whichever name it arrived under.
 *
 * Blank is treated as missing: a title of `'   '` draws an empty line in the
 * sources panel, which reads as a bug rather than as an untitled document.
 */
function chunkTitle(chunk: McpChunk): string {
  const title = chunk.title?.trim() || chunk.doc_title?.trim() || chunk.docTitle?.trim();
  return title || 'Uten tittel';
}

/**
 * A heading marker the chunker left inside a value.
 *
 * Measured against the running stack 2026-09-22, `norquad-docs`:
 *
 * ```
 * {"Header 1" "Europas historie 1789–1914",
 *  "Header 2" "Noter## Referanser## Litteratur"}
 * ```
 *
 * So `##` is not a separator the backend chose — it is Markdown that came
 * along inside ONE value, where the chunker ran three sibling headings
 * together without the line breaks that made them headings. The reader saw it
 * raw: «Europas historie 1789–1914 › Noter## Referanser## Litteratur»
 * (brukerblikk 7, funn 1). It is the only place in live where anything from
 * the backend reaches the screen without going through the Markdown renderer.
 *
 * A run of `#` followed by whitespace, because that is what tells a heading
 * marker from a `#` that is part of the text: «Kapittel #3» has no space
 * after the hash and must survive whole. `#+` rather than `#{1,6}` — six is
 * Markdown's limit for a heading somebody wrote, and this is a run somebody's
 * chunker produced, so an impossible seventh hash should still be swallowed
 * rather than left on screen.
 */
const HEADING_MARKER = /#+\s+/;

/**
 * The heading path inside a document.
 *
 * The server sends this as a string containing Clojure map syntax —
 * `{"Header 1" "Akershus slott og festning"}` — even though the schema
 * declares an object. So it is parsed as text: every quoted string in order,
 * odd ones are keys, even ones are values, and the values are the path.
 *
 * Each value is then split on the markers above, so the three headings the
 * chunker ran together come back as three steps. **They are siblings, not
 * nesting, and the path draws them as if they were** — which is the honest
 * limit of doing this here: nothing in the string says whether «Referanser»
 * sits under «Noter» or beside it. Showing all three beats showing one and
 * dropping two, and beats showing the markers. The lasting fix is the backend
 * sending clean text per level; noted in the backend request from 2026-09-14.
 *
 * Nothing else is cleaned. This is not Markdown rendering and not HTML
 * sanitising — it is one field, with one measured defect in it.
 */
export function parseHeadingPath(metadata: string | undefined): string | undefined {
  if (!metadata) return undefined;

  const quoted = [...metadata.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1]);
  const values = quoted.filter((_, index) => index % 2 === 1);
  const path = values
    .flatMap((value) => value.split(HEADING_MARKER))
    .map((step) => step.trim())
    // Empty once a value began with a marker, and all-hashes when a value was
    // nothing but one. Both are the marker with no heading behind it.
    .filter((step) => step !== '' && !/^#+$/.test(step))
    .join(' › ');
  return path || undefined;
}

/**
 * Relevance from rank, because the server sends no score.
 *
 * The chunks come back ordered by the reranker, so the position is the only
 * signal there is. Top third «Mest relevant», next third «Relevant», rest
 * «Minst relevant». Derived, not measured — worth replacing the day the
 * backend reports a score.
 */
export function relevanceFromRank(index: number, total: number): RelevanceLevel {
  if (total <= 3) return index === 0 ? 'high' : 'medium';
  if (index < total / 3) return 'high';
  if (index < (total * 2) / 3) return 'medium';
  return 'low';
}

/**
 * Groups the chunks into documents, keeping the 1-indexed citation numbers.
 *
 * `[n]` in the answer points at `chunks[n-1]`, and the documents are the
 * coarser grouping of the same thing, so the number has to survive the
 * grouping. Excerpts are grouped per document (answer 57).
 */
export function toSourceDocuments(chunks: McpChunk[], dataset?: string): SourceDocument[] {
  const documents = new Map<string, SourceDocument>();

  chunks.forEach((chunk, index) => {
    const documentId = chunk.doc_num ?? chunk.chunk_id ?? `doc-${index}`;
    // The chunk's own address when it has one, and otherwise the corpus's
    // template with the document's number: Kudos chunks carry `doc_num` and
    // no `url` (issue 92). See documentUrls.ts.
    const url = chunk.url ?? documentUrl(dataset, chunk.doc_num);
    const excerpt: Excerpt = {
      id: chunk.chunk_id ?? `${documentId}-${index}`,
      // backend: mangler, se API-bestilling A1 — structuredContent.chunks
      // carries id, title and length, never the passage itself. The client
      // looks the text up by id afterwards (excerpts.ts, src/decisions/0008).
      text: '',
      heading: parseHeadingPath(chunk.metadata),
      relevance: relevanceFromRank(index, chunks.length),
      kudosUrl: url,
      citationNumber: index + 1,
    };

    const existing = documents.get(documentId);
    if (existing) {
      existing.excerpts.push(excerpt);
      return;
    }

    documents.set(documentId, {
      id: documentId,
      title: chunkTitle(chunk),
      url,
      excerpts: [excerpt],
    });
  });

  return [...documents.values()];
}

export function toCitations(documents: SourceDocument[]): Citation[] {
  return documents.flatMap((document) =>
    document.excerpts
      .filter((excerpt) => excerpt.citationNumber !== undefined)
      .map((excerpt) => ({
        number: excerpt.citationNumber as number,
        excerptId: excerpt.id,
        documentId: document.id,
      })),
  );
}

/** A Norwegian label for one tool call, for the thinking steps. */
function toolCallStep(call: ToolCall, index: number): ThinkingStep {
  const tool = call.tool ?? 'ukjent';
  const queries = call.args?.queries ?? (call.args?.query ? [call.args.query] : undefined);
  const isRead = tool.includes('read') || Boolean(call.args?.chunk_ids?.length);

  return {
    id: `tool-${index}-${tool}`,
    kind: isRead ? 'read' : 'search',
    label: isRead ? 'Jeg leser utdragene.' : 'Jeg søker i dokumentene.',
    detail: call['result-summary'],
    queries,
    durationMs: call['duration-ms'],
  };
}

/**
 * Holds what has to be remembered between frames.
 *
 * The awkward part is `response/chunk`. Measured against the running server
 * 2026-09-11: every delta this agent streams is its own plan in the first
 * person — «Jeg vil slå opp kilder om birkebeinerne …» — and each run of
 * deltas is followed by an `agent/thinking` frame carrying the same words.
 * The answer itself never streams; it arrives whole in the final frame.
 *
 * So deltas are held back rather than emitted. An `agent/thinking` that
 * follows them proves they were the plan, and they are dropped. Anything else
 * that ends the run releases them as answer text. That way the client is
 * right today, and right again the day an agent does stream its answer —
 * without the views changing at all.
 */
export class McpStreamState {
  /** Deltas seen but not yet known to be plan or answer. */
  #pending: string[] = [];
  #answer = '';
  #keywords: string[] = [];
  #steps = 0;

  /** The answer text released so far. Empty while nothing is confirmed. */
  get answerText(): string {
    return this.#answer;
  }

  get keywords(): string[] {
    return this.#keywords;
  }

  /** Releases held-back deltas as answer text. */
  flushPending(): StreamEvent[] {
    const pending = this.#pending;
    this.#pending = [];
    if (pending.length === 0) return [];

    this.#answer += pending.join('');
    return pending.map((text) => ({ type: 'token', text }));
  }

  /** Translates one progress frame. Returns nothing for frames we ignore. */
  progress(meta: ProgressMeta): StreamEvent[] {
    switch (meta.event) {
      case 'response/chunk': {
        if (!meta.delta) return [];
        this.#pending.push(meta.delta);
        return [];
      }

      case 'agent/thinking': {
        if (!meta.reasoning) return [];
        // The deltas just before this frame were this step's plan, not the
        // answer. Drop them: the reasoning is shown as a thinking step.
        this.#pending = [];
        this.#steps += 1;
        return [
          {
            type: 'thinking-step',
            step: { id: `thinking-${this.#steps}`, kind: 'reasoning', label: meta.reasoning },
          },
        ];
      }

      case 'agent/turn-completed': {
        const calls = meta['tool-calls'] ?? [];
        return calls.map((call) => {
          this.#steps += 1;
          const step = toolCallStep(call, this.#steps);
          // Every search the agent ran, in order, without repeats. Taking
          // only the last one loses the three real queries and keeps the
          // echo of the user's own question.
          for (const query of step.queries ?? []) {
            if (!this.#keywords.includes(query)) this.#keywords.push(query);
          }
          return { type: 'thinking-step', step };
        });
      }

      case 'agent/finalized': {
        this.#steps += 1;
        return [
          ...this.flushPending(),
          {
            type: 'thinking-step',
            step: {
              id: `finalizing-${this.#steps}`,
              kind: 'finalizing',
              label: 'Jeg skriver svaret med kildehenvisninger.',
            },
          },
        ];
      }

      // agent/iteration-started says only that a loop went round again. It
      // tells the reader nothing, so it is dropped rather than shown.
      default:
        return [];
    }
  }

  /** Builds «Fremgangsmåte» from what the stream reported along the way. */
  retrieval(documents: SourceDocument[], chunkCount: number): RetrievalDetails {
    return {
      hitCount: chunkCount,
      documentCount: documents.length,
      keywords: this.#keywords,
    };
  }
}
