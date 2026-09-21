/** The only place `X-User-Id` may be derived. */
import { randomUUID } from 'node:crypto';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { readUser, type User } from './auth.ts';
import { config } from './config.ts';

export type SessionVars = { userId: string; user: User | null };

const COOKIE = 'ka_sid';
const MAX_AGE = 60 * 60 * 24 * 30;

export const sessionMiddleware = createMiddleware<{ Variables: SessionVars }>(
  async (c, next) => {
    if (config.auth.enabled) {
      const user = await readUser(c);
      c.set('user', user);
      c.set('userId', user?.id ?? '');
      return next();
    }

    const existing = getCookie(c, COOKIE);
    const sid = existing ?? randomUUID();
    c.set('userId', sid);
    c.set('user', null);

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
