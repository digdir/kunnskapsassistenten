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
 * Which agent answers, chosen in the compose field beside the send button,
 * the way claude.ai chooses its model (Lars, 06.10).
 *
 * The button is the agent's name and nothing else: no frame and no fill
 * (`tertiary`), because «it is information until you press it». It opens a
 * list with each agent's name, its one line of description, and a check by
 * the one that is chosen.
 *
 * Designsystemet's `Dropdown`, which is a list of buttons and not an ARIA
 * menu, and on purpose: a `role="menu"` without the arrow keys and typeahead
 * of the pattern would be worse than none (dropdown.md, «Tilgjengelighet»),
 * and Tab between a handful of buttons reads plainly. The dropdown has no
 * selected state of its own, so the chosen one says it with `aria-current`
 * and the check is decoration.
 *
 * Nothing at all with fewer than two agents: one agent is no choice.
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
      {/*
        The name says what the button changes, and contains what it shows, so
        a reader who says the visible word to their voice control still hits
        it (WCAG 2.5.3). A label and not a hidden span before the name: how a
        space between two spans is counted differs between engines.
      */}
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
      {/*
        Above the button, since the field is at the bottom of the window and
        a list below it would open off the screen. Controlled, as in
        ThreadMenu: a press inside the list does not close it on its own.
      */}
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
