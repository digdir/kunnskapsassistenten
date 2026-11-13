import type { AnswerData, AssistantApi } from '@genai/ui-assembly';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { ABOUT_LABEL, BACK_LABEL } from './menu';
import type { Me } from './session';

const me: Me = {
  name: 'Testperson Testesen',
  organisation: 'Testvirksomheten',
  signOut: '/auth/logout',
  model: 'kunnskapsassistenten__default',
  service: 'kunnskapsassistenten',
  tenant: 'digdir',
  writes: false,
};

const fakeApi = (): AssistantApi => ({
  loadModels: vi.fn(async () => [
    {
      id: 'kunnskapsassistenten__default',
      _service: 'kunnskapsassistenten',
      _service_title: 'Kunnskapsassistenten',
      _pickable: true,
      _chat: true,
    },
  ]),
  loadThreads: vi.fn(async () => [
    { id: 't1', title: 'En tråd', updatedAt: Date.now(), service: 'kunnskapsassistenten' },
    { id: 't2', title: 'En annen tjenestes tråd', updatedAt: Date.now(), service: 'annen' },
  ]),
  loadThread: vi.fn(async () => ({ title: 'En tråd', turns: [] })),
  loadCorpora: vi.fn(async () => []),
  loadFields: vi.fn(async () => []),
  loadFacets: vi.fn(async () => []),
  loadAbout: vi.fn(async () => undefined),
  ask: async function* () {},
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const openMenu = async () => {
  const [button] = await screen.findAllByRole('button', { name: me.name });
  fireEvent.click(button!);
  return document.querySelector('.uib-shell-profile-menu') as HTMLElement;
};

describe('the next client', () => {
  it("lists only this service's threads, and the person at the panel's foot", async () => {
    render(<App me={me} api={fakeApi()} />);
    expect(await screen.findByText('En tråd')).toBeTruthy();
    expect(screen.queryByText('En annen tjenestes tråd')).toBeNull();
    expect(screen.getAllByRole('button', { name: me.name }).length).toBeGreaterThan(0);
  });

  it("has «Tilbake til gammel versjon» as genki's own menu entry, after the pages, before «Logg ut»", async () => {
    const onSwitch = vi.fn();
    render(<App me={me} api={fakeApi()} onSwitchBack={onSwitch} />);
    const menu = await openMenu();
    // jsdom does not open a popover, so the menu counts as hidden.
    const back = await within(menu).findByRole('button', { name: BACK_LABEL, hidden: true });
    const settings = within(menu).getByText('Innstillinger');
    expect(
      settings.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const signOut = within(menu).getByRole('link', { name: /Logg ut/, hidden: true });
    expect(
      back.compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // In the menu's own list, not put there from outside.
    expect(document.querySelector('.ka-next-menu-extra')).toBeNull();
    fireEvent.click(back);
    await waitFor(() => expect(onSwitch).toHaveBeenCalledOnce());
  });

  it("has «Endringslogg» and «Om prosjektet» in the profile menu, as links to apps/web's pages", async () => {
    render(<App me={me} api={fakeApi()} />);
    const menu = await openMenu();
    const changelog = await within(menu).findByRole('link', {
      name: 'Endringslogg',
      hidden: true,
    });
    expect(changelog.getAttribute('href')).toBe('/endringslogg');
    const about = within(menu).getByRole('link', { name: ABOUT_LABEL, hidden: true });
    expect(about.getAttribute('href')).toBe('/om-prosjektet');
  });

  it('keeps its choices under ka-next. in this browser', async () => {
    render(<App me={me} api={fakeApi()} />);
    await screen.findByText('En tråd');
    await waitFor(() =>
      expect(Object.keys(localStorage).every((key) => key.startsWith('ka-next.'))).toBe(true),
    );
    expect(Object.keys(localStorage).length).toBeGreaterThan(0);
  });
});

describe('feedback on an answer', () => {
  /** A thread with one answer, from the run `runId` when given. */
  const answered = (runId?: string, extra: Partial<AnswerData> = {}): AssistantApi => ({
    ...fakeApi(),
    loadThread: vi.fn(async () => ({
      title: 'En tråd',
      turns: [
        {
          id: 'q1',
          question: 'Hva er fast?',
          askedAt: 1,
          answer: {
            text: 'Svaret står her.',
            status: 'complete' as const,
            created: 2,
            ...(runId ? { runId } : {}),
            ...extra,
          },
        },
      ],
    })),
  });

  beforeEach(() => history.replaceState(null, '', '/?t=t1'));
  afterEach(() => {
    history.replaceState(null, '', '/');
    vi.unstubAllGlobals();
  });

  const rate = async () => {
    const group = await screen.findByRole('group', { name: 'Tilbakemelding på svaret' });
    fireEvent.click(within(group).getByRole('button', { name: 'Ja' }));
    fireEvent.click(within(group).getByRole('button', { name: 'Send' }));
  };

  it("is sent to this server's feedback route with the thread and the run, for a person who may write", async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ ok: true }),
    );
    vi.stubGlobal('fetch', fetcher);
    render(<App me={{ ...me, writes: true }} api={answered('task-7')} />);
    await rate();
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/next/feedback');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      conversationId: 't1',
      taskId: 'task-7',
      rating: 'up',
      reasons: [],
    });
  });

  it('is not sent for an answer whose run is not known', async () => {
    const fetcher = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetcher);
    render(<App me={{ ...me, writes: true }} api={answered()} />);
    await rate();
    await screen.findByText('Tilbakemeldingen ble ikke sendt. Prøv igjen om litt.');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('is not offered with the service key, which may not write', async () => {
    render(<App me={me} api={answered('task-7')} />);
    await screen.findByText('Svaret står her.');
    expect(screen.queryByRole('group', { name: 'Tilbakemelding på svaret' })).toBeNull();
  });

  it('a reloaded thread that cites documents marks each document it cites, and lists its source by document', async () => {
    const sources = [
      {
        index: 1,
        title: 'Årsrapport 2023',
        documentId: '42',
        excerpts: [{ chunkId: 'c1', text: 'Ventetiden gikk ned.' }],
      },
    ];
    const api = answered('task-7', {
      text: 'Ventetiden gikk ned [1].',
      sources: sources as AnswerData['sources'],
    });
    // A service with a collection, so the sources and their footnotes are drawn.
    api.loadModels = vi.fn(async () => [
      {
        id: 'kunnskapsassistenten__default',
        _service: 'kunnskapsassistenten',
        _service_title: 'Kunnskapsassistenten',
        _pickable: true,
        _chat: true,
        _datasets: [{ tenant: 'digdir', 'dataset-config-key': 'kudos' }],
      },
    ]);
    render(<App me={me} api={api} />);
    // The next look marks each cited document until genki cites excerpts.
    await waitFor(() =>
      expect(document.querySelector('.uib-answer-text')?.textContent).toBe(
        'Ventetiden gikk ned [1].',
      ),
    );
    expect(
      document
        .querySelector('.uib-answer-footnote .uib-answer-mark')
        ?.getAttribute('aria-label'),
    ).toBe('Kilde 1: Årsrapport 2023');
    expect(screen.getAllByText('Årsrapport 2023').length).toBeGreaterThan(0);
  });
});
