import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnswerSources, Excerpt } from '../../model';
import { SourceExcerpt } from './SourceExcerpt';
import { SourcesView } from './SourcesView';
import { excerptSection, headingContext } from './excerptSection';

/** Issue 131: an excerpt is titled by where in the document it is, not by «Utdrag N» alone. */

function excerpt(over: Partial<Excerpt> = {}): Excerpt {
  return {
    id: 'utdrag-1',
    citationNumber: 1,
    relevance: 'high',
    text: 'Tall fra BankID viser at syv av ti 16-åringer bruker BankID.',
    ...over,
  };
}

function show(
  over: Partial<Excerpt> = {},
  props: Partial<Parameters<typeof SourceExcerpt>[0]> = {},
) {
  return render(
    <SourceExcerpt
      excerpt={excerpt(over)}
      documentTitle="Årsrapport Digitaliseringsdirektoratet 2022"
      corpusName="Kudos"
      position={1}
      total={1}
      open={false}
      onOpenChange={() => {}}
      hits={[]}
      active={false}
      {...props}
    />,
  );
}

const box = (container: HTMLElement) => container.querySelector<HTMLElement>('.source-excerpt')!;
const head = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.source-excerpt__head')!;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('excerptSection and headingContext', () => {
  it('takes the last level of the heading path as the section', () => {
    expect(excerptSection('Vurdering av framtidsutsikter › Digitale fullmaktsløsninger')).toBe(
      'Digitale fullmaktsløsninger',
    );
    expect(excerptSection('Samlet vurdering')).toBe('Samlet vurdering');
  });

  it('has no section without a heading', () => {
    expect(excerptSection(undefined)).toBeUndefined();
    expect(excerptSection('')).toBeUndefined();
  });

  it('gives the whole path as context only when a level stands above the section', () => {
    expect(headingContext('Mål › Styringsparametere')).toBe('Mål › Styringsparametere');
    expect(headingContext('Styringsparametere')).toBeUndefined();
    expect(headingContext(undefined)).toBeUndefined();
  });
});

describe('an excerpt titled by its section', () => {
  it('titles a cited excerpt by the last level of its heading path, with «Utdrag N» over it', () => {
    const { container } = show({
      citationNumber: 2,
      heading: 'Vurdering av framtidsutsikter › Digitale fullmaktsløsninger er nøkkelen',
    });

    expect(screen.getByRole('heading', { level: 4 }).textContent).toBe(
      'Digitale fullmaktsløsninger er nøkkelen',
    );
    const title = head(container).querySelector('.source-excerpt__title')!;
    expect(within(title as HTMLElement).getByText('Utdrag 2')).toBeTruthy();
  });

  it('keeps «Utdrag N» as the title when the excerpt has no heading', () => {
    show({ citationNumber: 3, heading: undefined });

    expect(screen.getByRole('heading', { level: 4 }).textContent).toBe('Utdrag 3');
  });

  it('titles an excerpt of a document cited whole by its section, with «Utdrag 2 av 4» over it', () => {
    const { container } = show(
      { citationNumber: undefined, heading: 'Mål › Styringsparametere' },
      { position: 2, total: 4, inCitedDocument: { domId: 'kilde-dokument-1-utdrag-2' } },
    );

    expect(screen.getByRole('heading', { level: 4 }).textContent).toBe('Styringsparametere');
    expect(within(head(container)).getByText('Utdrag 2 av 4')).toBeTruthy();
  });

  it('falls back to «Utdrag 2 av 4» in a document cited whole when the excerpt has no heading', () => {
    show(
      { citationNumber: undefined, heading: undefined },
      { position: 2, total: 4, inCitedDocument: { domId: 'kilde-dokument-1-utdrag-2' } },
    );

    expect(screen.getByRole('heading', { level: 4 }).textContent).toBe('Utdrag 2 av 4');
  });

  it('keeps the back-link to the answer beside «Utdrag N» when a section titles the excerpt', () => {
    const { container } = show(
      { citationNumber: 2, heading: 'Mål › Styringsparametere' },
      { uses: 2, onShowUse: () => {} },
    );

    const title = head(container).querySelector<HTMLElement>('.source-excerpt__title')!;
    expect(within(title).getByText('Utdrag 2')).toBeTruthy();
    expect(
      within(title).getByRole('button', { name: 'Vis hvor svaret bruker utdrag 2 (1/2)' }),
    ).toBeTruthy();
  });

  it('shows the whole heading path in the open excerpt when a level stands above the section', () => {
    const { container } = show({ heading: 'Mål › Styringsparametere' }, { open: true });

    expect(container.querySelector('.source-excerpt__quote-heading')?.textContent).toBe(
      'Mål › Styringsparametere',
    );
  });

  it('leaves a one-level path out of the open excerpt, where it would only repeat the title', () => {
    const { container } = show({ heading: 'Styringsparametere' }, { open: true });

    expect(container.querySelector('.source-excerpt__quote-heading')).toBeNull();
  });

  it('keeps the page in the open excerpt when the path is left out', () => {
    const { container } = show({ heading: 'Styringsparametere', page: 4 }, { open: true });

    expect(container.querySelector('.source-excerpt__quote-heading')?.textContent).toBe('side 4');
  });

  it('makes the row as tall as the head when a section titles the excerpt', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ width: 240, height: 73.2 }),
    );

    const { container } = show({ heading: 'Mål › Styringsparametere' });

    expect(box(container).style.getPropertyValue('--ka-excerpt-head')).toBe('74px');
  });

  it('leaves the row at its own height when the excerpt has no section', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ width: 240, height: 73.2 }),
    );

    const { container } = show({ heading: undefined });

    expect(box(container).style.getPropertyValue('--ka-excerpt-head')).toBe('');
  });
});

describe('the sources panel, titling excerpts by section', () => {
  const answer: AnswerSources = {
    messageId: 'svar-1',
    status: 'complete',
    documents: [
      {
        id: '372017',
        title: 'Årsrapport Direktoratet for forvaltning og økonomistyring 2024',
        excerpts: [
          excerpt({
            id: '372017-1',
            citationNumber: 1,
            heading: 'DFØs årsrapport 2024 › <span id=\\"page-4-0\\"></span>**1 Leders beretning**',
          }),
          excerpt({ id: '372017-2', citationNumber: 2, heading: undefined }),
        ],
      },
    ],
  };

  it('titles each excerpt by its readable section, and one without a heading by its number', () => {
    render(<SourcesView answers={[answer]} />);

    expect(
      screen.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent),
    ).toEqual(['1 Leders beretning', 'Utdrag 2']);
  });
});
