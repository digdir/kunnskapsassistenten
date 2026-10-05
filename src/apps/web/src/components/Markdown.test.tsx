import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';

describe('Markdown', () => {
  it('counts heading depth up from startLevel, not from the markdown', () => {
    render(<Markdown startLevel={3}>{'# Ett\n\n## To'}</Markdown>);

    expect(screen.getByRole('heading', { name: 'Ett', level: 3 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'To', level: 4 })).toBeTruthy();
  });

  it('renders lists as real lists', () => {
    render(<Markdown>{'- ett\n- to'}</Markdown>);

    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('puts a table in a named, focusable scroll box', () => {
    render(<Markdown>{'| A | B |\n| --- | --- |\n| 1 | 2 |'}</Markdown>);

    const region = screen.getByRole('group', { name: 'Tabell med kolonnene A og B' });
    expect(region.tabIndex).toBe(0);
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'A' })).toBeTruthy();
  });

  it('gives two tables in one answer a name each, numbered', () => {
    // Both were «Tabell» (#2); the number tells them apart.
    const twoTables = [
      '| År | Treff |',
      '| --- | --- |',
      '| 2023 | 4 |',
      '',
      'Og så:',
      '',
      '| År | Treff |',
      '| --- | --- |',
      '| 2024 | 7 |',
    ].join('\n');
    render(<Markdown>{twoTables}</Markdown>);

    const names = screen.getAllByRole('group').map((region) => region.getAttribute('aria-label'));
    expect(names).toEqual([
      'Tabell 1 med kolonnene År og Treff',
      'Tabell 2 med kolonnene År og Treff',
    ]);
  });

  it('numbers the same way when the answer is drawn again', () => {
    const twoTables = '| A |\n| --- |\n| 1 |\n\n| B |\n| --- |\n| 2 |';
    const { rerender } = render(<Markdown>{twoTables}</Markdown>);
    rerender(<Markdown>{twoTables}</Markdown>);

    expect(screen.getAllByRole('group').map((region) => region.getAttribute('aria-label'))).toEqual(
      ['Tabell 1 med kolonnen A', 'Tabell 2 med kolonnen B'],
    );
  });

  it('is not a landmark, so two answers with the same columns break nothing', () => {
    // A follow-up or «Generer på nytt» gives the same kind of table again, and
    // two regions with one name were axe's landmark-unique (KA CC on #241).
    const table = '| Ledd | Dokument | År |\n| --- | --- | --- |\n| 1 | Årsrapport | 2022 |';
    render(
      <>
        <Markdown>{table}</Markdown>
        <Markdown>{table}</Markdown>
      </>,
    );

    expect(screen.queryAllByRole('region')).toHaveLength(0);
    const groups = screen.getAllByRole('group', {
      name: 'Tabell med kolonnene Ledd, Dokument og År',
    });
    expect(groups).toHaveLength(2);
    // Still a tab stop, so the keyboard can scroll it.
    expect(groups.every((group) => group.tabIndex === 0)).toBe(true);
  });

  it('says Tabell alone when the header row has no text', () => {
    render(<Markdown>{'|   |   |\n| --- | --- |\n| 1 | 2 |'}</Markdown>);

    expect(screen.getByRole('group', { name: 'Tabell' })).toBeTruthy();
  });

  it('counts the columns past the fourth instead of reading them all out', () => {
    render(
      <Markdown>
        {
          '| A | B | C | D | E | F |\n| --- | --- | --- | --- | --- | --- |\n| 1 | 2 | 3 | 4 | 5 | 6 |'
        }
      </Markdown>,
    );

    expect(
      screen.getByRole('group', { name: 'Tabell med kolonnene A, B, C, D og 2 til' }),
    ).toBeTruthy();
  });

  it('renders links as links', () => {
    render(<Markdown>{'[Kudos](https://kudos.dfo.no)'}</Markdown>);

    const link = screen.getByRole('link', { name: 'Kudos' });
    expect(link.getAttribute('href')).toBe('https://kudos.dfo.no');
  });
});

describe('Markdown citations', () => {
  const targets = [
    { number: 1, targetId: 'excerpt-1', label: 'Kilde 1: Årsrapport Nkom 2022, side 41' },
    { number: 2, targetId: 'excerpt-2', label: 'Kilde 2: Årsrapport Nkom 2023' },
  ];

  it('turns [n] into a link that says where it goes', () => {
    render(<Markdown citations={targets}>{'Avvik rapporteres kvartalsvis [1].'}</Markdown>);

    const link = screen.getByRole('link', { name: 'Kilde 1: Årsrapport Nkom 2022, side 41' });
    expect(link.getAttribute('href')).toBe('#excerpt-1');
    expect(link.textContent).toBe('[1]');
  });

  it('leaves a marker with no excerpt as plain text', () => {
    // Unchanged by default: an answer can carry a bracketed number that was
    // never a citation, and a clarification does exactly that.
    const { container } = render(<Markdown citations={targets}>{'Udekket påstand [9].'}</Markdown>);

    expect(screen.queryByRole('link')).toBeNull();
    expect(container.textContent).toContain('Udekket påstand [9]');
    expect(container.querySelector('sup[title]')).toBeNull();
  });

  it('keeps the text around and between several markers', () => {
    const { container } = render(<Markdown citations={targets}>{'Ett [1][2] og slutt.'}</Markdown>);

    expect(container.textContent).toBe('Ett [1][2] og slutt.');
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('reports the number when a marker is activated', async () => {
    const seen: number[] = [];
    render(
      <Markdown citations={targets} onCitationActivate={(n) => seen.push(n)}>
        {'Se [2].'}
      </Markdown>,
    );

    screen.getByRole('link', { name: /Kilde 2/ }).click();
    expect(seen).toEqual([2]);
  });

  it('renders markers inside list items and table cells too', () => {
    render(<Markdown citations={targets}>{'- punkt [1]'}</Markdown>);
    expect(screen.getByRole('listitem').textContent).toBe('punkt [1]');
    expect(screen.getByRole('link', { name: /Kilde 1/ })).toBeTruthy();
  });
});

describe('markør uten kilde', () => {
  it('blir tekst med en forklaring, ikke en lenke', () => {
    // Et avbrutt svar har skrevet [3], men kildene kom aldri. En lenke til
    // ingenting er verre enn ingen lenke.
    const { container } = render(
      <Markdown citations={[]} sourcesLost>
        {'Et svar med [3] i seg.'}
      </Markdown>,
    );

    expect(screen.queryByRole('link')).toBeNull();

    const marker = container.querySelector('sup[title]');
    expect(marker?.getAttribute('title')).toBe('Kilden kom ikke fram');
    expect(marker?.textContent).toContain('[3]');
    // `title` alene er bare for mus. Dette er for den som lytter.
    expect(marker?.textContent?.toLowerCase()).toContain('kilden kom ikke fram');
  });

  it('lar teksten rundt stå urørt', () => {
    const { container } = render(
      <Markdown citations={[]} sourcesLost>
        {'Før [3] etter.'}
      </Markdown>,
    );
    expect(container.textContent).toContain('Før ');
    expect(container.textContent).toContain(' etter.');
  });
});

describe('Markdown og søk i teksten', () => {
  const marks = (container: HTMLElement) => [...container.querySelectorAll('mark')];

  it('marks every match, in every kind of block', () => {
    const { container } = render(
      <Markdown markClassName="treff" searchQuery="mål">
        {'# Måloppnåelse\n\nNkom måler mål mot mål.\n\n- ett mål\n- to'}
      </Markdown>,
    );

    // Case-insensitive, so «Mål» in the heading counts too: five in all.
    expect(marks(container)).toHaveLength(5);
    expect(marks(container).every((mark) => mark.className === 'treff')).toBe(true);
    // The text itself is untouched; only the wrapping changed.
    expect(container.textContent).toContain('Nkom måler mål mot mål.');
  });

  it('marks nothing on a query too short to be one', () => {
    const { container } = render(<Markdown searchQuery="m">{'Nkom måler mål.'}</Markdown>);

    // `MIN_QUERY_LENGTH` is the sources panel's rule, and there is one search
    // mechanism, not two.
    expect(marks(container)).toHaveLength(0);
  });

  it('leaves a citation marker a link when the prose around it is marked', () => {
    const { container } = render(
      <Markdown
        citations={[{ number: 1, targetId: 'excerpt-1', label: 'Årsrapport, side 4' }]}
        searchQuery="måler"
      >
        {'Nkom måler dette [1] hvert år.'}
      </Markdown>,
    );

    expect(marks(container)).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Årsrapport, side 4' })).toBeTruthy();
  });

  it('does not mark markdown syntax the reader never sees', () => {
    // The `#` is gone by the time the answer is on screen, so a search for it
    // must not report a hit the highlight cannot show.
    const { container } = render(<Markdown searchQuery="# ">{'# Overskrift'}</Markdown>);

    expect(marks(container)).toHaveLength(0);
  });
});
