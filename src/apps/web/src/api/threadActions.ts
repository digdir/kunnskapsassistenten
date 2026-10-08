import type { Thread } from '../model';
import { deleteMockThread, renameMockThread } from './mock/sessionThreads';
import { BFF_API } from './bff/api';
import { resetSignIn, toLogin } from './bff/signIn';
import { kaEnv } from './runtimeConfig';
import { keepDraft } from './session';

/**
 * Rename and delete a thread; beside the ChatClient, as they share nothing with
 * it but the address. Both throw when the backend says no, and the thread list,
 * which updates first, takes it back.
 */
export type ThreadActions = {
  rename(thread: Thread, title: string): Promise<void>;
  remove(thread: Thread): Promise<void>;
};

// A store of renames, so the main column's heading (its own copy of the thread,
// in another slot) follows the thread list. Optimistic like the list: published
// first, put back if the backend says no.
/**
 * A name, and whether it is only the question again: that flag decides if the
 * heading is visible or `ds-sr-only`, so a rolled-back rename must restore it.
 */
export type RenamedThread = { title: string; titleFromQuestion: boolean };

const renamed = new Map<string, RenamedThread>();
const listeners = new Set<() => void>();

/** A new `Map` each time, so `useSyncExternalStore` sees the change. */
let snapshot: ReadonlyMap<string, RenamedThread> = renamed;

function publish(threadId: string, name: RenamedThread): void {
  renamed.set(threadId, name);
  snapshot = new Map(renamed);
  for (const listener of [...listeners]) listener();
}

export function subscribeToThreadRenames(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Every name given in this session, by thread id. */
export function renamedThreads(): ReadonlyMap<string, RenamedThread> {
  return snapshot;
}

/** For tests: forget the names given so far. */
export function resetThreadRenames(): void {
  renamed.clear();
  snapshot = new Map();
}

/** The same actions, with renames published; here so every caller gets it. */
function publishing(actions: ThreadActions): ThreadActions {
  return {
    ...actions,
    rename: async (thread, title) => {
      // What to put back, flag and all, exactly as the list does
      // (`ThreadsView.rename`).
      const before: RenamedThread = {
        title: thread.title,
        titleFromQuestion: thread.titleFromQuestion === true,
      };
      // A name the reader typed is the thread's own, never the question again.
      publish(thread.id, { title, titleFromQuestion: false });
      try {
        await actions.rename(thread, title);
      } catch (error) {
        // Put the old name back only if the one on screen is still this call's;
        // otherwise a later rename owns it. ThreadsView.tsx does the same.
        if (renamed.get(thread.id)?.title === title) publish(thread.id, before);
        throw error;
      }
    },
  };
}

/** The actions this deployment has; none in live, whose MCP endpoint has neither call. */
export function createThreadActions(): ThreadActions | undefined {
  const mode = kaEnv().VITE_API_MODE ?? 'mock';
  if (mode === 'bff') return publishing(bffThreadActions());
  if (mode === 'live') return undefined;
  return publishing(mockThreadActions);
}

// In bff mode the thread's own id is the BFF's conversation id (bff/mapping.ts).
function conversationPath(thread: Thread): string {
  return `${BFF_API}/conversations/${encodeURIComponent(thread.conversationId ?? thread.id)}`;
}

async function send(path: string, init: RequestInit): Promise<void> {
  const response = await fetch(path, { credentials: 'same-origin', ...init });
  // What is in the compose field outlives the sign-in (session.ts).
  if (response.status === 401) toLogin(keepDraft());
  if (!response.ok) throw new Error(`${init.method} ${path} ${response.status}`);
}

export function bffThreadActions(): ThreadActions {
  return {
    rename: (thread, title) =>
      send(conversationPath(thread), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }),
    remove: (thread) => send(conversationPath(thread), { method: 'DELETE' }),
  };
}

/** The mock's own store, so both can be tried without a backend. */
const mockThreadActions: ThreadActions = {
  rename: async (thread, title) => renameMockThread(thread, title),
  remove: async (thread) => deleteMockThread(thread),
};

/** For tests: forget that a sign-in redirect has been started. */
export function resetThreadActions(): void {
  resetSignIn();
}
