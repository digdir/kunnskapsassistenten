import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { BrowserRouter, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setActiveCorpusKey } from '../../api';
import { resetMockThreads } from '../../api/mock/sessionThreads';
import { emptyFilterSelection, type FilterSelection, type Thread } from '../../model';
import { resetViewport, setViewportWidth } from '../../test/matchMedia';
import { ThreadsView } from '../../views/threads';
import { COMPOSER_ID } from '../ids';
import { LayoutProvider } from '../LayoutProvider';
import { MainScrollContext } from '../scrollContext';
import { useFilterSelection } from '../useFilterSelection';
import { useLayout } from '../useLayout';
import type { Layout } from '../viewModel';
import { ChatSlotView } from './ChatSlotView';

/**
 * «Ny tråd» after a conversation started on this page (issue 114).
 *
 * The thread list and the chat slot side by side under the real provider,
 * which is how the shell mounts them: the link is the thread list's own, the
 * filter and the layout are the provider's, and the conversation is the chat
 * slot's. Only the shell's chrome is left out.
 *
 * The answer is stopped rather than awaited. It does not finish in jsdom,
 * and what these tests are about — which conversation is on screen after the
 * click — is settled the moment the question is sent: that is when the
 * thread is started and given its address.
 */

function Scroll({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return <MainScrollContext value={scrollRef}>{children}</MainScrollContext>;
}

/** What the provider holds, read out so a test can check it after a click. */
const seen: { selection?: FilterSelection; layout?: Layout } = {};
const control: {
  setSelection?: (selection: FilterSelection) => void;
  setCollapsed?: ReturnType<typeof useLayout>['setCollapsed'];
} = {};

function Probe() {
  const { chosen, selection, setSelection } = useFilterSelection();
  const { layout, setCollapsed } = useLayout();
  useEffect(() => {
    seen.selection = chosen ?? selection;
    seen.layout = layout;
    control.setSelection = setSelection;
    control.setCollapsed = setCollapsed;
  });
  return null;
}

/** Navigering uten «Ny tråd», slik menyen og en vanlig lenke gjør det. */
const go: { navigate?: ReturnType<typeof useNavigate>; sti?: string } = {};

function Nav() {
  // I en effekt, som `Probe` over: å skrive til en modulvariabel under
  // rendring er en endring React ikke ser, og oxlint sier fra om det.
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    go.navigate = navigate;
    go.sti = location.pathname + location.hash;
  });
  return null;
}

const now = new Date().toISOString();
const listed: Thread[] = [{ id: 'eldre', title: 'Eldre tråd', createdAt: now, updatedAt: now }];

function show(threads: Thread[] = listed) {
  return render(
    <MemoryRouter>
      <LayoutProvider>
        <Probe />
        <Nav />
        <ThreadsView siblingViews={['threads']} onShowView={() => {}} threads={threads} />
        <Scroll>
          {/*
            De to rutene skallet har for samtaler (App.tsx), fordi nøkkelen
            `/` tegnes fra er en annen enn den en tråd tegnes fra. Uten
            rutene ser `useParams` aldri en `threadId`, og en test som åpner
            en tråd fra lista måler ingenting.
          */}
          <Routes>
            <Route index element={<ChatSlotView />} />
            <Route path="threads/:threadId" element={<ChatSlotView />} />
          </Routes>
        </Scroll>
      </LayoutProvider>
    </MemoryRouter>,
  );
}

const field = () =>
  screen.getByRole('textbox', {
    name: 'Spørsmål til Kunnskapsassistenten',
  }) as HTMLTextAreaElement;
const newThread = () => screen.getByRole('link', { name: /Ny tråd/ });

function ask(question: string) {
  fireEvent.change(field(), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Send spørsmålet' }));
}

function stop() {
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Avbryt genereringen' }));
  });
}

beforeEach(() => {
  resetMockThreads();
  setActiveCorpusKey('mock');
  window.history.replaceState(null, '', '/');
});

afterEach(() => resetViewport());

describe('«Ny tråd» after a conversation started on this page', () => {
  it('gives the thread its address at once, and then an empty conversation', () => {
    show();

    ask('Hva står i årsrapporten?');
    // The address names the thread as soon as it has an id — before any
    // answer, and without the reader going out of the thread and back.
    expect(window.location.pathname).toMatch(/^\/threads\/.+/u);
    expect(screen.getAllByText('Hva står i årsrapporten?').length).toBeGreaterThan(0);
    stop();

    act(() => fireEvent.click(newThread()));

    // To the router the page was `/` all along; the click still has to give
    // a new conversation, not the one it was already showing.
    expect(screen.queryAllByText('Hva står i årsrapporten?')).toHaveLength(0);
    expect(screen.getByRole('heading', { name: /Hva lurer du på\?/u })).toBeTruthy();
  });

  it('empties the filter', () => {
    show();
    act(() => control.setSelection?.({ ...emptyFilterSelection, documentType: ['Årsrapport'] }));
    expect(seen.selection?.documentType).toEqual(['Årsrapport']);

    ask('Hva står i årsrapporten?');
    stop();
    act(() => fireEvent.click(newThread()));

    expect(seen.selection).toEqual(emptyFilterSelection);
  });

  it('puts the keyboard in the compose field of the new conversation', () => {
    show();
    ask('Hva står i årsrapporten?');
    stop();

    // Where a real click leaves it: on the link. «Avbryt» hands focus to the
    // compose field, and without this the assertion below would pass on that
    // alone.
    act(() => newThread().focus());
    expect(document.activeElement).toBe(newThread());

    act(() => fireEvent.click(newThread()));

    expect(document.activeElement?.id).toBe(COMPOSER_ID);
    expect(field().value).toBe('');
  });

  it('closes the drawer it stood in, below the drawer breakpoint', () => {
    setViewportWidth(768);
    show();
    act(() => control.setCollapsed?.('primary-sidebar', false));
    expect(seen.layout?.slots['primary-sidebar'].collapsed).toBe(false);

    act(() => fireEvent.click(newThread()));

    expect(seen.layout?.slots['primary-sidebar'].collapsed).toBe(true);
  });

  it('leaves the panel open beside the answer column', () => {
    show();
    act(() => control.setCollapsed?.('primary-sidebar', false));

    act(() => fireEvent.click(newThread()));

    expect(seen.layout?.slots['primary-sidebar'].collapsed).toBe(false);
  });

  it('changes nothing on this page for a click that opens a new tab', () => {
    show();
    act(() => control.setSelection?.({ ...emptyFilterSelection, documentType: ['Årsrapport'] }));

    act(() => fireEvent.click(newThread(), { ctrlKey: true }));

    expect(seen.selection?.documentType).toEqual(['Årsrapport']);
  });

  it('gives a new conversation on every click, not only the first', () => {
    /*
     * Two clicks in a row are two new conversations. The key `/` is drawn
     * from has to CHANGE on each one — a boolean «someone asked for a new
     * thread» would have made the second click a no-op, and the half-written
     * question from between them would have stayed on screen.
     */
    show();

    act(() => fireEvent.click(newThread()));
    fireEvent.change(field(), { target: { value: 'Halvskrevet' } });
    expect(field().value).toBe('Halvskrevet');

    act(() => fireEvent.click(newThread()));

    expect(field().value).toBe('');
  });

  it('keeps the conversation when the navigation was not «Ny tråd»', () => {
    /*
     * The bug this key was written around: `/` was keyed on `location.key`,
     * and every navigation mints a new one — including the one that closes
     * the hidden settings menu, which is `navigate({ hash: '' }, { replace:
     * true })`. Writing half a question on `/`, opening `#innstillinger` and
     * pressing «Lukk» left the field empty and the conversation remounted
     * (KA CC on #208, with #203 in).
     *
     * Driven through the menu itself rather than through a bare `navigate`,
     * because it is the closing that has to be safe, not a navigation in the
     * abstract.
     */
    show();
    fireEvent.change(field(), { target: { value: 'Halvskrevet' } });

    act(() => void go.navigate?.({ hash: '#innstillinger' }));
    expect(screen.getByText('Innstillinger')).toBeTruthy();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Lukk' })));

    expect(screen.queryByText('Innstillinger')).toBeNull();
    expect(field().value).toBe('Halvskrevet');
  });

  it('uses the focus request once, so the next thread keeps the keyboard', () => {
    /*
     * `takeComposerFocusRequest` clears the flag as it answers, and nothing
     * was red without that line: every conversation asks on mount, so a
     * request left standing would be answered again by the NEXT one. Opening a
     * thread from the list a moment after «Ny tråd» would then pull the
     * keyboard out of the row the reader was standing in.
     *
     * The row is focused before it is clicked, because that is where a real
     * click leaves the keyboard and `fireEvent.click` does not move it — the
     * assertion would otherwise pass on the focus «Ny tråd» had already put
     * in the field.
     */
    show();

    act(() => fireEvent.click(newThread()));
    expect(document.activeElement?.id).toBe(COMPOSER_ID);

    const row = screen.getByRole('link', { name: /Eldre tråd/ });
    act(() => row.focus());
    act(() => fireEvent.click(row));

    expect(go.sti).toBe('/threads/eldre');
    expect(document.activeElement?.id).not.toBe(COMPOSER_ID);
    expect(document.activeElement?.tagName).toBe('A');
  });

  /*
   * Above an empty list the way to a new thread is the empty state's own
   * (issue 82), and it is the same action: the same link, and the same
   * click.
   */
  it('is the same action from the empty state, as «Start din første tråd»', () => {
    show([]);
    act(() => control.setSelection?.({ ...emptyFilterSelection, documentType: ['Årsrapport'] }));
    const start = screen.getByRole('link', { name: /Start din første tråd/ });
    act(() => start.focus());

    act(() => fireEvent.click(start));

    expect(seen.selection).toEqual(emptyFilterSelection);
    expect(document.activeElement?.id).toBe(COMPOSER_ID);
  });
});

/**
 * The router noticing the address this page wrote for itself.
 *
 * `startThread` gives the conversation an address with `history.replaceState`,
 * which the router never sees — so `useParams` keeps saying «no thread» while
 * the URL says `/threads/<id>`. The next real navigation makes the router
 * re-read `window.location`, and the id appears for the first time. Opening
 * the hidden settings menu is such a navigation.
 *
 * That is not a navigation to a thread, and it must not remount the slot. It
 * did: the key went from `new:N` to the id, the thread was read back from the
 * backend, and in live mode the backend's copy has no thinking steps and no
 * excerpts — «Fremgangsmåte» gone, the Kudos links from 6 to 0 (measured in
 * Azure on dfbb869).
 *
 * `BrowserRouter` and not `MemoryRouter`, because that is the whole mechanism:
 * a memory router has a history of its own and never reads `window.location`,
 * so it cannot see an address written behind its back and cannot reproduce
 * this at all. The `popstate` below is how the browser tells it to look again.
 *
 * **What this test cannot reach**, and it is worth saying rather than faking:
 * the second half of the same bug, where the slot keeps its instance but reads
 * the thread back in ON TOP of the conversation. That needs a finished turn
 * beside a stored copy of it, and the stream does not finish in jsdom — the
 * turn here is stopped, so there is nothing for a re-read to be laid in front
 * of. Writing the conversation into the mock store by hand was tried and
 * changes nothing, measured. It is `tests/e2e/chat.spec.ts` that counts the
 * questions and the answer cards, and holds the count for 1.5 s because the
 * re-read is asynchronous (KA CC, #217).
 */
describe('adressen denne sida skrev til seg selv', () => {
  function showOnBrowserRouter() {
    return render(
      <BrowserRouter>
        <LayoutProvider>
          <Scroll>
            <Routes>
              <Route index element={<ChatSlotView />} />
              <Route path="threads/:threadId" element={<ChatSlotView />} />
            </Routes>
          </Scroll>
        </LayoutProvider>
      </BrowserRouter>,
    );
  }

  it('remonterer ikke samtalen når routeren oppdager den', () => {
    showOnBrowserRouter();

    ask('Hva står i årsrapporten?');
    stop();
    const address = window.location.pathname;
    expect(address).toMatch(/^\/threads\/.+/u);

    // Et utkast er den reneste prøven: en remontering tar det med seg.
    fireEvent.change(field(), { target: { value: 'Halvskrevet' } });

    // Routeren ser adressen for første gang, slik den gjør når menyen åpnes.
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(window.location.pathname).toBe(address);
    expect(field().value).toBe('Halvskrevet');
    expect(screen.getAllByText('Hva står i årsrapporten?').length).toBeGreaterThan(0);
  });
});
