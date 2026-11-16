import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ABOUT } from './about';
import { CHANGELOG } from './changelog';
import { blocksOf, inline, Markdown } from './markdown';

afterEach(cleanup);

describe('the text of KA’s pages', () => {
  it('reads headings, paragraphs, quotes and dividers', () => {
    expect(
      blocksOf('# 1.1.2026\n\n## Nytt\n\n> Sitat\n> videre\n\nTekst\npå to linjer\n\n---'),
    ).toEqual([
      { kind: 'heading', depth: 1, text: '1.1.2026' },
      { kind: 'heading', depth: 2, text: 'Nytt' },
      { kind: 'quote', text: 'Sitat videre' },
      { kind: 'paragraph', text: 'Tekst på to linjer' },
      { kind: 'divider' },
    ]);
  });

  it('nests a list by two spaces a level', () => {
    expect(blocksOf('- A\n  - A1\n    - A1a\n  - A2\n- B')).toEqual([
      {
        kind: 'list',
        items: [
          {
            text: 'A',
            items: [
              { text: 'A1', items: [{ text: 'A1a', items: [] }] },
              { text: 'A2', items: [] },
            ],
          },
          { text: 'B', items: [] },
        ],
      },
    ]);
  });

  it('draws links that leave the site or write an email, and leaves any other as its words', () => {
    render(
      <p>
        {inline(
          '[skjema](https://forms.example/x), [post](mailto:a@b.no), [lokal](/auth/logout) og [js](javascript:alert(1))',
        )}
      </p>,
    );
    expect(screen.getByRole('link', { name: 'skjema' }).getAttribute('href')).toBe(
      'https://forms.example/x',
    );
    expect(screen.getByRole('link', { name: 'post' }).getAttribute('href')).toBe(
      'mailto:a@b.no',
    );
    expect(screen.queryByRole('link', { name: 'lokal' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'js' })).toBeNull();
    expect(screen.getByText(/lokal og js/)).toBeTruthy();
  });

  it('draws emphasis, and an escaped character as itself', () => {
    const { container } = render(
      <p>{inline('***Endret*** og **fet**, *kursiv* og \\"sitat\\"')}</p>,
    );
    expect(container.querySelector('strong > em')?.textContent).toBe('Endret');
    expect([...container.querySelectorAll('strong')].map((b) => b.textContent)).toEqual([
      'Endret',
      'fet',
    ]);
    expect([...container.querySelectorAll('em')].map((i) => i.textContent)).toEqual([
      'Endret',
      'kursiv',
    ]);
    expect(container.textContent).toBe('Endret og fet, kursiv og "sitat"');
  });

  it('draws «Endringslogg» with one level 2 heading per entry, newest first, 16.11.2026 on top', () => {
    render(<Markdown text={CHANGELOG} />);
    const entries = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(entries[0]).toBe('16.11.2026');
    expect(entries).toHaveLength(10);
    expect(entries.at(-1)).toBe('26.11.2024');
    // Designsystemet's divider is decoration, hidden from screen readers: the headings divide.
    expect(document.querySelectorAll('hr')).toHaveLength(9);
    // No markup left over as text.
    expect(document.body.textContent).not.toMatch(/(^|\s)(#|>|-{3}|\*\*)|\\"/);
  });

  it('says in the 16.11.2026 entry that the previous version is gone', () => {
    const entry = CHANGELOG.slice(0, CHANGELOG.indexOf('\n---'));
    expect(entry).toMatch(/forrige versjonen av Kunnskapsassistenten er fjernet/);
    expect(entry).toMatch(/nye versjonen er nå den eneste/);
  });

  it('draws «Om prosjektet» as paragraphs only', () => {
    const { container } = render(<Markdown text={ABOUT} />);
    expect(container.querySelectorAll('p')).toHaveLength(6);
    expect(within(container).queryByRole('heading')).toBeNull();
  });
});
