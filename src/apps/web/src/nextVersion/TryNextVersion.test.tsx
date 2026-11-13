import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { backToNext } from './backToNext';
import { BACK_TO_NEXT_LABEL, TRY_NEXT_LABEL, TryNextVersion } from './TryNextVersion';

const inList = (fetcher: typeof fetch, reload = vi.fn()) =>
  render(
    <ul>
      <TryNextVersion fetcher={fetcher} reload={reload} />
    </ul>,
  );

describe('Prøv ny versjon', () => {
  it('is drawn when the server offers the next client', async () => {
    inList(vi.fn(async () => Response.json({ ui: 'classic', available: true })));
    expect(await screen.findByRole('button', { name: TRY_NEXT_LABEL })).toBeTruthy();
  });

  it('is not drawn when the toggle is off, not offered, or the server does not answer', async () => {
    const answers = [
      vi.fn(async () => Response.json({ error: 'Ukjent endepunkt.' }, { status: 404 })),
      vi.fn(async () => Response.json({ ui: 'classic', available: false })),
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    ];
    for (const fetcher of answers) {
      const { unmount } = inList(fetcher);
      await waitFor(() => expect(fetcher).toHaveBeenCalled());
      expect(screen.queryByRole('button', { name: TRY_NEXT_LABEL })).toBeNull();
      unmount();
    }
  });

  it('chooses the next client as JSON, then reloads into it', async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'POST'
        ? Response.json({ ui: 'next' })
        : Response.json({ ui: 'classic', available: true }),
    );
    const reload = vi.fn();
    inList(fetcher as typeof fetch, reload);
    fireEvent.click(await screen.findByRole('button', { name: TRY_NEXT_LABEL }));
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(fetcher).toHaveBeenLastCalledWith('/api/next/ui', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ui: 'next' }),
    });
  });

  it('takes a person on an info page into the new version, not back to the same page', async () => {
    history.replaceState(null, '', '/endringslogg');
    try {
      const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'POST'
          ? Response.json({ ui: 'next' })
          : Response.json({ ui: 'classic', available: true }),
      );
      const reload = vi.fn();
      const go = vi.fn();
      render(
        <ul>
          <TryNextVersion fetcher={fetcher as typeof fetch} reload={reload} go={go} />
        </ul>,
      );
      fireEvent.click(await screen.findByRole('button', { name: TRY_NEXT_LABEL }));
      await waitFor(() => expect(go).toHaveBeenCalledWith('/'));
      expect(reload).not.toHaveBeenCalled();
    } finally {
      history.replaceState(null, '', '/');
    }
  });
});

describe('Tilbake til ny versjon', () => {
  const chosen = () => vi.fn(async () => Response.json({ ui: 'next', available: true }));
  const onInfoPage = (fetcher: typeof fetch, go: (href: string) => void, from?: string | null) =>
    render(
      <ul>
        <TryNextVersion fetcher={fetcher} go={go} from={from} />
      </ul>,
    );

  it('does not offer the new version on an info page opened from it', async () => {
    const fetcher = chosen();
    onInfoPage(fetcher, vi.fn());
    await screen.findByRole('button', { name: BACK_TO_NEXT_LABEL });
    expect(screen.queryByRole('button', { name: TRY_NEXT_LABEL })).toBeNull();
  });

  it('offers the way back to the new version, to the thread the person left, without choosing again', async () => {
    const fetcher = chosen();
    const go = vi.fn();
    onInfoPage(fetcher, go, '/?t=abc');
    fireEvent.click(await screen.findByRole('button', { name: BACK_TO_NEXT_LABEL }));
    expect(go).toHaveBeenCalledWith('/?t=abc');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("goes to the new version's front page when it is not known where the person was", async () => {
    const go = vi.fn();
    onInfoPage(chosen(), go, null);
    fireEvent.click(await screen.findByRole('button', { name: BACK_TO_NEXT_LABEL }));
    expect(go).toHaveBeenCalledWith('/');
  });

  it("goes back only to the new version's own page, never to another address", () => {
    const origin = 'https://ka.example';
    for (const from of [
      '//elsewhere.example/?t=abc',
      '/\\elsewhere.example/',
      'https://elsewhere.example/?t=abc',
      'javascript:alert(1)',
      '/auth/logout',
      '/endringslogg',
      '',
    ]) {
      expect(backToNext(from, origin), from).toBe('/');
    }
    expect(backToNext('/?t=abc', origin)).toBe('/?t=abc');
    expect(backToNext(`${origin}/?t=abc`, origin)).toBe('/?t=abc');
  });
});
