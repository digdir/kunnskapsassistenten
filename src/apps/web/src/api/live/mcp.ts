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
import { publicUrl } from '../publicUrl';

// The MCP wire format, translated into our own events. Where the protocol documentation and the
// server disagree, this follows the server.

/** The only revision the server accepts. Not a range, not a minimum. */
export const MCP_PROTOCOL_VERSION = '2026-07-28';

/**
 * The tool the server marks as default; the frontend hides the others. A constant because the Vite
 * proxy cannot rewrite a body; in production it belongs on the server that holds the API key.
 */
export const DEFAULT_TOOL_NAME = 'builtin.agent-rag-agent__agent-rag-graph-bundled';

/**
 * Which corpus to ask, as `tools/call` arguments, or nothing (the backend then picks its default).
 * Both or neither: `resolve-dataset-scope` in the backend's mcp/tools.clj drops one alone and
 * quietly answers from the default corpus. Snake case because the server reads that name exactly.
 */
export function datasetArguments(
  tenant: string | undefined,
  datasetConfigKey: string | undefined,
): { tenant: string; dataset_config_key: string } | Record<string, never> {
  const both = tenant && datasetConfigKey;
  if (both) return { tenant, dataset_config_key: datasetConfigKey };

  if (tenant || datasetConfigKey) {
    // Not an error the user can act on and not worth failing the question over, but the developer
    // who set one of the two has to hear about it.
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
 * The reader's filter as `overrides.retrieve-filter-by`, with field names from configuration
 * (src/decisions/0004). `{}` when nothing applies, since an empty override would still replace
 * the dataset's filter. `value-type` goes along when configured: Typesense needs it for numbers.
 */
export function filterArguments(
  selection: FilterSelection | undefined,
  fields: DatasetFilterFields | undefined,
): FilterArguments {
  if (!selection || !fields) return {};

  const wire: WireFilterField[] = [];

  // In the design's order rather than the selection's key order, so the same choice builds the
  // same request every time.
  for (const dimension of filterDimensions) {
    const mapping = fields[dimension];
    if (!mapping) continue;

    // A blank would reach the backend as `field:=[""]` and turn a working filter into no hits.
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
  /** Live `tools/call` sends `title`, stored messages `docTitle`, elsewhere `doc_title`. */
  title?: string;
  doc_title?: string;
  docTitle?: string;
  url?: string | null;
  metadata?: string;
};

// The chunk's title under whichever name it came. Blank counts as missing, because an empty line
// in the sources panel reads as a bug.
function chunkTitle(chunk: McpChunk): string {
  const title = chunk.title?.trim() || chunk.doc_title?.trim() || chunk.docTitle?.trim();
  return title || 'Uten tittel';
}

// A heading marker the chunker left inside a value (`Noter## Referanser`). Hashes must be followed
// by whitespace, so «Kapittel #3» survives; `#+` also swallows runs longer than Markdown's six.
const HEADING_MARKER = /#+\s+/;

/**
 * The heading path inside a document. The server sends Clojure map syntax as a string, despite the
 * schema saying object, so the quoted values are read in order and split on heading markers.
 * Headings run together are siblings but are drawn as steps; nothing in the string says more.
 */
export function parseHeadingPath(metadata: string | undefined): string | undefined {
  if (!metadata) return undefined;

  const quoted = [...metadata.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1]);
  const values = quoted.filter((_, index) => index % 2 === 1);
  const path = values
    .flatMap((value) => value.split(HEADING_MARKER))
    .map((step) => step.trim())
    // Empty or all hashes: a marker with no heading behind it.
    .filter((step) => step !== '' && !/^#+$/.test(step))
    .join(' › ');
  return path || undefined;
}

/**
 * Relevance from rank, because the server sends no score; the reranker's order is the only signal.
 * Derived, not measured: replace it once the backend reports a score.
 */
export function relevanceFromRank(index: number, total: number): RelevanceLevel {
  if (total <= 3) return index === 0 ? 'high' : 'medium';
  if (index < total / 3) return 'high';
  if (index < (total * 2) / 3) return 'medium';
  return 'low';
}

/**
 * Groups the chunks into documents. Each excerpt keeps its 1-indexed citation number, because
 * `[n]` in the answer points at `chunks[n-1]`.
 */
export function toSourceDocuments(chunks: McpChunk[], dataset?: string): SourceDocument[] {
  const documents = new Map<string, SourceDocument>();

  chunks.forEach((chunk, index) => {
    const documentId = chunk.doc_num ?? chunk.chunk_id ?? `doc-${index}`;
    // The chunk's own address, or else the corpus's template (Kudos chunks have no `url`, issue
    // 92). Both go through `publicUrl`; a rejected `chunk.url` does not fall back to the template,
    // which would show an address the backend never sent.
    const url = chunk.url ? publicUrl(chunk.url) : publicUrl(documentUrl(dataset, chunk.doc_num));
    const excerpt: Excerpt = {
      id: chunk.chunk_id ?? `${documentId}-${index}`,
      // structuredContent.chunks carries id, title and length, never the passage. The client looks
      // the text up by id afterwards (excerpts.ts, src/decisions/0008).
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
 * Holds what has to be remembered between frames. Deltas are held back: an `agent/thinking` after
 * them shows they were the agent's plan (this agent streams only its plan, and the answer arrives
 * whole in the final frame), and anything else that ends the run releases them as answer text.
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
        // The deltas just before this frame were this step's plan, not the answer. Drop them: the
        // reasoning is shown as a thinking step.
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
          // Every search the agent ran, without repeats: the last one alone is often just an echo
          // of the user's question.
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

      // agent/iteration-started says only that a loop went round again. It tells the reader
      // nothing, so it is dropped rather than shown.
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
