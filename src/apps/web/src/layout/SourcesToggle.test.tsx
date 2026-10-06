import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SourceDocument } from '../model';
import { resetViewport, setViewportWidth } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { Shell } from './Shell';
import { useAnswerSources } from './useAnswerSources';
import { useLayout } from './useLayout';

/**
 * The button that opens the sources panel says what it does and nothing
 * more: no count of the documents behind it, on screen or in its name
 * (issue 87).
 *
 * Measured on the rail, with an answer's sources recorded, because that is
 * the one state the count used to appear in.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const threeDocuments = [
  { id: 'd1', title: 'Årsrapport 2022', excerpts: [] },
  { id: 'd2', title: 'Årsrapport 2023', excerpts: [] },
  { id: 'd3', title: 'Årsrapport 2024', excerpts: [] },
] as unknown as SourceDocument[];

/**
 * Records an answer's sources, the way the chat view does when one lands.
 *
 * On a click after render and not in an effect: `<Shell routeOwnsMain />`
 * is a page with no chat view, and it clears the sources when it mounts
 * (`useNoAnswers`), after any effect of this component has run.
 */
function AnswerWithSources() {
  const { setDocuments } = useAnswerSources();
  const { setCollapsed } = useLayout();

  return (
    <>
      <button type="button" onClick={() => setDocuments(threeDocuments)}>
        Svar med kilder
      </button>
      <button type="button" onClick={() => setCollapsed('secondary-sidebar', true)}>
        Brett sammen kildepanelet
      </button>
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  resetViewport();
});

describe('knappen til kildepanelet', () => {
  it('har ikke noe tall når panelet er lagt sammen med kilder bak seg', () => {
    setViewportWidth(1440);
    render(
      <MemoryRouter initialEntries={['/']}>
        <LayoutProvider>
          <AnswerWithSources />
          <Shell routeOwnsMain />
        </LayoutProvider>
      </MemoryRouter>,
    );

    act(() => screen.getByRole('button', { name: 'Svar med kilder' }).click());
    act(() => screen.getByRole('button', { name: 'Brett sammen kildepanelet' }).click());

    const sources = document.querySelector('.secondary-sidebar');
    expect(sources?.hasAttribute('data-collapsed')).toBe(true);
    expect(screen.getByRole('button', { name: 'Vis kilder' })).toBeTruthy();
    expect(sources?.querySelector('.ds-badge')).toBeNull();
  });
});
