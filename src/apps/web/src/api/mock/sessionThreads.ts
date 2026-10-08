import type { ThreadCertainty } from '../chatClient';
import { withoutRetriedAttempts, type Message, type Thread, type ThreadDetail } from '../../model';

/**
 * This tab's conversations, so a reload keeps them as a backend with a thread
 * API would. `sessionStorage`: a stand-in for a server, not a record. Only turns
 * made here are stored, and any storage error just means they are forgotten.
 */

export const SESSION_STORAGE_KEY = 'ka.mock.threads.v1';

/** One conversation, as it is written down. */
type StoredThread = {
  /** Identity and title. For a fixture thread, only `updatedAt` and a new title are used. */
  thread: Thread;
  /** The turns this tab produced, oldest first. Fixture turns are not here. */
  messages: Message[];
  /** The reader named it. A fixture thread then takes `thread.title` too. */
  renamed?: boolean;
  /** The reader deleted it. Gone from the list, and not found when opened. */
  deleted?: boolean;
};

type Store = Record<string, StoredThread>;

// Module state, not an instance field: the shell and the chat view each build a client, and
// they must agree on which conversation is on screen.
let openThreadId: string | undefined;

function read(): Store {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Store)
      : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Out of quota, or storage blocked. It just will not survive a reload.
  }
}

/**
 * Remember a thread and file the next answer under it; an existing entry keeps
 * its messages. With `certainty: 'id-only'` (opened before it was read) it never
 * overwrites what is stored, or the thread would be named after a later question.
 */
export function openMockThread(thread: Thread, certainty: ThreadCertainty = 'known'): void {
  openThreadId = thread.id;

  const store = read();
  const existing = store[thread.id];
  store[thread.id] = {
    // What the reader did to it — a new name, a deletion — outlives opening it.
    ...existing,
    thread:
      certainty === 'id-only' ? (existing?.thread ?? thread) : { ...existing?.thread, ...thread },
    messages: existing?.messages ?? [],
  };
  write(store);
}

/**
 * A new title, the way the BFF's `PUT /api/conversations/:id` gives one.
 * Written even for a fixture thread, which has no entry until something
 * happens to it.
 */
export function renameMockThread(thread: Thread, title: string): void {
  const store = read();
  const existing = store[thread.id];
  store[thread.id] = {
    ...existing,
    thread: { ...(existing?.thread ?? thread), title, titleFromQuestion: false },
    messages: existing?.messages ?? [],
    renamed: true,
  };
  write(store);
}

/** A deletion, the way the BFF's `DELETE /api/conversations/:id` makes one. */
export function deleteMockThread(thread: Thread): void {
  const store = read();
  const existing = store[thread.id];
  store[thread.id] = {
    ...existing,
    thread: existing?.thread ?? thread,
    messages: existing?.messages ?? [],
    deleted: true,
  };
  write(store);
}

// Ids the mock mints itself, as the live backend does. The prefix tells a failing assertion
// which side minted it.
let mockThreadCounter = 0;

export function newMockThreadId(): string {
  mockThreadCounter += 1;
  return `mock-conv-${mockThreadCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** One question and the answer it got, as the mock produced them. */
export type MockTurn = {
  question: string;
  /** The answer's own id, the one the `done` event reported. */
  answerId: string;
  /** The answer, with its own `createdAt` so screen and store agree after a reload. */
  answer: Omit<Message, 'id' | 'role'>;
};

/**
 * Write a finished turn into the open thread. A no-op when no thread is open,
 * as in a unit test that calls `ask()` on its own: there is nowhere to put it
 * and nothing to guess.
 */
export function recordMockTurn(turn: MockTurn): void {
  if (!openThreadId) return;

  const store = read();
  const entry = store[openThreadId];
  if (!entry) return;

  const now = new Date().toISOString();
  entry.messages = [
    ...entry.messages,
    {
      id: `${turn.answerId}-question`,
      role: 'user',
      content: turn.question,
      createdAt: now,
      citations: [],
      status: 'complete',
    },
    { id: turn.answerId, role: 'assistant', ...turn.answer },
  ];
  entry.thread = { ...entry.thread, updatedAt: now };
  write(store);
}

/**
 * The thread list, with this tab's own conversations mixed in. A fixture
 * thread takes the stored `updatedAt`, so a follow-up moves it to «I dag».
 * The list view sorts by `updatedAt` itself.
 */
export function mockThreadList(fixtures: Thread[]): Thread[] {
  const store = read();

  const merged = fixtures
    .filter((thread) => !store[thread.id]?.deleted)
    .map((thread) => {
      const stored = store[thread.id];
      if (!stored) return thread;
      return {
        ...thread,
        updatedAt: stored.thread.updatedAt,
        ...(stored.renamed ? { title: stored.thread.title, titleFromQuestion: false } : {}),
      };
    });

  const known = new Set(fixtures.map((thread) => thread.id));
  for (const [id, stored] of Object.entries(store)) {
    if (!known.has(id) && !stored.deleted) merged.push(stored.thread);
  }

  return merged;
}

/**
 * One thread, with this tab's turns appended to whatever the fixtures hold.
 * Null when neither knows the id, which makes «Fant ikke tråden» reachable.
 */
export function mockThreadDetail(id: string, fixture: ThreadDetail | null): ThreadDetail | null {
  const stored = read()[id];
  if (!stored) return fixture;
  if (stored.deleted) return null;

  const base = fixture ?? { ...stored.thread, messages: [] };
  return {
    ...base,
    updatedAt: stored.thread.updatedAt,
    ...(stored.renamed ? { title: stored.thread.title, titleFromQuestion: false } : {}),
    messages: withoutRetriedAttempts([...base.messages, ...stored.messages]),
  };
}

/** For tests: forget both the store and which thread is open. */
export function resetMockThreads(): void {
  openThreadId = undefined;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Nothing to do, and nothing that depends on it.
  }
}
