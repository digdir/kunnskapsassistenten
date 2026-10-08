import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ThinkingStep } from '../../model';
import { ThinkingPanel } from './ThinkingPanel';

/*
 * Designsystemet's Spinner runs through useSynchronizedAnimation, which asks
 * document.getAnimations; jsdom has no Web Animations. Local to this file:
 * only the «Tenker …» summary renders a Spinner.
 */
if (typeof document.getAnimations !== 'function') {
  document.getAnimations = () => [];
}

const steps: ThinkingStep[] = [
  { id: 's1', kind: 'reasoning', label: 'Jeg deler spørsmålet i to.' },
  {
    id: 's2',
    kind: 'search',
    label: 'Jeg søker i årsrapportene.',
    detail: '60 utdrag funnet, 10 beholdt.',
    durationMs: 2410,
  },
  { id: 's3', kind: 'read', label: 'Jeg leser de mest relevante utdragene.', durationMs: 1600 },
];

function details() {
  return document.querySelector('details') as HTMLDetailsElement;
}

describe('ThinkingPanel', () => {
  it('draws nothing before the first step', () => {
    const { container } = render(<ThinkingPanel status="thinking" steps={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('opens itself while it thinks, and shows the steps as they came', () => {
    render(<ThinkingPanel status="thinking" steps={steps} />);

    expect(screen.getByText('Tenker …')).toBeTruthy();
    expect(details().open).toBe(true);

    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Jeg deler spørsmålet i to.',
      'Jeg søker i årsrapportene.60 utdrag funnet, 10 beholdt.',
      'Jeg leser de mest relevante utdragene.',
    ]);

    // Only the newest one is being worked on, and it says so without a live
    // region and without relying on colour.
    expect(items.filter((item) => item.getAttribute('aria-current') === 'step')).toHaveLength(1);
    expect(items.at(-1)?.getAttribute('aria-current')).toBe('step');
  });

  it('folds away when the answer starts, and says how long it took', () => {
    const { rerender } = render(<ThinkingPanel status="thinking" steps={steps} />);
    rerender(<ThinkingPanel status="done" steps={steps} thoughtMs={2400} />);

    expect(details().open).toBe(false);
    // The number the turn was measured at, not one this panel worked out: the
    // same turn has to say the same thing after a reload (brukerblikk runde 2,
    // funn 5).
    expect(screen.getByText('Tenkte i 2 sekunder')).toBeTruthy();
    expect(screen.queryByText('Tenker …')).toBeNull();
    expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(0);
  });

  it('prefers the measured time over what the steps reported', () => {
    // The steps add up to 4010 ms; the clock said 2,4 seconds. The clock is
    // the wait the reader sat through, and it is what was written down.
    render(<ThinkingPanel status="done" steps={steps} thoughtMs={2400} />);

    expect(screen.getByText('Tenkte i 2 sekunder')).toBeTruthy();
  });

  it('falls back to what the steps reported for a turn nobody watched', () => {
    // A fixture thread: the steps are stored, nobody ever timed the wait.
    // 2410 + 1600 = 4010 ms.
    render(<ThinkingPanel status="done" steps={steps} />);

    expect(screen.getByText('Tenkte i 4 sekunder')).toBeTruthy();
  });

  it('says «Tenkte» and no number when nothing timed itself', () => {
    render(<ThinkingPanel status="done" steps={[steps[0]!]} />);

    expect(screen.getByText('Tenkte')).toBeTruthy();
  });

  it('leaves it open once the reader has opened it', () => {
    const { rerender } = render(<ThinkingPanel status="thinking" steps={steps} />);
    rerender(<ThinkingPanel status="done" steps={steps} />);
    expect(details().open).toBe(false);

    // jsdom does not implement <details> toggling, so the open state is set
    // the way the browser would and the event fired by hand.
    details().open = true;
    fireEvent(details(), new Event('toggle'));

    rerender(<ThinkingPanel status="done" steps={steps} />);
    expect(details().open).toBe(true);
  });

  it('stays shut once the reader has shut it, while it is still thinking', () => {
    const { rerender } = render(<ThinkingPanel status="thinking" steps={steps} />);

    details().open = false;
    fireEvent(details(), new Event('toggle'));

    rerender(<ThinkingPanel status="thinking" steps={[...steps]} />);
    expect(details().open).toBe(false);
  });
});
