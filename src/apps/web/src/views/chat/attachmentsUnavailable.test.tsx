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
import { uploadErrorText } from './attachmentText';
import { ChatView } from './ChatView';

/**
 * Skrivefeltet der tjenesten ikke har opplasting i det hele tatt.
 *
 * Egen fil fordi `vi.mock` heises til toppen av fila den står i, og resten av
 * vedleggstestene skal kjøre mot den ekte mock-klienten. Samme oppdeling som
 * `FiltersView.corpus.test.tsx`.
 *
 * `unavailable` er kjent før noen velger en fil — klienten vet at det ikke
 * finnes noe endepunkt (API-bestilling A3). Bak BFF-en er det tilstanden som
 * gjelder, for den har ingen rute for opplasting, og da tegnes binderset
 * ikke i det hele tatt (anmeldelsen av #129).
 *
 * Det var en annen avgjørelse før: binderset sto med «Snart kan du laste opp
 * dokumenter her» på seg, fordi en kontroll som er på vei er verdt å vite om
 * (issue 79). Den er snudd. Et løfte som har stått i produksjon siden
 * september er ikke lenger en nyhet, og plassen det tar i den klebrige
 * bunnen er plass leseren kunne lest svaret i.
 *
 * Å slippe en fil på feltet er fortsatt ærlig avvist: det er det ene stedet
 * en leser kan prøve uten at noe inviterte til det.
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
        <CitationContext value={{ activeCitation: undefined, showCitation: () => {} }}>
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
  it('tegner ingen binders, og ingen filvelger', () => {
    const { container } = render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    expect(container.querySelector('.ka-composer__attach')).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /vedlegg|last opp|binders/iu })).toBeNull();
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
});
