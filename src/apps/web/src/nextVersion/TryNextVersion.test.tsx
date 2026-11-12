import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TRY_NEXT_LABEL, TryNextVersion } from './TryNextVersion';

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
});
