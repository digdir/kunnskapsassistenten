import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ComposerContext } from './composerContext';
import { useComposerPresence, useComposerRegistry } from './useComposerPresence';

/**
 * The two ends of «finnes det et skrivefelt på skjermen»: a view that reports
 * one, and the shell that draws a skip link to it.
 *
 * What is under test is the bookkeeping between them, so neither end is the
 * real one: `Reporter` stands in for the chat view and `Harness` for the
 * shell. The answer they agree on is written into the document as a word, the
 * way the shell writes it as a link.
 */
function Reporter({ present }: { present: boolean }) {
  useComposerPresence(present);
  return null;
}

function Harness({ children }: { children: ReactNode }) {
  const registry = useComposerRegistry();

  return (
    <ComposerContext value={registry}>
      <p>{registry.hasComposer ? 'skrivefelt' : 'ikke noe skrivefelt'}</p>
      {children}
    </ComposerContext>
  );
}

function answer(): string | null {
  return screen.getByRole('paragraph').textContent;
}

describe('useComposerPresence', () => {
  it('sier nei når ingen melder fra', () => {
    render(<Harness>{null}</Harness>);
    expect(answer()).toBe('ikke noe skrivefelt');
  });

  it('sier ja så lenge noen melder fra', () => {
    render(
      <Harness>
        <Reporter present />
      </Harness>,
    );
    expect(answer()).toBe('skrivefelt');
  });

  it('sier nei igjen når den samme melder fra om at feltet er borte', () => {
    // «Fant ikke tråden»: samme komponent står, men tegner noe annet. Det er
    // denne veien feilen gikk — lenka ble stående på en tråd som ikke fantes.
    const { rerender } = render(
      <Harness>
        <Reporter present />
      </Harness>,
    );
    expect(answer()).toBe('skrivefelt');

    rerender(
      <Harness>
        <Reporter present={false} />
      </Harness>,
    );
    expect(answer()).toBe('ikke noe skrivefelt');
  });

  it('sier nei når den som meldte fra forsvinner helt', () => {
    const { rerender } = render(
      <Harness>
        <Reporter present />
      </Harness>,
    );

    rerender(<Harness>{null}</Harness>);
    expect(answer()).toBe('ikke noe skrivefelt');
  });

  it('holder på svaret mens to skrivefelt overlapper', () => {
    // React monterer det som kommer før det river ned det som går, så to felt
    // finnes samtidig i ett commit når et view avløser et annet. Et flagg
    // ville sagt «ingen» midt i vekslinga, med et felt på skjermen hele tida.
    const { rerender } = render(
      <Harness>
        <Reporter key="a" present />
        <Reporter key="b" present />
      </Harness>,
    );
    expect(answer()).toBe('skrivefelt');

    rerender(
      <Harness>
        <Reporter key="b" present />
      </Harness>,
    );
    expect(answer()).toBe('skrivefelt');

    rerender(<Harness>{null}</Harness>);
    expect(answer()).toBe('ikke noe skrivefelt');
  });
});
