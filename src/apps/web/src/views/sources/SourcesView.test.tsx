import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { userDocumentSource } from '../../api/mock/fixtures';
import { documentDomId } from './ids';
import { excerptDomId, type AnswerSources, type SourceDocument } from '../../model';
import { SourcesView } from './SourcesView';

/**
 * jsdom does no layout and implements no scrolling, so the method the view
 * calls on arrival does not exist. Installing a no-op is what lets the focus
 * half of that pair be tested at all.
 */
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

function documentWith(id: string, title: string, numbers: number[]): SourceDocument {
  return {
    id,
    title,
    documentType: 'Årsrapport',
    organisation: 'Nasjonal kommunikasjonsmyndighet',
    year: 2023,
    excerpts: numbers.map((number) => ({
      id: `${id}-utdrag-${number}`,
      citationNumber: number,
      relevance: 'high' as const,
      heading: `Avsnitt ${number} i ${title}`,
      text: `Sitat nummer ${number} fra ${title}.`,
    })),
  };
}

/** Two answers that both number their excerpts from 1 — the case that broke. */
const firstAnswer: AnswerSources = {
  messageId: 'svar-1',
  status: 'complete',
  documents: [documentWith('doc-a', 'Årsrapport 2021', [1, 2])],
};

const secondAnswer: AnswerSources = {
  messageId: 'svar-2',
  status: 'complete',
  documents: [documentWith('doc-b', 'Tildelingsbrev 2024', [1, 2])],
};

/**
 * The view plus a `[1]` marker of the kind the answer draws, so the way back
 * has something real to go back to.
 *
 * The marker carries the same `href` the main column gives it; that href is
 * the whole contract between the two, and it is what the view searches for.
 */
function Harness({
  answers,
  citation,
}: {
  answers?: readonly AnswerSources[];
  citation?: { number: number; nonce: number; messageId?: string };
}) {
  return (
    <>
      <a href={`#${excerptDomId(1)}`} data-testid="markoer">
        [1]
      </a>
      <SourcesView
        answers={answers}
        activeCitationNumber={citation?.number}
        activeCitationNonce={citation?.nonce}
        activeCitationMessageId={citation?.messageId}
      />
    </>
  );
}

/** Clicking a marker is what the reader does; this is that, end to end. */
function ClickableHarness({ answers }: { answers: readonly AnswerSources[] }) {
  const [citation, setCitation] = useState<
    { number: number; nonce: number; messageId?: string } | undefined
  >(undefined);

  return (
    <>
      <a
        href={`#${excerptDomId(1)}`}
        data-testid="markoer"
        onClick={(event) => {
          event.preventDefault();
          setCitation({ number: 1, nonce: 1, messageId: 'svar-1' });
        }}
      >
        [1]
      </a>
      <SourcesView
        answers={answers}
        activeCitationNumber={citation?.number}
        activeCitationNonce={citation?.nonce}
        activeCitationMessageId={citation?.messageId}
      />
    </>
  );
}

/**
 * Two answers' `[1]`, each in its own `.markdown` as the main column draws
 * them, and a way to draw them anew the way react-markdown does when it gets
 * new components: equal markers, new elements. `redrawOnClick` does it in the
 * click's own render, before the citation reaches the panel.
 */
function RedrawingHarness({
  answers,
  redrawOnClick = false,
}: {
  answers: readonly AnswerSources[];
  redrawOnClick?: boolean;
}) {
  const [citation, setCitation] = useState<
    { number: number; nonce: number; messageId?: string } | undefined
  >(undefined);
  const [drawing, setDrawing] = useState(0);

  const marker = (answer: string) => (
    <a
      key={`${answer}-${drawing}`}
      href={`#${excerptDomId(1)}`}
      data-testid={`markoer-${answer}`}
      onClick={(event) => {
        event.preventDefault();
        setCitation((previous) => ({
          number: 1,
          nonce: (previous?.nonce ?? 0) + 1,
          messageId: 'svar-1',
        }));
        if (redrawOnClick) setDrawing((count) => count + 1);
      }}
    >
      [1]
    </a>
  );

  return (
    <>
      <div className="markdown">{marker('forste')}</div>
      <div className="markdown">{marker('andre')}</div>
      <button type="button" onClick={() => setDrawing((count) => count + 1)}>
        Tegn svaret på nytt
      </button>
      <SourcesView
        answers={answers}
        activeCitationNumber={citation?.number}
        activeCitationNonce={citation?.nonce}
        activeCitationMessageId={citation?.messageId}
      />
    </>
  );
}

/**
 * The visible counter, which is `aria-hidden` and therefore has no role to
 * query it by. Its spoken twin is the `role="status"` region, so a plain
 * `getByText` would find both.
 */
function visibleCounter(): string | undefined {
  return document.querySelector('.sources-answer-switcher__count')?.textContent ?? undefined;
}

describe('SourcesView, one answer at a time', () => {
  it('shows the newest answer and says which one it is', () => {
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    expect(visibleCounter()).toBe('Kilder til svar 2 av 2');
    expect(screen.getByRole('heading', { name: 'Tildelingsbrev 2024' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Årsrapport 2021' })).toBeNull();
  });

  it('draws no switcher for a thread with one answer', () => {
    render(<Harness answers={[secondAnswer]} />);

    expect(visibleCounter()).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'Forrige svar' })).toBeNull();
  });

  it('steps back to the previous answer', () => {
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Forrige svar' }));

    expect(visibleCounter()).toBe('Kilder til svar 1 av 2');
    expect(screen.getByRole('heading', { name: 'Årsrapport 2021' })).toBeTruthy();
  });

  it('stops at the ends without dropping the keyboard', () => {
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    const previous = screen.getByRole('button', { name: 'Forrige svar' });
    fireEvent.click(previous);
    fireEvent.click(previous);

    // aria-disabled, not disabled: the button keeps its tab stop, so pressing
    // it once too often does not send focus to <body>.
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    expect(previous.hasAttribute('disabled')).toBe(false);
    expect(visibleCounter()).toBe('Kilder til svar 1 av 2');
  });

  it('opens the excerpt of the answer the marker sits in, not the newest', () => {
    // The bug: [1] in the first answer used to open the SECOND answer's
    // excerpt 1, because both are numbered 1 and the panel held one list.
    render(
      <Harness
        answers={[firstAnswer, secondAnswer]}
        citation={{ number: 1, nonce: 1, messageId: 'svar-1' }}
      />,
    );

    expect(visibleCounter()).toBe('Kilder til svar 1 av 2');
    expect(screen.getByText('Sitat nummer 1 fra Årsrapport 2021.')).toBeTruthy();
    expect(screen.queryByText('Sitat nummer 1 fra Tildelingsbrev 2024.')).toBeNull();
  });

  it('follows a new answer when one arrives', () => {
    const { rerender } = render(<Harness answers={[firstAnswer]} />);

    rerender(<Harness answers={[firstAnswer, secondAnswer]} />);

    expect(visibleCounter()).toBe('Kilder til svar 2 av 2');
  });

  it('follows a new answer even after the reader has stepped back', () => {
    const { rerender } = render(<Harness answers={[firstAnswer, secondAnswer]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Forrige svar' }));
    expect(visibleCounter()).toBe('Kilder til svar 1 av 2');

    rerender(
      <Harness answers={[firstAnswer, secondAnswer, { ...firstAnswer, messageId: 's3' }]} />,
    );

    expect(visibleCounter()).toBe('Kilder til svar 3 av 3');
  });

  it('keeps the switcher when the answer on screen has no sources', () => {
    // Otherwise a stopped answer would trap the reader: nothing to see, and no
    // way back to the answer that did have sources.
    render(
      <Harness
        answers={[firstAnswer, { messageId: 'svar-2', status: 'aborted', documents: [] }]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Forrige svar' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Forrige svar' }));
    expect(screen.getByRole('heading', { name: 'Årsrapport 2021' })).toBeTruthy();
  });
});

describe('SourcesView, the active marker stays with its answer', () => {
  /** `data-active` is the blue band; the excerpt the reader was sent to. */
  function activeExcerptText(): string | undefined {
    return document.querySelector('[data-active="true"]')?.textContent ?? undefined;
  }

  it('leaves the highlight behind when the reader steps to another answer', () => {
    render(
      <Harness
        answers={[firstAnswer, secondAnswer]}
        citation={{ number: 1, nonce: 1, messageId: 'svar-1' }}
      />,
    );

    expect(activeExcerptText()).toContain('Sitat nummer 1 fra Årsrapport 2021.');

    // Both answers have an excerpt 1. Comparing only the number used to carry
    // the band — and «Tilbake til svaret» — along to an excerpt nobody had
    // been sent to.
    fireEvent.click(screen.getByRole('button', { name: 'Neste svar' }));

    expect(visibleCounter()).toBe('Kilder til svar 2 av 2');
    // A closed excerpt has its quote twice: in the preview and inside the
    // collapsed Details. Both belong to the second answer, which is the point.
    expect(screen.getAllByText('Sitat nummer 1 fra Tildelingsbrev 2024.').length).toBeGreaterThan(
      0,
    );
    expect(activeExcerptText()).toBeUndefined();
  });

  it('offers no way back from the answer the reader stepped to', () => {
    render(
      <Harness
        answers={[firstAnswer, secondAnswer]}
        citation={{ number: 1, nonce: 1, messageId: 'svar-1' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Tilbake til svaret' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Neste svar' }));

    expect(screen.queryByRole('button', { name: 'Tilbake til svaret' })).toBeNull();
  });

  it('gives the highlight back when the reader steps home again', () => {
    render(
      <Harness
        answers={[firstAnswer, secondAnswer]}
        citation={{ number: 1, nonce: 1, messageId: 'svar-1' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Neste svar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forrige svar' }));

    expect(activeExcerptText()).toContain('Sitat nummer 1 fra Årsrapport 2021.');
    expect(screen.getByRole('button', { name: 'Tilbake til svaret' })).toBeTruthy();
  });

  it('stays behind even when nobody said which answer the marker was in', () => {
    // The state between #39 and the chat view widening onSelectSource: several
    // answers, no message id on the citation. The marker is resolved against
    // the answer on screen, and the highlight has to stay with that answer all
    // the same.
    render(<Harness answers={[firstAnswer, secondAnswer]} citation={{ number: 1, nonce: 1 }} />);

    expect(activeExcerptText()).toContain('Sitat nummer 1 fra Tildelingsbrev 2024.');

    fireEvent.click(screen.getByRole('button', { name: 'Forrige svar' }));

    expect(activeExcerptText()).toBeUndefined();
  });
});

describe('SourcesView, the live region that says which answer', () => {
  /** `<output>` is role=status, which is a polite live region. */
  function liveRegion(): HTMLElement {
    return screen.getByRole('status');
  }

  it('is in the document before there is anything to announce', () => {
    // A live region mounted together with its text is not announced, and the
    // second answer arriving is the one moment it matters (KA CC on PR #36).
    render(<Harness answers={[firstAnswer]} />);

    const region = liveRegion();
    expect(region).toBeTruthy();
    expect(region.textContent).toBe('');
  });

  it('is the same element once the second answer arrives', () => {
    const { rerender } = render(<Harness answers={[firstAnswer]} />);
    const before = liveRegion();

    rerender(<Harness answers={[firstAnswer, secondAnswer]} />);

    expect(liveRegion()).toBe(before);
    expect(before.textContent).toBe('Kilder til svar 2 av 2');
  });

  it('says the same thing as the visible row, and only says it once', () => {
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    const visible = document.querySelector('.sources-answer-switcher__count') as HTMLElement;
    expect(visible.getAttribute('aria-hidden')).toBe('true');
    expect(liveRegion().textContent).toBe(visible.textContent);
  });

  it('follows the reader stepping between answers', () => {
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Forrige svar' }));

    expect(liveRegion().textContent).toBe('Kilder til svar 1 av 2');
  });
});

describe('SourcesView, the panel head that stays put', () => {
  function head(): HTMLElement | null {
    // The shell's box, filled by this view through `ViewHead`.
    return document.querySelector('.view-head');
  }

  it('holds the answer selector and the search, so one box can be pinned', () => {
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    const box = head();
    expect(box).toBeTruthy();
    expect(box?.querySelector('.sources-answer-switcher')).toBeTruthy();
    expect(box?.querySelector('.sources-search')).toBeTruthy();
  });

  it('leaves the Kudos line outside, where it scrolls with the excerpts', () => {
    // Everything pinned is taken off the reading area for as long as the
    // reader scrolls; this line never changes and says something about the
    // excerpts below it.
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    const line = screen.getByText(/All tekst er sitater fra dokumentene fra Kudos/);
    expect(line).toBeTruthy();
    expect(head()?.contains(line)).toBe(false);
  });

  it('keeps the search field described by the line that moved', () => {
    // `aria-describedby` resolves by id, not by position, and that is the only
    // reason the line may sit somewhere else at all.
    render(<Harness answers={[firstAnswer, secondAnswer]} />);

    const field = screen.getByRole('searchbox');
    const describedBy = field.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)?.textContent).toMatch(
      /All tekst er sitater/,
    );
  });

  it('holds only the panel heading on a page with nothing to search', () => {
    // «Kilder» is visible and in the head from the first render, as Figma has
    // it and as the navigation panel has «Filtrering» (Lars, 30.09). There is
    // no search field before there is anything to search.
    render(<Harness answers={[]} />);

    expect(head()?.textContent).toBe('Kilder');
    expect(head()?.querySelector('h2')?.textContent).toBe('Kilder');
    expect(head()?.querySelector('input')).toBeNull();
  });
});

describe('SourcesView, empty states', () => {
  it('says a stopped answer was stopped', () => {
    render(<Harness answers={[{ messageId: 'svar-1', status: 'aborted', documents: [] }]} />);

    expect(screen.getByText('Svaret ble avbrutt før kildene kom')).toBeTruthy();
    expect(screen.queryByText(/når du har stilt et spørsmål/)).toBeNull();
  });

  it('says nothing has been asked only when nothing has been asked', () => {
    render(<Harness answers={[]} />);

    expect(screen.getByText('Ingen kilder ennå')).toBeTruthy();
  });

  it('draws the skeleton while an answer is still being written', () => {
    render(<Harness answers={[{ messageId: 'svar-1', status: 'streaming', documents: [] }]} />);

    expect(screen.getByText('Henter kilder …')).toBeTruthy();
  });
});

describe('SourcesView, the way back to the answer', () => {
  it('moves focus back to the marker the reader came from', async () => {
    render(<ClickableHarness answers={[firstAnswer, secondAnswer]} />);
    const marker = screen.getByTestId('markoer');

    // A click focuses the link, which is how the view knows where to return.
    marker.focus();
    fireEvent.click(marker);

    const excerpt = document.getElementById(excerptDomId(1)) as HTMLElement;
    await waitFor(() => expect(document.activeElement).toBe(excerpt));

    fireEvent.click(screen.getByRole('button', { name: 'Tilbake til svaret' }));
    expect(document.activeElement).toBe(marker);
  });

  it('returns on Escape from inside the excerpt', async () => {
    render(<ClickableHarness answers={[firstAnswer, secondAnswer]} />);
    const marker = screen.getByTestId('markoer');

    marker.focus();
    fireEvent.click(marker);

    const excerpt = document.getElementById(excerptDomId(1)) as HTMLElement;
    await waitFor(() => expect(document.activeElement).toBe(excerpt));

    fireEvent.keyDown(excerpt, { key: 'Escape' });
    expect(document.activeElement).toBe(marker);
  });

  it('finds the marker again when the answer is drawn anew after the click', async () => {
    render(<RedrawingHarness answers={[firstAnswer, secondAnswer]} />);
    const clicked = screen.getByTestId('markoer-andre');

    clicked.focus();
    fireEvent.click(clicked);
    const excerpt = document.getElementById(excerptDomId(1)) as HTMLElement;
    await waitFor(() => expect(document.activeElement).toBe(excerpt));

    fireEvent.click(screen.getByRole('button', { name: 'Tegn svaret på nytt' }));
    expect(clicked.isConnected).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Tilbake til svaret' }));
    expect(document.activeElement).toBe(screen.getByTestId('markoer-andre'));
  });

  it('goes back to the answer that was clicked when the click itself draws it anew', async () => {
    render(<RedrawingHarness answers={[firstAnswer, secondAnswer]} redrawOnClick />);
    const clicked = screen.getByTestId('markoer-andre');

    clicked.focus();
    fireEvent.click(clicked);
    const excerpt = document.getElementById(excerptDomId(1)) as HTMLElement;
    await waitFor(() => expect(document.activeElement).toBe(excerpt));
    expect(clicked.isConnected).toBe(false);

    fireEvent.keyDown(excerpt, { key: 'Escape' });
    expect(document.activeElement).toBe(screen.getByTestId('markoer-andre'));
  });

  it('offers no way back from an excerpt nobody was sent to', () => {
    // Opened by hand, so there is nowhere to go back to, and a control that
    // does nothing is worse than no control.
    render(<Harness answers={[firstAnswer]} />);

    expect(screen.queryByRole('button', { name: 'Tilbake til svaret' })).toBeNull();
  });
});

describe('SourcesView, the shell as it is today', () => {
  it('keeps the single-list prop working unchanged', () => {
    render(<SourcesView documents={firstAnswer.documents} />);

    expect(screen.getByRole('heading', { name: 'Årsrapport 2021' })).toBeTruthy();
    expect(visibleCounter()).toBeUndefined();
  });

  it('still reads an empty list as «nothing asked yet»', () => {
    render(<SourcesView documents={[]} />);

    expect(screen.getByText('Ingen kilder ennå')).toBeTruthy();
  });

  it('still reads no list at all as loading', () => {
    render(<SourcesView />);

    expect(screen.getByText('Henter kilder …')).toBeTruthy();
  });
});

describe('SourcesView, raden i et utdrag', () => {
  /**
   * The name a browser gives the toggle: the visible word and the
   * screen-reader text after it. Chrome names a `summary` from its content,
   * «Åpne utdrag 1» (KA CC on #229), and jsdom gives it no role to ask
   * `getByRole` with, so the content is read directly.
   */
  const toggleNames = (container: HTMLElement) =>
    [...container.querySelectorAll('.source-excerpt summary')].map((summary) =>
      (summary.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );

  it('gir hver knapp utdragets nummer i navnet, og ingen to samme navn', () => {
    // Every toggle shows the one word «Åpne», so the name is what tells them
    // apart in a screen reader's list of controls (WCAG 2.4.9). Since #229
    // the toggle shares its row with «Utdrag N», and nothing else on the row
    // says which excerpt it opens.
    const { container } = render(
      <SourcesView
        documents={[
          documentWith('doc-a', 'Årsrapport 2021', [1, 2]),
          documentWith('doc-b', 'Årsrapport 2022', [3]),
        ]}
      />,
    );

    expect(toggleNames(container)).toEqual(['Åpne utdrag 1', 'Åpne utdrag 2', 'Åpne utdrag 3']);
  });

  it('sier i raden at svaret ikke viser til et utdrag uten nummer', () => {
    // The line stood under the head and over a preview until #229. Now the row
    // is all a closed excerpt shows, so the line is in the row, outside what
    // `details` hides — and the toggle is named by the excerpt's place in its
    // document, since it has no number to be named by.
    const cited = documentWith('doc-a', 'Årsrapport 2021', [1]);
    const { container } = render(
      <SourcesView
        documents={[
          {
            ...cited,
            excerpts: [
              ...cited.excerpts,
              { id: 'doc-a-uten-nummer', relevance: 'low', text: 'Et utdrag svaret ikke brukte.' },
            ],
          },
        ]}
      />,
    );

    const row = container.querySelector('.source-excerpt[data-uncited] .source-excerpt__head');
    expect(row?.textContent).toContain('Ikke vist til i svaret');
    expect(row?.closest('details')).toBeNull();
    expect(container.querySelectorAll('.source-excerpt__uncited')).toHaveLength(1);
    expect(toggleNames(container)).toEqual(['Åpne utdrag 1', 'Åpne utdrag 2 av 2']);
  });
});

describe('SourcesView, Kudos-lenker som skiller seg fra hverandre', () => {
  /**
   * Two documents whose excerpts all link out, which is the ordinary case, and
   * one excerpt whose address opens the page its quote is on.
   *
   * Every excerpt links to its document in live and bff mode, and to nothing
   * more. Only a file URL with `#page=N` goes further (kudosLink.ts), and that
   * is the one excerpt here with a link of its own (Lars, 30.09, on Simens
   * issue 92).
   */
  function withKudosLinks(): SourceDocument[] {
    const url = (id: string) => `https://kudos.dfo.no/dokument/${id}`;

    return [
      { ...documentWith('doc-a', 'Årsrapport Nkom 2025', [1, 2]) },
      { ...documentWith('doc-b', 'Tildelingsbrev Nkom 2026', [3]) },
    ].map((source) => ({
      ...source,
      url: url(source.id),
      excerpts: source.excerpts.map((excerpt) =>
        excerpt.citationNumber === 2
          ? { ...excerpt, page: 41, kudosUrl: `${url(source.id)}/filer/rapport.pdf#page=41` }
          : { ...excerpt, kudosUrl: url(source.id) },
      ),
    }));
  }

  /**
   * The names as an assistive technology computes them, not `textContent`.
   *
   * `getByRole` runs the accessible name computation, so a generic
   * `aria-label` on the link would override the text and fail here — reading
   * `textContent` would have passed it (KA CC on #92).
   */
  const LINK_NAMES = [
    'Les side 41 på Kudos, utdrag 2, Årsrapport Nkom 2025 (åpnes i ny fane)',
    'Les dokumentet på Kudos, Årsrapport Nkom 2025 (åpnes i ny fane)',
    'Les dokumentet på Kudos, Tildelingsbrev Nkom 2026 (åpnes i ny fane)',
  ];

  it('navngir hver lenke med utdraget og dokumentet den hører til', () => {
    render(<SourcesView documents={withKudosLinks()} />);

    // `getByRole` kaster både når ingen og når flere treffer, så dette er
    // navnet og entydigheten i samme påstand.
    expect(
      screen.getByRole('link', {
        name: 'Les side 41 på Kudos, utdrag 2, Årsrapport Nkom 2025 (åpnes i ny fane)',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', {
        name: 'Les dokumentet på Kudos, Tildelingsbrev Nkom 2026 (åpnes i ny fane)',
      }),
    ).toBeTruthy();
  });

  it('gir et utdrag egen lenke bare når den åpner siden sitatet står på', () => {
    // Utdrag 1 og 3 lenker til dokumentet og ikke lenger: den lenka står én
    // gang, nederst i dokumentet. Før sto den samme adressen under hvert
    // sitat og én gang til under dokumentet (Lars 30.09, Simens issue 92).
    render(<SourcesView documents={withKudosLinks()} />);

    expect(screen.queryByRole('link', { name: /utdrag 1,/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /utdrag 3,/ })).toBeNull();
    expect(screen.getAllByRole('link', { name: /^Les dokumentet på Kudos/ })).toHaveLength(2);
  });

  it('gir ingen to lenker i panelet samme navn', () => {
    // Det var funnet: alle lenkene het «Les dokumentet på Kudos», så en
    // skjermleser som ramser opp lenkene leste samme rad én gang per utdrag
    // (WCAG 2.4.9, KA CC på #70). Dokumentoverskriftens egen lenke er med i
    // tellingen, for den står i samme liste.
    render(<SourcesView documents={withKudosLinks()} />);

    expect(screen.getAllByRole('link')).toHaveLength(LINK_NAMES.length);
    for (const name of LINK_NAMES) {
      expect(screen.getAllByRole('link', { name })).toHaveLength(1);
    }
  });

  it('skiller to dokumenter med samme tittel med nummeret, på kortet og i lenka', () => {
    // Målt 05.10: indeksen har «Årsrapport Datatilsynet 2023» som dokument 90777
    // og 88640, og ett svar tok biter fra begge. Da sto to kort med samme
    // overskrift og to lenker med samme navn til hver sin adresse.
    const url = (id: string) => `https://kudos.dfo.no/documents/${id}`;
    const twice = [
      { ...documentWith('90777', 'Årsrapport Datatilsynet 2023', [1, 2]), url: url('90777') },
      { ...documentWith('88640', 'Årsrapport Datatilsynet 2023', [3]), url: url('88640') },
    ];
    render(<SourcesView documents={twice} />);

    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual([
      'Årsrapport Datatilsynet 2023, dokument 90777',
      'Årsrapport Datatilsynet 2023, dokument 88640',
    ]);
    const link = screen.getByRole('link', {
      name: 'Les dokumentet på Kudos, Årsrapport Datatilsynet 2023, dokument 88640 (åpnes i ny fane)',
    });
    expect(link.getAttribute('href')).toBe(url('88640'));
    const names = screen.getAllByRole('link').map((each) => each.textContent);
    expect(new Set(names).size).toBe(names.length);
  });

  it('lar den synlige teksten være i fred', () => {
    // Tillegget er `ds-sr-only`: en seende leser skal fortsatt se de fire
    // ordene Figma har, ikke dokumenttittelen om igjen under hvert sitat.
    const { container } = render(<SourcesView documents={withKudosLinks()} />);

    const link = [...container.querySelectorAll('a')].find((a) =>
      a.textContent?.includes('Les dokumentet på Kudos'),
    );
    const visible = [...(link?.childNodes ?? [])]
      .filter((node) => !(node instanceof HTMLElement && node.className.includes('ds-sr-only')))
      .map((node) => node.textContent)
      .join('')
      .trim();

    expect(visible).toBe('Les dokumentet på Kudos');
  });
});

describe('SourcesView, et dokument leseren har lastet opp selv', () => {
  /**
   * Bygget med mockens egen `userDocumentSource`, ikke med en håndskrevet
   * kilde. Det er den som lager kilden når et spørsmål stilles med et vedlegg,
   * så en test mot noe annet ville målt min egen antakelse om formen.
   */
  function ownDocument(name = 'Mitt notat 2026.pdf'): SourceDocument {
    return userDocumentSource(
      {
        id: 'doc-egen',
        name,
        type: 'pdf',
        size: 1024,
        status: 'ready',
        progress: 100,
        uploadedAt: '2026-09-21T09:00:00.000Z',
      },
      1,
    );
  }

  it('viser filnavnet som tittel og «Ditt dokument» som type', () => {
    render(<SourcesView documents={[ownDocument()]} />);

    expect(screen.getByRole('heading', { name: 'Mitt notat 2026.pdf' })).toBeTruthy();
    expect(screen.getByText('Ditt dokument')).toBeTruthy();
  });

  it('har ingen lenke ut, og sier hvorfor med sine egne ord', () => {
    // Ikke «Dokumentet har ingen offentlig lenke», som er mappekorpusets
    // setning: her mangler det ingenting, filen er leserens egen.
    render(<SourcesView documents={[ownDocument()]} />);

    expect(screen.queryByRole('link', { name: /Kudos/ })).toBeNull();
    expect(screen.getByText(/Bare du har dette dokumentet/)).toBeTruthy();
  });

  it('sier at teksten er fra begge slags dokumenter, ikke bare fra Kudos', () => {
    // Linja er en påstand om hvor hvert ord i panelet kommer fra. Med et
    // opplastet dokument i lista er «fra Kudos» usant, og nettopp dette
    // panelet er det leseren skal kunne etterprøve.
    render(<SourcesView documents={[ownDocument()]} />);

    expect(screen.getByText(/både fra Kudos og fra dine egne/)).toBeTruthy();
    expect(screen.queryByText(/^All tekst er sitater fra dokumentene fra Kudos\./)).toBeNull();
  });

  it('lar linja stå uendret når alt er fra korpuset', () => {
    render(<SourcesView documents={firstAnswer.documents} />);

    expect(screen.getByText(/All tekst er sitater fra dokumentene fra Kudos\./)).toBeTruthy();
  });

  it('skiller ditt dokument fra korpusets med samme tittel', () => {
    // Begge heter det samme. Bare det ene har en Kudos-lenke, og det er
    // origin som avgjør hvilket.
    const tittel = 'Årsrapport Nkom 2025';
    const corpus: SourceDocument = {
      id: 'doc-korpus',
      title: tittel,
      documentType: 'Årsrapport',
      organisation: 'Nkom',
      year: 2025,
      url: 'https://kudos.dfo.no/dokument/a1c6feb9-3a47-4889-b049-92adae575b9f',
      excerpts: [
        {
          id: 'doc-korpus-1',
          citationNumber: 2,
          relevance: 'high' as const,
          text: 'Sitat fra korpuset.',
          kudosUrl: 'https://kudos.dfo.no/dokument/a1c6feb9-3a47-4889-b049-92adae575b9f',
        },
      ],
    };

    const { container } = render(<SourcesView documents={[ownDocument(tittel), corpus]} />);

    expect(screen.getAllByRole('heading', { name: tittel })).toHaveLength(2);
    expect(screen.getByText('Ditt dokument')).toBeTruthy();

    // Skopet til hvert sitt kort: korpusdokumentet har lenker ut, ditt har
    // ingen, selv om de to kortene har nøyaktig samme overskrift.
    const card = (id: string) => container.querySelector(`#${documentDomId(id)}`) as HTMLElement;
    expect(within(card('doc-korpus')).getAllByRole('link').length).toBeGreaterThan(0);
    expect(within(card('doc-egen')).queryAllByRole('link')).toEqual([]);
  });
});

describe('SourcesView, korpuset følger svaret og ikke valget', () => {
  /**
   * KA CC målte det gjenværende tilfellet på #129: åpne Kudos-tråden mens
   * Wikipedia er valgt, og «fra Wikipedia (mock)» sto over Nkom-kortet.
   * Utdragene under linja endrer seg ikke når velgeren flyttes, så linja skal
   * ikke gjøre det heller.
   *
   * Mock-miljøet kjenner bare ett korpus, «Kudos». Det er nok til å vise
   * saken: et svar merket med et korpus denne installasjonen ikke kjenner
   * sier «standardkorpuset», mens et svar uten nøkkel faller tilbake på det
   * valgte og sier «Kudos». Går valget foran svaret, blir begge «Kudos».
   * Selve valget mellom de to nøklene er testet for seg i `origin.test.ts`.
   */
  function answerFrom(corpusKey: string | undefined): AnswerSources {
    return {
      messageId: 'svar-1',
      status: 'complete',
      documents: [documentWith('doc-a', 'Årsrapport 2021', [1])],
      ...(corpusKey === undefined ? {} : { corpusKey }),
    };
  }

  function disclaimer(): string {
    return document.querySelector('.sources-search__description')?.textContent ?? '';
  }

  it('navngir korpuset svaret kom fra, ikke det som er valgt', () => {
    render(<SourcesView answers={[answerFrom('et-annet-korpus')]} />);

    expect(disclaimer()).toContain('fra standardkorpuset');
    expect(disclaimer()).not.toContain('fra Kudos');
  });

  it('faller tilbake til det valgte korpuset når svaret mangler nøkkel', () => {
    // Gamle live-tråder fra før nøkkelen fulgte med.
    render(<SourcesView answers={[answerFrom(undefined)]} />);

    expect(disclaimer()).toContain('fra Kudos');
  });

  it('lar lenketeksten følge samme korpus som linja', () => {
    // `documentWith` lager ingen adresser, og uten adresse er det ingen lenke
    // å navngi. Dette dokumentet har en.
    const url = 'https://kudos.dfo.no/dokument/a1c6feb9-3a47-4889-b049-92adae575b9f';
    const withLink: AnswerSources = {
      messageId: 'svar-1',
      status: 'complete',
      corpusKey: 'et-annet-korpus',
      documents: [
        {
          id: 'doc-a',
          title: 'Årsrapport 2021',
          url,
          excerpts: [
            {
              id: 'doc-a-1',
              citationNumber: 1,
              relevance: 'high' as const,
              text: 'Et sitat.',
              kudosUrl: url,
            },
          ],
        },
      ],
    };

    render(<SourcesView answers={[withLink]} />);

    // Ukjent korpus: fraskrivelsen tar stedfortrederen, lenka navngir
    // ingenting og sier bare hva den gjør.
    expect(screen.getAllByRole('link', { name: /^Les dokumentet,/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /på standardkorpuset/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /på Kudos/ })).toBeNull();
  });
});

describe('SourcesView, utdrag fra korpuset som lesbar tekst', () => {
  // 372017/1 i Kudos (DFØs årsrapport 2024), slik live gir overskriften:
  // `parseHeadingPath` beholder `\"` fra Clojure-strengen den kom i.
  const markedUp: AnswerSources = {
    messageId: 'svar-1',
    status: 'complete',
    documents: [
      {
        id: '372017',
        title: 'Årsrapport Direktoratet for forvaltning og økonomistyring 2024',
        excerpts: [
          {
            id: '372017-1',
            citationNumber: 1,
            relevance: 'high' as const,
            heading: 'DFØs årsrapport 2024 › <span id=\\"page-4-0\\"></span>**1 Leders beretning**',
            text: 'Vi har en **viktig** tekst om lønn.<img src="x" onerror="alert(1)">\n\n{5}\n\n------------------------------------------------\n\nNeste side.',
          },
        ],
      },
    ],
  };

  function panelText(container: HTMLElement): string {
    return container.textContent ?? '';
  }

  it('viser overskriften uten anker, stjerner og skråstreker', () => {
    const { container } = render(<SourcesView answers={[markedUp]} />);

    expect(screen.getAllByText('DFØs årsrapport 2024 › 1 Leders beretning').length).toBeGreaterThan(
      0,
    );
    expect(panelText(container)).not.toContain('<span');
    expect(panelText(container)).not.toContain('**');
    expect(panelText(container)).not.toContain('\\"');
  });

  it('viser verken sidemerket, streken eller taggene fra sitatet', () => {
    const { container } = render(<SourcesView answers={[markedUp]} />);

    expect(panelText(container)).not.toContain('{5}');
    expect(panelText(container)).not.toMatch(/-{3,}/);
    expect(panelText(container)).not.toContain('<img');
    expect(container.querySelector('img')).toBeNull();
  });

  it('søker i teksten leseren ser, ikke i markdownen bak den', () => {
    render(<SourcesView answers={[markedUp]} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Søk i kildene' }), {
      target: { value: 'viktig tekst' },
    });

    expect(screen.getByText('1 av 1 treff')).toBeTruthy();
  });
});
