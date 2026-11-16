/**
 * `GET /api/next/kudos/files/:uuid`: a Kudos document's PDF, read through this server, for the
 * next client's Dokumentvisning to show in the browser's own viewer. Kudos sends its files with
 * `X-Frame-Options: SAMEORIGIN` and no CORS, so the page can neither frame nor fetch them itself.
 *
 * Provisional until genki offers a route for a document's file (genki ADR 0054).
 *
 * - Only `https://kudos.dfo.no`: the document's record at `/api/v0/documents/<uuid>`, then the first
 *   of its files whose address is exactly `/dokument/<that uuid>/filer/<uuid>.pdf` there. No other
 *   host or path is read, and no redirect is followed.
 * - The PDF is streamed as it comes, with `application/pdf`, `inline`, `nosniff` and private
 *   caching, up to `FILE_MAX_BYTES`, and only when it starts as a PDF does.
 * - `HEAD` reads the record alone: the page asks it first, so a document without a PDF shows its
 *   excerpts instead of a framed error.
 * - A failure is a problem response with a fixed sentence and a code, never Kudos's body.
 *
 * Mounted in nextApi.ts, under `/api/*`, so the session and the sign-in check in app.ts come first.
 */
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from './apiShared.ts';

const KUDOS = 'https://kudos.dfo.no';
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID = new RegExp(`^${UUID_PATTERN}$`);

/**
 * The largest PDF passed on: genki's ingest reads Kudos's files up to the same 50 MiB
 * (`maxDocumentBytes`), so every document genki holds can be shown, and nothing larger is.
 */
export const FILE_MAX_BYTES = 50 * 1024 * 1024;
/** A document's record is a few kilobytes; more than this is not one. */
const RECORD_MAX_BYTES = 256 * 1024;
/** Until Kudos has answered with the record and the PDF's headers; the body then streams. */
const ANSWER_TIMEOUT_MS = 15_000;
/** The whole file: 50 MiB at about 1 MB/s. */
const FILE_TIMEOUT_MS = 60_000;
/** The reader's browser may keep a file for an hour; no shared cache keeps it. */
const CACHE = 'private, max-age=3600';

const PDF_TYPE = /^application\/pdf\s*(?:;|$)/i;
const PDF_START = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export interface KudosFileOptions {
  fetch?: typeof fetch;
  maxBytes?: number;
  answerTimeoutMs?: number;
  fileTimeoutMs?: number;
}

// The one address a document's PDF may have: on Kudos's own host, written out so no setting can
// point the route elsewhere, under that document, a uuid named `.pdf`.
const FILE_URL = new RegExp(
  `^https://kudos\\.dfo\\.no/dokument/(${UUID_PATTERN})/filer/${UUID_PATTERN}\\.pdf$`,
);
export const isFileOf = (url: string, uuid: string) => FILE_URL.exec(url)?.[1] === uuid;

const problem = (c: Context, status: ContentfulStatusCode, code: string, title: string) =>
  c.body(JSON.stringify({ type: 'about:blank', title, status, code }), status, {
    'Content-Type': 'application/problem+json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });

type Failure = { status: ContentfulStatusCode; code: string; title: string };

// 404 is «no PDF to show», which the page tells from a failure: a file too large is one.
const failures = {
  badUuid: { status: 400, code: 'bad_uuid', title: 'Ugyldig dokumentnummer.' },
  notFound: { status: 404, code: 'kudos_not_found', title: 'Fant ikke dokumentet i Kudos.' },
  noPdf: { status: 404, code: 'kudos_no_pdf', title: 'Dokumentet har ingen PDF i Kudos.' },
  tooLarge: {
    status: 404,
    code: 'kudos_too_large',
    title: 'PDF-en er for stor til å vises her.',
  },
  notPdf: { status: 502, code: 'kudos_not_pdf', title: 'Kudos sendte ikke en PDF.' },
  redirect: {
    status: 502,
    code: 'kudos_redirect',
    title: 'Kudos svarte med en videresending.',
  },
  failed: { status: 502, code: 'kudos_failed', title: 'Kudos svarte med en feil.' },
  unreachable: {
    status: 502,
    code: 'kudos_unreachable',
    title: 'Fikk ikke kontakt med Kudos.',
  },
  timeout: { status: 504, code: 'kudos_timeout', title: 'Kudos svarte ikke i tide.' },
} satisfies Record<string, Failure>;

class Refused extends Error {
  readonly failure: Failure;
  constructor(failure: Failure) {
    super(failure.code);
    this.failure = failure;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** At most `max` bytes of the body, or `undefined` when it is longer. */
async function readAtMost(res: Response, max: number): Promise<Uint8Array | undefined> {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) return undefined;
      chunks.push(value);
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks);
}

/** A response's body is never followed or read past what is needed: closed here. */
const drop = (res: Response) => void res.body?.cancel().catch(() => {});

/** The file's name for «Lagre som», as Kudos names it when that is a plain PDF name. */
const nameOf = (file: Record<string, unknown>, url: string) => {
  const given = typeof file.filename === 'string' ? file.filename.trim() : '';
  const fallback = url.slice(url.lastIndexOf('/') + 1);
  return given.length <= 200 && /\.pdf$/i.test(given) && !/[\u0000-\u001f"\\/]/.test(given)
    ? given
    : fallback;
};

/** `inline`, with an ASCII name and the name itself encoded (RFC 6266). */
const disposition = (name: string) =>
  `inline; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`;

/**
 * The PDF as it comes, once its first bytes say it is one: read before the answer is sent, so a
 * file that is not a PDF is refused with a problem. Past `max` bytes the stream stops.
 */
async function checkedPdf(body: ReadableStream<Uint8Array>, max: number) {
  const reader = body.getReader();
  const head: Uint8Array[] = [];
  let seen = 0;
  while (seen < PDF_START.length) {
    const { done, value } = await reader.read();
    if (done) break;
    head.push(value);
    seen += value.byteLength;
  }
  const start = Buffer.concat(head);
  if (start.byteLength < PDF_START.length || PDF_START.some((b, i) => start[i] !== b)) {
    void reader.cancel().catch(() => {});
    throw new Refused(failures.notPdf);
  }
  if (seen > max) {
    void reader.cancel().catch(() => {});
    throw new Refused(failures.tooLarge);
  }
  let first = true;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (first) {
        first = false;
        controller.enqueue(start);
        return;
      }
      const { done, value } = await reader.read();
      if (done) return controller.close();
      seen += value.byteLength;
      if (seen > max) {
        void reader.cancel().catch(() => {});
        return controller.error(new Error('kudos_too_large'));
      }
      controller.enqueue(value);
    },
    cancel: (reason) => reader.cancel(reason),
  });
}

/** The routes, mounted at `/kudos/files` in the next client's API. */
export function kudosFiles(options: KudosFileOptions = {}) {
  const read = options.fetch ?? fetch;
  const max = options.maxBytes ?? FILE_MAX_BYTES;
  const answerTimeout = options.answerTimeoutMs ?? ANSWER_TIMEOUT_MS;
  const fileTimeout = options.fileTimeoutMs ?? FILE_TIMEOUT_MS;
  const files = new Hono<Env>();

  /** One call to Kudos, never redirected: a redirect could lead off kudos.dfo.no. */
  const call = async (url: string, accept: string, signal: AbortSignal) => {
    let res: Response;
    try {
      res = await read(url, { headers: { Accept: accept }, redirect: 'manual', signal });
    } catch (err) {
      throw new Refused(
        (err as Error).name === 'TimeoutError' ? failures.timeout : failures.unreachable,
      );
    }
    if (res.status >= 300 && res.status < 400) {
      drop(res);
      throw new Refused(failures.redirect);
    }
    return res;
  };

  /** The document's first PDF on Kudos, from its record. */
  const pdfOf = async (uuid: string, signal: AbortSignal) => {
    const res = await call(`${KUDOS}/api/v0/documents/${uuid}`, 'application/json', signal);
    if (res.status === 404) {
      drop(res);
      throw new Refused(failures.notFound);
    }
    if (!res.ok) {
      drop(res);
      throw new Refused(failures.failed);
    }
    const body = await readAtMost(res, RECORD_MAX_BYTES).catch(() => undefined);
    let record: unknown;
    try {
      record = body ? JSON.parse(new TextDecoder().decode(body)) : undefined;
    } catch {
      record = undefined;
    }
    if (!isRecord(record)) throw new Refused(failures.failed);
    const listed = Array.isArray(record.files) ? record.files : [];
    const file = listed.find(
      (f): f is Record<string, unknown> =>
        isRecord(f) && typeof f.url === 'string' && isFileOf(f.url, uuid),
    );
    if (!file) throw new Refused(failures.noPdf);
    if (typeof file.size === 'number' && file.size > max) throw new Refused(failures.tooLarge);
    const url = file.url as string;
    return { url, name: nameOf(file, url) };
  };

  files.get('/:uuid', async (c) => {
    const given = c.req.param('uuid');
    if (!UUID.test(given.toLowerCase()))
      return problem(c, 400, failures.badUuid.code, failures.badUuid.title);
    const uuid = given.toLowerCase();
    // A closed tab ends the calls to Kudos too.
    const answered = AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(answerTimeout)]);
    try {
      const pdf = await pdfOf(uuid, answered);
      const headers = {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition(pdf.name),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': CACHE,
      };
      if (c.req.method === 'HEAD') return c.body(null, 200, headers);

      const whole = AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(fileTimeout)]);
      const res = await call(pdf.url, 'application/pdf', whole);
      if (!res.ok) {
        drop(res);
        throw new Refused(res.status === 404 ? failures.noPdf : failures.failed);
      }
      if (!PDF_TYPE.test(res.headers.get('Content-Type') ?? '')) {
        drop(res);
        throw new Refused(failures.notPdf);
      }
      const length = Number(res.headers.get('Content-Length') ?? Number.NaN);
      if (Number.isFinite(length) && length > max) {
        drop(res);
        throw new Refused(failures.tooLarge);
      }
      if (!res.body) throw new Refused(failures.notPdf);
      const body = await checkedPdf(res.body, max);
      console.log(
        'kudos file %s %s',
        uuid,
        Number.isFinite(length) ? `${length} B` : 'streamed',
      );
      return c.body(body, 200, {
        ...headers,
        ...(Number.isFinite(length) ? { 'Content-Length': String(length) } : {}),
      });
    } catch (err) {
      if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });
      const failure = err instanceof Refused ? err.failure : failures.failed;
      console.log('kudos file %s refused: %s', uuid, failure.code);
      return problem(c, failure.status, failure.code, failure.title);
    }
  });

  return files;
}
