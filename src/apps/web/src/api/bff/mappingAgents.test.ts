import { describe, expect, it } from 'vitest';
import type { BffModels } from './contract';
import models from './fixtures/models.json';
import { agentsFromBff } from './mapping';

/** `GET /api/models` from the BFF on :8791, recorded 06.10. */
const recorded = (models as BffModels).agents;
const DEFAULT_TOOL = 'builtin.agent-rag-agent__agent-rag-graph-bundled';

describe('agentsFromBff', () => {
  it('gir hver agent med navnet og beskrivelsen BFF-en har', () => {
    const { agents } = agentsFromBff(recorded, DEFAULT_TOOL);

    expect(agents.map((agent) => agent.label)).toEqual([
      'agent-rag',
      'ai-overview',
      'fact-checker',
      'research-assistant',
      'retrieve-only',
      'digdir/altinn-docs-tuned',
      'altinn-docs-default',
      'e2e/altinn-docs-tuned',
    ]);
    expect(agents[0]?.description).toBe('General-purpose agentic retrieval assistant.');
  });

  it('sender standardmodusen til agenten, og tilbyr ikke modusene', () => {
    const { agents } = agentsFromBff(recorded, DEFAULT_TOOL);
    const research = agents.find((agent) => agent.id === 'builtin/research-assistant-agent');

    // Its default is faithful, though bundled is listed first.
    expect(research?.model).toBe('builtin.research-assistant-agent__agent-rag-graph-faithful');
  });

  it('kjenner igjen standarden fra verktøyet BFF-en svarer med', () => {
    expect(agentsFromBff(recorded, DEFAULT_TOOL).defaultId).toBe('builtin/agent-rag-agent');
    expect(
      agentsFromBff(recorded, 'builtin.research-assistant-agent__agent-rag-graph-bundled')
        .defaultId,
    ).toBe('builtin/research-assistant-agent');
  });

  it('har ingen standard når BFF-en ikke sier noe', () => {
    expect(agentsFromBff(recorded).defaultId).toBeUndefined();
    expect(agentsFromBff(recorded, 'ukjent.verktøy').defaultId).toBeUndefined();
  });

  it('tar ikke med en agent uten modus, og ingenting når lista mangler', () => {
    const { agents } = agentsFromBff([{ id: 'tom', label: 'tom', modes: [] }]);
    expect(agents).toEqual([]);
    expect(agentsFromBff(undefined)).toEqual({ agents: [] });
  });
});
