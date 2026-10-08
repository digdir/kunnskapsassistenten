import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import type { Source } from '@ka/contract';
import { afterEach, describe, expect, test } from 'vitest';
import { SourcesPanel } from './SourcesPanel.tsx';

afterEach(cleanup);

const sources: Source[] = [
  {
    docNum: '413482',
    title: 'Status og forslag til videre arbeid med kunstig intelligens',
    url: 'https://kudos.example/documents/413482',
    marker: 1,
    excerpt: 'De regionale helseforetakene har alle en rekke aktiviteter.',
  },
  {
    docNum: '4240',
    title: 'Årsrapport Digitaliseringsdirektoratet 2020',
    url: 'https://kudos.example/documents/4240',
    marker: 2,
  },
];

const show = (over: Partial<Parameters<typeof SourcesPanel>[0]> = {}) =>
  render(<SourcesPanel sources={sources} open onToggle={() => {}} {...over} />).container;

const shortcuts = (host: Element) =>
  [...host.querySelectorAll('.shortcut')].map((li) => li.textContent);

describe('SourcesPanel', () => {
  test('numbers the shortcuts by marker, so [N] in the answer resolves', () => {
    expect(shortcuts(show()).map((t) => t?.[0])).toEqual(['1', '2']);
  });

  test('every shortcut links to the document and opens in a new tab', () => {
    const links = [...show().querySelectorAll('.shortcut a')] as HTMLAnchorElement[];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://kudos.example/documents/413482',
      'https://kudos.example/documents/4240',
    ]);
    expect(links.every((a) => a.getAttribute('rel') === 'noreferrer')).toBe(true);
  });

  test('renders one card per document with its doc_num', () => {
    const host = show();
    expect(host.querySelectorAll('.source-card')).toHaveLength(2);
    expect(host.textContent).toContain('doc_num: 413482');
  });

  test('search matches on title', () => {
    const host = show();
    fireEvent.input(screen.getByLabelText('Søk i kildene'), {
      target: { value: 'årsrapport' },
    });
    expect(shortcuts(host)).toHaveLength(1);
    expect(host.textContent).toContain('Årsrapport Digitaliseringsdirektoratet 2020');
  });

  test('search matches on doc_num', () => {
    const host = show();
    fireEvent.input(screen.getByLabelText('Søk i kildene'), { target: { value: '413482' } });
    expect(shortcuts(host)).toHaveLength(1);
  });

  test('search matches inside the excerpt', () => {
    const host = show();
    fireEvent.input(screen.getByLabelText('Søk i kildene'), {
      target: { value: 'helseforetakene' },
    });
    expect(shortcuts(host)).toHaveLength(1);
    expect(host.textContent).toContain('Status og forslag');
  });

  test('a search with no matches says so', () => {
    const host = show();
    fireEvent.input(screen.getByLabelText('Søk i kildene'), { target: { value: 'zzz' } });
    expect(host.textContent).toContain('Ingen treff.');
  });

  test('Åpne expands one card and leaves the others clamped', () => {
    const host = show();
    fireEvent.click(screen.getAllByText('Åpne')[0]!);
    expect(host.querySelectorAll('.source-excerpt.is-open')).toHaveLength(1);
    expect(screen.getAllByText('Åpne')).toHaveLength(1);
    expect(screen.getAllByText('Lukk')).toHaveLength(1);
  });

  test('Lukk collapses it again', () => {
    const host = show();
    fireEvent.click(screen.getAllByText('Åpne')[0]!);
    fireEvent.click(screen.getByText('Lukk'));
    expect(host.querySelectorAll('.source-excerpt.is-open')).toHaveLength(0);
  });

  test('a document with no passage says so rather than showing an empty box', () => {
    const host = show();
    expect(host.textContent).toContain('Utdraget er ikke tilgjengelig');
  });

  test('with no sources it invites a question instead of showing an empty list', () => {
    const host = show({ sources: [] });
    expect(host.querySelectorAll('.source-card')).toHaveLength(0);
    expect(host.textContent).toContain('Ingen kilder ennå');
  });

  test('collapsed, the button carries the count', () => {
    expect(show({ open: false }).textContent).toContain('Vis kilder (2)');
  });

  test('collapsed with no sources, the button carries no count', () => {
    const host = show({ open: false, sources: [] });
    expect(host.textContent).toContain('Vis kilder');
    expect(host.textContent).not.toContain('(0)');
  });
});
