import { LiveUploadClient } from './live/LiveUploadClient';
import { MockUploadClient } from './mock/MockUploadClient';
import { kaEnv } from './runtimeConfig';
import type { UploadClient } from './uploadClient';

let client: UploadClient | undefined;

/**
 * The upload client for this mode, built once.
 *
 * `VITE_API_MODE` is the same switch `createChatClient()` reads: mock mode
 * does the whole flow in the browser, and every other mode refuses honestly
 * because there is no endpoint (API-bestilling A3). That includes `bff`:
 * the BFF in digdir/kunnskapsassistenten has no upload route either, and a
 * test that asked only «is it live?» handed the pod the mock, which took
 * files that went nowhere.
 * Found by #2 on 30.09. Mock is the one mode named, so a mode added later
 * refuses until someone gives it an upload.
 *
 * Cached, unlike `createChatClient()` — but not because two instances would
 * disagree. They would not: `MockUploadClient` holds no state of its own and
 * reads `localStorage` on every call, so a second instance would answer
 * exactly the same. The cache is here so that `unavailable` is read off one
 * object rather than a new one per render, and so a test that swaps the mode
 * has one place to reset. That is a smaller claim than the one this comment
 * used to make, and it is the true one. KA CC on #117.
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
