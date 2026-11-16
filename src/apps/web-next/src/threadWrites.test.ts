import { describe, expect, it, vi } from 'vitest';
import { threadWrites } from './threadWrites';

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
