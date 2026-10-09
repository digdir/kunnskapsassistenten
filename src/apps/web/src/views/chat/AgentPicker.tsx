import { Dropdown } from '@digdir/designsystemet-react';
import { CheckmarkIcon, ChevronDownIcon } from '@navikt/aksel-icons';
import { useRef, useState } from 'react';
import type { Agent } from '../../model';
import { AGENT_DEFAULT_LABEL, AGENT_HEADING, AGENT_PREFIX } from './text';

type AgentPickerProps = {
  agents: Agent[];
  /** The agent shown as chosen. Undefined when the default is not known. */
  current?: Agent;
  onChoose: (id: string) => void;
};

/**
 * Which agent answers. A `Dropdown` of buttons and not an ARIA menu, which
 * without arrow keys and typeahead is worse than none; it has no selected
 * state, so the chosen one says so with `aria-current`.
 */
export function AgentPicker({ agents, current, onChoose }: AgentPickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (agents.length < 2) return null;
  const label = current?.label ?? AGENT_DEFAULT_LABEL;

  function choose(id: string) {
    setOpen(false);
    onChoose(id);
    // The list is gone, and the button that opened it is where the reader was.
    triggerRef.current?.focus();
  }

  return (
    <Dropdown.TriggerContext>
      {/* The name contains what the button shows, so voice control still
          hits it (WCAG 2.5.3). A label and not a hidden span, because engines
          differ on how the space between two spans is counted. */}
      <Dropdown.Trigger
        aria-label={`${AGENT_PREFIX}${label}`}
        className="ka-agent-picker__trigger"
        data-color="neutral"
        data-size="sm"
        ref={triggerRef}
        variant="tertiary"
      >
        <span className="ka-agent-picker__current">{label}</span>
        <ChevronDownIcon aria-hidden />
      </Dropdown.Trigger>
      {/* Above the button, since the field is at the bottom and a list below
          would open off the screen. Controlled, so a press inside the list
          does not close it on its own. */}
      <Dropdown
        className="ka-agent-picker"
        // Neutral, not the accent blue the list's buttons take by default: a
        // list of names to read and choose from, not a row of links.
        data-color="neutral"
        // The BFF lists eight agents, 663 px of list on a phone. `contain`
        // makes Designsystemet cap it at the room above the button and
        // scroll inside it, instead of running off the top of a short screen.
        data-overscroll="contain"
        data-size="sm"
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        open={open}
        placement="top-end"
      >
        <Dropdown.Heading>{AGENT_HEADING}</Dropdown.Heading>
        <Dropdown.List>
          {agents.map((agent) => {
            const chosen = agent.id === current?.id;
            return (
              <Dropdown.Item key={agent.id}>
                <Dropdown.Button
                  aria-current={chosen ? 'true' : undefined}
                  className="ka-agent-picker__option"
                  onClick={() => choose(agent.id)}
                >
                  <span className="ka-agent-picker__text">
                    <span className="ka-agent-picker__name">{agent.label}</span>
                    {agent.description ? (
                      <span className="ka-agent-picker__description">{agent.description}</span>
                    ) : null}
                  </span>
                  {chosen ? <CheckmarkIcon aria-hidden className="ka-agent-picker__check" /> : null}
                </Dropdown.Button>
              </Dropdown.Item>
            );
          })}
        </Dropdown.List>
      </Dropdown>
    </Dropdown.TriggerContext>
  );
}
