import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { Thread } from '../../model';
import { ThreadLink } from './ThreadLink';

const now = new Date().toISOString();
const thread: Thread = {
  id: 'dss-regnskap',
  title:
    'Hva rapporteres om regnskap, kostnader og bevilgning i DSS sine årsrapporter for 2022 og 2023?',
  createdAt: now,
  updatedAt: now,
};

/**
 * jsdom lays nothing out, so both widths are 0 and nothing is ever cut off —
 * which is the right default for every other test in the project. The tests
 * that are about the measurement say what the browser would have measured, on
 * the prototype, and put it back afterwards.
 *
 * Widths, and on `HTMLElement`: the row is one line since 23.09, so what is
 * measured is whether the end of the title fell off, and the element that is
 * measured is the title span inside the link.
 */
function withWidths(scrollWidth: number, clientWidth: number): void {
  for (const [name, value] of [
    ['scrollWidth', scrollWidth],
    ['clientWidth', clientWidth],
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, name, { configurable: true, value });
  }
}

/** The box that shows the whole row, or nothing when it is not open. */
function overlay(): HTMLElement | null {
  return document.querySelector('.threads-view__overlay');
}

afterEach(() => {
  for (const name of ['scrollWidth', 'clientWidth']) {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
  }
  // jsdom has no FontFaceSet, so the font test installs one. Anything left
  // behind would make the next file's rows measure themselves twice.
  delete (document as unknown as Record<string, unknown>).fonts;
});

function view(current: boolean) {
  return (
    <MemoryRouter>
      <ThreadLink thread={thread} current={current} />
    </MemoryRouter>
  );
}

function renderLink(current = false) {
  return render(view(current));
}

/** The link, whatever it is called this instant. */
function link() {
  return screen.getByRole('link', { name: thread.title });
}

describe('ThreadLink', () => {
  it('har hele tittelen som tilgjengelig navn, uansett hva som vises', () => {
    // The cut is visual. A screen reader reads the DOM, and the DOM has the
    // whole question.
    renderLink();

    expect(screen.getByRole('link', { name: thread.title })).toBeTruthy();
  });

  it('gir ingen tooltip når tittelen får plass', () => {
    // A tooltip on a row that is not cut off promises the reader something
    // they can already see — and is read as a description after the name they
    // have just heard.
    renderLink();

    expect(screen.getByRole('link', { name: thread.title }).getAttribute('title')).toBeNull();
  });

  it('viser hele raden i en boks når tittelen er kuttet', () => {
    withWidths(420, 300);
    renderLink();

    fireEvent.pointerEnter(link());

    expect(overlay()?.textContent).toContain(thread.title);
    // Boksen er bare tegning: hele tittelen er lenkas navn fra før, og en
    // skjermleser skal ikke høre den to ganger.
    expect(overlay()?.getAttribute('aria-hidden')).toBe('true');
  });

  it('lukker boksen når pekeren forlater raden', () => {
    withWidths(420, 300);
    renderLink();

    fireEvent.pointerEnter(link());
    expect(overlay()).toBeTruthy();

    fireEvent.pointerLeave(link());
    expect(overlay()).toBeNull();
  });

  it('legger boksen inne i lenka, så et klikk på den åpner tråden', () => {
    /*
     * Boksen dekker raden, og med `pointer-events: auto` tar den klikket.
     * Lå den utenfor lenka — den lå i en portal på body til KA CC målte #160
     * — landet klikket på en div og gjorde ingenting. Inne i lenka ER et
     * klikk på boksen et klikk på raden, midtklikk og «åpne i ny fane» med.
     */
    withWidths(420, 300);
    renderLink();

    fireEvent.pointerEnter(link());

    expect(overlay()?.closest('a')).toBe(link());
    // Direkte barn, ikke bare etterkommer: fokusringen på boksen henger på
    // `.threads-view__thread:focus-visible > .threads-view__overlay`.
    expect(overlay()?.parentElement).toBe(link());
  });

  it('blir stående når pekeren går fra raden og inn i boksen', () => {
    /*
     * WCAG 1.4.13, «hoverable»: boksen henger utenfor radens høyre kant, så
     * å flytte pekeren dit ER å forlate raden. Uten at de to behandles som én
     * flate lukket boksen seg mens leseren sto på den (KA CC på #160).
     */
    withWidths(420, 300);
    renderLink();

    fireEvent.pointerEnter(link());
    const boks = overlay();
    expect(boks).toBeTruthy();

    fireEvent.pointerLeave(link(), { relatedTarget: boks });
    expect(overlay()).toBeTruthy();

    // Og ut av boksen igjen lukker den.
    fireEvent.pointerLeave(boks as HTMLElement, { relatedTarget: document.body });
    expect(overlay()).toBeNull();
  });

  it('åpner boksen på fokus, og lukker den med Escape', () => {
    // WCAG 1.4.13: innhold som kommer på peker eller fokus må kunne lukkes
    // uten å flytte noen av delene.
    withWidths(420, 300);
    renderLink();

    fireEvent.focus(link());
    expect(overlay()).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(overlay()).toBeNull();
  });

  it('lar den første Escape være boksens, ikke skuffas', () => {
    /*
     * I skuffemodus er panelet en `dialog`, og Escape er dialogens egen
     * lukkeforespørsel: ett trykk lukket både boksen og skuffa, og flyttet
     * fokus (KA CC på #160). `preventDefault` i fangstfasen er rekkefølgen
     * plattformen bruker selv — popoveren inni dialogen lukkes først.
     *
     * `fireEvent` returnerer false når standardhandlingen er avverget.
     */
    withWidths(420, 300);
    renderLink();
    fireEvent.focus(link());

    const gikkGjennom = fireEvent.keyDown(document, { key: 'Escape' });

    expect(gikkGjennom).toBe(false);
    expect(overlay()).toBeNull();

    // Og andre trykk er skuffas: lytteren forsvant med boksen.
    expect(fireEvent.keyDown(document, { key: 'Escape' })).toBe(true);
  });

  it('lar andre taster gå sin vei mens boksen står', () => {
    withWidths(420, 300);
    renderLink();
    fireEvent.focus(link());

    expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(true);
    expect(overlay()).toBeTruthy();
  });

  it('viser ingen boks når hele tittelen får plass', () => {
    // En boks som gjentar en tittel leseren alt ser lover resten og gir
    // samme setning.
    withWidths(300, 300);
    renderLink();

    fireEvent.pointerEnter(link());

    expect(overlay()).toBeNull();
  });

  it('teller ikke en halv piksel som avkorting', () => {
    // Sub-pixel text widths round the two boxes apart on a row where nothing
    // is hidden.
    withWidths(300.5, 300);
    renderLink();

    fireEvent.pointerEnter(link());

    expect(overlay()).toBeNull();
  });

  it('merker den åpne tråden, og bare den', () => {
    renderLink(true);
    expect(screen.getByRole('link', { name: thread.title }).getAttribute('aria-current')).toBe(
      'page',
    );

    renderLink(false);
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it('måler på nytt når raden blir den åpne', () => {
    /*
     * The open row is drawn semibold, which makes the same title wider
     * without changing the box it is drawn in — so `ResizeObserver` never
     * fires, and the row whose last word has just been pushed out of sight
     * keeps saying it fits. KA CC on #80.
     */
    withWidths(300, 300);
    const { rerender } = renderLink(false);
    fireEvent.pointerEnter(link());
    expect(overlay()).toBeNull();

    withWidths(420, 300);
    rerender(view(true));
    fireEvent.pointerEnter(link());

    expect(overlay()).toBeTruthy();
  });

  it('måler på nytt når skriften er lastet', async () => {
    /*
     * Inter comes from altinncdn, and the first measurement happens in the
     * fallback face. Its metrics are not Inter's, so a row that fits before
     * the font arrives can be cut off after it.
     */
    let arrive = () => {};
    const ready = new Promise<void>((resolve) => {
      arrive = resolve;
    });
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready } });

    withWidths(300, 300);
    renderLink();
    fireEvent.pointerEnter(link());
    expect(overlay()).toBeNull();

    withWidths(420, 300);
    await act(async () => {
      arrive();
      await ready;
    });
    fireEvent.pointerEnter(link());

    expect(overlay()).toBeTruthy();
  });
});
