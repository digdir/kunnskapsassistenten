// Rename and delete, through the server's proxy to genki. The server lets them through only with
// a person's own token, so `/api/next/me` says `writes` before the page offers them.
import type { ThreadRow } from '@genai/ui-assembly';

const thread = (id: string) => `/api/next/genki/api/conversations/${encodeURIComponent(id)}`;

const ensure = async (response: Response, what: string) => {
  if (!response.ok) throw new Error(`${what} ${response.status}`);
};

export const threadWrites = (fetcher: typeof fetch = fetch) => ({
  onRename: async (row: ThreadRow, title: string) =>
    ensure(
      await fetcher(thread(row.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ title }),
      }),
      'rename',
    ),
  onDelete: async (row: ThreadRow) =>
    ensure(
      await fetcher(thread(row.id), {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      }),
      'delete',
    ),
});
