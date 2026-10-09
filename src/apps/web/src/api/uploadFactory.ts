import { LiveUploadClient } from './live/LiveUploadClient';
import { MockUploadClient } from './mock/MockUploadClient';
import { kaEnv } from './runtimeConfig';
import type { UploadClient } from './uploadClient';

let client: UploadClient | undefined;

/**
 * The upload client for this mode, built once. Only mock uploads; every other
 * mode, `bff` included, has no endpoint and refuses. Cached so `unavailable` is
 * read off one object, and a test that swaps the mode has one place to reset.
 */
export function createUploadClient(): UploadClient {
  client ??=
    (kaEnv().VITE_API_MODE ?? 'mock') === 'mock' ? new MockUploadClient() : new LiveUploadClient();
  return client;
}

/** Tests only: drop the cached client so the next call reads the mode again. */
export function resetUploadClientForTest(): void {
  client = undefined;
}
