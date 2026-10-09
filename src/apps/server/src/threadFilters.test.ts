import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forget, forgetIfFailed, recall, remember } from './threadFilters.ts';

const done = { type: 'done', conversationId: 'c', insufficient: false } as const;

test('a thread keeps the filter it was started with', () => {
  remember('t1', { type: ['Evaluering'] });
  assert.deepEqual(recall('t1'), { type: ['Evaluering'] });
});

test('an empty selection is not stored', () => {
  remember('t2', { type: [] });
  assert.equal(recall('t2'), undefined);
});

test('a deleted thread forgets its filter', () => {
  remember('t3', { type: ['Årsrapport'] });
  forget('t3');
  assert.equal(recall('t3'), undefined);
});

test('a thread that was read recently outlives older ones', () => {
  remember('kept', { type: ['Evaluering'] });
  for (let i = 0; i < 499; i++) remember(`filler-${i}`, { type: ['Årsrapport'] });
  recall('kept');
  remember('one-more', { type: ['Årsrapport'] });
  assert.deepEqual(recall('kept'), { type: ['Evaluering'] });
  assert.equal(recall('filler-0'), undefined);
});

test('a thread whose first turn failed keeps no filter, so a follow-up is not stuck with it', () => {
  remember('t5', { concerned_years: ['2024'] });
  const note = forgetIfFailed('t5');
  note({ type: 'error', message: 'Søket ble avvist.', code: 'invalid_overrides' });
  assert.equal(recall('t5'), undefined);
});

test('the filter stays through a turn that has its answer', () => {
  remember('t6', { type: ['Evaluering'] });
  const note = forgetIfFailed('t6');
  note({ type: 'delta', text: 'Svaret.' });
  note(done);
  assert.deepEqual(recall('t6'), { type: ['Evaluering'] });
});
