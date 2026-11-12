// The next client chosen on the server (`POST /api/next/ui`), which keeps it in a cookie.

/** Choose the next client, then load the page again in it. */
export async function chooseNext(
  fetcher: typeof fetch = fetch,
  reload: () => void = () => location.reload(),
): Promise<void> {
  const response = await fetcher('/api/next/ui', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ui: 'next' }),
  });
  if (!response.ok) throw new Error(`POST /api/next/ui ${response.status}`);
  reload();
}
