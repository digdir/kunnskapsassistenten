import { config } from './config.ts';

const chunksCollection = () => config.docsCollection.replace('_documents_', '_chunks_');

export async function excerpts(chunkIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(chunkIds.filter(Boolean))];
  if (!ids.length || !config.typesenseHost || !config.typesenseKey || !config.docsCollection) {
    return out;
  }

  const url = new URL(
    `https://${config.typesenseHost}/collections/${chunksCollection()}/documents/search`,
  );
  url.searchParams.set('q', '*');
  url.searchParams.set('filter_by', `chunk_id:[${ids.join(',')}]`);
  url.searchParams.set('include_fields', 'chunk_id,content_markdown');
  url.searchParams.set('per_page', String(Math.min(ids.length, 250)));

  const res = await fetch(url, { headers: { 'X-TYPESENSE-API-KEY': config.typesenseKey } });
  if (!res.ok) return out;

  const body = (await res.json()) as {
    hits?: Array<{ document?: { chunk_id?: string; content_markdown?: string } }>;
  };
  for (const hit of body.hits ?? []) {
    const d = hit.document;
    if (d?.chunk_id && d.content_markdown) out.set(d.chunk_id, d.content_markdown.trim());
  }
  return out;
}
