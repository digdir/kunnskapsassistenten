import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { toAgents } from './models.ts';

describe('toAgents', () => {
  test('one entry per agent, with its modes nested', () => {
    const agents = toAgents([
      {
        id: 'a',
        _agent_id: 'builtin/agent-rag-agent',
        _mode: 'agent-rag-graph-bundled',
        _default: true,
      },
      { id: 'b', _agent_id: 'builtin/agent-rag-agent', _mode: 'agent-rag-graph-faithful' },
    ]);
    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.label, 'agent-rag');
    assert.deepEqual(
      agents[0]?.modes.map((m) => m.label),
      ['bundled', 'faithful'],
    );
  });

  test('the default mode is the one the backend marks, not the first', () => {
    const agents = toAgents([
      {
        id: 'a',
        _agent_id: 'builtin/research-assistant-agent',
        _mode: 'agent-rag-graph-bundled',
      },
      {
        id: 'b',
        _agent_id: 'builtin/research-assistant-agent',
        _mode: 'agent-rag-graph-faithful',
        _default: true,
      },
    ]);
    assert.equal(agents[0]?.modes.find((m) => m.isDefault)?.label, 'faithful');
  });

  test('two agents sharing a short name are qualified by namespace', () => {
    const agents = toAgents([
      { id: 'a', _agent_id: 'digdir/altinn-docs-tuned', _mode: 'agent-rag-graph-bundled' },
      { id: 'b', _agent_id: 'e2e/altinn-docs-tuned', _mode: 'agent-rag-graph-bundled' },
    ]);
    assert.deepEqual(
      agents.map((a) => a.label),
      ['digdir/altinn-docs-tuned', 'e2e/altinn-docs-tuned'],
    );
  });

  test('a single-mode agent still carries one mode, so the caller has a tool id', () => {
    const agents = toAgents([
      {
        id: 'builtin.fact-checker-agent__fact-checker',
        _agent_id: 'builtin/fact-checker-agent',
        _mode: 'fact-checker',
      },
    ]);
    assert.equal(agents[0]?.label, 'fact-checker');
    assert.equal(agents[0]?.modes.length, 1);
    assert.equal(agents[0]?.modes[0]?.id, 'builtin.fact-checker-agent__fact-checker');
  });

  test('the agent id is derived from the tool name when the backend omits it', () => {
    const agents = toAgents([{ id: 'builtin.agent-rag-agent__agent-rag-graph-bundled' }]);
    assert.equal(agents[0]?.label, 'agent-rag');
    assert.equal(agents[0]?.modes[0]?.label, 'bundled');
  });
});
