import { fireEvent, render, screen } from '@testing-library/react';
import { createRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('keeps the alert container in the DOM while there is no error', () => {
    const { container } = render(<ErrorState />);

    // The container has to exist before the message does, otherwise a screen
    // reader announces nothing when the error arrives.
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(screen.queryByRole('alert')?.textContent).toBe('');
  });

  it('shows the message and a retry button when there is one', () => {
    render(<ErrorState title="Svaret feilet" message="Prøv igjen om litt." onRetry={() => {}} />);

    expect(screen.getByRole('alert').textContent).toContain('Prøv igjen om litt.');
    expect(screen.getByRole('button', { name: 'Prøv igjen' })).toBeTruthy();
  });

  it('moves focus to the given target when the retry clears the error', () => {
    const target = createRef<HTMLButtonElement>();

    function Host() {
      const [failed, setFailed] = useState(true);
      return (
        <>
          <button type="button" ref={target}>
            Lista som kom
          </button>
          <ErrorState
            message={failed ? 'Klarte ikke å hente.' : undefined}
            onRetry={() => setFailed(false)}
            focusAfterRetry={target}
          />
        </>
      );
    }

    render(<Host />);
    const retry = screen.getByRole('button', { name: 'Prøv igjen' });
    retry.focus();
    fireEvent.click(retry);

    // The button that made itself disappear must hand focus on, or the next
    // Tab starts over at the skip link.
    expect(screen.queryByRole('button', { name: 'Prøv igjen' })).toBeNull();
    expect(document.activeElement).toBe(target.current);
  });

  it('falls back to the alert region when no target is given', () => {
    function Host() {
      const [failed, setFailed] = useState(true);
      return (
        <ErrorState
          message={failed ? 'Klarte ikke å hente.' : undefined}
          onRetry={() => setFailed(false)}
        />
      );
    }

    render(<Host />);
    const region = screen.getByRole('alert');
    const retry = screen.getByRole('button', { name: 'Prøv igjen' });
    retry.focus();
    fireEvent.click(retry);

    expect(document.activeElement).toBe(region);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('leaves focus alone when the error clears on its own', () => {
    const elsewhere = createRef<HTMLButtonElement>();

    function Host({ failed }: { failed: boolean }) {
      return (
        <>
          <button type="button" ref={elsewhere}>
            Et annet sted
          </button>
          <ErrorState message={failed ? 'Klarte ikke å hente.' : undefined} onRetry={() => {}} />
        </>
      );
    }

    const { rerender } = render(<Host failed />);
    elsewhere.current?.focus();
    // No retry was clicked, so nothing may reach in and move the user.
    rerender(<Host failed={false} />);

    expect(document.activeElement).toBe(elsewhere.current);
  });
});

describe('EmptyState', () => {
  it('is not an alert: nothing missing is an error', () => {
    render(<EmptyState title="Ingen kilder ennå" description="Still et spørsmål først." />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Ingen kilder ennå' })).toBeTruthy();
  });

  it('is drawn small inside a panel, where what is missing is part of it', () => {
    render(<EmptyState title="Ingen treff" />);

    // 18 px, under a panel head at 21 or 24. This is the case the size was
    // written for, and it is the one that must not change.
    expect(screen.getByRole('heading', { name: 'Ingen treff' }).getAttribute('data-size')).toBe(
      '2xs',
    );
  });

  it('is drawn in the answer column`s own voice when it IS the page', () => {
    render(<EmptyState level={2} title="Siden finnes ikke" />);

    // `lg` is the size «Hei 👋 / Hva lurer du på?» and a thread title are
    // already drawn at, and this stands where they would have stood. At
    // `2xs` it was the smallest thing on a page it was the whole of — funn 2
    // in docs/review/brukerblikk-2-2026-09-15.md.
    expect(
      screen.getByRole('heading', { name: 'Siden finnes ikke' }).getAttribute('data-size'),
    ).toBe('lg');
  });

  it('reads the size off the level, so the two cannot disagree', () => {
    // No second prop to get wrong: where it sits is one fact, asked once.
    const { rerender } = render(<EmptyState level={3} title="Ingenting" />);
    const size = () => screen.getByRole('heading', { name: 'Ingenting' }).getAttribute('data-size');
    expect(size()).toBe('2xs');

    rerender(<EmptyState level={4} title="Ingenting" />);
    expect(size()).toBe('2xs');

    rerender(<EmptyState level={2} title="Ingenting" />);
    expect(size()).toBe('lg');
  });
});
