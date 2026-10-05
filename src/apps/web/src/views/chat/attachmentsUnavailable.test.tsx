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
import { ATTACH_UNAVAILABLE_LABEL, uploadErrorText } from './attachmentText';
import { ChatView } from './ChatView';

/**
 * Skrivefeltet der tjenesten ikke har opplasting i det hele tatt.
 *
 * Egen fil fordi `vi.mock` heises til toppen av fila den står i, og resten av
 * vedleggstestene skal kjøre mot den ekte mock-klienten. Samme oppdeling som
 * `FiltersView.corpus.test.tsx`.
 *
 * `unavailable` er kjent før noen velger en fil — klienten vet at det ikke
 * finnes noe endepunkt (API-bestilling A3) — så feltet kan si det ærlig i
 * stedet for å ta imot en fil og avvise den et øyeblikk senere.
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
  it('sier hvorfor på knappen, før noen velger en fil', () => {
    /*
     * Grunnen står i navnet, ikke bak et klikk: en kontroll som tar imot en
     * fil og deretter sier at den ikke kan, har fått leseren til å gjøre
     * arbeid for ingenting (KA CC på #125). `aria-disabled` og ikke
     * `disabled`, så kontrollen er fortsatt nåbar og kan si det den sier.
     *
     * Setningen står nå PÅ knappen, slik Simen tegnet den (issue 79), og ikke
     * i et `aria-label`. Da er navnet det samme som teksten på skjermen, som
     * er det WCAG 2.5.3 ber om av en kontroll noen kan si høyt.
     */
    render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    const paperclip = screen.getByRole('button', { name: ATTACH_UNAVAILABLE_LABEL });
    expect(paperclip.getAttribute('aria-disabled')).toBe('true');
    expect(paperclip.getAttribute('aria-label')).toBeNull();
    expect(paperclip.textContent).toBe(ATTACH_UNAVAILABLE_LABEL);
  });

  it('holder setningen i en egen span, så en smal kolonne kan ta den av skjermen', () => {
    /*
     * Setningen er 334 px bred og brøt over tre–fire linjer på telefon, altså
     * 83 px av den klebrige bunnen på de skjermene som har minst av den (KA CC
     * på #195). Under 480 px boks tar CSS-en den av skjermen — og da må den
     * ligge i noe som kan skjules, mens navnet på knappen blir stående.
     */
    render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    const paperclip = screen.getByRole('button', { name: ATTACH_UNAVAILABLE_LABEL });
    const text = paperclip.querySelector('.ka-composer__attach-text');
    expect(text?.textContent).toBe(ATTACH_UNAVAILABLE_LABEL);
  });

  it('åpner ingen filvelger, og lager ingen chip', () => {
    upload.calls = 0;
    render(
      <Shell>
        <ChatView client={idleClient} />
      </Shell>,
    );

    fireEvent.click(screen.getByRole('button', { name: ATTACH_UNAVAILABLE_LABEL }));

    expect(screen.getByText(uploadErrorText('unavailable'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Fjern vedlegget/u })).toBeNull();
    expect(upload.calls).toBe(0);
  });
});
