import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Hono } from 'hono';
import { kudosFiles, type KudosFileOptions } from './kudosFiles.ts';

/*
 * `GET /api/next/kudos/files/:uuid` against a fake Kudos: which addresses it reads, and what the
 * page gets back. Kudos is never called for real.
 */

const DOC = 'a33bf297-afd2-4b38-992e-b23c8fec3d80';
const FILE = 'a33bf297-bce1-48b8-989d-1f0d21815626';
const RECORD_URL = `https://kudos.dfo.no/api/v0/documents/${DOC}`;
const PDF_URL = `https://kudos.dfo.no/dokument/${DOC}/filer/${FILE}.pdf`;
const PDF = new TextEncoder().encode('%PDF-1.7\n1 0 obj << >> endobj\n%%EOF\n');
const KUDOS_TEXT = 'Internal Server Error at kudos-app-7f9 (db.internal:5432)';

interface Call {
  url: string;
  init: RequestInit | undefined;
}

type Answer = (init: RequestInit | undefined) => Response | Promise<Response>;

const recordWith = (files: unknown[]) =>
  Response.json({ uuid: DOC, title: 'Store språkmodeller', files });

const theFile = { url: PDF_URL, filename: 'FFI_Utvidet-sammendrag.pdf', size: PDF.byteLength };

const pdfResponse = (body: BodyInit = PDF, headers: Record<string, string> = {}) =>
  new Response(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(typeof body === 'string' ? body.length : PDF.byteLength),
      ...headers,
    },
  });

/** The route on a host as nextApi.ts mounts it, against a Kudos that answers `answers`. */
const kudos = (
  answers: Record<string, Answer>,
  options: Omit<KudosFileOptions, 'fetch'> = {},
) => {
  const calls: Call[] = [];
  const fake = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const answer = answers[url];
    return answer ? answer(init) : new Response('not here', { status: 404 });
  }) as typeof fetch;
  const host = new Hono();
  host.route('/api/next/kudos/files', kudosFiles({ fetch: fake, ...options }));
  const get = (uuid: string, method = 'GET') =>
    host.request(`/api/next/kudos/files/${uuid}`, { method });
  return { calls, get };
};

const usual = () =>
  kudos({ [RECORD_URL]: () => recordWith([theFile]), [PDF_URL]: () => pdfResponse() });

const problemOf = async (res: Response) => {
  assert.equal(res.headers.get('content-type'), 'application/problem+json');
  return (await res.json()) as { status: number; code: string; title: string };
};

describe('a Kudos document’s PDF', () => {
  test('is the document’s first PDF, streamed inline as a PDF, unsniffed and kept only privately', async () => {
    const { calls, get } = usual();
    const res = await get(DOC);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.equal(
      res.headers.get('content-disposition'),
      `inline; filename="FFI_Utvidet-sammendrag.pdf"; filename*=UTF-8''FFI_Utvidet-sammendrag.pdf`,
    );
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('cache-control'), 'private, max-age=3600');
    assert.deepEqual(new Uint8Array(await res.arrayBuffer()), PDF);
    assert.deepEqual(
      calls.map((c) => c.url),
      [RECORD_URL, PDF_URL],
    );
  });

  test('is read from Kudos without following a redirect, on either call', async () => {
    const { calls, get } = usual();
    await (await get(DOC)).arrayBuffer();
    assert.deepEqual(
      calls.map((c) => c.init?.redirect),
      ['manual', 'manual'],
    );
  });

  test('is only looked up on HEAD: the record is read, the PDF is not', async () => {
    const { calls, get } = usual();
    const res = await get(DOC, 'HEAD');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.deepEqual(
      calls.map((c) => c.url),
      [RECORD_URL],
    );
  });

  test('takes the document number in capitals, and asks Kudos for it in lower case', async () => {
    const { calls, get } = usual();
    assert.equal((await get(DOC.toUpperCase())).status, 200);
    assert.equal(calls[0]?.url, RECORD_URL);
  });

  test('names a file whose name is not a plain PDF name by the file’s own number', async () => {
    const { get } = kudos({
      [RECORD_URL]: () => recordWith([{ ...theFile, filename: 'a"b\r\n.pdf' }]),
      [PDF_URL]: () => pdfResponse(),
    });
    const res = await get(DOC);
    assert.match(
      res.headers.get('content-disposition') ?? '',
      new RegExp(`filename="${FILE}\\.pdf"`),
    );
  });
});

describe('what the route refuses', () => {
  test('a number that is not a uuid, before Kudos is asked', async () => {
    const { calls, get } = usual();
    for (const uuid of [
      'not-a-uuid',
      `${DOC}x`,
      `${DOC.slice(0, -1)}`,
      '..%2Fapi%2Fv0',
      `${DOC}%2F..%2F..`,
      `%20${DOC}`,
      'kudos:' + DOC,
    ]) {
      const res = await get(uuid);
      assert.equal(res.status, 400, uuid);
      assert.equal((await problemOf(res)).code, 'bad_uuid');
    }
    assert.equal(calls.length, 0);
  });

  test('a file on another host, at another path, of another document or by another scheme', async () => {
    const other = '0f8fad5b-d9cb-469f-a165-70867728950e';
    for (const url of [
      `https://evil.example/dokument/${DOC}/filer/${FILE}.pdf`,
      `https://kudos.dfo.no.evil.example/dokument/${DOC}/filer/${FILE}.pdf`,
      `https://kudos.dfo.no@evil.example/dokument/${DOC}/filer/${FILE}.pdf`,
      `http://kudos.dfo.no/dokument/${DOC}/filer/${FILE}.pdf`,
      `https://kudos.dfo.no:8443/dokument/${DOC}/filer/${FILE}.pdf`,
      `https://kudos.dfo.no/media/${FILE}.pdf`,
      `https://kudos.dfo.no/dokument/${other}/filer/${FILE}.pdf`,
      `https://kudos.dfo.no/dokument/${DOC}/filer/../../${FILE}.pdf`,
      `https://kudos.dfo.no/dokument/${DOC}/filer/${FILE}.pdf?download=1`,
      `https://kudos.dfo.no/dokument/${DOC}/filer/${FILE}.docx`,
      `https://kudos.dfo.no/dokument/${DOC}/filer/${FILE}.pdf\n`,
    ]) {
      const { calls, get } = kudos({
        [RECORD_URL]: () => recordWith([{ url, filename: 'x.pdf', size: 10 }]),
        [url]: () => pdfResponse(),
      });
      const res = await get(DOC);
      assert.equal(res.status, 404, url);
      assert.equal((await problemOf(res)).code, 'kudos_no_pdf', url);
      assert.deepEqual(
        calls.map((c) => c.url),
        [RECORD_URL],
        url,
      );
    }
  });

  test('nothing but the allowed file, even when another is listed first', async () => {
    const { calls, get } = kudos({
      [RECORD_URL]: () =>
        recordWith([{ url: 'https://evil.example/x.pdf' }, 'not a file', theFile]),
      [PDF_URL]: () => pdfResponse(),
    });
    assert.equal((await get(DOC)).status, 200);
    assert.deepEqual(
      calls.map((c) => c.url),
      [RECORD_URL, PDF_URL],
    );
  });

  test('a redirect from Kudos, to another host or its own, on the record or the file', async () => {
    for (const [at, location] of [
      [RECORD_URL, 'https://evil.example/api/v0/documents/x'],
      [RECORD_URL, `https://kudos.dfo.no/api/v1/documents/${DOC}`],
      [PDF_URL, 'https://evil.example/file.pdf'],
      [PDF_URL, `https://kudos.dfo.no/dokument/${DOC}/filer/${FILE}.pdf`],
    ] as const) {
      const answers: Record<string, Answer> = {
        [RECORD_URL]: () => recordWith([theFile]),
        [PDF_URL]: () => pdfResponse(),
        [at]: () => new Response(null, { status: 302, headers: { Location: location } }),
      };
      const { calls, get } = kudos(answers);
      const res = await get(DOC);
      assert.equal(res.status, 502, `${at} → ${location}`);
      assert.equal((await problemOf(res)).code, 'kudos_redirect');
      assert.ok(!calls.some((c) => c.url === location && location !== at), location);
    }
  });

  test('a PDF the record says is larger than 50 MiB, before it is read', async () => {
    const { calls, get } = kudos({
      [RECORD_URL]: () => recordWith([{ ...theFile, size: 50 * 1024 * 1024 + 1 }]),
      [PDF_URL]: () => pdfResponse(),
    });
    const res = await get(DOC);
    assert.equal(res.status, 404);
    assert.equal((await problemOf(res)).code, 'kudos_too_large');
    assert.deepEqual(
      calls.map((c) => c.url),
      [RECORD_URL],
    );
  });

  test('a PDF whose length is over the cap, and one that streams past it', async () => {
    const declared = kudos(
      {
        [RECORD_URL]: () => recordWith([{ ...theFile, size: undefined }]),
        [PDF_URL]: () => pdfResponse(PDF, { 'Content-Length': '1000' }),
      },
      { maxBytes: 100 },
    );
    const res = await declared.get(DOC);
    assert.equal(res.status, 404);
    assert.equal((await problemOf(res)).code, 'kudos_too_large');

    const chunk = new Uint8Array(64).fill(0x20);
    chunk.set(PDF.subarray(0, 5));
    const streamed = kudos(
      {
        [RECORD_URL]: () => recordWith([{ ...theFile, size: undefined }]),
        [PDF_URL]: () =>
          new Response(
            new ReadableStream({
              start(controller) {
                for (let i = 0; i < 4; i += 1) controller.enqueue(chunk);
                controller.close();
              },
            }),
            { headers: { 'Content-Type': 'application/pdf' } },
          ),
      },
      { maxBytes: 100 },
    );
    const cut = await streamed.get(DOC);
    assert.equal(cut.status, 200);
    await assert.rejects(cut.arrayBuffer());
  });

  test('a file Kudos does not send as a PDF, or whose bytes are not one', async () => {
    for (const answer of [
      () => new Response('<html>Logg inn</html>', { headers: { 'Content-Type': 'text/html' } }),
      () => pdfResponse('<html>Logg inn</html>'),
      () => pdfResponse(''),
    ]) {
      const { get } = kudos({ [RECORD_URL]: () => recordWith([theFile]), [PDF_URL]: answer });
      const res = await get(DOC);
      assert.equal(res.status, 502);
      const problem = await problemOf(res);
      assert.equal(problem.code, 'kudos_not_pdf');
      assert.doesNotMatch(JSON.stringify(problem), /Logg inn/);
    }
  });

  test('a document Kudos does not have, as not found', async () => {
    const { get } = kudos({ [RECORD_URL]: () => new Response('{}', { status: 404 }) });
    const res = await get(DOC);
    assert.equal(res.status, 404);
    assert.equal((await problemOf(res)).code, 'kudos_not_found');
  });

  test('Kudos’s own error text, which never reaches the page', async () => {
    const cases: Record<string, Answer>[] = [
      { [RECORD_URL]: () => new Response(KUDOS_TEXT, { status: 500 }) },
      { [RECORD_URL]: () => new Response(KUDOS_TEXT, { status: 200 }) },
      {
        [RECORD_URL]: () => recordWith([theFile]),
        [PDF_URL]: () => new Response(KUDOS_TEXT, { status: 503 }),
      },
    ];
    for (const answers of cases) {
      const { get } = kudos(answers);
      const res = await get(DOC);
      assert.equal(res.status, 502);
      const text = await res.text();
      assert.doesNotMatch(text, /kudos-app|db\.internal|Internal Server Error/);
      assert.equal(JSON.parse(text).code, 'kudos_failed');
    }
  });

  test('a record too large to be one', async () => {
    const { get } = kudos({
      [RECORD_URL]: () => Response.json({ files: [theFile], padding: 'x'.repeat(300 * 1024) }),
    });
    assert.equal((await problemOf(await get(DOC))).code, 'kudos_failed');
  });

  test('a Kudos that does not answer in time, and one that cannot be reached', async () => {
    const slow = kudos(
      {
        [RECORD_URL]: (init) =>
          new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
          ),
      },
      { answerTimeoutMs: 20 },
    );
    const late = await slow.get(DOC);
    assert.equal(late.status, 504);
    assert.equal((await problemOf(late)).code, 'kudos_timeout');

    const down = kudos({
      [RECORD_URL]: () => {
        throw new TypeError('fetch failed');
      },
    });
    const gone = await down.get(DOC);
    assert.equal(gone.status, 502);
    assert.equal((await problemOf(gone)).code, 'kudos_unreachable');
  });
});
