import { describe, expect, it, vi } from 'vitest';
import { switchClient } from './switchClient';
import { threadWrites } from './threadWrites';

describe('switching client', () => {
  it('asks the server as JSON, then reloads into the chosen client', async () => {
    const fetcher = vi.fn(async () => Response.json({ ui: 'classic' }));
    const reload = vi.fn();
    await switchClient('classic', fetcher, reload);
    expect(fetcher).toHaveBeenCalledWith('/api/next/ui', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ui: 'classic' }),
    });
    expect(reload).toHaveBeenCalledOnce();
  });

  it('stays where it is when the server refuses', async () => {
    const reload = vi.fn();
    await expect(
      switchClient(
        'classic',
        vi.fn(async () => new Response(null, { status: 403 })),
        reload,
      ),
    ).rejects.toThrow(/403/);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('rename and delete', () => {
  const row = { id: 'c/1', title: 'Gammelt', updatedAt: 0 };

  it('go through the proxy, the title as JSON', async () => {
    const fetcher = vi.fn(async () => Response.json({}));
    const { onRename, onDelete } = threadWrites(fetcher);
    await onRename(row, 'Nytt');
    await onDelete(row);
    expect(fetcher.mock.calls).toEqual([
      [
        '/api/next/genki/api/conversations/c%2F1',
        expect.objectContaining({ method: 'PUT', body: JSON.stringify({ title: 'Nytt' }) }),
      ],
      [
        '/api/next/genki/api/conversations/c%2F1',
        expect.objectContaining({ method: 'DELETE' }),
      ],
    ]);
  });

  it('fail when the server refuses, so the list keeps the thread', async () => {
    const { onDelete } = threadWrites(vi.fn(async () => new Response(null, { status: 403 })));
    await expect(onDelete(row)).rejects.toThrow(/403/);
  });
});
