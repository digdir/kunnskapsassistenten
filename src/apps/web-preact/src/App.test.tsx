import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { App } from './App.tsx';

afterEach(cleanup);

beforeEach(() => {
  // The shell asks for the user, models and threads on mount; none is needed here.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 404 })),
  );
  Element.prototype.scrollIntoView = vi.fn();
});

const focusable = 'a[href], button:not([disabled]), input:not([disabled]), textarea, select';

describe('skip link', () => {
  test('is the first tab stop, ahead of the thread panel', () => {
    const { container } = render(<App />);
    const first = container.querySelector(focusable);
    expect(first).toBe(screen.getByRole('link', { name: 'Hopp til hovedinnhold' }));
    const threads = container.querySelector('nav.threads');
    expect(threads).not.toBeNull();
    expect(
      first!.compareDocumentPosition(threads!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test('points at the main landmark', () => {
    render(<App />);
    const link = screen.getByRole('link', { name: 'Hopp til hovedinnhold' });
    expect(link.getAttribute('href')).toBe('#main-content');
    expect(document.getElementById('main-content')).toBe(screen.getByRole('main'));
  });

  test("uses Designsystemet's skip link, hidden until focused", () => {
    render(<App />);
    expect(screen.getByRole('link', { name: 'Hopp til hovedinnhold' }).classList).toContain(
      'ds-skip-link',
    );
  });
});
