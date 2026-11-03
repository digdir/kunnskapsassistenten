import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { ChatClient } from '../../api';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { FilterContext } from '../../layout/filterContext';
import { MainScrollContext } from '../../layout/scrollContext';
import { ThreadContext } from '../../layout/threadContext';
import { emptyFilterSelection, threadFromQuestion } from '../../model';
import { ATTACH_SOON, ATTACH_SOON_LABEL, DROP_HINT, uploadErrorText } from './attachmentText';
import { ChatView } from './ChatView';

/**
 * Skrivefeltet der tjenesten ikke har opplasting i det hele tatt. Det er
 * tilstanden i alle modusene en leser møter: ingen backend har et endepunkt,
 * og klienten vet det før noen velger en fil (API-bestilling A3).
 *
 * Egen fil fordi `vi.mock` heises til toppen av fila den står i, og resten av
 * vedleggstestene skal kjøre mot den ekte mock-klienten. Samme oppdeling som
 * `FiltersView.corpus.test.tsx`.
 *
 * Binderset tegnes avslått med «Kommer snart» i stedet for å være borte, så
 * leseren ser at det kommer og ikke at det mangler. Én tilstand styrer både
 * knappen og slippet: det som ikke kan legges ved med knappen, kan ikke
 * legges ved ved å slippes heller.
 */
const upload = vi.hoisted(() => ({ calls: 0 }));

vi.mock('../../layout/useUserDocuments', () => ({
  useUserDocuments: () => ({
    documents: [],
    ready: [],
    uploading: false,
    unavailable: 'unavailable' as const,
    upload: async () => {
      upload.calls += 1;
      throw new Error('skal ikke kalles');
    },
    remove: async () => {},
  }),
}));

const idleClient: ChatClient = {
  // oxlint-disable-next-line require-yield
  async *ask() {
    throw new Error('ikke spurt');
  },
  listThreads: async () => [],
  getThread: async () => null,
  listFacets: async () => [],
};

function Shell({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return (
    <MemoryRouter>
      <MainScrollContext value={scrollRef}>
        <CitationContext
          value={{ activeCitation: undefined, showCitation: () => {}, showDocument: () => {} }}
        >
          <AnswerSourcesContext value={inertAnswerSources}>
            <ThreadContext value={{ startThread: (question) => threadFromQuestion(question) }}>
              <FilterContext value={{ selection: emptyFilterSelection, setSelection: () => {} }}>
                {children}
              </FilterContext>
            </ThreadContext>
          </AnswerSourcesContext>
        </CitationContext>
      </MainScrollContext>
    </MemoryRouter>
  );
}

describe('vedlegg der tjenesten ikke har opplasting', () => {
  it('tegner binderset avslått, med ordene på seg', () => {
    render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    const attach = screen.getByRole('button', { name: ATTACH_SOON_LABEL });
    expect(attach.classList.contains('ka-composer__attach')).toBe(true);
    // `aria-disabled` og ikke `disabled`: knappen blir stående i
    // tabrekkefølgen, så den som bruker tastatur eller skjermleser møter den
    // og får vite at den ikke virker ennå.
    expect(attach.getAttribute('aria-disabled')).toBe('true');
    expect(attach.hasAttribute('disabled')).toBe(false);
    expect(attach.textContent).toContain(ATTACH_SOON);
    // Navnet rommer de synlige ordene (WCAG 2.5.3).
    expect(ATTACH_SOON_LABEL.toLowerCase()).toContain(ATTACH_SOON.toLowerCase());
  });

  it('har ingen filvelger bak den avslåtte knappen', () => {
    const { container } = render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    expect(container.querySelector('input[type="file"]')).toBeNull();

    // Et klikk har ingenting å åpne, og skal ikke be om en opplasting heller.
    upload.calls = 0;
    fireEvent.click(screen.getByRole('button', { name: ATTACH_SOON_LABEL }));
    expect(upload.calls).toBe(0);
    expect(screen.queryByRole('button', { name: /Fjern vedlegget/u })).toBeNull();
  });

  it('lar resten av raden stå', () => {
    render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    expect(screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Send/u })).toBeTruthy();
  });

  it('avviser en fil som slippes på feltet, og lager ingen chip', () => {
    upload.calls = 0;
    const { container } = render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    const frame = container.querySelector('.ka-composer')!;
    const file = new File(['innhold'], 'rapport.pdf', { type: 'application/pdf' });
    fireEvent.drop(frame, {
      dataTransfer: { files: [file], types: ['Files'] },
    });

    expect(screen.getByText(uploadErrorText('unavailable'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Fjern vedlegget/u })).toBeNull();
    expect(upload.calls).toBe(0);
  });

  it('lover ikke et vedlegg mens filen dras over feltet', () => {
    const { container } = render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    const frame = container.querySelector('.ka-composer')!;
    fireEvent.dragEnter(frame, { dataTransfer: { files: [], types: ['Files'] } });

    // Rammen lyser opp, så leseren ser at filen er sett, men setningen om at
    // den blir lagt ved står ikke der: slippet under den avviser.
    expect(frame.getAttribute('data-dragging')).toBe('true');
    expect(screen.queryByText(DROP_HINT)).toBeNull();
  });
});
