import { useEffect, useState } from 'react';
import type { ChatClient } from '../../api';
import { storeAgentId, storedAgentId } from '../../api/agentChoice';
import type { Agent, AgentList } from '../../model';

export type AgentChoice = {
  /** Every agent the client offers. Fewer than two, and there is nothing to choose. */
  agents: Agent[];
  /** The agent shown as chosen: the reader's own choice, or else the default. */
  current?: Agent;
  /**
   * What goes as `model` with the question. Undefined unless the reader has
   * chosen an agent away from the default, so the backend decides the default
   * itself and a reader on it follows when it changes.
   */
  model?: string;
  choose: (id: string) => void;
};

/**
 * The agents for the choice in the compose field, and which one is chosen.
 *
 * Fetched per view and not kept between them. Behind the BFF, listing the
 * agents is also what makes it accept a `model` at all (`BffModels`), so a
 * list from before a restart of the BFF would offer choices it then ignores.
 *
 * A kept choice that is no longer in the list falls back to the default
 * without being forgotten: an agent that comes back is still the reader's.
 */
export function useAgents(client: ChatClient): AgentChoice {
  const [list, setList] = useState<AgentList>({ agents: [] });
  const [chosenId, setChosenId] = useState<string | undefined>(() => storedAgentId());

  useEffect(() => {
    if (!client.listAgents) return;
    const controller = new AbortController();
    client
      .listAgents(controller.signal)
      .then((found) => {
        if (!controller.signal.aborted) setList(found);
      })
      // No list is no choice, and the question goes to the default.
      .catch(() => {});
    return () => controller.abort();
  }, [client]);

  const chosen = list.agents.find((agent) => agent.id === chosenId);
  const current = chosen ?? list.agents.find((agent) => agent.id === list.defaultId);

  function choose(id: string) {
    // The default is kept as no choice at all, so it stays the BFF's to say.
    const next = id === list.defaultId ? undefined : id;
    storeAgentId(next);
    setChosenId(next);
  }

  return { agents: list.agents, current, model: chosen?.model, choose };
}
