import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { OpenThreadContext } from './openThreadContext';
import { useOpenThread, useOpenThreadRegistry, useReportOpenThread } from './useOpenThread';

/**
 * The two ends of «hvilken samtale er på skjermen»: the view that holds the
 * conversation, and the thread list that marks its row.
 *
 * Neither end is the real one here — what is under test is the bookkeeping
 * between them. `Holder` stands in for the chat view and `Reader` for the
 * thread list, which writes the answer into the document the way the list
 * writes it into an attribute.
 */
function Holder({ threadId }: { threadId: string | undefined }) {
  useReportOpenThread(threadId);
  return null;
}

function Reader() {
  return <p>{useOpenThread() ?? 'ingen'}</p>;
}

function Shell({ children }: { children: ReactNode }) {
  const registry = useOpenThreadRegistry();

  return (
    <OpenThreadContext value={registry}>
      <Reader />
      {children}
    </OpenThreadContext>
  );
}

const open = () => screen.getByRole('paragraph').textContent;

describe('useOpenThread', () => {
  it('sier ingen når ingen holder en samtale', () => {
    render(<Shell>{null}</Shell>);
    expect(open()).toBe('ingen');
  });

  it('sier hvilken samtale som er på skjermen', () => {
    render(
      <Shell>
        <Holder threadId="nkom-maaloppnaaelse" />
      </Shell>,
    );
    expect(open()).toBe('nkom-maaloppnaaelse');
  });

  it('følger med når leseren går til en annen samtale', () => {
    const { rerender } = render(
      <Shell>
        <Holder threadId="nkom-maaloppnaaelse" />
      </Shell>,
    );

    rerender(
      <Shell>
        <Holder threadId="dss-regnskap" />
      </Shell>,
    );
    expect(open()).toBe('dss-regnskap');
  });

  it('glemmer den når den som holdt den tegner noe annet', () => {
    // «Fant ikke tråden»: adressen navngir en samtale, men ingen er på
    // skjermen. En merket rad ville pekt leseren på den de nettopp ikke fikk
    // åpnet.
    const { rerender } = render(
      <Shell>
        <Holder threadId="nkom-maaloppnaaelse" />
      </Shell>,
    );

    rerender(
      <Shell>
        <Holder threadId={undefined} />
      </Shell>,
    );
    expect(open()).toBe('ingen');
  });

  it('glemmer den når den som holdt den forsvinner helt', () => {
    // Ruta som tegner hovedkolonnen selv monterer ingen chat-view. Lista står
    // fortsatt der, og ingen av radene er åpne.
    const { rerender } = render(
      <Shell>
        <Holder threadId="nkom-maaloppnaaelse" />
      </Shell>,
    );

    rerender(<Shell>{null}</Shell>);
    expect(open()).toBe('ingen');
  });
});
