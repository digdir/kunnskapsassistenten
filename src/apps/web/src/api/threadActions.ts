import type { Thread } from '../model';
import { deleteMockThread, renameMockThread } from './mock/sessionThreads';
import { kaEnv } from './runtimeConfig';
import { keepDraft } from './session';

/**
 * What the reader can do to a thread besides open it: give it a new name, and
 * delete it.
 *
 * Beside the ChatClient and not in it, for now. The BFF has had both all
 * along (`PUT` and `DELETE` on `/api/conversations/:id`), and the client did
 * not use them (design/plan-monorepo-2026-09-29.md, «Det klienten vår må
 * få»). The BFF client was being rewritten for D16 on the same night, and
 * these two calls share nothing with it but the address, so they got a file
 * of their own instead of a merge in the middle of it.
 *
 * Both throw when the backend says no. The thread list updates first and
 * takes it back on a throw, so what the caller needs is only that it failed.
 */
export type ThreadActions = {
  rename(thread: Thread, title: string): Promise<void>;
  remove(thread: Thread): Promise<void>;
};

/*
 * Who else has to hear about a new name.
 *
 * The thread list owns its own rows and updates them itself. The main column
 * does not: it draws `threadHeading` off the thread `ChatSlotView` read when
 * the address was opened, and nothing tells that copy the name changed.
 * Measured 2026-09-29 in mock: renaming the open thread put the new name in
 * the list at once, while the heading kept «NKOM måloppnåelse» until the next
 * load.
 *
 * A store rather than a prop, because the two views sit in different slots
 * with no parent between them that knows about renames — the same reason
 * `corpus.ts` and `userDocuments.ts` are stores.
 *
 * It follows the list's optimism exactly: the new name is published before
 * the backend is asked, and the old one is published back if the backend says
 * no, so the heading and the row never disagree.
 */
/**
 * A name, and whether it is the thread's own or the question over again.
 *
 * Both, because `titleFromQuestion` decides whether the heading is drawn at
 * all: a title that only repeats the question is `ds-sr-only`, heard and not
 * seen (`threadHeading`, `ChatView`). Publishing the title alone made a
 * failed rename put the OLD title back as if the reader had chosen it, and
 * the same sentence then stood visible right above the question it was made
 * from. Measured 2026-09-29; found by KA CC on #185.
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

/**
 * The same actions, with a rename published to whoever is listening.
 *
 * Wrapped here and not in the thread list, so every caller gets it and the
 * list keeps the only copy of its own optimism.
 */
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
        /*
         * Back to the old name only if the one on screen is still this
         * call's. Renamed again in the meantime — A to B, then B to C before
         * the first answered — the name is the later rename's, and this
         * failure says nothing about it (KA CC, kan 2 on #180). The thread
         * list follows the same rule for its own rows (ThreadsView.tsx).
         */
        if (renamed.get(thread.id)?.title === title) publish(thread.id, before);
        throw error;
      }
    },
  };
}

/**
 * The actions this deployment has, or undefined when it has none.
 *
 * Live talks to the backend's MCP endpoint, which has no call for either, so
 * the list shows neither there rather than offering something that would
 * fail on every press.
 */
export function createThreadActions(): ThreadActions | undefined {
  const mode = kaEnv().VITE_API_MODE ?? 'mock';
  if (mode === 'bff') return publishing(bffThreadActions());
  if (mode === 'live') return undefined;
  return publishing(mockThreadActions);
}

/**
 * The BFF's conversation, which is the thread's own id there: the BFF names
 * its conversations and the thread takes that name (bff/mapping.ts).
 */
function conversationPath(thread: Thread): string {
  return `/api/conversations/${encodeURIComponent(thread.conversationId ?? thread.id)}`;
}

let redirecting = false;

/**
 * To the BFF's sign-in when the session has run out, and back to the page
 * the reader's draft belongs on (session.ts, `keepDraft`) — what the BFF
 * client does on a 401 (BffChatClient.ts, `toLogin`). A copy of
 * its five lines rather than an import, for the reason the file says above.
 */
function toLogin(returnTo: string): void {
  if (redirecting || window.location.pathname.startsWith('/auth/')) return;
  redirecting = true;
  window.location.assign(`/auth/login?next=${encodeURIComponent(returnTo)}`);
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
  redirecting = false;
}
