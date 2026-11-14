import type { StreamEvent } from '@genai/client';
import type { AnswerData, AssistantApi } from '@genai/ui-assembly';
import { lookOf, optionInForce } from '@genai/ui-blocks';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, layout } from './App';
import { ABOUT_LABEL, BACK_LABEL } from './menu';
import { profileFor } from './profile';
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
  it('is genki’s template knowledge-assistant-next as it is: the next look, feedback on, no follow-ups', () => {
    expect(layout.template).toBe('knowledge-assistant-next');
    expect(lookOf(layout)).toBe('next');
    expect(optionInForce(layout, 'chat', 'feedback')).toBe(true);
    expect(optionInForce(layout, 'chat', 'followUps')).toBe(false);
  });

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

  it('offers neither apps/web’s pages nor «Tilbake til gammel versjon» where the server serves only this client', async () => {
    render(<App me={{ ...me, nextOnly: true }} api={fakeApi()} />);
    const menu = await openMenu();
    // genki's own entries stay.
    expect(await within(menu).findByText('Innstillinger')).toBeTruthy();
    expect(within(menu).getByRole('link', { name: /Logg ut/, hidden: true })).toBeTruthy();
    for (const name of [BACK_LABEL, ABOUT_LABEL, 'Endringslogg'])
      expect(within(menu).queryByText(name)).toBeNull();
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

describe('«Innstillinger»', () => {
  beforeEach(() => history.replaceState(null, '', '/innstillinger'));
  afterEach(() => history.replaceState(null, '', '/'));

  const go = (name: RegExp) =>
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Innstillinger' })).getByRole('button', {
        name,
      }),
    );
  const pageEnd = () =>
    document.querySelector('.uib-settings-page')?.lastElementChild?.textContent;

  it("ends each page with something to choose with KA's settings note", async () => {
    const note = profileFor(me).settingsNote;
    expect(note).toMatch(/^Valgene huskes i denne nettleseren\./);
    render(<App me={me} api={fakeApi()} />);
    await screen.findByRole('heading', { level: 1, name: 'Generelt' });
    expect(pageEnd()).toBe(note);
    // The name and organisation from the sign-in.
    go(/^Om deg/);
    expect(screen.getByRole('heading', { level: 1, name: 'Om deg' })).toBeTruthy();
    expect(pageEnd()).toBe(note);
    // KA's two trials.
    go(/^Beta-funksjoner/);
    expect(screen.getByRole('heading', { level: 1, name: 'Beta-funksjoner' })).toBeTruthy();
    expect(pageEnd()).toBe(note);
    // genki keeps no privacy choice yet, so the page has nothing for the note to speak of.
    go(/^Personvern og data/);
    expect(screen.getByText('Ingen valg her ennå.')).toBeTruthy();
    expect(screen.queryByText(note!)).toBeNull();
  });
});

describe('an answer while the reader is in another thread', () => {
  afterEach(() => {
    history.replaceState(null, '', '/');
    vi.unstubAllGlobals();
  });

  /** genki, with an answer the test sends a piece at a time; an abort rejects it, as fetch does. */
  const streaming = () => {
    let asked = false;
    let signal: AbortSignal | undefined;
    const queue: StreamEvent[] = [];
    let wake = () => {};
    const api: AssistantApi = {
      ...fakeApi(),
      loadThreads: vi.fn(async () => [
        ...(asked
          ? [
              {
                id: 't-new',
                title: 'Hva er nytt?',
                updatedAt: 2,
                service: 'kunnskapsassistenten',
              },
            ]
          : []),
        { id: 't1', title: 'En tråd', updatedAt: 1, service: 'kunnskapsassistenten' },
      ]),
      // genki stores an answer once it is done, so the new thread holds the question alone.
      loadThread: vi.fn(async (id: string) =>
        id === 't-new'
          ? {
              title: 'Hva er nytt?',
              turns: [{ id: 'n1', question: 'Hva er nytt?', askedAt: 1 }],
            }
          : {
              title: 'En tråd',
              turns: [
                {
                  id: 'q1',
                  question: 'Hva var gammelt?',
                  askedAt: 1,
                  answer: {
                    text: 'Det gamle svaret.',
                    status: 'complete' as const,
                    created: 2,
                  },
                },
              ],
            },
      ),
      ask: async function* (params) {
        asked = true;
        signal = params.signal;
        for (;;) {
          const next = queue.shift();
          if (next) {
            yield next;
            if (next.type === 'done') return;
            continue;
          }
          await new Promise<void>((resolve, reject) => {
            const stop = () => reject(new DOMException('aborted', 'AbortError'));
            if (params.signal.aborted) stop();
            params.signal.addEventListener('abort', stop);
            wake = resolve;
          });
        }
      },
    };
    // Every event is read, and what it changes drawn, before the test goes on.
    const send = (...events: StreamEvent[]) =>
      act(async () => {
        queue.push(...events);
        wake();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    return { api, send, aborted: () => signal?.aborted };
  };
  const open = async (name: RegExp) => {
    const link = await screen.findByRole('link', { name });
    await act(async () => {
      fireEvent.click(link);
    });
  };
  const answerText = () =>
    [...document.querySelectorAll('.uib-answer-text')]
      .map((text) => text.textContent)
      .join(' ');

  it('keeps coming, is there on return, and its feedback names the thread it was asked in', async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ ok: true }),
    );
    vi.stubGlobal('fetch', fetcher);
    const { api, send, aborted } = streaming();
    render(<App me={{ ...me, writes: true }} api={api} />);
    const field = await screen.findByRole('textbox', { name: /Spørsmål til/ });
    fireEvent.change(field, { target: { value: 'Hva er nytt?' } });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Send spørsmålet' }).hasAttribute('aria-disabled'),
      ).toBe(false),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send spørsmålet' }));
    });
    const named = { type: 'conversation', conversationId: 't-new' } as const;
    await send(named, named, { type: 'text', text: 'Det nye ' });
    await waitFor(() => expect(answerText()).toContain('Det nye'));
    await open(/En tråd/);
    expect(await screen.findByText('Det gamle svaret.')).toBeTruthy();
    // The rest arrives out of sight.
    await send(
      { type: 'text', text: 'svaret.' },
      {
        type: 'done',
        answer: {
          id: 'a1',
          text: 'Det nye svaret.',
          taskId: 'task-9',
          sources: [],
          citations: [],
          noAnswer: false,
        },
      },
    );
    expect(aborted()).toBe(false);
    expect(screen.getByText('Det gamle svaret.')).toBeTruthy();
    await open(/Hva er nytt\?/);
    await waitFor(() => expect(answerText()).toBe('Det nye svaret.'));
    const group = await screen.findByRole('group', { name: 'Tilbakemelding på svaret' });
    fireEvent.click(within(group).getByRole('button', { name: 'Ja' }));
    fireEvent.click(within(group).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({
      conversationId: 't-new',
      taskId: 'task-9',
      rating: 'up',
      reasons: [],
    });
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
