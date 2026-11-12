// The toggle between the two clients on this site: the server keeps the choice in a cookie and
// serves the chosen client's page (`POST /api/next/ui`), so a reload lands in it.

export type Ui = 'next' | 'classic';

/** Choose a client, then load the page again in it. A thread open now opens there too. */
export async function switchClient(
  ui: Ui,
  fetcher: typeof fetch = fetch,
  reload: () => void = () => location.reload(),
): Promise<void> {
  const response = await fetcher('/api/next/ui', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ui }),
  });
  if (!response.ok) throw new Error(`POST /api/next/ui ${response.status}`);
  reload();
}
