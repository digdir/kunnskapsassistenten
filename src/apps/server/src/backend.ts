/** Who the backend is asked on behalf of, and the headers that say so. */
import { config } from './config.ts';

/**
 * `userId` is the session's. With Ansattporten, `token` is the person's
 * access token and `actingFor` the organisation they chose, if they had a choice.
 */
export interface Caller {
  userId: string;
  token?: string;
  actingFor?: string;
  /** The person turned the excerpt trial on, and this server offers it (decisions/0016). */
  excerptTrial?: boolean;
}

/** The genki environment a tester gets, or `undefined` for everyone else, who get genki's `prod`. */
export function environmentFor(
  userId: string,
  testers: { ids: ReadonlySet<string>; environment: string } = config.testers,
): string | undefined {
  return testers.ids.has(userId) ? testers.environment : undefined;
}

/** The client's header while the person has the excerpt trial on; only `1` turns it on. */
export const EXCERPT_TRIAL_HEADER = 'KA-Trial-Excerpt-Citations';

/** The caller, marked for the excerpt trial when the request asks and the server offers it. */
export function withExcerptTrial(caller: Caller, header: string | undefined): Caller {
  return header === '1' && config.excerptEnvironment
    ? { ...caller, excerptTrial: true }
    : caller;
}

export function backendHeaders(caller: Caller): Record<string, string> {
  const trial = caller.excerptTrial ? config.excerptEnvironment : undefined;
  const environment = environmentFor(caller.userId) ?? trial;
  const chosen: Record<string, string> = environment
    ? { 'GenAI-Environment': environment }
    : {};
  if (caller.token)
    return {
      Authorization: `Bearer ${caller.token}`,
      ...(caller.actingFor ? { 'GenAI-Acting-For': caller.actingFor } : {}),
      ...chosen,
    };
  return { 'X-API-Key': config.apiKey, 'X-User-Id': caller.userId, ...chosen };
}

/** As `backendHeaders`, but a service key is sent without `X-User-Id`, as before. */
export function appHeaders(caller: Caller): Record<string, string> {
  return caller.token ? backendHeaders(caller) : { 'X-API-Key': config.apiKey };
}

/** genki's refusals a person can be told about, by problem type, in our words. */
const PROBLEMS: Record<string, { code: string; message: string }> = {
  'urn:genai:problem:locked-environment': {
    code: 'locked_environment',
    message:
      'Testmiljøet er låst. Bare Digdir-ansatte som logger inn med Entra ID, kan bruke språkmodellene der.',
  },
  'urn:genai:problem:entra-not-trusted': {
    code: 'entra_not_trusted',
    message: 'Entra ID-kontoen din er ikke blant dem som slipper inn i testmiljøet.',
  },
};

/** A known problem in a refused response from genki, or `undefined`. Reads the body. */
export async function knownProblem(
  res: Response,
): Promise<{ code: string; message: string } | undefined> {
  if (res.status !== 401 && res.status !== 403) return undefined;
  try {
    const body = (await res.json()) as { type?: unknown };
    return typeof body.type === 'string' ? PROBLEMS[body.type] : undefined;
  } catch {
    return undefined;
  }
}
