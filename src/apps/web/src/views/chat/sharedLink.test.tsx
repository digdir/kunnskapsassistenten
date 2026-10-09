import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AnswerActions } from './AnswerActions';

beforeAll(() => {
  // jsdom lays nothing out and has no scrolling; the call that keeps the
  // receipt in view has to go somewhere.
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function show() {
  return render(<AnswerActions content="Et svar." createdAt="2026-10-06T21:00:00Z" />);
}

const copyLink = () => screen.getByRole('button', { name: 'Kopier lenke til tråden' });

/**
 * digdir/kunnskapsassistenten#119: adressen til en tråd åpner tråden bare i
 * nettleseren den ble laget i. Det som holdes fast her, er at grensen er en
 * beskrivelse og ikke en del av navnet, og at setningen står tre steder.
 */
describe('lenken til tråden', () => {
  it('har det knappen gjør som navn, og grensen som beskrivelse', () => {
    show();

    const button = copyLink();
    const describedBy = button.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const note = document.getElementById(describedBy!);
    expect(note?.textContent).toBe('Virker bare for deg, i denne nettleseren.');
    // `hidden` og ikke `ds-sr-only`: beskrivelsen når knappen, men setningen
    // er ikke et eget stopp for den som går gjennom raden.
    expect(note?.hidden).toBe(true);
  });

  it('sier det samme i tooltipen, som er den synlige halvdelen', () => {
    show();

    expect(copyLink().getAttribute('data-tooltip')).toBe(
      'Virker bare for deg, i denne nettleseren',
    );
  });

  it('sier begge halvdelene i kvitteringen, der den leses opp', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    show();
    fireEvent.click(copyLink());

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const text = await screen.findByText(
      'Lenken til tråden er kopiert. Virker bare for deg, i denne nettleseren.',
    );
    expect(text.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('kopierer fortsatt adressen leseren står på', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    show();
    fireEvent.click(copyLink());

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
  });
});
