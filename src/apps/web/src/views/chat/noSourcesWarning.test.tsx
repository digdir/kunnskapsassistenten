import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ChatClient } from '../../api';
import { threadDetailFromBff } from '../../api/bff/mapping';
import { messagesFromApi } from '../../api/live/conversations';
import type { Message, SourceDocument, StreamEvent } from '../../model';
import { MessageList } from './MessageList';
import { NO_HITS_FILTERED, NO_HITS_WHOLE_CORPUS, NO_SOURCES_WARNING } from './text';
import { useChat } from './useChat';

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

const document: SourceDocument = {
  id: 'doc-1',
  title: 'Årsrapport 2024',
  excerpts: [{ id: 'doc-1-1', text: 'Et utdrag.', relevance: 'high', citationNumber: 1 }],
};

const answer: Message = {
  id: 'a1',
  role: 'assistant',
  content: 'Nkom måler måloppnåelse mot målene i tildelingsbrevet.',
  createdAt: '2026-10-06T09:00:00Z',
  citations: [],
  status: 'complete',
};

function show(message: Message) {
  return render(
    <MessageList
      foundNothing={() => false}
      messages={[message]}
      onRegenerate={() => {}}
      onSelectSource={() => {}}
    />,
  );
}

function warning() {
  return screen.queryByText(NO_SOURCES_WARNING);
}

describe('advarselen når svaret ikke har kilder', () => {
  it('er den korte linja', () => {
    expect(NO_SOURCES_WARNING).toBe(
      'Svaret har ingen kilder. Kontroller det mot originaldokumentene før du bruker det.',
    );
  });

  it('står i svarkortet, over svaret, som én linje med et info-ikon og uten boks', () => {
    const { container } = show({ ...answer, sources: [] });

    const line = warning();
    expect(line?.tagName).toBe('P');
    expect(line?.classList.contains('ka-no-sources-note')).toBe(true);
    expect(line?.closest('.ka-answer-card')).toBeTruthy();
    // The icon is decoration: the sentence says it all.
    const icon = line?.querySelector('svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.classList.contains('ka-no-sources-note__icon')).toBe(true);
    // No box: neither the yellow alert from before nor any other.
    expect(container.querySelector('.ds-alert')).toBeNull();
    // Before the answer in the reading order.
    const text = screen.getByText(answer.content);
    expect(line!.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('står også når kildene aldri kom, ikke bare når de kom tomme', () => {
    show(answer);
    expect(warning()).toBeTruthy();
  });

  it('står ikke under et svar med kilder', () => {
    show({ ...answer, sources: [document] });
    expect(warning()).toBeNull();
  });

  it('står ikke når svaret viser til utdrag som ikke ble lagret', () => {
    // Read back from a store that keeps the text and not the chunks: the
    // markers are on screen, and the sources panel says they were not stored.
    show({ ...answer, content: 'Målene står i tildelingsbrevet [1][2].', citationCount: 2 });
    expect(warning()).toBeNull();
  });

  it('står ikke før svaret er ferdig, eller når det ikke ble et svar', () => {
    for (const status of ['streaming', 'aborted', 'error', 'needs-clarification'] as const) {
      const { unmount } = show({ ...answer, status });
      expect(warning(), status).toBeNull();
      unmount();
    }
  });

  it('står ikke over klientens egen melding om at søket ikke fant noe', () => {
    // That message is not an answer to check against the documents: it says
    // nothing was found, and the warning would say the same thing again.
    for (const content of [NO_HITS_WHOLE_CORPUS, NO_HITS_FILTERED]) {
      const { unmount } = show({ ...answer, content, sources: [] });
      expect(warning()).toBeNull();
      unmount();
    }
  });

  it('står etter ny innlasting fra live', () => {
    const [, restored] = messagesFromApi([
      { id: 'q', role: 'user', text: 'Hva er måloppnåelse?', created: 1 },
      { id: 'a', role: 'assistant', text: answer.content, created: 2 },
    ]);
    show(restored as Message);
    expect(warning()).toBeTruthy();
  });

  it('står ikke etter ny innlasting når svaret har markører og kildene ikke er lagret', () => {
    const [, restored] = messagesFromApi([
      { id: 'q', role: 'user', text: 'Hva er måloppnåelse?', created: 1 },
      { id: 'a', role: 'assistant', text: 'Målene står i tildelingsbrevet [1].', created: 2 },
    ]);
    show(restored as Message);
    expect(warning()).toBeNull();
  });
});

describe('advarselen etter ny innlasting fra bff', () => {
  it('står ikke over et svar BFF-en ikke tok vare på kildene til', () => {
    // Measured 06.10 against the BFF on :8791: the second of three answers
    // had sources and no markers, and after a reload it was told it had none.
    const thread = threadDetailFromBff({
      conversation: { id: 'c1', topic: 'Første', created: 1 },
      messages: [
        { id: 'q1', role: 'user', text: 'Første', created: 1 },
        { id: 'a1', role: 'assistant', text: 'Et svar med kilder [1][2].', created: 2 },
        { id: 'q2', role: 'user', text: 'Andre', created: 3 },
        { id: 'a2', role: 'assistant', text: 'Et svar med kilder og uten markører.', created: 4 },
        { id: 'q3', role: 'user', text: 'Tredje', created: 5 },
        { id: 'a3', role: 'assistant', text: 'Det siste svaret.', created: 6 },
      ],
      sources: [
        { docNum: '1', title: 'Årsrapport', url: '', marker: 1, chunkId: 'a', excerpt: 'x' },
      ],
    });

    render(
      <MessageList
        foundNothing={() => false}
        messages={thread.messages}
        onRegenerate={() => {}}
        onSelectSource={() => {}}
      />,
    );
    expect(warning()).toBeNull();
  });

  it('står ikke over et svar som ble lest tilbake uten noe BFF-en husket', () => {
    // After a restart of the BFF, or for a thread that never had sources:
    // from here the two look the same, so nothing is claimed.
    const thread = threadDetailFromBff({
      conversation: { id: 'c1', topic: 'Første', created: 1 },
      messages: [
        { id: 'q1', role: 'user', text: 'Hva er 17 ganger 23?', created: 1 },
        { id: 'a1', role: 'assistant', text: '17 × 23 = 391.', created: 2 },
      ],
      sources: [],
    });

    show(thread.messages[1] as Message);
    expect(warning()).toBeNull();
  });
});

/** A client that streams the given frames for any question. */
function scriptedClient(frames: StreamEvent[]): ChatClient {
  return {
    async *ask() {
      yield* frames;
    },
    listThreads: async () => [],
    getThread: async () => null,
    listFacets: async () => [],
  };
}

describe('det skjermleseren hører når svaret er ferdig', () => {
  it('sier fra om advarselen når svaret ikke har kilder', async () => {
    const client = scriptedClient([
      { type: 'token', text: 'Svaret.' },
      {
        type: 'sources',
        documents: [],
        citations: [],
        retrieval: { hitCount: 0, documentCount: 0, keywords: [] },
      },
      { type: 'done', messageId: 'm1', conversationId: 'c1' },
    ]);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.announcement).toBe(`Svaret er ferdig. ${NO_SOURCES_WARNING}`);
  });

  it('sier bare at svaret er ferdig når det har kilder', async () => {
    const client = scriptedClient([
      { type: 'token', text: 'Svaret [1].' },
      {
        type: 'sources',
        documents: [document],
        citations: [],
        retrieval: { hitCount: 1, documentCount: 1, keywords: [] },
      },
      { type: 'done', messageId: 'm1', conversationId: 'c1' },
    ]);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.announcement).toBe('Svaret er ferdig.');
  });
});
