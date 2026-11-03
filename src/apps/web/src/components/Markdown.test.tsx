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

  it.each([
    ['refused', 'Se [her](javascript:alert(1)).'],
    ['left out', 'Se [her]().'],
  ])('leaves the text of a link whose address was %s, and no link', (_, answer) => {
    // react-markdown empties a javascript: address, and `[her]()` has none to
    // begin with. Drawn as a link, either is `<a href="">`: a link to the page
    // the reader is already on. Testing Library's role query does not count
    // `href=""` as a link, so the test looks for the element.
    const { container } = render(<Markdown>{answer}</Markdown>);

    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('Se her.');
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

  // The design canvas (D1) draws a footnote as a number in a small circle. The brackets stay in
  // the text, out of sight, for whoever copies the answer; the link's name is its `aria-label`.
  it('shows the number alone, with the brackets kept out of sight', () => {
    render(<Markdown citations={targets}>{'Ett [1][2] og slutt.'}</Markdown>);

    const [first, second] = screen.getAllByRole('link');
    expect(first.classList.contains('markdown__citation-mark')).toBe(true);
    const visible = (link: HTMLElement) =>
      [...link.childNodes]
        .filter((node) => !(node instanceof HTMLElement && node.classList.contains('ds-sr-only')))
        .map((node) => node.textContent)
        .join('');
    expect([visible(first), visible(second)]).toEqual(['1', '2']);
    expect(first.querySelectorAll('.ds-sr-only')).toHaveLength(2);
  });

  // At 390 px a circle wrapped alone to the start of a line, away from the word it belongs to.
  // The model's space before `[n]` is kept out of sight, so the circle is 3 px from the word.
  it('holds a run of footnotes on one line with the word before it', () => {
    const { container } = render(
      <Markdown citations={targets}>{'Avvik rapporteres kvartalsvis [1][2] i året.'}</Markdown>,
    );

    const runs = container.querySelectorAll('.markdown__citation-run');
    expect(runs).toHaveLength(1);
    expect(runs[0].firstChild?.textContent).toBe('kvartalsvis');
    expect(runs[0].querySelectorAll('a')).toHaveLength(2);
    // The space before the first marker is in the run, hidden, and nothing is lost from the text.
    expect(runs[0].children[0].classList.contains('ds-sr-only')).toBe(true);
    expect(runs[0].children[0].textContent).toBe(' ');
    expect(container.textContent).toBe('Avvik rapporteres kvartalsvis [1][2] i året.');
  });

  it('starts a run at the marker when no word comes right before it', () => {
    const { container } = render(<Markdown citations={targets}>{'**Fet** [1] og [2].'}</Markdown>);

    const runs = [...container.querySelectorAll('.markdown__citation-run')];
    expect(runs.map((run) => run.querySelectorAll('a').length)).toEqual([1, 1]);
    expect(runs[1].firstChild?.textContent).toBe('og');
    expect(container.textContent).toBe('Fet [1] og [2].');
  });

  it('renders markers inside list items and table cells too', () => {
    render(<Markdown citations={targets}>{'- punkt [1]'}</Markdown>);
    expect(screen.getByRole('listitem').textContent).toBe('punkt [1]');
    expect(screen.getByRole('link', { name: /Kilde 1/ })).toBeTruthy();
  });
});

describe('a marker with no source', () => {
  it('becomes text with an explanation, not a link', () => {
    // A stopped answer has written [3], but the sources never came. A link to
    // nothing is worse than no link.
    const { container } = render(
      <Markdown citations={[]} sourcesLost>
        {'Et svar med [3] i seg.'}
      </Markdown>,
    );

    expect(screen.queryByRole('link')).toBeNull();

    const marker = container.querySelector('sup[title]');
    expect(marker?.getAttribute('title')).toBe('Kilden kom ikke fram');
    expect(marker?.textContent).toContain('[3]');
    // `title` alone is for the mouse only. This is for whoever listens.
    expect(marker?.textContent?.toLowerCase()).toContain('kilden kom ikke fram');
  });

  it('leaves the text around it untouched', () => {
    const { container } = render(
      <Markdown citations={[]} sourcesLost>
        {'Før [3] etter.'}
      </Markdown>,
    );
    expect(container.textContent).toContain('Før ');
    expect(container.textContent).toContain(' etter.');
  });
});

/**
 * The answer text comes from a language model, and the model can be steered
 * by what it reads in the sources. Nothing in it may run.
 *
 * The client this one replaces piped `marked` through DOMPurify and tested
 * four cases. These are the same four. Here the protection is react-markdown
 * itself: raw HTML is never parsed, only shown as text, and its
 * `defaultUrlTransform` empties any URL whose protocol is not on its list.
 *
 * Each case was made red by taking a layer away (2026-10-06):
 * - a `urlTransform` that lets everything through: the javascript:,
 *   vbscript: and data: links. React 19 swaps a javascript: href for one
 *   that throws, but it is still a javascript: URL, and react-markdown should
 *   never have let it through. The other two React leaves as they are.
 * - raw HTML turned on with rehype-raw: script and iframe. The event handler
 *   stays green there, because React refuses a string as a listener.
 * - the answer set as HTML directly, as `marked` without DOMPurify would:
 *   all of them, the event handler included.
 */
describe('Markdown runs nothing from the answer text', () => {
  /** Everything in the rendered answer that a browser could execute. */
  function executable(root: Element): string[] {
    const found: string[] = [];
    for (const element of root.querySelectorAll('*')) {
      const tag = element.tagName.toLowerCase();
      if (['script', 'iframe', 'object', 'embed'].includes(tag)) found.push(`<${tag}>`);
      for (const { name, value } of element.attributes) {
        if (/^on/i.test(name)) found.push(`${tag}[${name}]`);
        if (['href', 'src', 'action', 'formaction'].includes(name) && isUnsafeUrl(value)) {
          found.push(`${tag}[${name}=${value}]`);
        }
      }
    }
    return found;
  }

  /**
   * An address that runs code when followed: `javascript:` and `vbscript:`,
   * and `data:`, which can carry a whole page with its own script.
   *
   * The URL parser ignores case, trims control characters and spaces at the
   * ends and drops tabs and newlines anywhere, so `java\tscript:` counts.
   * Dropping every one of them anywhere is stricter than the parser, which is
   * the safe side for a test.
   */
  function isUnsafeUrl(value: string): boolean {
    const compact = [...value]
      .filter((char) => char.charCodeAt(0) > 0x20)
      .join('')
      .toLowerCase();
    return (
      compact.startsWith('javascript:') ||
      compact.startsWith('vbscript:') ||
      compact.startsWith('data:')
    );
  }

  it.each([
    ['inline', 'hei <script>alert(1)</script> da'],
    ['as its own block', '<script>alert(1)</script>\n\nEtterpå.'],
  ])('renders no script tag (%s)', (_, answer) => {
    const { container } = render(<Markdown>{answer}</Markdown>);

    expect(executable(container)).toEqual([]);
  });

  it('renders no inline event handler', () => {
    const { container } = render(<Markdown>{'<img src=x onerror="alert(1)">'}</Markdown>);

    expect(executable(container)).toEqual([]);
  });

  it.each([
    ['javascript:', '[klikk](javascript:alert(1))'],
    ['javascript: in mixed case', '[klikk](JaVaScRiPt:alert(1))'],
    ['javascript: entity-encoded', '[klikk](&#x6A;avascript:alert(1))'],
    ['vbscript:', '[klikk](vbscript:msgbox(1))'],
    ['data:', '[klikk](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
  ])('keeps the text of a link but not an address that runs code (%s)', (_, answer) => {
    const { container } = render(<Markdown>{answer}</Markdown>);

    expect(executable(container)).toEqual([]);
    expect(container.textContent).toBe('klikk');
  });

  it('renders no iframe', () => {
    const { container } = render(
      <Markdown>{'<iframe src="https://evil.example"></iframe>'}</Markdown>,
    );

    expect(executable(container)).toEqual([]);
  });
});

/**
 * An address in an answer is as untrusted as the document the model read it
 * in, and the browser follows some of them without being asked.
 *
 * Found in the review of #129 (F4): `![x](/auth/logout)` becomes
 * `<img src="/auth/logout">`, and the browser sends the session cookie with
 * the GET as soon as the answer renders. The session is gone, the answer is
 * stored, and reopening the thread does it again. One document in the corpus
 * is enough to write it.
 *
 * So no image is fetched at all, and a link is drawn only for an address
 * that leads out of the app — another origin over `http(s)`, or `mailto:`.
 * Both rules are about where the address points, not about what it says,
 * which is why `javascript:` is tested a second time further down: that
 * layer is react-markdown's and this one is ours.
 */
describe('Markdown follows no address back into the app', () => {
  it('draws an image as its alt text, and fetches nothing', () => {
    const { container } = render(<Markdown>{'![Logg ut](/auth/logout)'}</Markdown>);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('Logg ut');
  });

  it('draws nothing at all for an image with no alt text', () => {
    const { container } = render(<Markdown>{'![](/auth/logout)'}</Markdown>);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it.each([
    ['a path of its own', '[logg ut](/auth/logout)'],
    ['the whole address', `[logg ut](${window.location.origin}/auth/logout)`],
    ['a query of its own', '[logg ut](/auth/logout?next=/)'],
  ])('keeps the text but draws no link when it points at this app (%s)', (_, answer) => {
    const { container } = render(<Markdown>{answer}</Markdown>);

    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('logg ut');
  });

  it('draws a link out of the app, in the same tab, without the referrer', () => {
    render(<Markdown>{'[årsrapporten](https://kudos.dfo.no/documents/1)'}</Markdown>);

    const link = screen.getByRole('link', { name: 'årsrapporten' });
    expect(link.getAttribute('href')).toBe('https://kudos.dfo.no/documents/1');
    // The same tab, so no `target`: see the note on `a` in Markdown.tsx.
    expect(link.getAttribute('target')).toBeNull();
    // The address of the thread is nobody else's business.
    expect(link.getAttribute('rel')).toBe('noreferrer');
  });

  it('keeps a mailto address, which reaches no endpoint', () => {
    // The info pages are drawn by this component too, and the one for help
    // carries the contact address. It hands an address to a mail program and
    // acts on nothing.
    render(<Markdown>{'[Skriv til oss](mailto:kontakt@example.no)'}</Markdown>);

    const link = screen.getByRole('link', { name: 'Skriv til oss' });
    expect(link.getAttribute('href')).toBe('mailto:kontakt@example.no');
  });
});
