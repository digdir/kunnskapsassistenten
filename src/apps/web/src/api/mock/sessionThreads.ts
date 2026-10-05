import type { ThreadCertainty } from '../chatClient';
import type { Message, Thread, ThreadDetail } from '../../model';

/**
 * The conversations this browser tab has had, so a reload does not lose them.
 *
 * Reise 12 and 14 in design/brukerreiser-2026-09-15.md, punkt 16 on the
 * ranked list — the worst journey in the app: ask a question on `/`, get an
 * address, reload, and the conversation is gone while the address still looks
 * like it means something. The backend cannot fix it yet (gap 4: a
 * `conversation_id` from `tools/call` is not readable back through
 * `/api/conversations`, API-bestilling A6), so the mock does what a backend
 * with a thread API would do, and the live client keeps saying the truth.
 *
 * `sessionStorage` and not `localStorage`, on purpose. This is a stand-in for
 * a server, not a record: it lives as long as the tab, it is not shared with
 * other tabs, and it goes away when the browser is closed — which is the
 * honest lifetime for something that exists because the real store is
 * missing. It also means a fixture corpus cannot slowly fill a reader's disk
 * with answers they never asked to keep.
 *
 * Only the turns produced HERE are stored. A fixture thread the reader asked
 * a follow-up in keeps its fixture messages in code and gets the new turn
 * appended on read, so the same answer is never written down twice.
 *
 * Every access is guarded the same way the colour scheme is: storage throws
 * outright in Safari's private mode and with site data blocked, and the quota
 * is finite. A remembered conversation is never worth a blank page, so a bad
 * or full store simply means the app behaves as it did before this existed.
 */

export const SESSION_STORAGE_KEY = 'ka.mock.threads.v1';

/** One conversation, as it is written down. */
type StoredThread = {
  /**
   * Identity and title. For a fixture thread, only `updatedAt` is used — and
   * the title, once the reader has given it a new one.
   */
  thread: Thread;
  /** The turns this tab produced, oldest first. Fixture turns are not here. */
  messages: Message[];
  /** The reader named it. A fixture thread then takes `thread.title` too. */
  renamed?: boolean;
  /** The reader deleted it. Gone from the list, and not found when opened. */
  deleted?: boolean;
};

type Store = Record<string, StoredThread>;

/**
 * Which thread the next answer belongs to.
 *
 * Module state rather than an instance field, because there is more than one
 * client instance in the running app — the shell builds one to read the
 * thread, the chat view builds another to ask questions — and they have to
 * agree about which conversation is on screen. A mock is a stand-in for one
 * server, so it has one session.
 */
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
    // Out of quota, or storage blocked. The conversation is still on screen;
    // it just will not survive the reload.
  }
}

/**
 * Remember a thread, and make it the one the next answer is filed under.
 *
 * Called by the shell for both kinds of thread: the one it just minted for a
 * question asked on `/`, and the one it read from `/threads/:threadId`. An
 * entry that exists keeps its messages — opening a thread is not the same as
 * emptying it.
 *
 * `certainty` is the caller saying how much of the thread is real. The shell
 * can open one before it has read it — a question asked while `/threads/:id`
 * is still loading has to be filed somewhere — and then it is sure of the id
 * and stands in for the rest. A stand-in only makes sure there is somewhere
 * to file the answer; it never writes over what is already here, and it never
 * keeps the real thread from landing a moment later.
 *
 * Told rather than worked out. Keeping whatever was written FIRST looks like
 * the same rule and is not: in that one gap it is the stand-in that writes
 * first, so the conversation would have ended up named after the newest
 * question asked in it, with the real title arriving 700 ms too late to get in
 * (KA CC on #153).
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
 *
 * Written into the entry whether or not this tab made the thread: a fixture
 * thread has no entry until something happens to it, and this is something.
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

/**
 * An id for a conversation the mock owns, told apart from the shell's at a
 * glance.
 *
 * The mock used to file conversations under the id the SHELL made up, and
 * that is why nobody saw brukerblikk 8's finding for a week: live's backend
 * names its own conversations, so mock and live disagreed about precisely the
 * thing that was broken, and a test could pass in mock while the address was
 * dead in live. Now both name their own, and the prefix is there so a failing
 * assertion says which side minted the id it is looking at.
 */
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
  /**
   * The answer, carrying its own `createdAt`.
   *
   * The time comes with the turn rather than being taken here, because the
   * same turn is also on screen and the two have to say the same thing. They
   * did not: the message was stamped when its placeholder was made and the
   * stored copy when it was written down, which is the whole length of the
   * answer apart — «14:32» on screen, «14:32:15» after a reload, one answer
   * that had not changed (KA CC on #71).
   */
  answer: Omit<Message, 'id' | 'role'>;
};

/**
 * Write a finished turn into the open thread.
 *
 * A no-op when no thread is open, which is the case in a unit test that calls
 * `ask()` on its own: nothing has said where the answer belongs, so there is
 * nowhere to put it and nothing to guess.
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
 * The thread list, with this tab's own conversations mixed in.
 *
 * A thread the fixtures already know keeps its fixture entry but takes the
 * stored `updatedAt`, so a follow-up moves it to «I dag» in the grouping. One
 * this tab made is appended; the list view sorts by `updatedAt` itself.
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
 *
 * `fixture` is what the fixtures answered, null when they know nothing about
 * the id. A thread that is in neither place is still null, which is what
 * makes «Fant ikke tråden» reachable.
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
    messages: [...base.messages, ...stored.messages],
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
