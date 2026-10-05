import { Button, Heading } from '@digdir/designsystemet-react';
import { useRef, useState } from 'react';
import type { ChatClient } from '../../../api';
import { fixtures, MockChatClient } from '../../../api/mock';
import type { FilterFacet, StreamEvent, Thread, ThreadDetail } from '../../../model';
import { LayoutProvider } from '../../../layout/LayoutProvider';
import { MainScrollContext } from '../../../layout/scrollContext';
import { ChatView } from '../ChatView';

/**
 * A harness for the chat view, for development only.
 *
 * It exists because the routes and the shell belong to the foundation, and a
 * view cannot be looked at until someone mounts it. Vite's dev server serves
 * any HTML file by path, so this one is reachable at
 * /src/views/chat/preview/index.html without touching anyone else's files,
 * and the production build never sees it: `vite build` only follows
 * index.html.
 *
 * It is also what the accessibility snapshot is taken against.
 */

/** A client that fails, so the error state can be looked at (answer 35). */
const failingClient: ChatClient = {
  async *ask(): AsyncIterable<StreamEvent> {
    await new Promise((resolve) => setTimeout(resolve, 600));
    yield {
      type: 'error',
      error: { code: 'model-unavailable' },
    };
  },
  listThreads: async (): Promise<Thread[]> => [],
  getThread: async (): Promise<ThreadDetail | null> => null,
  listFacets: async (): Promise<FilterFacet[]> => [],
};

const fastMock = new MockChatClient({ thinkingStepMs: 120, firstTokenMs: 250, tokenMs: 6 });
/** Slow enough that the skeleton, the caret and the stop button can be looked at. */
const slowMock = new MockChatClient({ thinkingStepMs: 900, firstTokenMs: 2500, tokenMs: 60 });

const scenarios = {
  tom: {
    label: 'Tom tilstand',
    client: fastMock,
    thread: undefined,
  },
  svar: {
    label: 'Ferdig svar',
    client: fastMock,
    thread: fixtures.findThread('nkom-maaloppnaaelse') ?? undefined,
  },
  sakte: {
    label: 'Sakte strømming',
    client: slowMock,
    thread: undefined,
  },
  feil: {
    label: 'Feiltilstand',
    client: failingClient,
    thread: undefined,
  },
} as const;

type ScenarioId = keyof typeof scenarios;

export function Preview() {
  const [id, setId] = useState<ScenarioId>('tom');
  const scenario = scenarios[id];
  // The shell normally provides this; here the harness plays the shell.
  const mainScroll = useRef<HTMLElement | null>(null);

  return (
    <LayoutProvider>
      <MainScrollContext value={mainScroll}>
        <div className="shell">
          <nav aria-label="Forhåndsvisninger" className="primary-sidebar">
            <div className="stack">
              <Heading data-size="xs" level={2}>
                Forhåndsvisning
              </Heading>
              {(Object.keys(scenarios) as ScenarioId[]).map((key) => (
                <Button
                  aria-current={key === id ? 'true' : undefined}
                  data-color="neutral"
                  key={key}
                  onClick={() => setId(key)}
                  variant={key === id ? 'secondary' : 'tertiary'}
                >
                  {scenarios[key].label}
                </Button>
              ))}
            </div>
          </nav>

          <main className="main" id="main-content" ref={mainScroll}>
            <ChatView client={scenario.client} key={id} thread={scenario.thread} userName="Simen" />
          </main>
        </div>
      </MainScrollContext>
    </LayoutProvider>
  );
}
