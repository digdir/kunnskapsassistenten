// The assembly's calls, through the server's proxy to genki (`/api/next/genki/*`). The server adds
// the signed-in person's credential; the page never holds one. A call refused with 401 because
// the session ran out sends the person to the sign-in, and back here afterwards.
import { createGenkiApi, type AssistantApi, type AssistantProfile } from '@genai/ui-assembly';
import { sessionGone, signInHref } from './session';

export const GENKI_BASE = '/api/next/genki';

const statusOf = (error: unknown) =>
  typeof error === 'object' && error !== null && 'status' in error
    ? (error as { status: unknown }).status
    : undefined;

/** `api`, with a lapsed session sending the person to the sign-in. */
export function withSignIn(
  api: AssistantApi,
  signIn: () => void = () => location.assign(signInHref()),
  gone: () => Promise<boolean> = sessionGone,
): AssistantApi {
  const check = async (error: unknown) => {
    if (statusOf(error) === 401 && (await gone())) signIn();
  };
  const wrap =
    <A extends unknown[], R>(call: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        return await call(...args);
      } catch (error) {
        await check(error);
        throw error;
      }
    };
  return {
    loadModels: wrap(api.loadModels),
    loadThreads: wrap(api.loadThreads),
    loadThread: wrap(api.loadThread),
    loadCorpora: wrap(api.loadCorpora),
    loadFields: wrap(api.loadFields),
    loadFacets: wrap(api.loadFacets),
    loadAbout: wrap(api.loadAbout),
    ask: async function* (params) {
      try {
        yield* api.ask(params);
      } catch (error) {
        await check(error);
        throw error;
      }
    },
  };
}

export const genkiApi = (tenant: string, profile: AssistantProfile) =>
  withSignIn(createGenkiApi({ baseUrl: GENKI_BASE, tenant, profile }));
