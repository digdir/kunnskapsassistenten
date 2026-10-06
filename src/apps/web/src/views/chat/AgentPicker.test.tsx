import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MOCK_AGENTS } from '../../api/mock/MockChatClient';
import { AgentPicker } from './AgentPicker';

const { agents } = MOCK_AGENTS;
const [agentRag, research] = agents;

function show(current = agentRag, onChoose = vi.fn()) {
  render(<AgentPicker agents={agents} current={current} onChoose={onChoose} />);
  return onChoose;
}

const trigger = () => screen.getByRole('button', { name: /^Agent: / });
/** The list is a closed popover in jsdom, so its buttons are hidden. */
const option = (name: string) =>
  screen.getByRole('button', { name: new RegExp(`^${name}`), hidden: true });

describe('AgentPicker', () => {
  it('er en knapp med navnet på agenten som er valgt, og sier hva den velger', () => {
    show();

    expect(trigger().textContent).toBe('agent-rag');
    expect(trigger().getAttribute('aria-label')).toBe('Agent: agent-rag');
    expect(trigger().closest('.ds-button')?.getAttribute('data-variant')).toBe('tertiary');
  });

  it('lister hver agent med navn og beskrivelse, og haken ved den valgte', () => {
    show(research);

    const chosen = option('research-assistant');
    expect(chosen.textContent).toContain('Breadth-first retrieval');
    expect(chosen.getAttribute('aria-current')).toBe('true');
    expect(chosen.querySelector('svg.ka-agent-picker__check')).toBeTruthy();
    expect(option('fact-checker').getAttribute('aria-current')).toBeNull();
    expect(option('fact-checker').querySelector('svg.ka-agent-picker__check')).toBeNull();
  });

  it('sier fra om valget og gir fokus tilbake til knappen', () => {
    const onChoose = show();

    fireEvent.click(trigger());
    fireEvent.click(option('fact-checker'));

    expect(onChoose).toHaveBeenCalledWith('builtin/fact-checker-agent');
    expect(document.activeElement).toBe(trigger());
  });

  it('vises ikke når det ikke er noe å velge mellom', () => {
    const { container } = render(
      <AgentPicker agents={[agentRag!]} current={agentRag} onChoose={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('sier «Standard» når BFF-en ikke har sagt hvilken agent som er standard', () => {
    render(<AgentPicker agents={agents} onChoose={() => {}} />);
    expect(trigger().textContent).toContain('Standard');
  });
});
