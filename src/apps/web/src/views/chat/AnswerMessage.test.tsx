import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Message } from '../../model';
import { MessageList } from './MessageList';
import { CLOSING_QUESTION } from './text';

/*
 * jsdom lays nothing out and has no scrolling, so the call the current hit
 * makes to bring itself into view has to go somewhere. What it does is not
 * what these tests are about; that it does not throw is.
 */
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

const answer: Message = {
  id: 'a1',
  role: 'assistant',
  content: [
    '### Måloppnåelse i Nkom',
    '',
    'Nkom måler måloppnåelse mot målene i tildelingsbrevet.',
    '',
    'Andre avsnitt uten det ordet.',
  ].join('\n'),
  createdAt: '2026-09-15T09:00:00Z',
  citations: [],
  status: 'complete',
};

/*
 * Gjennom `MessageList`, fordi det er der søket bor nå. Stripa tegnes i
 * skallets view-hode og det finnes ett per region, så hvilket svar som søkes
 * er en opplysning om samtalen og ikke om det enkelte svaret. Å rendre
 * `AnswerMessage` alene her ville testet en knapp uten noe bak seg.
 */
function show(message: Message = answer, foundNothing?: boolean) {
  return render(
    <MessageList
      foundNothing={() => foundNothing ?? false}
      messages={[message]}
      onRegenerate={() => {}}
      onSelectSource={() => {}}
    />,
  );
}

function openSearch() {
  fireEvent.click(screen.getByRole('button', { name: 'Søk i svaret' }));
  return screen.getByRole('searchbox', { name: 'Søk i svaret' });
}

function type(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
}

function marks(container: HTMLElement) {
  return [...container.querySelectorAll('mark.ka-answer-mark')];
}

function current(container: HTMLElement) {
  return container.querySelector('mark[data-current="true"]');
}

describe('AnswerMessage og søk i svaret', () => {
  it('finner, teller og markerer treffene i svaret', async () => {
    const { container } = show();

    type(openSearch(), 'mål');

    // «Måloppnåelse» in the heading, «måler», «måloppnåelse» and «målene» in
    // the first paragraph. None in the second.
    await waitFor(() => expect(marks(container)).toHaveLength(4));
    expect(screen.getByText('1 av 4 treff')).toBeTruthy();
    expect(current(container)).toBe(marks(container)[0]);
  });

  it('steg seg gjennom treffene og stopper i hver ende', async () => {
    const { container } = show();

    type(openSearch(), 'mål');
    await waitFor(() => expect(screen.getByText('1 av 4 treff')).toBeTruthy());

    const next = screen.getByRole('button', { name: 'Neste treff i svaret' });
    const previous = screen.getByRole('button', { name: 'Forrige treff i svaret' });

    // Den første enden: «Forrige» er markert som ute av drift og gjør ingenting.
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(previous);
    expect(screen.getByText('1 av 4 treff')).toBeTruthy();

    fireEvent.click(next);
    await waitFor(() => expect(screen.getByText('2 av 4 treff')).toBeTruthy());
    expect(current(container)).toBe(marks(container)[1]);

    fireEvent.click(next);
    fireEvent.click(next);
    await waitFor(() => expect(screen.getByText('4 av 4 treff')).toBeTruthy());
    // Den andre enden: stopper i stedet for å gå rundt (brukerblikk funn 11).
    expect(next.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(next);
    expect(screen.getByText('4 av 4 treff')).toBeTruthy();
  });

  it('sier fra når ingenting ble funnet, og når det er skrevet for lite', async () => {
    show();
    const field = openSearch();

    type(field, 'm');
    await waitFor(() => expect(screen.getByText('Skriv minst 2 tegn')).toBeTruthy());

    type(field, 'romfart');
    await waitFor(() => expect(screen.getByText('Ingen treff')).toBeTruthy());
  });

  it('begynner på nytt treff når spørringen endrer seg', async () => {
    show();
    const field = openSearch();

    type(field, 'mål');
    await waitFor(() => expect(screen.getByText('1 av 4 treff')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Neste treff i svaret' }));
    await waitFor(() => expect(screen.getByText('2 av 4 treff')).toBeTruthy());

    // Et nytt søk peker på sitt eget første treff, ikke på posisjonen i det forrige.
    type(field, 'avsnitt');
    await waitFor(() => expect(screen.getByText('1 av 1 treff')).toBeTruthy());
  });

  it('Escape lukker søket og gir fokus tilbake til knappen', async () => {
    const { container } = show();
    const field = openSearch();

    type(field, 'mål');
    await waitFor(() => expect(marks(container)).toHaveLength(4));

    fireEvent.keyDown(field, { key: 'Escape' });

    // Strimmelen er borte, markeringene med den, og fokus står der det kom fra:
    // en knapp som forsvinner uten å si hvor fokus skal, slipper tastaturet ned
    // på body (WCAG 2.4.3).
    const toggle = screen.getByRole('button', { name: 'Søk i svaret' });
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(marks(container)).toHaveLength(0);
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('har ikke søk før svaret er ferdig', () => {
    show({ ...answer, content: 'Halvferdig', status: 'streaming' });

    // Handlingsraden hører til et ferdig svar; et som fortsatt skrives har
    // ingenting å søke i ennå.
    expect(screen.queryByRole('button', { name: 'Søk i svaret' })).toBeNull();
  });
});

describe('AnswerMessage og avslutningsspørsmålet', () => {
  it('avslutter et vanlig svar med spørsmålet', () => {
    show();
    expect(screen.getByText(CLOSING_QUESTION)).toBeTruthy();
  });

  it('lar det være under et svar som ikke fant noe', () => {
    // «Er det noe mer jeg kan hjelpe deg med?» inviterer til en oppfølging av
    // et svar som ikke fant noe. Samme regel som chipsene (KA CC, 2026-09-15).
    show(answer, true);
    expect(screen.queryByText(CLOSING_QUESTION)).toBeNull();
  });
});
