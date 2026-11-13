/**
 * `/api/next`: what the next client, apps/web-next, needs from this server (decisions/0013).
 *
 * - `GET /ui` and `POST /ui`: which client this browser gets, kept in a cookie.
 * - `GET /me`: who is signed in, and which genki service and variant the page asks.
 * - `/genki/*`: a narrow proxy to the genki calls `createGenkiApi` makes, with the signed-in
 *   person's credential, as every call of apps/web is made (`backendHeaders`).
 * - `POST /feedback`: a rating of an answer, as apps/web's, and only with a person's token.
 *
 * Mounted under `/api/*`, so the session, the sign-in check and the body limit in app.ts come
 * first. Nothing here imports apps/web, and apps/web's routes are not changed.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Context, MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from './apiShared.ts';
import { readSessionId } from './auth.ts';
import { backendHeaders, knownProblem, type Caller } from './backend.ts';
import { config } from './config.ts';
import * as convos from './conversations.ts';
import { cleanFeedback, ownsTask, sendFeedback } from './feedback.ts';
import * as sourceStore from './sourceStore.ts';
import { getTokens } from './tokenStore.ts';

// ── Which client ──

export type Ui = 'next' | 'classic';

const secureCookies = () => config.auth.origin.startsWith('https://');

/** `__Host-` needs Secure, which a plain-http localhost cannot have. */
export const uiCookie = () => (secureCookies() ? '__Host-ka_ui' : 'ka_ui');

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Whether the next client is offered: switched on, and built. */
export const nextOffered = () =>
  config.next.enabled &&
  Boolean(config.next.webRoot) &&
  existsSync(join(config.next.webRoot, 'index.html'));

/** The client this browser chose: `next` only when the cookie says so. */
export const uiOf = (c: Context): Ui =>
  getCookie(c, uiCookie()) === 'next' ? 'next' : 'classic';

// ── Writes from this origin only ──

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const JSON_TYPE = /^application\/json\s*(;|$)/i;

/**
 * A write must come from this site's own page. Hono's `csrf()` in app.ts checks only form posts,
 * so here: a JSON content type on a body (a cross-site form cannot send one, and there is no
 * CORS), `Sec-Fetch-Site` same-origin when the browser sends it, and an `Origin`, when sent, that
 * is this site's.
 */
export const sameOriginWrites =
  (origin: string): MiddlewareHandler =>
  async (c, next) => {
    if (SAFE.has(c.req.method)) return next();
    const site = c.req.header('Sec-Fetch-Site');
    if (site && site !== 'same-origin') return refused(c, 'cross_site');
    const from = c.req.header('Origin');
    if (from && from !== origin) return refused(c, 'cross_site');
    if (c.req.method !== 'DELETE' && !JSON_TYPE.test(c.req.header('Content-Type') ?? ''))
      return refused(c, 'json_only');
    return next();
  };

const refused = (c: Context, code: string) => c.json({ error: 'refused', code }, 403);

// ── The proxy's rules ──

/** An id in a path: starts as genki's ids may, with a letter, digit, `_` or `-`, never `.` or `:`. */
const ID = '[A-Za-z0-9_-][A-Za-z0-9_.:-]{0,199}';
const AN_ID = new RegExp(`^${ID}$`);
const TITLE_MAX = 200;
const TAGS_MAX = 5;
const TAG = /^corpus:[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

type Json = Record<string, unknown>;

/** What a rule makes of the request: the query and body to send, or a refusal. */
type Shaped = { query?: URLSearchParams; body?: Json } | { status: 400 | 413; error: string };

interface Rule {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: RegExp;
  /** Only with a person's token, never with the service key (local runs, e2e, agents). */
  personOnly?: boolean;
  shape: (input: { query: URLSearchParams; body: unknown }, settings: NextSettings) => Shaped;
}

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const bad = (error: string): Shaped => ({ status: 400, error });

/** Only the named parameters, each at most once. */
const only = (query: URLSearchParams, names: readonly string[]) => {
  const kept = new URLSearchParams();
  for (const name of names) {
    const value = query.get(name);
    if (value !== null) kept.set(name, value);
  }
  return kept;
};

const integer = (raw: string | null, min: number, max: number) => {
  if (raw === null || !/^\d{1,4}$/.test(raw)) return undefined;
  const n = Number(raw);
  return n >= min && n <= max ? n : undefined;
};

/** The service's own variants, or the service itself. */
const ownModel = (model: unknown, settings: NextSettings) =>
  typeof model === 'string' &&
  (model === settings.service ||
    (model.startsWith(`${settings.service}__`) && /^[A-Za-z0-9_-]{1,200}$/.test(model)));

const title = (raw: unknown) =>
  typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').slice(0, TITLE_MAX) : '';

const RULES: readonly Rule[] = [
  { method: 'GET', path: /^\/v1\/models$/, shape: () => ({}) },
  {
    method: 'GET',
    path: /^\/api\/conversations$/,
    shape: ({ query }) => {
      const size = integer(query.get('page_size'), 1, 100) ?? 100;
      const index = integer(query.get('page_index'), 0, 49) ?? 0;
      return {
        query: new URLSearchParams({ page_size: String(size), page_index: String(index) }),
      };
    },
  },
  { method: 'GET', path: new RegExp(`^/api/conversations/${ID}$`), shape: () => ({}) },
  { method: 'GET', path: /^\/api\/datasets$/, shape: () => ({}) },
  { method: 'GET', path: new RegExp(`^/api/datasets/${ID}$`), shape: () => ({}) },
  {
    method: 'GET',
    path: /^\/api\/facets$/,
    shape: ({ query }, settings) => {
      const kept = only(query, ['dataset-config-key', 'fields', 'filter']);
      kept.set('tenant', settings.tenant);
      return { query: kept };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/conversations$/,
    shape: ({ body }, settings) => {
      if (!isRecord(body)) return bad('A JSON object is expected.');
      if (body['agent-id'] !== settings.service) return bad('Another service.');
      const tags = Array.isArray(body.tags) ? body.tags : [];
      if (tags.length > TAGS_MAX || !tags.every((t) => typeof t === 'string' && TAG.test(t)))
        return bad('Tags must be at most five `corpus:<key>`.');
      return { body: { title: title(body.title), 'agent-id': settings.service, tags } };
    },
  },
  {
    method: 'POST',
    path: /^\/v1\/chat\/completions$/,
    shape: ({ body }, settings) => {
      if (!isRecord(body)) return bad('A JSON object is expected.');
      if (!ownModel(body.model, settings)) return bad('Another service.');
      const messages = body.messages;
      const message =
        Array.isArray(messages) && messages.length === 1 ? messages[0] : undefined;
      if (!isRecord(message) || message.role !== 'user' || typeof message.content !== 'string')
        return bad('Exactly one question is expected.');
      if (!message.content.trim()) return bad('The question is empty.');
      if (message.content.length > settings.maxQueryLength)
        return { status: 413, error: 'The question is too long.' };
      const conversation = body.conversation_id;
      if (
        conversation !== undefined &&
        !(typeof conversation === 'string' && AN_ID.test(conversation))
      )
        return bad('Not a conversation id.');
      if (body.filters !== undefined && !isRecord(body.filters))
        return bad('Filters must be an object.');
      const dataset = body.dataset_config_key;
      if (dataset !== undefined && !(typeof dataset === 'string' && AN_ID.test(dataset)))
        return bad('Not a dataset key.');
      return {
        body: {
          model: body.model,
          messages: [{ role: 'user', content: message.content }],
          ...(conversation !== undefined ? { conversation_id: conversation } : {}),
          ...(body.filters !== undefined ? { filters: body.filters } : {}),
          ...(dataset !== undefined
            ? { tenant: settings.tenant, dataset_config_key: dataset }
            : {}),
          ...(body.stream === true ? { stream: true } : {}),
          ...(body.genai_stream === 'live' ? { genai_stream: 'live' } : {}),
          ...(body.genai_steps === true ? { genai_steps: true } : {}),
        },
      };
    },
  },
  {
    method: 'PUT',
    path: new RegExp(`^/api/conversations/${ID}$`),
    personOnly: true,
    shape: ({ body }) => {
      const named = isRecord(body) ? title(body.title) : '';
      return named ? { body: { title: named } } : bad('The title is empty.');
    },
  },
  {
    method: 'DELETE',
    path: new RegExp(`^/api/conversations/${ID}$`),
    personOnly: true,
    shape: () => ({}),
  },
];

/** The rule for a call, or none: then it is refused and never forwarded. */
export const ruleFor = (method: string, path: string) =>
  RULES.find((rule) => rule.method === method && rule.path.test(path));

const DOT_SEGMENT = /^(?:\.|%2e){1,2}$/i;

/** The path as the client sent it, before the URL parser resolved its `.` and `..` segments. */
const sentPath = (c: Context): string => {
  const sent = (c.env as { incoming?: { url?: string } } | undefined)?.incoming?.url;
  if (!sent) return new URL(c.req.url).pathname;
  const start = sent.startsWith('/') ? 0 : sent.indexOf('/', sent.indexOf('//') + 2);
  const path = start === -1 ? '/' : sent.slice(start);
  const query = path.indexOf('?');
  return query === -1 ? path : path.slice(0, query);
};

/** A `.` or `..` segment, raw or encoded, or an encoded slash or backslash anywhere in the path. */
const unsafePath = (path: string) => {
  const lower = path.toLowerCase();
  return (
    lower.includes('%2f') ||
    lower.includes('%5c') ||
    lower.includes('\\') ||
    path.split('/').some((segment) => DOT_SEGMENT.test(segment))
  );
};

/** genki's headers the page reads, passed back as they came. */
const PASSED_BACK = ['genai-task', 'genai-service-version', 'genai-conversation'];

/** The body types the page reads; anything else genki sends goes back as JSON. */
const PASSED_TYPE = /^(?:application\/json|text\/event-stream)\s*(?:;\s*charset=[\w.-]+\s*)?$/i;

/** Answers and threads are the person's own: kept in no cache, and never transformed. */
const NOT_STORED = 'no-store, no-transform';

/**
 * How much of a failed response is read, for its problem type and code only. genki's error
 * text never reaches the page or the log (decisions/0009, as in mcp.ts): it can name hosts and
 * replies from the model.
 */
const ERROR_BODY_MAX = 16 * 1024;

/** genki's code is passed on only when it is an identifier, so it carries no text. */
const CODE = /^[a-z][a-z0-9_]{0,63}$/;

async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < max) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } catch {
    return '';
  } finally {
    void reader.cancel().catch(() => {});
  }
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, max));
}

function codeOf(text: string): string | undefined {
  try {
    const body = JSON.parse(text) as unknown;
    if (!isRecord(body)) return undefined;
    const code = isRecord(body.error) ? body.error.code : body.code;
    return typeof code === 'string' && CODE.test(code) ? code : undefined;
  } catch {
    return undefined;
  }
}

/** A failed call to genki, as the page gets it: a fixed sentence and a code, with genki's status. */
async function upstreamFailure(upstream: Response): Promise<{ message: string; code: string }> {
  const text = await readCapped(upstream, ERROR_BODY_MAX);
  const problem = await knownProblem(new Response(text, { status: upstream.status }));
  if (problem) return problem;
  const code = codeOf(text);
  // The code in the sentence too: the page tells a thread that is gone by `conversation` in it.
  return {
    message: `Tjenesten svarte ${upstream.status}${code ? ` (${code})` : ''}.`,
    code: code ?? `backend_http_${upstream.status}`,
  };
}

const failed = (c: Context, status: number, message: string, code: string) =>
  c.json({ error: message, detail: message, code }, status as ContentfulStatusCode);

const LANGUAGE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;

export interface NextSettings {
  apiBase: string;
  model: string;
  service: string;
  tenant: string;
  origin: string;
  maxQueryLength: number;
}

const settingsFromConfig = (): NextSettings => ({
  apiBase: config.apiBase,
  model: config.next.model,
  service: config.next.service,
  tenant: config.next.tenant,
  origin: config.auth.origin,
  maxQueryLength: config.maxQueryLength,
});

/** The person's organisation: the one they act for, or their only one. */
async function organisationOf(c: Context<Env>): Promise<string | undefined> {
  if (config.auth.mode !== 'ansattporten') return undefined;
  const tokens = getTokens(await readSessionId(c));
  if (!tokens) return undefined;
  const chosen = tokens.actingFor
    ? tokens.organisations.find((o) => o.orgNumber === tokens.actingFor)
    : tokens.organisations.length === 1
      ? tokens.organisations[0]
      : undefined;
  return chosen?.name;
}

/** What a person is called with sign-in off, which is only on one's own machine. */
const LOCAL_NAME = 'Lokal testbruker';

/** The routes, against `settings`; app.ts mounts them with the server's own. */
export function nextRoutes(settings: NextSettings = settingsFromConfig()) {
  const next = new Hono<Env>();
  // First, so a refusal from the checks below is not stored either.
  next.use('/genki/*', async (c, run) => {
    await run();
    c.res.headers.set('Cache-Control', NOT_STORED);
  });
  next.use('*', sameOriginWrites(settings.origin));

  /** For apps/web's «Prøv ny versjon», drawn only when this says the next client is offered. */
  next.get('/ui', (c) => c.json({ ui: uiOf(c), available: nextOffered() }));

  next.post('/ui', async (c) => {
    const body = (await c.req.json().catch(() => undefined)) as { ui?: unknown } | undefined;
    const ui = body?.ui;
    if (ui !== 'next' && ui !== 'classic')
      return c.json({ error: 'ui is next or classic.' }, 400);
    if (ui === 'next')
      setCookie(c, uiCookie(), 'next', {
        path: '/',
        maxAge: ONE_YEAR,
        httpOnly: true,
        sameSite: 'Lax',
        secure: secureCookies(),
      });
    else deleteCookie(c, uiCookie(), { path: '/', secure: secureCookies() });
    return c.json({ ui });
  });

  next.get('/me', async (c) => {
    const user = c.get('user');
    const organisation = await organisationOf(c);
    return c.json({
      name: user?.name || (config.auth.enabled ? '' : LOCAL_NAME),
      ...(organisation ? { organisation } : {}),
      signOut: config.auth.enabled ? '/auth/logout' : null,
      model: settings.model,
      service: settings.service,
      tenant: settings.tenant,
      writes: Boolean(c.get('caller').token),
    });
  });

  // apps/web's feedback checks (feedback.ts), and never with the service key (decisions/0013).
  next.post('/feedback', async (c) => {
    const caller: Caller = c.get('caller');
    if (!caller.token) return refused(c, 'not_allowed');
    const feedback = cleanFeedback(await c.req.json().catch(() => undefined));
    if (typeof feedback === 'string') return c.json({ error: feedback }, 400);
    if (!(await ownsTask(caller, feedback)))
      return c.json({ error: 'Fant ikke svaret i samtalen.' }, 404);
    try {
      return c.json(await sendFeedback(caller, feedback));
    } catch (err) {
      return c.json(convos.failure('Kunne ikke sende tilbakemeldingen.', err), 502);
    }
  });

  next.all('/genki/*', async (c) => {
    const url = new URL(c.req.url);
    const method = c.req.method;
    const sent = sentPath(c);
    if (unsafePath(sent)) {
      console.log('next proxy refused %s %s', method, JSON.stringify(sent));
      return c.json({ error: 'refused', code: 'bad_path' }, 400);
    }
    const prefix = url.pathname.indexOf('/genki/');
    const path = url.pathname.slice(prefix + '/genki'.length);
    const rule = ruleFor(method, path);
    const caller: Caller = c.get('caller');
    if (!rule || (rule.personOnly && !caller.token)) {
      console.log('next proxy refused %s %s', method, JSON.stringify(path));
      return refused(c, 'not_allowed');
    }

    let body: unknown;
    if (method === 'POST' || method === 'PUT') {
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: 'Invalid JSON.' }, 400);
      }
    }
    const shaped = rule.shape({ query: url.searchParams, body }, settings);
    if ('status' in shaped)
      return c.json({ error: shaped.error, detail: shaped.error }, shaped.status);

    const language = c.req.header('Accept-Language')?.split(',')[0]?.trim();
    const headers: Record<string, string> = {
      Accept:
        c.req.header('Accept') === 'text/event-stream'
          ? 'text/event-stream'
          : 'application/json',
      'Accept-Encoding': 'identity',
      ...(language && LANGUAGE.test(language) ? { 'Accept-Language': language } : {}),
      ...(shaped.body ? { 'Content-Type': 'application/json' } : {}),
      ...backendHeaders(caller),
    };
    const search = shaped.query && [...shaped.query].length ? `?${shaped.query}` : '';
    const started = Date.now();
    let upstream: Response;
    try {
      upstream = await fetch(`${settings.apiBase}${path}${search}`, {
        method,
        headers,
        ...(shaped.body ? { body: JSON.stringify(shaped.body) } : {}),
        // Never followed: the credential would go with it, and the call is to genki only.
        redirect: 'manual',
        // «Stopp», or a closed tab, ends the call to genki too.
        signal: c.req.raw.signal,
      });
    } catch (err) {
      if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });
      console.error('next proxy %s %s unreachable', method, path, err);
      return c.json(
        { error: 'Fikk ikke kontakt med tjenesten.', code: 'backend_unreachable' },
        502,
      );
    }
    console.log(
      'next proxy %s %s %d %dms',
      method,
      path,
      upstream.status,
      Date.now() - started,
    );

    if (upstream.status >= 300 && upstream.status < 400) {
      void upstream.body?.cancel().catch(() => {});
      return failed(
        c,
        502,
        'Tjenesten svarte med en videresending, som ikke følges.',
        'backend_redirect',
      );
    }
    if (!upstream.ok) {
      const failure = await upstreamFailure(upstream);
      return failed(c, upstream.status, failure.message, failure.code);
    }
    // apps/web hangs a thread's kept sources on its last answer (sourceStore.ts), now this one.
    const thread = shaped.body?.conversation_id;
    if (method === 'POST' && typeof thread === 'string') sourceStore.forget(thread);

    // The body as it comes, never read, re-chunked or compressed here: an answer streams.
    const out = new Headers({ 'X-Accel-Buffering': 'no' });
    const type = upstream.headers.get('Content-Type');
    out.set('Content-Type', type && PASSED_TYPE.test(type) ? type : 'application/json');
    for (const name of PASSED_BACK) {
      const value = upstream.headers.get(name);
      if (value) out.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: out });
  });

  return next;
}
