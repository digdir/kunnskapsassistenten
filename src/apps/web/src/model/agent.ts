/**
 * An agent the reader can put the question to: the assistant behind the
 * answer, chosen in the compose field.
 *
 * Behind the BFF the list is `GET /api/models`, which is the backend's
 * `/v1/models` grouped by agent. One agent can come in several modes (the
 * same work split into steps differently, for the backend's own evaluation);
 * the reader is not asked about those, and each agent goes with the mode it
 * marks as its default.
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
  /**
   * The agent the BFF answers with when no `model` is sent. Undefined when it
   * did not say.
   */
  defaultId?: string;
}
