import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, mock, test } from 'node:test';

/*
 * `KA_NEXT_LAYOUT` (decisions/0017): the layout from genki's builder, checked at start with genki's
 * own checks from the next client's vendored ui-blocks, and handed to the page in `/api/next/me`.
 * Unset, `/api/next/me` is as before (nextApi.test.ts).
 */

/** genki's template `knowledge-assistant-next` as the builder's «Kopier oppsettet» gives it. */
const TEMPLATE = {
  version: 1,
  template: 'knowledge-assistant-next',
  look: 'next',
  zones: {
    primary: [{ block: 'threads' }, { block: 'filter' }, { block: 'settings' }],
    main: [
      { block: 'approach' },
      { block: 'chat', settings: { feedback: true, followUps: false } },
    ],
    secondary: [{ block: 'approach' }, { block: 'sources' }],
  },
};

/** Another assistant: the same blocks, in its own words. */
const ANOTHER = {
  ...TEMPLATE,
  profile: {
    assistantName: 'Rapportassistenten',
    suggestions: ['Hva sier rapportene om digitalisering?'],
    corpora: {
      kudos: {
        label: 'Rapportarkivet',
        fields: [{ id: 'type', label: 'Slag rapport', heading: 'Slag' }],
        documentLinks: { digits: 'https://kudos.dfo.no/documents/{id}' },
      },
    },
  },
};

const files = mkdtempSync(join(tmpdir(), 'ka-next-layout-'));
const inFile = (name: string, text: string) => {
  const path = join(files, name);
  writeFileSync(path, text);
  return path;
};

// The server under test runs with a layout, so its /api/next/me carries one.
process.env.DIGDIR_API_KEY ??= 'test-key';
Object.assign(process.env, {
  AUTH_MODE: 'off',
  APP_ORIGIN: 'http://localhost:8787',
  KA_NEXT: '1',
  KA_NEXT_LAYOUT: JSON.stringify(ANOTHER),
});

let app: typeof import('./app.ts').app;
let layouts: typeof import('./nextLayout.ts');
before(async () => {
  ({ app } = await import('./app.ts'));
  layouts = await import('./nextLayout.ts');
});
after(() => rmSync(files, { recursive: true, force: true }));

/** What `nextLayout` says on the console, and whether it stopped the server. */
const run = (raw: string, enabled: boolean) => {
  const said: string[] = [];
  const exit = mock.method(process, 'exit', (code?: number) => {
    throw new Error(`exit ${code}`);
  });
  const record = (...args: unknown[]) => said.push(args.map(String).join(' '));
  mock.method(console, 'error', record);
  mock.method(console, 'warn', record);
  let layout: unknown;
  let stopped = false;
  try {
    layout = layouts.nextLayout(raw, enabled);
  } catch (error) {
    stopped = /exit 1/.test(String(error));
    if (!stopped) throw error;
  } finally {
    mock.restoreAll();
  }
  return { layout, stopped, said: said.join('\n'), exits: exit.mock.callCount() };
};

describe('KA_NEXT_LAYOUT', () => {
  test('takes the layout as the JSON itself or from a file', () => {
    assert.deepEqual(run(JSON.stringify(ANOTHER), true).layout, ANOTHER);
    assert.deepEqual(run(`  ${JSON.stringify(TEMPLATE)}\n`, true).layout, TEMPLATE);
    assert.deepEqual(
      run(inFile('another.json', JSON.stringify(ANOTHER)), true).layout,
      ANOTHER,
    );
  });

  test('unset or empty, there is no layout and nothing is said', () => {
    for (const raw of [undefined, '', '   ']) {
      const said: string[] = [];
      mock.method(console, 'warn', (...args: unknown[]) => said.push(args.join(' ')));
      mock.method(console, 'error', (...args: unknown[]) => said.push(args.join(' ')));
      try {
        assert.equal(layouts.nextLayout(raw, true), undefined);
      } finally {
        mock.restoreAll();
      }
      assert.deepEqual(said, []);
    }
  });

  test("refuses a bad layout: it breaks genki's rules, named by rule and path, and the server stops", () => {
    const bad = {
      ...TEMPLATE,
      zones: { ...TEMPLATE.zones, main: [...TEMPLATE.zones.main, { block: 'no-such-block' }] },
      profile: {
        assistantName: 'x'.repeat(81),
        corpora: { kudos: { documentLinks: { digits: 'http://kudos.dfo.no/documents/{id}' } } },
      },
    };
    const { layout, stopped, exits, said } = run(JSON.stringify(bad), true);
    assert.equal(layout, undefined);
    assert.ok(stopped);
    assert.equal(exits, 1);
    assert.match(said, /KA_NEXT_LAYOUT is refused: it breaks 3 of genki’s layout rules:/);
    assert.match(said, /unknown-block \{"block":"no-such-block","zone":"main"\}/);
    assert.match(said, /text-too-long \{"path":"profile.assistantName","max":80\}/);
    assert.match(
      said,
      /link-not-https \{"path":"profile.corpora.kudos.documentLinks.digits"\}/,
    );
  });

  test('refuses a bad layout: not an AssistantLayout v1, and the server stops', () => {
    for (const shape of [
      { ...TEMPLATE, version: 2 },
      { ...TEMPLATE, look: 'retro' },
      { ...TEMPLATE, zones: { primary: [], main: [] } },
      { ...TEMPLATE, profile: { suggestions: 'one' } },
      [TEMPLATE],
    ]) {
      const { stopped, said } = run(JSON.stringify(shape), true);
      assert.ok(stopped, JSON.stringify(shape));
      assert.match(said, /KA_NEXT_LAYOUT is refused: it is not an AssistantLayout v1/);
    }
  });

  test('refuses a bad layout without quoting it: not JSON, no such file, too large', () => {
    const secret = 'sk-live-0123456789abcdef';
    const cases: [string, RegExp][] = [
      [`{"version":1,"zones":${secret}}`, /it is not valid JSON\.$/],
      [`/no/such/${secret}.json`, /nor the path of a file that can be read\.$/],
      [`${secret}`, /nor the path of a file that can be read\.$/],
      [
        `{"version":1,"pad":"${secret}${'x'.repeat(layouts.LAYOUT_MAX_BYTES)}"}`,
        /it is larger than 65536 bytes\.$/,
      ],
      [
        inFile('large.json', `{"pad":"${secret}${'x'.repeat(layouts.LAYOUT_MAX_BYTES)}"}`),
        /the file is larger than 65536 bytes\.$/,
      ],
      [inFile('broken.json', `{"version":1,"zones":${secret}`), /it is not valid JSON\.$/],
    ];
    for (const [raw, reason] of cases) {
      const { stopped, said } = run(raw, true);
      assert.ok(stopped, said);
      assert.match(said, reason);
      assert.doesNotMatch(said, /sk-live/);
    }
  });

  test('a bad layout is warned about and ignored while KA_NEXT is off, so apps/web starts', () => {
    const { layout, stopped, exits, said } = run('{"version":1}', false);
    assert.equal(layout, undefined);
    assert.equal(stopped, false);
    assert.equal(exits, 0);
    assert.match(said, /KA_NEXT_LAYOUT is refused: it is not an AssistantLayout v1/);
    assert.match(said, /Ignored while KA_NEXT is off\./);
  });

  test("refuses to start when genki's checks cannot be loaded", () => {
    const said: string[] = [];
    mock.method(console, 'error', (...args: unknown[]) => said.push(args.join(' ')));
    mock.method(process, 'exit', (code?: number) => {
      throw new Error(`exit ${code}`);
    });
    try {
      assert.throws(
        () =>
          layouts.nextLayout(JSON.stringify(TEMPLATE), true, () => {
            throw new Error('missing');
          }),
        /exit 1/,
      );
    } finally {
      mock.restoreAll();
    }
    assert.match(said.join('\n'), /genki's layout checks could not be loaded/);
  });

  test("runs genki's own checks, from the vendored ui-blocks as they are", () => {
    const genki = layouts.layoutChecks();
    assert.equal(genki.isAssistantLayout(TEMPLATE), true);
    assert.deepEqual(genki.layoutProblems(TEMPLATE as never), []);
    assert.deepEqual(
      genki
        .layoutProblems({ ...TEMPLATE, zones: { ...TEMPLATE.zones, primary: [] } } as never)
        .map((problem) => problem.rule),
      [],
    );
    assert.deepEqual(
      genki
        .layoutProblems({
          ...TEMPLATE,
          zones: { primary: [], main: [{ block: 'sources' }], secondary: [] },
        } as never)
        .map((problem) => problem.rule),
      ['zone-not-allowed'],
    );
  });
});

describe('/api/next/me with KA_NEXT_LAYOUT', () => {
  test('carries the layout, its profile included, for the page to draw', async () => {
    const res = await app.request('/api/next/me');
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.deepEqual(body.layout, ANOTHER);
    assert.equal(body.model, 'kunnskapsassistenten__default');
  });
});
