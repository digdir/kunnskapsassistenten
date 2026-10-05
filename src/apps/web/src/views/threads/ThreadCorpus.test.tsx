import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Thread } from '../../model';
import { ThreadsView } from './ThreadsView';

/**
 * Which corpus a thread was asked of, on the row.
 *
 * A thread is bound to the corpus it was started in — switching starts a new
 * one — so a list that mixes them has to say which is which, or two rows with
 * the same question mean different things and nothing on screen says so.
 *
 * Only when there is more than one corpus: the same word under every row is
 * noise, and the panel pays for it in height.
 */
const corpus = vi.hoisted(() => ({
  options: [
    { key: 'norquad-docs', label: 'Wikipedia (NorQuAD)' },
    { key: 'kudos-pilot', label: 'Kudos-pilot' },
  ],
  choosable: true,
}));

vi.mock('../../layout/useCorpus', () => ({
  useCorpus: () => ({
    options: corpus.options,
    active: 'norquad-docs',
    option: corpus.options[0],
    choosable: corpus.choosable,
    set: () => {},
  }),
}));

const now = new Date().toISOString();
const threads: Thread[] = [
  {
    id: 'a',
    title: 'Måloppnåelse i Nkom',
    createdAt: now,
    updatedAt: now,
    corpusKey: 'kudos-pilot',
  },
  { id: 'b', title: 'Hva er en fjord?', createdAt: now, updatedAt: now, corpusKey: 'norquad-docs' },
  { id: 'c', title: 'Eldre tråd uten korpus', createdAt: now, updatedAt: now },
];

function renderList() {
  return render(
    <MemoryRouter>
      <ThreadsView siblingViews={['threads']} onShowView={() => {}} threads={threads} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  corpus.choosable = true;
});

describe('korpus på trådraden', () => {
  it('sier hvilket korpus hver tråd hører til', () => {
    renderList();

    expect(screen.getByText('Kudos-pilot')).toBeTruthy();
    expect(screen.getByText('Wikipedia (NorQuAD)')).toBeTruthy();
  });

  it('lar en tråd uten korpus stå uten merke', () => {
    // Tråder laget før valget fantes har ingen nøkkel, og en gjetning her
    // ville vært en påstand om hvor svarene kom fra.
    const { container } = renderList();

    const rows = [...container.querySelectorAll('.threads-view__item')];
    const older = rows.find((row) => row.textContent?.includes('Eldre tråd uten korpus'));
    expect(older?.querySelector('.threads-view__corpus')).toBeNull();
  });

  it('sier ingenting når det bare finnes ett korpus', () => {
    corpus.choosable = false;
    const { container } = renderList();

    expect(container.querySelectorAll('.threads-view__corpus')).toHaveLength(0);
  });

  it('holder korpuset utenfor lenkas navn, men inne i raden', () => {
    // Samme grunn som tidsstempelet: navnet på raden er tittelen, ikke
    // tittelen pluss hvor den ble spurt. Siden 23.09 er hele raden lenka, så
    // korpuset STÅR inni den – navnet kommer fra `aria-labelledby`, som
    // peker på tittel-spannet alene.
    renderList();

    const link = screen.getByRole('link', { name: 'Måloppnåelse i Nkom' });
    expect(link.textContent).toContain('Kudos-pilot');

    const labelledBy = link.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)?.textContent).toBe('Måloppnåelse i Nkom');
  });
});
