import { Button, Heading } from '@digdir/designsystemet-react';
import { useRef, useState } from 'react';
import type { ChatClient } from '../../../api';
import { fixtures, MockChatClient } from '../../../api/mock';
import type { FilterFacet, StreamEvent, Thread, ThreadDetail } from '../../../model';
import { LayoutProvider } from '../../../layout/LayoutProvider';
import { MainScrollContext } from '../../../layout/scrollContext';
import { ChatView } from '../ChatView';

/** A harness for the chat view, for development only, so it can be looked at
   without mounting the shell. The production build never sees it: `vite
   build` follows index.html alone. */

/** A client that fails, so the error state can be looked at. */
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
            <ChatView client={scenario.client} key={id} thread={scenario.thread} userName="Ola" />
          </main>
        </div>
      </MainScrollContext>
    </LayoutProvider>
  );
}
