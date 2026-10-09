export type ApiMode = 'mock' | 'live' | 'bff';

/**
 * `VITE_API_MODE` as built, never set at runtime, so the bundler can leave the
 * unused clients out (`createChatClient`). Unset: `bff` in production, where the
 * BFF serves this client, else `mock`. `?.` for plain Node (runtimeConfig.ts).
 */
export function apiMode(): ApiMode {
  const env = import.meta.env;
  return env?.VITE_API_MODE ?? (env?.PROD ? 'bff' : 'mock');
}
