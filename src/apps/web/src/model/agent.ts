/**
 * An agent the reader can put the question to, chosen in the compose field.
 * From the BFF's `GET /api/models`, grouped by agent; each uses its default
 * mode, since the modes exist for the backend's own evaluation.
 */
export interface Agent {
  /** The agent itself, such as `builtin/agent-rag-agent`. What a choice is kept as. */
  id: string;
  /** Its name, as the backend gives it. */
  label: string;
  /** One line on what it is for, as the backend gives it. */
  description?: string;
  /** What goes as `model` with the question: the agent's default mode. */
  model: string;
}

/** The agents, and which one answers when the question names none. */
export interface AgentList {
  agents: Agent[];
  /** The agent the BFF answers with when no `model` is sent. Undefined when it did not say. */
  defaultId?: string;
}
