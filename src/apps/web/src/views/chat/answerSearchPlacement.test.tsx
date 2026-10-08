import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Message } from '../../model';
import { MessageList } from './MessageList';

/*
 * jsdom ruller ikke, så kallet det gjeldende treffet gjør for å komme fram
 * må gå et sted. At det ikke kaster er det testene her trenger.
 */
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

const answer = (id: string, content: string): Message => ({
  id,
  role: 'assistant',
  content,
  createdAt: '2026-09-15T09:00:00Z',
  citations: [],
  status: 'complete',
});

const question = (id: string, content: string): Message => ({
  id,
  role: 'user',
  content,
  createdAt: '2026-09-15T09:00:00Z',
  citations: [],
  status: 'complete',
});

function show(messages: Message[]) {
  return render(
    <MessageList messages={messages} onRegenerate={() => {}} onSelectSource={() => {}} />,
  );
}

const toggles = () => screen.getAllByRole('button', { name: 'Søk i svaret' });

describe('søkestripa hører til view-hodet, ikke til svarkortet', () => {
  it('tegner stripa i view-hode-plassen', () => {
    /*
     * Brukerblikk 3, funn 1: stripa lå nederst i svarkortet, kortet ruller, og
     * skrivefeltet er klebrig og ugjennomsiktig. Ett «Neste treff» og både
     * feltet og telleren lå bak skrivefeltet — leseren skrev i et felt hen
     * ikke så. Skallet eier en plass øverst i regionen for akkurat dette.
     *
     * Uten skall rundt seg tegner `ViewHead` hodet der det står, i en boks med
     * samme klasse. Det er den boksen som er påstanden her: stripa går gjennom
     * plassen, ikke ned i kortet.
     */
    const { container } = show([answer('a1', 'Nkom måler måloppnåelse.')]);

    fireEvent.click(toggles()[0]);

    const strip = container.querySelector('.ka-answer-search');
    expect(strip).not.toBeNull();
    expect(strip?.closest('.view-head')).not.toBeNull();
    expect(strip?.closest('.ka-answer-card')).toBeNull();
  });

  it('står først i viewet, så tabulatoren møter den før svaret', () => {
    // Nettopp fordi portalen sender hendelser langs React-treet mens
    // nettleseren tabulerer DOM-en: et hode skrevet først og tegnet først er
    // på samme plass begge veier.
    const { container } = show([answer('a1', 'Nkom måler måloppnåelse.')]);
    fireEvent.click(toggles()[0]);

    const strip = container.querySelector('.ka-answer-search')!;
    const card = container.querySelector('.ka-answer-card')!;
    expect(strip.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('lar bare ett svar søke om gangen', async () => {
    /*
     * Det følger av at plassen finnes én gang per region: to åpne søk ville
     * vært to hoder i én plass. Før flyttingen hadde hvert svar sitt eget, og
     * to kunne stå åpne samtidig.
     */
    show([
      question('u1', 'Første spørsmål'),
      answer('a1', 'Første svar om måloppnåelse.'),
      question('u2', 'Andre spørsmål'),
      answer('a2', 'Andre svar om måloppnåelse.'),
    ]);

    const knapper = screen.getAllByRole('button', { name: /^Søk i svar/u });
    expect(knapper).toHaveLength(2);

    fireEvent.click(knapper[0]);
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
    expect(knapper[0].getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(knapper[1]);
    await waitFor(() => expect(knapper[1].getAttribute('aria-expanded')).toBe('true'));
    // Fortsatt ett søkefelt, og det første svaret har sluppet taket.
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
    expect(knapper[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('sier hvilket svar den søker i når det finnes flere', () => {
    // Stripa er ikke lenger i kortet den søker i, så den må si hva den søker
    // i — som kildepanelets «Kilder til svar 1 av 2».
    show([
      question('u1', 'Første spørsmål'),
      answer('a1', 'Første svar.'),
      question('u2', 'Andre spørsmål'),
      answer('a2', 'Andre svar.'),
    ]);

    fireEvent.click(screen.getAllByRole('button', { name: /^Søk i svar/u })[1]);
    expect(screen.getByRole('searchbox', { name: 'Søk i svar 2 av 2' })).toBeTruthy();
  });

  it('sier bare «Søk i svaret» når det bare finnes ett', () => {
    show([answer('a1', 'Ett svar.')]);

    fireEvent.click(toggles()[0]);
    expect(screen.getByRole('searchbox', { name: 'Søk i svaret' })).toBeTruthy();
  });

  it('begynner på nytt når leseren bytter svar', async () => {
    // Én stripe, én spørring: å bære den forrige spørringen over til en annen
    // tekst ville vist treff leseren ikke har bedt om.
    show([
      question('u1', 'Første spørsmål'),
      answer('a1', 'Første svar om måloppnåelse.'),
      question('u2', 'Andre spørsmål'),
      answer('a2', 'Andre svar om måloppnåelse.'),
    ]);

    const feltverdi = () => (screen.getByRole('searchbox') as HTMLInputElement).value;

    const knapper = screen.getAllByRole('button', { name: /^Søk i svar/u });
    fireEvent.click(knapper[0]);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'måloppnåelse' } });
    await waitFor(() => expect(feltverdi()).toBe('måloppnåelse'));

    fireEvent.click(knapper[1]);
    await waitFor(() => expect(feltverdi()).toBe(''));
  });
});

describe('tabellen i svaret', () => {
  it('har ingen fokusring før den faktisk har fokus', () => {
    /*
     * Brukerblikk 3, funn 3: klassen var `ds-focus--visible`, den påtvungne
     * varianten, så hver eneste tabell i hvert eneste svar sto med en 3 px
     * ring hele tiden — verst i mørk modus, der den leste som en ramme ingen
     * hadde tegnet. `ds-focus` tegner den samme ringen på :focus-visible.
     */
    const { container } = show([
      answer('a1', ['| Tema | Verdi |', '| --- | --- |', '| Nye Altinn | Krav |'].join('\n')),
    ]);

    const table = container.querySelector('.markdown__table');
    expect(table).not.toBeNull();
    expect(table?.classList.contains('ds-focus')).toBe(true);
    expect(table?.classList.contains('ds-focus--visible')).toBe(false);
    // Boksen er fortsatt tastaturnåbar: den ruller, og en rullende boks må
    // kunne nås (WCAG 2.1.1).
    expect(table?.getAttribute('tabindex')).toBe('0');
  });
});
