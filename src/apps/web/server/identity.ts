import type { IncomingMessage } from 'node:http';

/**
 * Where the user id the backend hears comes from.
 *
 * `browser`: the `X-User-Id` the client made up and sent (`src/api/live/userId.ts`).
 * It proves nothing, and is what there is without a login.
 *
 * `platform`: the signed-in user Container Apps' built-in login («Easy Auth»)
 * put on the request. The browser's `X-User-Id` is thrown away, so nobody can
 * read another user's threads by sending their id.
 */
export type UserIdSource = 'browser' | 'platform';

/**
 * The header the platform sets for the signed-in user: «an identifier that the
 * identity provider sets for the caller». Microsoft's documentation, for
 * Container Apps and App Service alike: «External requests aren't allowed to
 * set these headers, so they're present only if set by Container Apps.»
 * Node lowercases header names, so this is the name as it arrives here.
 *
 * That promise holds only with the login in front. Without it, anybody can
 * send this header, which is why `platform` is never the default and
 * deploy/main.bicep sets it together with the login and not otherwise.
 */
export const PLATFORM_USER_HEADER = 'x-ms-client-principal-id';

/**
 * `KA_USER_ID_FROM`, read strictly.
 *
 * Unset is `browser`, so running locally is what it was. Anything that is
 * neither word stops the server, and that is the point: `KA_MODE` may fall
 * back to mock on a typo because mock costs nothing, but a misspelt
 * `platform` falling back to `browser` would let the browser choose whose
 * threads it reads behind a login that was meant to prevent exactly that.
 */
export function userIdSourceFrom(raw: string | undefined): UserIdSource {
  const trimmed = raw?.trim() ?? '';
  if (trimmed === '' || trimmed === 'browser') return 'browser';
  if (trimmed === 'platform') return 'platform';
  throw new Error(`KA_USER_ID_FROM må være «browser» eller «platform», ikke «${trimmed}».`);
}

/** The platform's user id on this request, or undefined when there is none. */
export function platformUserId(request: IncomingMessage): string | undefined {
  const raw = request.headers[PLATFORM_USER_HEADER];
  const id = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return id === undefined || id === '' ? undefined : id;
}
