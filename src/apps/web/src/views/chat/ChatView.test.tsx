import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { AskParams, ChatClient } from '../../api';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { FilterContext } from '../../layout/filterContext';
import { MainScrollContext } from '../../layout/scrollContext';
import { ThreadContext } from '../../layout/threadContext';
import {
  emptyFilterSelection,
  type AnswerSources,
  threadFromQuestion,
  type FilterSelection,
  type StreamEvent,
  type ThreadDetail,
} from '../../model';
import { MOCK_AGENTS } from '../../api/mock/MockChatClient';
import { AGENT_STORAGE_KEY } from '../../api/agentChoice';
import { ATTACH_LABEL } from './attachmentText';
import { ChatView } from './ChatView';
import {
  ABORTED_BEFORE_ANSWER,
  CLARIFICATION_PLACEHOLDER,
  CLARIFICATION_TAG,
  CLOSING_QUESTION,
  COMPOSE_PLACEHOLDER,
  DISCLAIMER,
  FOLLOW_UP_QUESTIONS,
  NO_HITS_WHOLE_CORPUS,
  REGENERATE,
  SHORTCUT_DESCRIPTION,
  shortcutHint,
} from './text';

/*
 * Designsystemet's Skeleton asks document.getAnimations, which jsdom does not
 * have. The empty answer card renders one while the first token is on its way.
 */
if (typeof document.getAnimations !== 'function') {
  document.getAnimations = () => [];
}

/** A client whose whole turn is decided up front. */
function clientYielding(events: StreamEvent[]): ChatClient {
  return {
    async *ask({ signal }: AskParams): AsyncIterable<StreamEvent> {
      for (const event of events) {
        if (signal?.aborted) return;
        yield event;
      }
      // Nothing more is coming, but the turn is not over either: the stop
      // button has to stay reachable when the list is empty.
      if (events.length === 0) await new Promise(() => {});
    },
    listThreads: async () => [],
    getThread: async () => null,
    listFacets: async () => [],
  };
}

type ShellProps = {
  children: ReactNode;
  startThread?: () => void;
  /** What the filter view has narrowed to, as the shell would hold it. */
  selection?: FilterSelection;
  /** Records what the view reports about each answer's sources. */
  onAnswerSources?: (answer: AnswerSources) => void;
  /** Records `[n]` activations, with the answer they came from. */
  onCitation?: (number: number, messageId?: string) => void;
};

/**
 * The pieces of the shell the chat view reads.
 *
 * The router is here for the same reason it is in `FiltersView.test.tsx`: the
 * view reads the active corpus to pick its three suggestions, and `useCorpus`
 * navigates when the corpus is SET — so reading it needs a router the way it
 * needs the contexts around it.
 */
function Shell({ children, startThread, selection, onAnswerSources, onCitation }: ShellProps) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return (
    <MemoryRouter>
      <MainScrollContext value={scrollRef}>
        <CitationContext
          value={{ activeCitation: undefined, showCitation: onCitation ?? (() => {}) }}
        >
          <AnswerSourcesContext
            value={{ ...inertAnswerSources, setAnswerSources: onAnswerSources ?? (() => {}) }}
          >
            <ThreadContext
              value={{
                startThread: (question) => {
                  startThread?.();
                  return threadFromQuestion(question);
                },
              }}
            >
              <FilterContext
                value={{ selection: selection ?? emptyFilterSelection, setSelection: () => {} }}
              >
                {children}
              </FilterContext>
            </ThreadContext>
          </AnswerSourcesContext>
        </CitationContext>
      </MainScrollContext>
    </MemoryRouter>
  );
}

function field() {
  return screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' });
}

function ask(question: string) {
  fireEvent.change(field(), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Send spørsmålet' }));
}

function threadWith(title: string, titleFromQuestion?: boolean): ThreadDetail {
  return {
    id: 't1',
    title,
    titleFromQuestion,
    createdAt: '2026-09-15T09:00:00Z',
    updatedAt: '2026-09-15T09:00:00Z',
    messages: [
      {
        id: 'u1',
        role: 'user',
        content: 'Hva sier rapporten?',
        createdAt: '2026-09-15T09:00:00Z',
        citations: [],
        status: 'complete',
      },
    ],
  };
}

const done: StreamEvent = { type: 'done', messageId: 'm1', conversationId: 'c1' };
const answer: StreamEvent[] = [{ type: 'token', text: 'Svaret på spørsmålet.' }, done];
/** An answer with a source behind its one marker, for the clipboard. */
const sourcedAnswer: StreamEvent[] = [
  { type: 'token', text: 'Nkom melder kvartalsvis [1].' },
  {
    type: 'sources',
    documents: [
      {
        id: 'd1',
        title: 'Årsrapport Nkom 2022',
        organisation: 'Nkom',
        year: 2022,
        excerpts: [{ id: 'e1', text: '', relevance: 'high', citationNumber: 1, page: 41 }],
      },
    ],
    citations: [{ number: 1, excerptId: 'e1', documentId: 'd1' }],
    retrieval: { hitCount: 1, documentCount: 1, keywords: [] },
  },
  done,
];

const clarification: StreamEvent[] = [
  {
    type: 'thinking-step',
    step: { id: 's1', kind: 'search', label: 'Jeg leter etter årsrapporter.', durationMs: 2000 },
  },
  { type: 'token', text: 'Mener du årsrapporten eller tildelingsbrevet?' },
  { type: 'done', messageId: 'm1', conversationId: 'c1', outcome: 'needs-clarification' },
];

describe('ChatView', () => {
  it('gives a conversation started on the front page the same head as a thread', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    // Before the first question the only heading is the greeting.
    expect(screen.queryByRole('heading', { name: /rapporten/u })).toBeNull();

    ask('Hva sier rapporten? Og hva med 2023?');

    // The thread has no title yet, so the first sentence of the question
    // stands in — the head is the same on both routes (finding 5).
    const head = await waitFor(() =>
      screen.getByRole('heading', { level: 2, name: 'Hva sier rapporten' }),
    );

    // But it says no more than the question under it, so it is heard and not
    // seen: the same text twice on screen is what finding 5 asked to stop.
    expect(head.className).toContain('ds-sr-only');
    expect(screen.getAllByText(/Hva sier rapporten\?/u)).toHaveLength(1);
  });

  it('draws a real thread title, with the question under it', () => {
    render(
      <Shell>
        <ChatView client={clientYielding([done])} thread={threadWith('NKOM måloppnåelse')} />
      </Shell>,
    );

    const head = screen.getByRole('heading', { level: 2 });
    expect(head.textContent).toBe('NKOM måloppnåelse');
    expect(head.className).not.toContain('ds-sr-only');
  });

  it('hides a title the client made out of the question', () => {
    // `threadFromQuestion` stores the whole question and says so with
    // `titleFromQuestion`. The flag decides, not a comparison of the strings:
    // the stored title is the whole question and the stand-in is its first
    // sentence, so the two do not match for a question of several sentences.
    render(
      <Shell>
        <ChatView
          client={clientYielding([done])}
          thread={threadWith('Hva sier rapporten? Og hva med 2023?', true)}
        />
      </Shell>,
    );

    const head = screen.getByRole('heading', { level: 2 });
    expect(head.className).toContain('ds-sr-only');
  });

  it('gives the conversation an address when a question is sent', async () => {
    const startThread = vi.fn();
    render(
      <Shell startThread={startThread}>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    ask('  Hva er måloppnåelse?  ');

    // Once, with the question as the reader typed it minus the padding. C16.
    await waitFor(() => expect(startThread).toHaveBeenCalledOnce());
  });

  it('does not ask for a retry in the text right above the retry button', async () => {
    render(
      <Shell>
        <ChatView
          client={clientYielding([
            { type: 'error', error: { code: 'unknown', message: 'Noe gikk galt. Prøv igjen.' } },
          ])}
        />
      </Shell>,
    );

    ask('Hva sier rapporten?');

    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert.textContent).toContain('Noe gikk galt.'));

    // Once, on the button (finding 9).
    expect(alert.textContent?.match(/Prøv igjen/gu)).toHaveLength(1);
  });

  it('names the case in the heading and tells two failures apart', async () => {
    const { unmount } = render(
      <Shell>
        <ChatView
          client={clientYielding([{ type: 'error', error: { code: 'model-unavailable' } }])}
        />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    const first = await screen.findByRole('alert');
    await waitFor(() => expect(first.textContent).toContain('Assistenten svarte ikke'));
    unmount();

    render(
      <Shell>
        <ChatView
          client={clientYielding([{ type: 'error', error: { code: 'retrieval-unavailable' } }])}
        />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    const second = await screen.findByRole('alert');
    // «Noe gikk galt» said the same thing for both, and the two need
    // different things from the reader (brukerreiser punkt 12).
    await waitFor(() => expect(second.textContent).toContain('Søket i dokumentene svarte ikke'));
  });

  it('offers no «Prøv igjen» when the key was rejected', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding([{ type: 'error', error: { code: 'unauthorized' } }])} />
      </Shell>,
    );

    ask('Hva sier rapporten?');

    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert.textContent).toContain('Ingen tilgang'));
    // The same question with the same key fails the same way; a button that
    // cannot work sends the reader round the loop instead of onwards.
    expect(screen.queryByRole('button', { name: 'Prøv igjen' })).toBeNull();
  });

  it('draws a search that found nothing as an answer, not as an alert', async () => {
    const reported: AnswerSources[] = [];
    render(
      <Shell onAnswerSources={(answerSources) => reported.push(answerSources)}>
        <ChatView client={clientYielding([{ type: 'error', error: { code: 'no-hits' } }])} />
      </Shell>,
    );

    ask('Hva sier dokumentene om romfart?');

    // In the thread, as a turn of its own. The live region says the same
    // thing, so the answer is looked for where answers are.
    await waitFor(() =>
      expect(document.querySelector('.ka-messages')?.textContent).toContain(
        NO_HITS_WHOLE_CORPUS.split('\n')[0],
      ),
    );
    // No red box and no retry: the search ran, and running it again against
    // the same documents finds the same nothing.
    expect(screen.getByRole('alert').textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Prøv igjen' })).toBeNull();

    /*
     * The sources panel is told it is a finished answer with nothing behind
     * it, which is what stops it waiting on «Henter kilder …».
     *
     * Waited for, and not read the moment the text appears. The text and the
     * report are two different settlements: the words come from the message,
     * the report from the effect that compares this thread against what the
     * shell is holding, and that effect runs after the render the words
     * landed in. Read synchronously, the last report is whatever had been
     * sent by then — measured once as `['streaming']`, which is the report
     * from before the turn finished, and the test went red in a full run and
     * green on its own (#5, 2026-09-16).
     */
    await waitFor(() => expect(reported.at(-1)?.status).toBe('complete'));
    expect(reported.at(-1)?.documents).toEqual([]);
  });

  it('keeps what the reader is typing while the thread is still loading', async () => {
    /*
     * `ChatSlotView` draws the chat straight away and fills `thread` in when
     * the client answers, so on `/threads/:id` the thread arrives a moment
     * after the first render. The view used to key itself on the thread id,
     * so that moment replaced the whole session — and took the compose field
     * with it. Type while it loads and the text was gone; in CI, which is
     * slower, the same remount landed in the middle of a test's keystrokes.
     */
    const { rerender } = render(
      <Shell>
        <ChatView client={clientYielding([])} />
      </Shell>,
    );

    fireEvent.change(field(), { target: { value: 'a/b' } });
    const describedBy = field().getAttribute('aria-describedby') ?? '';

    rerender(
      <Shell>
        <ChatView client={clientYielding([])} thread={threadWith('NKOM måloppnåelse')} />
      </Shell>,
    );

    expect(field()).toHaveProperty('value', 'a/b');
    // And the description the field points at is still the one in the page.
    // CI failed on this half as often as on the value: a remount hands out
    // fresh `useId`s, so for a moment the field named an element that was gone.
    expect(describedBy).not.toBe('');
    for (const id of describedBy.split(/\s+/u)) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it('takes on the thread when it arrives', async () => {
    // The other half of the same change: the messages used to get in by
    // remounting, so dropping the remount without taking them on would have
    // left a restored conversation empty. Measured — the reload journey in
    // the e2e suite went red on exactly that.
    const { rerender } = render(
      <Shell>
        <ChatView client={clientYielding([])} />
      </Shell>,
    );
    expect(screen.queryByText('Hva sier rapporten?')).toBeNull();

    rerender(
      <Shell>
        <ChatView client={clientYielding([])} thread={threadWith('NKOM måloppnåelse')} />
      </Shell>,
    );

    expect(await screen.findByText('Hva sier rapporten?')).toBeTruthy();
  });

  it('puts a late thread in front of a question already asked', async () => {
    const { container, rerender } = render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    ask('Hva er måloppnåelse?');
    await screen.findByText('Svaret på spørsmålet.');

    rerender(
      <Shell>
        <ChatView client={clientYielding(answer)} thread={threadWith('NKOM måloppnåelse')} />
      </Shell>,
    );

    /*
     * Both are real, and both stay. The reader's own turn is untouched — that
     * was the whole point of adopting rather than remounting — and the stored
     * conversation is laid in front of it, which is the order they happened
     * in: it was there before the question that was asked while it loaded.
     *
     * It used to be dropped instead, and a reader who asked something before
     * `getThread` answered never saw the conversation that was already at
     * that address (KA CC on #66).
     */
    expect(screen.getByText('Hva er måloppnåelse?')).toBeTruthy();
    expect(screen.getByText('Hva sier rapporten?')).toBeTruthy();

    const said = [...container.querySelectorAll('.ka-message')].map((message) =>
      message.textContent?.includes('Hva sier rapporten?') ? 'lagret' : 'nytt',
    );
    expect(said[0]).toBe('lagret');
  });

  it('reports the sources again when something empties the shell', async () => {
    /*
     * Brukerblikk runde 2, funn 1: a reloaded conversation came back with its
     * answer, its markers and its sources in `sessionStorage`, and both side
     * panels still said «Kildene vises her når du har stilt et spørsmål».
     *
     * Several things clear the shell's sources — leaving a thread, a route
     * with no conversation, this view's own unmount — and the view used to
     * keep its own note of what it had already sent. That note cannot know
     * the shell was emptied afterwards, so the answer was reported once and
     * never again. Here the emptying is done on purpose, which is the one way
     * to hold the rule whatever the order was on the day.
     */
    function StatefulShell({ children }: { children: ReactNode }) {
      const [answers, setAnswers] = useState<AnswerSources[] | undefined>(undefined);
      // Memoised the way `LayoutProvider` memoises them. Not a detail: with
      // callbacks that change identity, the view's «clear on the way out»
      // effect re-runs — and re-running runs its cleanup — so the two effects
      // clear and report each other forever. Measured 2026-09-15.
      const setAnswerSources = useCallback(
        (answer: AnswerSources) =>
          setAnswers((current) => [
            ...(current ?? []).filter((other) => other.messageId !== answer.messageId),
            answer,
          ]),
        [],
      );
      const clearAnswerSources = useCallback(() => setAnswers(undefined), []);
      const value = useMemo(
        () => ({ ...inertAnswerSources, answers, setAnswerSources, clearAnswerSources }),
        [answers, setAnswerSources, clearAnswerSources],
      );

      return (
        <Shell>
          <AnswerSourcesContext value={value}>
            {/* What the sources panel would be drawing, as one string. */}
            <p data-testid="kilder">
              {answers === undefined
                ? 'ingenting kjent'
                : `${answers.at(-1)?.documents.length ?? 0} dokumenter`}
            </p>
            <button onClick={() => setAnswers(undefined)} type="button">
              Tøm kildene
            </button>
            {children}
          </AnswerSourcesContext>
        </Shell>
      );
    }

    render(
      <StatefulShell>
        <ChatView client={clientYielding(sourcedAnswer)} />
      </StatefulShell>,
    );

    ask('Hva sier rapporten?');
    await waitFor(() => expect(screen.getByTestId('kilder').textContent).toBe('1 dokumenter'));

    // Whatever emptied it, the next render has to fill it again.
    fireEvent.click(screen.getByRole('button', { name: 'Tøm kildene' }));
    await waitFor(() => expect(screen.getByTestId('kilder').textContent).toBe('1 dokumenter'));
  });

  it('drops the closing question under an answer that found nothing', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding([{ type: 'error', error: { code: 'no-hits' } }])} />
      </Shell>,
    );

    ask('Hva sier dokumentene om romfart?');

    await waitFor(() =>
      expect(document.querySelector('.ka-messages')?.textContent).toContain(
        NO_HITS_WHOLE_CORPUS.split('\n')[0],
      ),
    );

    // «Er det noe mer jeg kan hjelpe deg med?» invites a follow-up to an
    // answer that found nothing — the same thing the hidden suggestions would
    // do, one line up (brukerblikk runde 2, funn 7).
    expect(screen.queryByText(CLOSING_QUESTION)).toBeNull();
  });

  it('keeps the closing question under an ordinary answer', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    expect(await screen.findByText(CLOSING_QUESTION)).toBeTruthy();
  });

  it('offers no follow-up suggestions under an answer that found nothing', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding([{ type: 'error', error: { code: 'no-hits' } }])} />
      </Shell>,
    );

    ask('Hva sier dokumentene om romfart?');

    await waitFor(() =>
      expect(document.querySelector('.ka-messages')?.textContent).toContain(
        NO_HITS_WHOLE_CORPUS.split('\n')[0],
      ),
    );

    // «Kan du utdype?» asks the assistant to say more about nothing, and the
    // other two lead back to the same empty search.
    for (const question of FOLLOW_UP_QUESTIONS) {
      expect(screen.queryByRole('button', { name: question }), question).toBeNull();
    }
  });

  it('brings the suggestions back for the next answer that did find something', async () => {
    let turn = 0;
    const client: ChatClient = {
      async *ask(): AsyncIterable<StreamEvent> {
        turn += 1;
        if (turn === 1) {
          yield { type: 'error', error: { code: 'no-hits' } };
          return;
        }
        for (const event of answer) yield event;
      },
      listThreads: async () => [],
      getThread: async () => null,
      listFacets: async () => [],
    };

    render(
      <Shell>
        <ChatView client={client} />
      </Shell>,
    );

    ask('Hva sier dokumentene om romfart?');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: FOLLOW_UP_QUESTIONS[0] })).toBeNull(),
    );

    // The empty search was one turn, not a property of the thread.
    ask('Hva sier rapporten?');
    expect(await screen.findByRole('button', { name: FOLLOW_UP_QUESTIONS[0] })).toBeTruthy();
  });

  it('says «Avbryt» in words while the answer is on its way', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding([])} />
      </Shell>,
    );

    ask('Hva sier rapporten?');

    // A bare square is not obviously «stopp» to anyone looking (finding 10).
    const stop = await screen.findByRole('button', { name: 'Avbryt genereringen' });
    expect(stop.textContent).toContain('Avbryt');
  });

  it('shows a clarification as a question and asks the reader to answer it', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(clarification)} />
      </Shell>,
    );

    ask('Hva er måloppnåelse?');

    expect(await screen.findByText(CLARIFICATION_TAG)).toBeTruthy();

    // The field says what it wants, and takes the caret: the reader has just
    // been asked something and this is where the answer goes.
    await waitFor(() => expect(field()).toHaveProperty('placeholder', CLARIFICATION_PLACEHOLDER));
    expect(document.activeElement).toBe(field());

    // «Kan du utdype?» is not an answer to anything the agent asked.
    expect(screen.queryByRole('button', { name: FOLLOW_UP_QUESTIONS[0] })).toBeNull();

    // Nothing a finished answer carries.
    expect(screen.queryByRole('button', { name: 'Kopier lenke til tråden' })).toBeNull();
    expect(screen.queryByText('Fremgangsmåte')).toBeNull();
  });

  it('sends the reader’s answer as the next message in the same thread', async () => {
    const asked: string[] = [];
    const client: ChatClient = {
      async *ask({ query }: AskParams): AsyncIterable<StreamEvent> {
        asked.push(query);
        for (const event of asked.length === 1 ? clarification : answer) yield event;
      },
      listThreads: async () => [],
      getThread: async () => null,
      listFacets: async () => [],
    };

    render(
      <Shell>
        <ChatView client={client} />
      </Shell>,
    );

    ask('Hva er måloppnåelse?');
    await screen.findByText(CLARIFICATION_TAG);

    ask('Årsrapporten.');

    // An ordinary next turn: same thread, no special path.
    await waitFor(() => expect(asked).toEqual(['Hva er måloppnåelse?', 'Årsrapporten.']));
    await waitFor(() => expect(field()).toHaveProperty('placeholder', COMPOSE_PLACEHOLDER));
  });

  it('sends the document filter with the question, and says so over the answer', async () => {
    const asked: (FilterSelection | undefined)[] = [];
    const client: ChatClient = {
      async *ask({ filters }: AskParams): AsyncIterable<StreamEvent> {
        asked.push(filters);
        for (const event of answer) yield event;
      },
      listThreads: async () => [],
      getThread: async () => null,
      listFacets: async () => [],
    };

    const selection: FilterSelection = {
      ...emptyFilterSelection,
      documentType: ['Årsrapport'],
      year: ['2023'],
    };

    render(
      <Shell selection={selection}>
        <ChatView client={client} />
      </Shell>,
    );

    ask('Hva sier rapporten?');

    // The filter is part of the question, not a view decoration (reise 8).
    await waitFor(() => expect(asked).toEqual([selection]));

    // And the answer says what it was asked against.
    expect(await screen.findByText(/Avgrenset til: Årsrapport · 2023/u)).toBeTruthy();
  });

  it('says nothing about the filter when nothing was narrowed', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    await screen.findByRole('button', { name: 'Kopier svaret' });

    expect(screen.queryByText(/Avgrenset til/u)).toBeNull();
  });

  it('copies the answer with its sources, and counts them in the receipt', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    render(
      <Shell>
        <ChatView client={clientYielding(sourcedAnswer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    fireEvent.click(await screen.findByRole('button', { name: 'Kopier svaret' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const copied = writeText.mock.calls[0]![0] as string;
    // The marker survives, because there is now something for it to point at.
    expect(copied).toContain('kvartalsvis [1].');
    expect(copied).toContain('[1] Nkom (2022). Årsrapport Nkom 2022, s. 41.');
    expect(await screen.findByText('Svaret og 1 kilde er kopiert.')).toBeTruthy();

    vi.unstubAllGlobals();
  });

  it('offers to run a stopped answer again, and says why it has no sources', async () => {
    const asked: string[] = [];
    const client: ChatClient = {
      async *ask({ query, signal }: AskParams): AsyncIterable<StreamEvent> {
        asked.push(query);
        yield { type: 'token', text: 'Halve svaret' };
        if (asked.length === 1) {
          await new Promise<void>((resolve) => signal?.addEventListener('abort', () => resolve()));
          yield { type: 'error', error: { code: 'aborted', message: 'Svaret ble avbrutt.' } };
          return;
        }
        yield done;
      },
      listThreads: async () => [],
      getThread: async () => null,
      listFacets: async () => [],
    };

    render(
      <Shell>
        <ChatView client={client} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    fireEvent.click(await screen.findByRole('button', { name: 'Avbryt genereringen' }));

    // The text that arrived stays, and the card says why nothing is behind it.
    const again = await screen.findByRole('button', { name: /Generer på nytt/u });
    expect(screen.getByText(/Halve svaret/u)).toBeTruthy();
    expect(screen.getByText(/kildene bak det kom aldri fram/u)).toBeTruthy();
    // Nothing to copy from half an answer.
    expect(screen.queryByRole('button', { name: 'Kopier svaret' })).toBeNull();

    fireEvent.click(again);
    await waitFor(() => expect(asked).toEqual(['Hva sier rapporten?', 'Hva sier rapporten?']));
  });

  it('offers «Generer på nytt» for a turn stopped while it was still searching', async () => {
    /*
     * Nothing arrives until the reader stops it, and then the stop comes back
     * as an `error` frame with code `aborted` — which is how both real
     * clients report cancellation, so a caller has one code path for «the
     * answer stopped» regardless of why.
     */
    const stoppable: ChatClient = {
      async *ask({ signal }: AskParams): AsyncIterable<StreamEvent> {
        await new Promise<void>((resolve) => {
          if (signal?.aborted) resolve();
          else signal?.addEventListener('abort', () => resolve(), { once: true });
        });
        yield { type: 'error', error: { code: 'aborted' } };
      },
      listThreads: async () => [],
      getThread: async () => null,
      listFacets: async () => [],
    };

    const reported: AnswerSources[] = [];
    render(
      <Shell onAnswerSources={(answerSources) => reported.push(answerSources)}>
        <ChatView client={stoppable} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    fireEvent.click(await screen.findByRole('button', { name: 'Avbryt genereringen' }));

    /*
     * The turn used to vanish here — no card, no way onward, and a sources
     * panel back to «du har ikke spurt om noe» for a reader who had just
     * asked something. Stopping one word later left both (#4, funn A).
     */
    expect(await screen.findByRole('button', { name: REGENERATE })).toBeTruthy();
    expect(screen.getByText(ABORTED_BEFORE_ANSWER)).toBeTruthy();

    // And the panel is told what became of it, as it is for a turn stopped
    // after the first word. Waited for: the button appearing is one render,
    // the report is the effect after it.
    await waitFor(() => expect(reported.at(-1)?.status).toBe('aborted'));
    expect(reported.at(-1)?.documents).toEqual([]);
  });

  it('puts focus on «Prøv igjen» when a failure arrives after a mouse click', async () => {
    render(
      <Shell>
        <ChatView
          client={clientYielding([
            { type: 'error', error: { code: 'unknown', message: 'Noe gikk galt.' } },
          ])}
        />
      </Shell>,
    );

    /*
     * The click landed on the send button, which became the stop button and,
     * when the turn failed, the send button again — disabled, because the
     * field is empty. Focus is still ON it at the moment the error lands and
     * falls to `<body>` one frame later, which is why the rescue may not ask
     * `document.activeElement` alone (#4, funn B; traced in the built app).
     */
    const send = screen.getByRole('button', { name: 'Send spørsmålet' });
    fireEvent.change(field(), { target: { value: 'Hva sier rapporten?' } });
    send.focus();
    fireEvent.click(send);

    await screen.findByText('Svaret kom ikke fram');
    // «Prøv igjen» is the one thing to do next, so that is where focus goes.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Prøv igjen' })),
    );
  });

  it('leaves focus on the paperclip, which changed nothing', async () => {
    render(
      <Shell>
        <ChatView
          client={clientYielding([{ type: 'error', error: { code: 'model-unavailable' } }])}
        />
      </Shell>,
    );

    const send = screen.getByRole('button', { name: 'Send spørsmålet' });
    fireEvent.change(field(), { target: { value: 'Hva sier rapporten?' } });
    send.focus();
    fireEvent.click(send);

    // The reader moves to the paperclip while the answer is on its way. It is
    // inert, it says «Vedlegg kommer», and nothing about it changes when the
    // turn fails — so the rescue must leave it alone. The rescue is about the
    // one control that changed meaning, not about the area it sits in
    // (KA CC on #59).
    const paperclip = screen.getByRole('button', { name: ATTACH_LABEL });
    paperclip.focus();

    await screen.findByText('Assistenten svarte ikke');
    expect(document.activeElement).toBe(paperclip);
  });

  it('falls back to the field when the failure offers no retry', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding([{ type: 'error', error: { code: 'unauthorized' } }])} />
      </Shell>,
    );

    const send = screen.getByRole('button', { name: 'Send spørsmålet' });
    fireEvent.change(field(), { target: { value: 'Hva sier rapporten?' } });
    send.focus();
    fireEvent.click(send);

    await screen.findByText('Ingen tilgang');
    // A rejected key has no button to press again, and the reader's way on is
    // to write to someone.
    expect(screen.queryByRole('button', { name: 'Prøv igjen' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(field()));
  });

  it('leaves the caret alone when the reader sent with Enter', async () => {
    render(
      <Shell>
        <ChatView
          client={clientYielding([{ type: 'error', error: { code: 'model-unavailable' } }])}
        />
      </Shell>,
    );

    fireEvent.change(field(), { target: { value: 'Hva sier rapporten?' } });
    field().focus();
    fireEvent.keyDown(field(), { key: 'Enter' });

    // The failure really arrived: the alert region is mounted whether or not
    // there is an error in it, so the heading is what proves the turn failed.
    await screen.findByText('Assistenten svarte ikke');
    // Enter leaves the caret in the field, and a reader who is typing must
    // not have it taken away.
    expect(document.activeElement).toBe(field());
  });

  it('keeps «Tenkte i N sekunder» over a clarification', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(clarification)} />
      </Shell>,
    );

    ask('Hva er måloppnåelse?');
    await screen.findByText(CLARIFICATION_TAG);

    // The agent searched before it asked back, and that is the same fact here
    // as over an answer. The number is whatever the turn was measured at — an
    // instant client is one second — so what is asserted is that it is said.
    expect(screen.getByText(/^Tenkte i \d+ sekund(er)?$/u)).toBeTruthy();
  });

  it('puts the caret in the field on Ctrl+/ from anywhere on the page', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    const elsewhere = await screen.findByRole('button', { name: 'Kopier svaret' });
    elsewhere.focus();

    // shiftKey is true because on a Norwegian keyboard «/» IS Shift+7. A
    // handler that rejected shift could never fire on the layout this app is
    // written for.
    fireEvent.keyDown(elsewhere, { key: '/', ctrlKey: true, shiftKey: true });

    expect(document.activeElement).toBe(field());
  });

  it('answers to Cmd+/ as well, for a Mac', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    const elsewhere = await screen.findByRole('button', { name: 'Kopier svaret' });
    elsewhere.focus();

    fireEvent.keyDown(elsewhere, { key: '/', metaKey: true, shiftKey: true });

    expect(document.activeElement).toBe(field());
  });

  it('does nothing on a bare «/»', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    const elsewhere = await screen.findByRole('button', { name: 'Kopier svaret' });
    elsewhere.focus();

    // A shortcut on a single character key is WCAG 2.1.4, level A, and this
    // one could not be switched off. The modifier is what takes it out of
    // scope — so the bare key has to stay inert.
    const notSwallowed = fireEvent.keyDown(elsewhere, { key: '/', cancelable: true });

    expect(document.activeElement).toBe(elsewhere);
    expect(notSwallowed).toBe(true);
  });

  it('leaves Ctrl+Alt+/ alone, because that is AltGr on Windows', async () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    const elsewhere = await screen.findByRole('button', { name: 'Kopier svaret' });
    elsewhere.focus();

    fireEvent.keyDown(elsewhere, { key: '/', ctrlKey: true, altKey: true, shiftKey: true });

    expect(document.activeElement).toBe(elsewhere);
  });

  it('reaches the handler from inside a shadow root', () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    // The three filter dropdowns are Designsystemet `Suggestion`, whose input
    // lives in a shadow root. With a modifier the shortcut is welcome there
    // too — nobody holds Ctrl to write a slash — but the event has to cross
    // the boundary at all, which is what this guards.
    const host = document.createElement('div');
    document.body.append(host);
    const inner = document.createElement('input');
    host.attachShadow({ mode: 'open' }).append(inner);
    inner.focus();

    inner.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '/',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );

    expect(document.activeElement).toBe(field());
    host.remove();
  });

  it('says how to reach the field, to a pointer and to a screen reader', () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    /*
     * On the field rather than in a line of grey text under it. The hint used
     * to share the footer with the disclaimer and wrapped it onto two lines,
     * which cost 24 px of the sticky bottom on every screen (høydebudsjett
     * 2026-09-21, H3). A tooltip is where a pointer user looks for what a
     * control does, and the field is the thing the shortcut acts on.
     */
    expect(field().getAttribute('title')).toBe(shortcutHint());
    expect(screen.queryByText(shortcutHint())).toBeNull();

    // The field itself carries the spelled-out version: «/» read aloud is
    // «skråstrek» in some voices and silence in others.
    const described = field().getAttribute('aria-describedby');
    expect(described).toBeTruthy();
    expect(document.getElementById(described!)?.textContent).toBe(SHORTCUT_DESCRIPTION);
  });

  it('har feltet over knappene, med binders først og send sist', () => {
    /*
     * Knappene sto i feltraden, fordi en rad for seg kostet 48 px av den
     * klebrige bunnen på hver skjerm (høydebudsjett 2026-09-21, H1). Designet
     * viste hva det kostet i stedet: boksen er høy nok til å skrive i, så
     * plassholderen sto innrykket øverst med en knapp lavt på hver side og
     * ingenting på linje (issue 79). Nå tar feltet hele bredden av
     * boksen, og de to knappene står på raden under, en i hver ende.
     *
     * Kantene teksten skal møte er CSS og måles i nettleseren, ikke her: på
     * 1440 × 900 starter både teksten og bindersikonet på 560, og både teksten
     * og sendeknappen slutter på 1258. Det denne testen holder fast, er
     * rekkefølgen de kantene følger av.
     */
    const { container } = render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    const box = container.querySelector('.ka-composer')!;
    const rows = [...box.children].filter((child) => child.tagName !== 'INPUT');
    const field = box.querySelector('.ka-composer__field')!;
    const controls = box.querySelector('.ka-composer__controls')!;
    // To rader i boksen: feltet øverst, knappene under.
    expect(rows).toEqual([field, controls]);

    // Og i knapperaden: binders først, send sist.
    const inControls = [...controls.children];
    const attach = controls.querySelector('.ka-composer__attach')!;
    const send = controls.querySelector('.ka-composer__send')!;
    expect(inControls).toContain(attach);
    expect(inControls).toContain(send);
    expect(inControls.indexOf(attach)).toBeLessThan(inControls.indexOf(send));
  });

  it('har oppfølgingsspørsmålene rett under boksen og ansvarsteksten sist', async () => {
    /*
     * Ansvarsteksten ble flyttet over boksen i issue 89 og tilbake under den i
     * issue 79. Oppfølgingsspørsmålene står rett under boksen, som i
     * issue-89a, og ansvarsteksten sist: området er festet i bunnen og vokser
     * oppover, så den siste linja er den som aldri flytter seg. Luften er
     * CSS; det denne testen holder fast, er rekkefølgen.
     */
    const { container } = render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    ask('Hva sier dokumentene om romfart?');
    await screen.findByRole('button', { name: FOLLOW_UP_QUESTIONS[0] });

    const area = container.querySelector('.ka-composer-area')!;
    const at = (selector: string) =>
      [...area.children].findIndex((child) => child.matches(selector));

    expect(at('.ka-composer')).toBeGreaterThanOrEqual(0);
    expect(at('.ka-follow-ups')).toBeGreaterThan(at('.ka-composer'));
    expect(at('.ka-composer__disclaimer')).toBeGreaterThan(at('.ka-follow-ups'));
    // Last of what is on screen: only the screen-reader description, which
    // is out of flow, comes after it.
    const shown = [...area.children].filter((child) => !child.matches('.ds-sr-only'));
    expect(shown.at(-1)?.matches('.ka-composer__disclaimer')).toBe(true);
  });

  it('lar bunnteksten være forbeholdet alene', () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );

    const footer = document.querySelector('.ka-composer__disclaimer')!;
    expect(footer.textContent).toBe(DISCLAIMER);
  });

  it('reports every answer under its own message id', async () => {
    const reported: AnswerSources[] = [];
    render(
      <Shell onAnswerSources={(answer) => reported.push(answer)}>
        <ChatView client={clientYielding(sourcedAnswer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    await screen.findByRole('button', { name: 'Kopier svaret' });

    // One id all the way through, and the status travels with the sources:
    // an empty `documents` means four different things, and only the answer
    // knows which (#4, brukerreiser punkt 5).
    await waitFor(() => expect(reported.at(-1)?.status).toBe('complete'));
    const ids = new Set(reported.map((answer) => answer.messageId));
    expect(ids.size).toBe(1);
    expect(reported.at(0)).toMatchObject({ documents: [], status: 'streaming' });
    expect(reported.at(-1)?.documents).toHaveLength(1);
  });

  it('lar markørtallet fra en gjenopprettet tråd nå kildepanelet', async () => {
    /*
     * En samtale hentet tilbake fra live-backenden har svarteksten med
     * `[1]`–`[4]` i seg og ingen utdrag bak dem: backenden lagrer samtalen,
     * men ikke chunkene. Uten at tallet følger med hit sier panelet «Svaret
     * viser ikke til noen utdrag» ved siden av et svar som viser til fire,
     * og den nye tomtilstanden blir aldri tegnet. Målt i live-modus 2026-09-16.
     */
    const reported: AnswerSources[] = [];
    const restored: ThreadDetail = {
      ...threadWith('Hva er Norge kjent for?'),
      messages: [
        {
          id: 'u9',
          role: 'user',
          content: 'Hva er Norge kjent for?',
          createdAt: '2026-09-16T09:00:00Z',
          citations: [],
          status: 'complete',
        },
        {
          id: 'a9',
          role: 'assistant',
          content: 'Kysten [2]. Olje [3]. Vannkraft [4]. Navnet [1].',
          createdAt: '2026-09-16T09:00:01Z',
          // Tomme, fordi ingenting kunne løses opp mot utdrag.
          citations: [],
          citationCount: 4,
          status: 'complete',
        },
      ],
    };

    render(
      <Shell onAnswerSources={(answer) => reported.push(answer)}>
        <ChatView client={clientYielding([])} thread={restored} />
      </Shell>,
    );

    await waitFor(() => expect(reported.length).toBeGreaterThan(0));
    expect(reported.at(-1)).toMatchObject({
      messageId: 'a9',
      documents: [],
      status: 'complete',
      citationCount: 4,
    });
  });

  it('lar kildepanelet vite at kildene ikke ble lagret', async () => {
    // A thread read back through the BFF, which keeps no sources per message.
    const reported: AnswerSources[] = [];
    const restored: ThreadDetail = {
      ...threadWith('Hva er Norge kjent for?'),
      messages: [
        {
          id: 'u8',
          role: 'user',
          content: 'Hva er Norge kjent for?',
          createdAt: '2026-10-06T09:00:00Z',
          citations: [],
          status: 'complete',
        },
        {
          id: 'a8',
          role: 'assistant',
          content: 'Kysten, oljen og vannkraften.',
          createdAt: '2026-10-06T09:00:01Z',
          citations: [],
          citationCount: 0,
          sourcesNotStored: true,
          status: 'complete',
        },
      ],
    };

    render(
      <Shell onAnswerSources={(answer) => reported.push(answer)}>
        <ChatView client={clientYielding([])} thread={restored} />
      </Shell>,
    );

    await waitFor(() => expect(reported.length).toBeGreaterThan(0));
    expect(reported.at(-1)).toMatchObject({ messageId: 'a8', sourcesNotStored: true });
  });

  it('reports once per real change, not once per token', async () => {
    const reported: AnswerSources[] = [];
    const manyTokens: StreamEvent[] = [
      ...'ett to tre fire fem seks'
        .split(' ')
        .map((word): StreamEvent => ({ type: 'token', text: `${word} ` })),
      done,
    ];

    render(
      <Shell onAnswerSources={(answer) => reported.push(answer)}>
        <ChatView client={clientYielding(manyTokens)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    await screen.findByRole('button', { name: 'Kopier svaret' });

    // Six tokens, two states: writing, then finished. The shell is told
    // about the second, not about the words.
    await waitFor(() =>
      expect(reported.map((answer) => answer.status)).toEqual(['streaming', 'complete']),
    );
  });

  it('tells the shell which answer a marker sits in', async () => {
    const activated: [number, string | undefined][] = [];
    render(
      <Shell onCitation={(number, messageId) => activated.push([number, messageId])}>
        <ChatView client={clientYielding(sourcedAnswer)} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    const marker = await screen.findByRole('link', { name: /^Kilde 1:/u });
    fireEvent.click(marker);

    expect(activated).toHaveLength(1);
    const [number, messageId] = activated[0]!;
    expect(number).toBe(1);
    // Each answer numbers its excerpts from 1, so the number alone does not
    // say which excerpt.
    expect(messageId).toBeTruthy();
  });

  it('draws a stopped answer’s markers as text that says why', async () => {
    const asked: string[] = [];
    const client: ChatClient = {
      async *ask({ query, signal }: AskParams): AsyncIterable<StreamEvent> {
        asked.push(query);
        yield { type: 'token', text: 'Halve svaret med [1] i seg' };
        await new Promise<void>((resolve) => signal?.addEventListener('abort', () => resolve()));
        yield { type: 'error', error: { code: 'aborted', message: 'Svaret ble avbrutt.' } };
      },
      listThreads: async () => [],
      getThread: async () => null,
      listFacets: async () => [],
    };

    render(
      <Shell>
        <ChatView client={client} />
      </Shell>,
    );

    ask('Hva sier rapporten?');
    fireEvent.click(await screen.findByRole('button', { name: 'Avbryt genereringen' }));
    await screen.findByRole('button', { name: /Generer på nytt/u });

    // The marker was written; the excerpt was still on its way. A link to
    // nothing would be worse than no link.
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByTitle('Kilden kom ikke fram')).toBeTruthy();
  });
});

/** A client with the mock's three agents, writing down every question it is asked. */
function clientWithAgents(): { client: ChatClient; asked: AskParams[] } {
  const asked: AskParams[] = [];
  const base = clientYielding(answer);
  return {
    asked,
    client: {
      ...base,
      ask(params) {
        asked.push(params);
        return base.ask(params);
      },
      listAgents: async () => MOCK_AGENTS,
    },
  };
}

const agentButton = () => screen.getByRole('button', { name: /^Agent: / });

describe('ChatView og valget av agent', () => {
  it('viser standarden fra klienten, og sender ingen model uten valg', async () => {
    window.localStorage.removeItem(AGENT_STORAGE_KEY);
    const { client, asked } = clientWithAgents();
    render(
      <Shell>
        <ChatView client={client} />
      </Shell>,
    );

    await waitFor(() => expect(agentButton().textContent).toContain('agent-rag'));
    ask('Hva er måloppnåelse?');

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).not.toHaveProperty('model');
  });

  it('sender valgt agent med spørsmålet, og husker den til neste gang', async () => {
    window.localStorage.removeItem(AGENT_STORAGE_KEY);
    const { client, asked } = clientWithAgents();
    const { unmount } = render(
      <Shell>
        <ChatView client={client} />
      </Shell>,
    );

    await waitFor(() => expect(agentButton().textContent).toContain('agent-rag'));
    fireEvent.click(agentButton());
    fireEvent.click(screen.getByRole('button', { name: /^fact-checker/, hidden: true }));
    ask('Stemmer det at Nkom nådde målene?');

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]?.model).toBe('builtin.fact-checker-agent__fact-checker');
    expect(window.localStorage.getItem(AGENT_STORAGE_KEY)).toBe('builtin/fact-checker-agent');

    unmount();
    render(
      <Shell>
        <ChatView client={clientWithAgents().client} />
      </Shell>,
    );
    await waitFor(() => expect(agentButton().textContent).toContain('fact-checker'));
    window.localStorage.removeItem(AGENT_STORAGE_KEY);
  });

  it('glemmer valget når leseren går tilbake til standarden, så BFF-en bestemmer igjen', async () => {
    window.localStorage.setItem(AGENT_STORAGE_KEY, 'builtin/fact-checker-agent');
    const { client, asked } = clientWithAgents();
    render(
      <Shell>
        <ChatView client={client} />
      </Shell>,
    );

    await waitFor(() => expect(agentButton().textContent).toContain('fact-checker'));
    fireEvent.click(agentButton());
    fireEvent.click(screen.getByRole('button', { name: /^agent-rag/, hidden: true }));
    ask('Hva er måloppnåelse?');

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).not.toHaveProperty('model');
    expect(window.localStorage.getItem(AGENT_STORAGE_KEY)).toBeNull();
  });

  it('bruker standarden når den valgte agenten ikke finnes lenger', async () => {
    window.localStorage.setItem(AGENT_STORAGE_KEY, 'builtin/borte-agent');
    const { client, asked } = clientWithAgents();
    render(
      <Shell>
        <ChatView client={client} />
      </Shell>,
    );

    await waitFor(() => expect(agentButton().textContent).toContain('agent-rag'));
    ask('Hva er måloppnåelse?');

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).not.toHaveProperty('model');
    window.localStorage.removeItem(AGENT_STORAGE_KEY);
  });

  it('viser ikke valget når klienten ikke har noen liste', () => {
    render(
      <Shell>
        <ChatView client={clientYielding(answer)} />
      </Shell>,
    );
    expect(screen.queryByRole('button', { name: /^Agent: / })).toBeNull();
  });
});
