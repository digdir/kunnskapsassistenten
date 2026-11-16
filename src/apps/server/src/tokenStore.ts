/** Ansattporten tokens per session, in this process only. The browser holds just the key. */
import { randomBytes } from 'node:crypto';
import type { Organisation } from './types.ts';

export interface TokenSession {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
  organisations: Organisation[];
  actingFor?: string;
  /** Signed in, but genki or Altinn gives no access: the sentence to show. */
  refused?: string;
  createdAt: number;
}

const MAX_AGE_MS = 8 * 60 * 60 * 1000;
const sessions = new Map<string, TokenSession>();

function sweep(now: number): void {
  for (const [sid, s] of sessions) if (now - s.createdAt > MAX_AGE_MS) sessions.delete(sid);
}

export function newSessionId(): string {
  return randomBytes(32).toString('base64url');
}

export function getTokens(sid: string | undefined): TokenSession | undefined {
  if (!sid) return undefined;
  const s = sessions.get(sid);
  if (s && Date.now() - s.createdAt > MAX_AGE_MS) {
    sessions.delete(sid);
    return undefined;
  }
  return s;
}

export function setTokens(sid: string, session: TokenSession): void {
  sweep(Date.now());
  sessions.set(sid, session);
}

export function dropTokens(sid: string | undefined): void {
  if (sid) sessions.delete(sid);
}
