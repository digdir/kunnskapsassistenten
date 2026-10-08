import { describe, expect, it } from 'vitest';
import { MockChatClient } from './MockChatClient';

describe('MockChatClient.listAgents', () => {
  it('gir en liten liste til demo og test, med en standard', async () => {
    const client = new MockChatClient({
      thinkingStepMs: 0,
      tokenMs: 0,
      sourcesMs: 0,
      requestMs: 0,
    });

    const { agents, defaultId } = await client.listAgents();

    expect(agents.map((agent) => agent.label)).toEqual([
      'agent-rag',
      'research-assistant',
      'fact-checker',
    ]);
    expect(defaultId).toBe('builtin/agent-rag-agent');
    expect(agents.every((agent) => agent.description && agent.model)).toBe(true);
  });
});
