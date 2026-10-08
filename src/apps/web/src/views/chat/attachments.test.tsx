import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AskParams, ChatClient } from '../../api';
import { resetUserDocumentsForTest } from '../../api/userDocuments';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { FilterContext } from '../../layout/filterContext';
import { MainScrollContext } from '../../layout/scrollContext';
import { ThreadContext } from '../../layout/threadContext';
import { emptyFilterSelection, threadFromQuestion, type StreamEvent } from '../../model';
import { WAIT_FOR_UPLOADS, uploadErrorText } from './attachmentText';
import { ChatView } from './ChatView';

/**
 * Vedlegg i skrivefeltet (rolle-3l).
 *
 * Kjører mot den ekte mock-opplastingsklienten, ikke mot en stand-in: hele
 * poenget er at chipen følger dokumentet fra 0 % til klart eller mislykket, og
 * en klient som svarer med én gang tester ikke den veien i det hele tatt.
 * Mocken bruker 1,5 s på en fil, så ventetidene her er romslige med vilje.
 */

const asked: AskParams[] = [];

function client(events: StreamEvent[] = []): ChatClient {
  return {
    async *ask(params) {
      asked.push(params);
      for (const event of events) yield event;
    },
    listThreads: async () => [],
    getThread: async () => null,
    listFacets: async () => [],
  };
}

const answer: StreamEvent[] = [
  { type: 'token', text: 'Svaret.' },
  { type: 'done', messageId: 'm1', conversationId: 'c1' },
];

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

function show(events: StreamEvent[] = []) {
  return render(
    <Shell>
      <ChatView client={client(events)} />
    </Shell>,
  );
}

const file = (name: string, size = 1024) => {
  const made = new File(['x'], name, { type: 'application/pdf' });
  Object.defineProperty(made, 'size', { value: size });
  return made;
};

function pick(...files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files } });
}

const field = () => screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' });
/* `toBeDisabled` er jest-dom, som dette repoet ikke bruker. */
const sendButton = () =>
  screen.getByRole('button', { name: 'Send spørsmålet' }) as HTMLButtonElement;
const chipText = () =>
  screen
    .getAllByRole('button', { name: /Fjern vedlegget/u })
    .map((chip) => chip.textContent ?? '')
    .join(' ');
/** Klar = ingen chip sier prosent lenger. */
const waitForReady = () => waitFor(() => expect(chipText()).not.toMatch(/%/u), { timeout: 8000 });

function ask(question: string) {
  fireEvent.change(field(), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Send spørsmålet' }));
}

beforeEach(() => {
  asked.length = 0;
  localStorage.clear();
  resetUserDocumentsForTest();
});

afterEach(() => {
  localStorage.clear();
  resetUserDocumentsForTest();
});

describe('vedlegg i skrivefeltet', { timeout: 20000 }, () => {
  it('legger ved en fil, fra laster opp til klar', async () => {
    show();

    pick(file('rapport.pdf'));

    // Chipen er der med en gang, før filen er ferdig: en leser som nettopp
    // valgte en fil skal se at noe skjedde. Prosenten er hvordan den sier at
    // den holder på.
    const chip = () => screen.getByRole('button', { name: /Fjern vedlegget rapport\.pdf/u });
    expect(chip().textContent).toMatch(/%/u);

    // Og den slutter å si det når filen er klar.
    await waitFor(() => expect(chip().textContent).not.toMatch(/%/u), { timeout: 8000 });
    expect(chip().textContent).toContain('rapport.pdf');
  });

  it('sender ikke med Enter mens en fil er på vei, og sier hvorfor', async () => {
    /*
     * Vakta lå på send-knappens `disabled` alene, og Enter gikk rett forbi:
     * spørsmålet gikk, filen som fortsatt lastet opp gjorde ikke, og
     * ingenting sa fra (KA CC på #125). Det er nettopp det stille tapet
     * regelen finnes for, gjennom døra regelen ikke sto ved.
     */
    show(answer);
    fireEvent.change(field(), { target: { value: 'Hva står i rapporten?' } });
    pick(file('rapport.pdf'));

    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(asked).toHaveLength(0);
    expect(screen.getByText(WAIT_FOR_UPLOADS)).toBeTruthy();

    // Og når filen er klar, går den samme tasten gjennom.
    await waitForReady();
    fireEvent.keyDown(field(), { key: 'Enter' });
    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0].attachments).toHaveLength(1);
  });

  it('tar vente-beskjeden bort når det ikke er noe å vente på lenger', async () => {
    /*
     * Et avslag overlever grunnen sin hvis ingen tar det bort: det sto i
     * live-området seks sekunder etter at opplastingen var ferdig, og ba
     * leseren vente på en fil som var klar (KA CC på #125, runde 2).
     *
     * Og ingenting sendes av seg selv når ventinga er over — leseren trykker
     * igjen. Et spørsmål som drar av gårde på egen hånd er et spørsmål ingen
     * valgte å sende akkurat da.
     */
    show(answer);
    fireEvent.change(field(), { target: { value: 'Hva står i rapporten?' } });
    pick(file('rapport.pdf'));

    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(screen.getByText(WAIT_FOR_UPLOADS)).toBeTruthy();

    await waitForReady();

    await waitFor(() => expect(screen.queryByText(WAIT_FOR_UPLOADS)).toBeNull());
    // Og spørsmålet står fortsatt uskrevet i feltet: det gikk ikke av seg selv.
    expect(asked).toHaveLength(0);
    expect((field() as HTMLTextAreaElement).value).toBe('Hva står i rapporten?');
  });

  it('sender ikke med knappen heller mens en fil er på vei', async () => {
    show(answer);
    fireEvent.change(field(), { target: { value: 'Hva står i rapporten?' } });
    pick(file('rapport.pdf'));

    fireEvent.click(sendButton());

    expect(asked).toHaveLength(0);
    expect(screen.getByText(WAIT_FOR_UPLOADS)).toBeTruthy();

    await waitForReady();
  });

  it('gir fokus tilbake til skrivefeltet når et vedlegg fjernes', async () => {
    /*
     * Chipen er en knapp, og den forsvinner i det den trykkes. En kontroll
     * som blir borte uten å si hvor fokus skal, slipper tastaturet ned på
     * body, øverst i dokumentet (WCAG 2.4.3).
     */
    show();
    pick(file('rapport.pdf'));

    const chip = screen.getByRole('button', { name: /Fjern vedlegget rapport\.pdf/u });
    chip.focus();
    fireEvent.click(chip);

    expect(document.activeElement).toBe(field());
  });

  it('gir fokus tilbake til skrivefeltet når et vedlegg prøves på nytt', async () => {
    // Samme sak: «Prøv igjen» er borte i det filen går tilbake til å laste
    // opp, så knappen som ble trykket finnes ikke lenger.
    show();
    pick(file('feil-rapport.pdf'));

    const retry = await screen.findByRole(
      'button',
      { name: /Prøv å laste opp feil-rapport\.pdf på nytt/u },
      { timeout: 8000 },
    );
    retry.focus();
    fireEvent.click(retry);

    expect(document.activeElement).toBe(field());
  });

  it('annonserer start og ferdig, ikke hvert prosentsteg', async () => {
    /*
     * Atten setninger for én fil på halvannet sekund, og den siste av dem
     * var «0 %»: mellom at lageret bytter den ventende raden mot det ferdige
     * dokumentet og at slottet får vite om det, finnes det en render uten
     * noen rad å lese et tall fra (KA CC på #125).
     */
    const { container } = show();
    const region = () => container.querySelector('[aria-live="polite"]')!;

    pick(file('rapport.pdf'));
    const heard: string[] = [];
    await waitFor(() => expect(region().textContent).toContain('Laster opp'), { timeout: 8000 });
    heard.push(region().textContent ?? '');

    await waitFor(() => expect(region().textContent).toContain('lastet opp og lagt ved'), {
      timeout: 8000,
    });
    heard.push(region().textContent ?? '');

    expect(heard[0]).toBe('Laster opp rapport.pdf.');
    expect(heard.join(' ')).not.toMatch(/%/u);
  });

  it('sender id-ene med spørsmålet, og navnene står på meldingen', async () => {
    show(answer);

    pick(file('rapport.pdf'));
    fireEvent.change(field(), { target: { value: 'Hva står i rapporten?' } });
    await waitForReady();

    ask('Hva står i rapporten?');

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0].attachments).toHaveLength(1);
    expect(screen.getByText('Med vedlegg: rapport.pdf')).toBeTruthy();
  });

  it('tømmer vedleggene når spørsmålet er sendt', async () => {
    show(answer);

    pick(file('rapport.pdf'));
    fireEvent.change(field(), { target: { value: 'Hva står i rapporten?' } });
    await waitForReady();
    ask('Hva står i rapporten?');

    // Chipen hører til spørsmålet som ble skrevet, ikke til det neste.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Fjern vedlegget/u })).toBeNull(),
    );
  });

  it('sier hvorfor en fil ble avvist, og tilbyr å prøve igjen', async () => {
    // Mocken lar en fil som heter «feil…» mislykkes, så feilstien kan nås på
    // bestilling i stedet for å kreve en 21 MB PDF.
    show();

    pick(file('feil-rapport.pdf'));

    await waitFor(() => expect(screen.getByText(uploadErrorText('failed'))).toBeTruthy(), {
      timeout: 6000,
    });
    expect(
      screen.getByRole('button', { name: /Prøv å laste opp feil-rapport\.pdf på nytt/u }),
    ).toBeTruthy();
  });

  it('sender ikke en fil som mislyktes', async () => {
    show(answer);

    pick(file('feil-rapport.pdf'));
    await waitFor(() => expect(screen.getByText(uploadErrorText('failed'))).toBeTruthy(), {
      timeout: 6000,
    });

    ask('Hva står i rapporten?');
    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0].attachments).toBeUndefined();
    expect(screen.queryByText(/Med vedlegg/u)).toBeNull();
  });

  it('avviser en filtype vi ikke tar, uten å spørre klienten', async () => {
    show();

    pick(file('bilde.png'));

    // Med en gang, ikke etter halvannet sekund: vi vet svaret uten å prøve.
    expect(screen.getByText(uploadErrorText('wrong-type'))).toBeTruthy();
    // Og ingen vei videre, for filen er den samme neste gang.
    expect(screen.queryByRole('button', { name: /Prøv å laste opp/u })).toBeNull();
  });

  it('lar leseren ta et vedlegg av igjen', async () => {
    show();

    pick(file('rapport.pdf'));
    const chip = screen.getByRole('button', { name: /Fjern vedlegget rapport\.pdf/u });
    fireEvent.click(chip);

    expect(screen.queryByRole('button', { name: /Fjern vedlegget/u })).toBeNull();
  });

  it('tar imot flere filer om gangen', async () => {
    show();

    pick(file('en.pdf'), file('to.pdf'));

    expect(screen.getAllByRole('button', { name: /Fjern vedlegget/u })).toHaveLength(2);
  });
});
