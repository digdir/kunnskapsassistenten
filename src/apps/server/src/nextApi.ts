/**
 * `/api/next`: what the next client, apps/web-next, needs from this server (decisions/0013).
 *
 * - `GET /ui` and `POST /ui`: which client this browser gets, kept in a cookie.
 * - `GET /me`: who is signed in, and which genki service and variant the page asks.
 * - `/genki/*`: a narrow proxy to the genki calls `createGenkiApi` makes, with the signed-in
 *   person's credential, as every call of apps/web is made (`backendHeaders`).
 *
 * Mounted under `/api/*`, so the session, the sign-in check and the body limit in app.ts come
 * first. Nothing here imports apps/web, and apps/web's routes are not changed.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Context, MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Env } from './apiShared.ts';
import { readSessionId } from './auth.ts';
import { backendHeaders, knownProblem, type Caller } from './backend.ts';
import { config } from './config.ts';
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

/** An id in a path: starts with a letter or digit, so never `.` or `..`. */
const ID = '[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}';
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
      if (conversation !== undefined && !new RegExp(`^${ID}$`).test(String(conversation)))
        return bad('Not a conversation id.');
      if (body.filters !== undefined && !isRecord(body.filters))
        return bad('Filters must be an object.');
      const dataset = body.dataset_config_key;
      if (dataset !== undefined && !new RegExp(`^${ID}$`).test(String(dataset)))
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

/** genki's headers the page reads, passed back as they came. */
const PASSED_BACK = ['genai-task', 'genai-service-version', 'genai-conversation'];

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

  next.all('/genki/*', async (c) => {
    const url = new URL(c.req.url);
    const prefix = url.pathname.indexOf('/genki/');
    const path = url.pathname.slice(prefix + '/genki'.length);
    const method = c.req.method;
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

    const problem = await knownProblem(upstream.clone());
    if (problem) {
      void upstream.body?.cancel();
      return c.json(
        { error: problem.message, detail: problem.message, code: problem.code },
        upstream.status as 401 | 403,
      );
    }

    // The body as it comes, never read, re-chunked or compressed here: an answer streams.
    const out = new Headers({
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    const type = upstream.headers.get('Content-Type');
    if (type) out.set('Content-Type', type);
    for (const name of PASSED_BACK) {
      const value = upstream.headers.get(name);
      if (value) out.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: out });
  });

  return next;
}
