import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Source } from '@ka/contract';
import { answerSources, recall } from './sourceStore.ts';

const source: Source = { docNum: 'd1', title: 'Årsrapport 2023', url: 'https://x', marker: 1 };
const done = { type: 'done', conversationId: 'c', insufficient: false } as const;

test('an answer without sources leaves none behind, not the answer before it', () => {
  const first = answerSources('c1');
  first({ type: 'sources', sources: [source] });
  first(done);

  // `ask` sends no `sources` event for an answer that has none.
  const second = answerSources('c1');
  second({ type: 'delta', text: 'Jeg fant ikke noe om det.' });
  second(done);

  assert.deepEqual(recall('c1'), []);
});

test('a turn that fails keeps the sources of the last answer', () => {
  const first = answerSources('c2');
  first({ type: 'sources', sources: [source] });
  first(done);

  const failed = answerSources('c2');
  failed({ type: 'error', message: 'Uventet feil mot backend.' });

  assert.deepEqual(recall('c2'), [source]);
});
