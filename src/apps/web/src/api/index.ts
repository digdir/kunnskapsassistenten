import type { ChatClient } from './chatClient';
import { BffChatClient } from './bff';
import { activeCorpusKey } from './corpus';
import { kaEnv } from './runtimeConfig';
import { LiveChatClient } from './live';
import { defaultMockSpeed, MockChatClient, mockSpeeds } from './mock';

export type { AskParams, ChatClient } from './chatClient';
export type { UploadClient, UploadProgress } from './uploadClient';
export { createUploadClient } from './uploadFactory';
export {
  loadUserDocuments,
  removeUserDocument,
  subscribeToUserDocuments,
  uploadUserDocument,
  userDocuments,
} from './userDocuments';
export type { CorpusOption } from './corpus';
export {
  activeCorpus,
  activeCorpusKey,
  adoptServerCorpus,
  corpusDisplayName,
  corpusDisplayNameFor,
  corpusIsChoosable,
  corpusOption,
  corpusOptions,
  setActiveCorpusKey,
  subscribeToCorpus,
} from './corpus';

/**
 * The chat client for `VITE_API_MODE`, read at build time (apiMode.ts). Live goes
 * through a proxy that holds the API key, which never reaches the bundle; `bff`
 * goes through the BFF (src/decisions/0005-client-behind-the-bff.md).
 */
export function createChatClient(): ChatClient {
  const env = kaEnv();
  // The rule in apiMode.ts, inlined so the build can fold it and drop the mock
  // and the live client from a bff build (with vite.config.ts). Don't call
  // `apiMode()` here: nothing would be folded.
  const mode = import.meta.env.VITE_API_MODE ?? (import.meta.env.PROD ? 'bff' : 'mock');
  if (mode === 'bff') {
    const bff = new BffChatClient({ datasetConfigKey: activeCorpusKey });
    // The corpus's name comes from the BFF (src/decisions/0006); ask for it
    // now rather than when the filter panel first draws.
    bff.prime();
    return bff;
  }
  if (mode !== 'live') {
    // Slow and lifelike by default: an instant mock cannot show the skeleton,
    // the thinking panel or the streaming. The e2e suite sets `fast`.
    const speed = env.VITE_MOCK_SPEED ?? defaultMockSpeed;
    return new MockChatClient(mockSpeeds[speed] ?? mockSpeeds[defaultMockSpeed]);
  }

  // Tenant and dataset: both or neither (the client drops a lone one); unset,
  // the backend picks. A function, so each request reads the current choice.
  return new LiveChatClient({
    tenant: env.VITE_KA_TENANT,
    datasetConfigKey: activeCorpusKey,
  });
}
