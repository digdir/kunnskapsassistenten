import { render, screen, waitFor } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { ChatClient } from '../../api';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { FilterContext } from '../../layout/filterContext';
import { MainScrollContext } from '../../layout/scrollContext';
import { ThreadContext } from '../../layout/threadContext';
import {
  emptyFilterSelection,
  threadFromQuestion,
  type Message,
  type ThreadDetail,
} from '../../model';
import { ChatView } from './ChatView';

/*
 * Designsystemet sin Skeleton spør document.getAnimations, som jsdom ikke
 * har. Samme grep som i ChatView.test.tsx.
 */
if (typeof document.getAnimations !== 'function') {
  document.getAnimations = () => [];
}

/**
 * En tråd som lastes møter ikke leseren med forsidens hilsen
 * (brukerblikk 8, funn 2).
 *
 * Hilsenen og de tre forslagene er starten på en ny samtale. Sto de på
 * `/threads/<id>`, ble leseren budt velkommen til å begynne på noe de alt
 * hadde valgt — mens filterpanelet ved siden av sa at det lastet.
 */
const message = (id: string, role: 'user' | 'assistant', content: string): Message => ({
  id,
  role,
  content,
  createdAt: '2026-09-23T09:00:00.000Z',
  citations: [],
  status: 'complete',
});

const thread: ThreadDetail = {
  id: 'nkom-maaloppnaaelse',
  title: 'NKOM måloppnåelse',
  createdAt: '2026-09-23T09:00:00.000Z',
  updatedAt: '2026-09-23T09:00:00.000Z',
  messages: [
    message('m1', 'user', 'Hva står i årsrapporten?'),
    message('m2', 'assistant', 'Årsrapporten oppsummerer virksomheten.'),
  ],
};

/** Nothing is asked in these tests; the client is here so none is invented. */
const idleClient: ChatClient = {
  async *ask() {},
  listThreads: async () => [],
  getThread: async () => null,
  listFacets: async () => [],
};

/** The pieces of the shell the chat view reads. Same set as ChatView.test.tsx. */
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

function show(props: Parameters<typeof ChatView>[0]) {
  return render(
    <Shell>
      <ChatView {...props} client={idleClient} />
    </Shell>,
  );
}

const greeting = () => screen.queryByText(/Hva lurer du på\?/u);

describe('hovedkolonnen mens tråden hentes', () => {
  it('sier at samtalen hentes, i stedet for å hilse på nytt', async () => {
    show({ loading: true, userName: 'Simen' });

    expect(await screen.findByText('Henter samtalen')).toBeTruthy();
    expect(greeting()).toBeNull();
    // Forslagene er et tilbud om å begynne på noe annet enn det leseren valgte.
    expect(screen.queryByRole('heading', { name: 'Forslag' })).toBeNull();
  });

  it('sier det gjennom området som alt står i sida, ikke i et nytt', async () => {
    /*
     * Et live-område som kommer MED teksten sin er et område skjermleseren
     * ikke har noen endring å melde om — det ble satt inn, ikke endret. Det
     * polite området nederst i viewet er montert og tomt fra første render,
     * så der er ordene en endring (KA CC på #156).
     */
    show({ loading: true });

    const politt = document.querySelector('[aria-live="polite"]');
    // Tomt i første commit: det er nettopp derfor ordene er en endring.
    expect(politt?.textContent).toBe('');
    await waitFor(() => expect(politt?.textContent).toBe('Henter samtalen'));
    // Og ingen andre områder som sier det samme: <output> er role="status".
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });

  it('lar skrivefeltet stå, så spørsmålet i gapet fortsatt kan stilles', () => {
    show({ loading: true });

    expect(screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' })).toBeTruthy();
  });

  it('hilser fortsatt på en forside uten adresse', () => {
    show({ userName: 'Simen' });

    expect(greeting()).toBeTruthy();
    expect(screen.queryByText('Henter samtalen')).toBeNull();
  });

  it('viser samtalen når den har landet', () => {
    show({ loading: false, thread });

    expect(screen.getByText('Hva står i årsrapporten?')).toBeTruthy();
    expect(screen.queryByText('Henter samtalen')).toBeNull();
    expect(greeting()).toBeNull();
  });

  it('lar det leseren har rukket å spørre om stå, også mens tråden lastes', () => {
    /*
     * Rekkefølgen mellom de to tilstandene: en tur som alt er på skjermen
     * (#149) skal ikke dekkes av skjeletter mens eldre meldinger hentes.
     * Leserens egne ord er det ferskeste på sida.
     */
    show({
      loading: true,
      thread: { ...thread, messages: [message('m9', 'user', 'Hva med DSS?')] },
    });

    expect(screen.getByText('Hva med DSS?')).toBeTruthy();
    expect(screen.queryByText('Henter samtalen')).toBeNull();
  });
});
