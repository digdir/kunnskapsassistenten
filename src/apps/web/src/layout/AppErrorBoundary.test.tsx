import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

/**
 * The page that stands where the app was, instead of a white window.
 *
 * What this measures is the boundary: that an error below it gives a page with
 * a name, a way out and the error text. The error actually seen is thrown
 * by the DOM in a real browser, in React's commit phase, and is measured there
 * (design/_briefs/bygg/maalt-hvit-skjerm-ny-traad.md). jsdom has no page
 * translator to move nodes from under React.
 */
function Throws({ error }: { error: Error }): never {
  throw error;
}

beforeEach(() => {
  // React logs every error a boundary catches. It is expected here, and it
  // would bury the result of the run.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppErrorBoundary', () => {
  it('lar appen være når ingenting feiler', () => {
    render(
      <AppErrorBoundary>
        <p>Appen</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('Appen')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Noe gikk galt' })).toBeNull();
  });

  it('viser en side med overskrift og «Last inn på nytt» i stedet for en hvit skjerm', () => {
    render(
      <AppErrorBoundary>
        <Throws error={new Error('noe røk')} />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('main')).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Noe gikk galt' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Last inn på nytt' })).toBeDefined();
    // Feilteksten ligger bak Details, så den kan kopieres inn i en melding.
    expect(screen.getByText(/Error: noe røk/)).toBeDefined();
  });

  it('gir overskriften fokus, for det som hadde fokus, er borte', () => {
    render(
      <AppErrorBoundary>
        <Throws error={new Error('noe røk')} />
      </AppErrorBoundary>,
    );
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1, name: 'Noe gikk galt' }),
    );
  });

  it('laster inn på nytt når knappen trykkes', () => {
    const onReload = vi.fn();
    render(
      <AppErrorBoundary onReload={onReload}>
        <Throws error={new Error('noe røk')} />
      </AppErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Last inn på nytt' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('nevner utvidelser og oversettelse bare for feilen DOM-en gir når noden er flyttet', () => {
    const moved = new DOMException(
      "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
      'NotFoundError',
    );
    const { unmount } = render(
      <AppErrorBoundary>
        <Throws error={moved as unknown as Error} />
      </AppErrorBoundary>,
    );
    expect(screen.getByText(/utvidelse i nettleseren/)).toBeDefined();
    unmount();

    render(
      <AppErrorBoundary>
        <Throws error={new TypeError('x is undefined')} />
      </AppErrorBoundary>,
    );
    expect(screen.queryByText(/utvidelse i nettleseren/)).toBeNull();
  });
});
