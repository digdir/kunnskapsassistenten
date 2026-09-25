import type { AgentOption } from '@ka/contract';

export interface BackendModel {
  id: string;
  description?: string;
  _default?: boolean;
  _mode?: string;
  _agent_id?: string;
}

export function toAgents(data: BackendModel[]): AgentOption[] {
  const rows = data.map((m) => {
    const agentId = m._agent_id ?? m.id.split('__')[0] ?? m.id;
    const short = (agentId.split(/[/.]/).pop() ?? m.id).replace(/-agent$/, '');
    const mode = (m._mode ?? m.id.split('__')[1] ?? '').replace(/^agent-rag-graph-/, '');
    // `description` is "<agent> — <mode>: <internals>".
    const description = (m.description ?? '').split(/\s+—\s+/)[0]?.trim();
    return { toolId: m.id, agentId, short, mode, isDefault: Boolean(m._default), description };
  });

  const agentsByShort = new Map<string, Set<string>>();
  for (const r of rows) {
    const seen = agentsByShort.get(r.short) ?? new Set<string>();
    seen.add(r.agentId);
    agentsByShort.set(r.short, seen);
  }

  const byAgent = new Map<string, AgentOption>();
  for (const r of rows) {
    // Distinct agents, not rows: one agent with two modes is not ambiguous.
    const label =
      (agentsByShort.get(r.short)?.size ?? 0) > 1
        ? `${r.agentId.split(/[/.]/).slice(0, -1).join('/')}/${r.short}`
        : r.short;
    const entry = byAgent.get(r.agentId) ?? {
      id: r.agentId,
      label,
      ...(r.description ? { description: r.description } : {}),
      modes: [],
    };
    entry.modes.push({ id: r.toolId, label: r.mode || label, isDefault: r.isDefault });
    byAgent.set(r.agentId, entry);
  }
  return [...byAgent.values()];
}
