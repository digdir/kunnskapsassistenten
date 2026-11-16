/** The only place `X-User-Id` may be derived. With Ansattporten, requireAuth adds the token. */
import { randomUUID } from 'node:crypto';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { readUser, type User } from './auth.ts';
import type { Caller } from './backend.ts';
import { config } from './config.ts';

export type SessionVars = { userId: string; user: User | null; caller: Caller };

/** The app's environment, with the session's variables. */
export type Env = { Variables: SessionVars };

const COOKIE = 'ka_sid';
const MAX_AGE = 60 * 60 * 24 * 30;

export const sessionMiddleware = createMiddleware<{ Variables: SessionVars }>(
  async (c, next) => {
    if (config.auth.enabled) {
      const user = await readUser(c);
      c.set('user', user);
      c.set('userId', user?.id ?? '');
      c.set('caller', { userId: user?.id ?? '' });
      return next();
    }

    const existing = getCookie(c, COOKIE);
    const sid = existing ?? randomUUID();
    c.set('userId', sid);
    c.set('user', null);
    c.set('caller', { userId: sid });

    await next();

    // setCookie's header is lost when a handler returns a raw Response.
    if (!existing) {
      c.res.headers.append(
        'Set-Cookie',
        `${COOKIE}=${sid}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; SameSite=Lax`,
      );
    }
  },
);
