import { Divider, Heading, Link, List, Paragraph, Table } from '@digdir/designsystemet-react';
import { Children, useMemo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CitationTarget } from '../model';
import { HighlightedText } from './HighlightedText';
import { MIN_QUERY_LENGTH, findHits } from './textSearch';

/**
 * Renders an answer's markdown onto Designsystemet components.
 *
 * The answer structure was settled on 2026-09-11 (answer 14): a heading plus
 * paragraphs, with markdown lists and simple tables inside the flow. The
 * mapping below is the one in design/designsystemet/behov-til-komponent.md.
 *
 * Three things Designsystemet does not cover, and which are therefore written
 * by hand in src/styles/global.css: `pre`/`code`, `blockquote`, and the
 * spacing between blocks (there is no prose container). The fourth is the
 * horizontal scroll box around wide tables — `Table` does not scale down, and
 * the answer column is at most 800 px.
 */
export type MarkdownProps = {
  /** The markdown to render. */
  children: string;
  /**
   * Heading level for a top-level `#`. Deeper headings count up from here and
   * stop at 6. The default is 2, because an answer sits directly under the
   * page heading. Raise it when the answer sits under a heading of its own,
   * so the document never skips a level. Level is semantics; the visual size
   * follows the depth in the markdown, not the level.
   */
  startLevel?: 2 | 3 | 4;
  /**
   * Turns the `[n]` markers in the text into links to excerpt n in the
   * sources panel. Markers with no target stay plain text, which is
   * what should happen when the model cites something that is not there.
   */
  citations?: CitationTarget[];
  /**
   * The sources for this answer never arrived, so a `[n]` in it points at
   * nothing.
   *
   * Set it for an answer the user stopped mid-stream: the markers are
   * written, the excerpts were still on their way. The marker is then drawn
   * as text that says why instead of as a dead link.
   *
   * Off by default, and that matters: an answer that asks a clarifying
   * question can contain a `[1]` as ordinary prose, and nothing was lost
   * there — no search ran. Saying «kilden kom ikke fram» about it would be a
   * lie. Only the caller knows which case it is.
   */
  sourcesLost?: boolean;
  /** Called when the reader activates a marker, with its number. */
  onCitationActivate?: (citationNumber: number) => void;
  /**
   * Wraps every occurrence of this string in `<mark>`, one block at a time.
   *
   * Shorter than `MIN_QUERY_LENGTH` marks nothing, which is the same rule the
   * sources panel searches by — there is one search mechanism, not two
   * (answers 27 and 55).
   *
   * What is deliberately NOT here is which hit is the current one, or how
   * many there are. Both are questions about reading order, and reading order
   * is what the rendered document already knows: the `<mark>` elements come
   * back from `querySelectorAll` in exactly that order. So the caller counts
   * and steps through them in the DOM, and this component stays a pure
   * function of its markdown. See `AnswerSearch` in the chat view.
   */
  searchQuery?: string;
  /**
   * Class on each `<mark>`, so the highlight sits on the caller's own
   * surface. Left out, the browser's default yellow stands in.
   */
  markClassName?: string;
};

/**
 * The address a link in an answer is allowed to carry, or nothing.
 *
 * An answer is written by a model that has read the corpus, so an address in
 * it is exactly as trustworthy as the documents are — which is to say, not at
 * all. Three forms are let through:
 *
 * - `http` and `https` to another origin. That is what a citation is: a
 *   document that lives somewhere else.
 * - `mailto:`, which the info pages use for the contact address. It reaches
 *   no endpoint and acts on nothing; it hands an address to the reader's mail
 *   program, which then waits for them.
 *
 * Everything else keeps its text and loses its link. The one that matters is
 * an address pointing back into this app: `[logg ut](/auth/logout)` is a GET
 * that ends the session, and one document in the corpus is enough to write it
 * (the review of #129). Naming `/auth/` alone would be out of date the next
 * time a route is added, so the rule is about the origin and not about a
 * path. Nothing in the app has ever had a reason to be linked to from an
 * answer.
 *
 * The scheme list is written as what IS allowed rather than as what is not,
 * so a scheme nobody thought of is refused rather than let through.
 * react-markdown empties `javascript:` and its relatives before this runs;
 * this is the second layer, and it is ours.
 *
 * Relative addresses resolve against the page, the way the browser would, so
 * `/auth/logout` and the whole address for it are one case.
 *
 * The address is handed back as it was written rather than as the parser
 * normalises it: the browser resolves it the same way either way, and a link
 * whose address differs from the one in the answer is harder to check.
 */
function linkableHref(href: string): string | undefined {
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return undefined;
  }
  if (url.protocol === 'mailto:') return href;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  if (url.origin === window.location.origin) return undefined;
  return href;
}

const CITATION_MARKER = /\[(\d+)\]/g;

/**
 * Replaces `[n]` in the text with a superscript link to the excerpt.
 *
 * A bare «[3]» tells a screen reader user nothing, so the link carries the
 * document and page as its accessible name. Convention decided 2026-09-11:
 * the marker points at an EXCERPT, not at a document.
 */
/**
 * What a `[n]` says when the excerpt behind it never arrived.
 *
 * Norwegian, because a user reads it. An answer the user stopped has markers
 * whose sources were still on their way.
 */
export const MISSING_SOURCE = 'Kilden kom ikke fram';

function withCitations(
  children: ReactNode,
  targets: Map<number, CitationTarget>,
  onActivate?: (citationNumber: number) => void,
  sourcesLost?: boolean,
): ReactNode {
  /*
   * No early return when there are no targets, and that is the point rather
   * than an oversight. An answer the user stopped has markers and no sources
   * at all, so `targets` is empty — and that is exactly the case the
   * unlinked marker below exists for. Returning early here meant the
   * explanation never appeared for the one answer that needed it. Caught by
   * its own test.
   *
   * Prose without markers costs one regex that matches nothing.
   */

  return Children.map(children, (child, childIndex) => {
    if (typeof child !== 'string') return child;

    const parts: ReactNode[] = [];
    let consumed = 0;

    for (const match of child.matchAll(CITATION_MARKER)) {
      const number = Number(match[1]);
      const target = targets.get(number);

      /*
       * A marker with no excerpt behind it. It happens for real: an answer
       * stopped mid-stream has written `[3]` but the sources never arrived,
       * so there is nothing to point at. Found by #3.
       *
       * It stays plain text — a link to nowhere is worse than no link — but
       * it says why, so a reader is not left wondering whether they missed
       * something. `title` alone would be mouse-only, hence the second half
       * for anyone listening.
       */
      if (!target) {
        if (!sourcesLost) continue;
        if (match.index > consumed) parts.push(child.slice(consumed, match.index));
        parts.push(
          <sup
            className="markdown__citation"
            title={MISSING_SOURCE}
            key={`${childIndex}-${match.index}`}
          >
            {match[0]}
            <span className="ds-sr-only"> ({MISSING_SOURCE.toLocaleLowerCase('nb-NO')})</span>
          </sup>,
        );
        consumed = match.index + match[0].length;
        continue;
      }

      if (match.index > consumed) parts.push(child.slice(consumed, match.index));
      parts.push(
        <sup className="markdown__citation" key={`${childIndex}-${match.index}`}>
          <Link
            href={`#${target.targetId}`}
            aria-label={target.label}
            title={target.label}
            /*
              `preventDefault`, because the href must not be followed.
              `onActivate` already opens the sources panel and moves focus to
              the excerpt, so the browser's own fragment jump adds nothing —
              and once the conversation has an address it costs everything:
              the marker then resolves to `/threads/:id#excerpt-n`, which is a
              real navigation, and the chat slot remounts with the whole
              conversation inside it. Measured by #3 against PR #25: 5 e2e red.

              The href stays. It is what makes this a link for a screen
              reader, for «open in new tab» and for copying the address of an
              excerpt, and none of those go through this handler.
            */
            onClick={(event) => {
              event.preventDefault();
              onActivate?.(number);
            }}
          >
            {match[0]}
          </Link>
        </sup>,
      );
      consumed = match.index + match[0].length;
    }

    if (parts.length === 0) return child;
    if (consumed < child.length) parts.push(child.slice(consumed));
    return parts;
  });
}

/**
 * The same children again, with search matches wrapped in `<mark>`.
 *
 * Runs after `withCitations` and over its output, so a `[n]` that has already
 * become a link is left alone and only the prose around it is searched. The
 * matching is `findHits`, the splitting is `HighlightedText`: the sources
 * panel searches by the same two, and a second implementation of «what counts
 * as a match» would drift from it within the week.
 *
 * One block at a time, because that is what react-markdown hands over. A
 * query spanning a paragraph boundary finds nothing, which is also true of
 * the browser's own find.
 */
function withHighlights(children: ReactNode, query: string, markClassName?: string): ReactNode {
  if (query.trim().length < MIN_QUERY_LENGTH) return children;

  return Children.map(children, (child) => {
    if (typeof child !== 'string') return child;

    const hits = findHits([{ id: 'block', kind: 'answer', text: child }], query);
    if (hits.length === 0) return child;

    return <HighlightedText text={child} hits={hits} markClassName={markClassName} />;
  });
}

const sizeByDepth = ['md', 'sm', 'xs', '2xs', '2xs', '2xs'] as const;

function headingComponents(
  startLevel: number,
  decorateHeading: (children: ReactNode) => ReactNode,
): Partial<Components> {
  const entries = ([1, 2, 3, 4, 5, 6] as const).map((depth) => {
    const level = Math.min(startLevel + depth - 1, 6) as 1 | 2 | 3 | 4 | 5 | 6;
    const render = ({ children }: { children?: React.ReactNode }) => (
      <Heading level={level} data-size={sizeByDepth[depth - 1]}>
        {decorateHeading(children)}
      </Heading>
    );
    return [`h${depth}`, render] as const;
  });
  return Object.fromEntries(entries);
}

/** The bits of a hast node this file reads. Loose on purpose: see `numberTables`. */
type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

/**
 * Numbers the tables in one answer, in the order they come, and says how
 * many there are.
 *
 * The number and the count go on the table's own hast properties, where the
 * `table` component reads them off `node`. They are never rendered: the
 * component draws its own elements and passes none of the node's properties
 * on. A rehype plugin rather than a counter in the component, because a
 * component can render more than once (StrictMode, a re-render of one
 * answer), and a counter would count again.
 */
function numberTables() {
  return (tree: HastNode) => {
    const tables: HastNode[] = [];
    const walk = (node: HastNode) => {
      if (node.type === 'element' && node.tagName === 'table') tables.push(node);
      node.children?.forEach(walk);
    };
    walk(tree);
    tables.forEach((table, index) => {
      table.properties = { ...table.properties, tableNumber: index + 1, tableCount: tables.length };
    });
  };
}

/** All the text inside a hast node, as one trimmed string. */
function textOf(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('').trim();
}

/** The text of the header cells in a table's first row. */
function columnHeaders(table: HastNode | undefined): string[] {
  const rows: HastNode[] = [];
  const walk = (node: HastNode) => {
    if (node.type === 'element' && node.tagName === 'tr') rows.push(node);
    else node.children?.forEach(walk);
  };
  if (table) walk(table);
  const cells = (rows[0]?.children ?? []).filter(
    (cell) => cell.type === 'element' && cell.tagName === 'th',
  );
  return cells.map(textOf).filter(Boolean);
}

/** How many column names a table's name lists before it says how many more. */
const NAMED_COLUMNS = 4;

const columnList = new Intl.ListFormat('nb', { type: 'conjunction' });

/**
 * The accessible name of a table's scroll box: «Tabell med kolonnene År,
 * Treff og Dokumenter», with its number when the answer has more than one —
 * «Tabell 2 med kolonnene …».
 *
 * The box is a named group, not a region. As a region, every table on the
 * page was a landmark, and two of them with one name broke axe's
 * `landmark-unique`: two tables in one answer (#2), and two answers with the
 * same columns, which a follow-up or «Generer på nytt» gives (KA CC on #241).
 * No name holds across a thread of any length, and a table is not a page
 * region either: a long thread put one in the screen reader's list of
 * landmarks per table, which is mostly noise. A group keeps the name and the
 * tab stop, so the keyboard can still scroll it (`scrollable-region-focusable`).
 *
 * The name is for the reader, then, and not for uniqueness. It comes from the
 * header row, since a markdown table has no caption, and the number tells two
 * tables in one answer apart whatever their columns are.
 *
 * Past `NAMED_COLUMNS` the rest are counted rather than read out, so a wide
 * table does not get a name a screen reader takes ten seconds to say.
 */
function tableName(number: number, count: number, headers: string[]): string {
  const base = count > 1 ? `Tabell ${number}` : 'Tabell';
  if (headers.length === 0) return base;
  const named = headers.slice(0, NAMED_COLUMNS);
  const rest = headers.length - named.length;
  const columns = rest > 0 ? [...named, `${rest} til`] : named;
  return `${base} med ${headers.length === 1 ? 'kolonnen' : 'kolonnene'} ${columnList.format(columns)}`;
}

export function Markdown({
  children,
  startLevel = 2,
  citations,
  onCitationActivate,
  sourcesLost,
  searchQuery = '',
  markClassName,
}: MarkdownProps) {
  const targets = useMemo(
    () => new Map((citations ?? []).map((target) => [target.number, target])),
    [citations],
  );

  const components = useMemo<Components>(() => {
    const decorate = (content: ReactNode) =>
      withHighlights(
        withCitations(content, targets, onCitationActivate, sourcesLost),
        searchQuery,
        markClassName,
      );

    return {
      ...headingComponents(startLevel, (content) =>
        withHighlights(content, searchQuery, markClassName),
      ),
      p: ({ children: content }) => <Paragraph variant="long">{decorate(content)}</Paragraph>,
      ul: ({ children: content }) => <List.Unordered>{content}</List.Unordered>,
      ol: ({ children: content }) => <List.Ordered>{content}</List.Ordered>,
      li: ({ children: content }) => <List.Item>{decorate(content)}</List.Item>,
      /*
        Only an address that leads out of the app becomes a link; see
        `linkableHref`. Everything else keeps its text and loses the link,
        which is what an empty `href` already did — react-markdown empties an
        address it refused, and drawn as a link that one points at the page
        the reader is already on.

        The same tab, which is what it has always been. Every link in this app
        that leaves it opens a tab of its own and says so — the sources panel,
        the documents list, the menu for flags — but each of those is a
        control we wrote the words for, and the warning is part of the words.
        This one sits inside a sentence somebody else wrote, where a warning
        can only be bolted onto the end of it and is read out as part of it.
        WCAG asks for no change of context that was not requested (3.2.5), and
        G200 says to open a new window only where there is a reason; reading
        on in a document is not one. The thread is on the server behind the
        BFF, so Back brings it back.

        `noreferrer` because the address of the thread is nobody else's
        business: without it the browser hands `/threads/<id>` to whatever
        host the model pointed at.
      */
      a: ({ children: content, href }) => {
        const address = href ? linkableHref(href) : undefined;
        if (!address) return <>{content}</>;
        return (
          <Link href={address} rel="noreferrer">
            {content}
          </Link>
        );
      },
      /*
        An image is never fetched from an answer, and its alt text is drawn as
        prose instead.

        The browser GETs an `src` as soon as the answer renders, with the
        session cookie, before anyone has decided to follow anything — so
        `![x](/auth/logout)` in a corpus document signs the reader out, and
        again every time the stored answer is reopened (the review of #129,
        F4). `linkableHref` cannot help here: no click is involved, and an
        image on another host is a request the reader never asked for either.

        The alt text stays because it is the answer's own words about what it
        meant to show. Nothing in the corpus produces images today.
      */
      img: ({ alt }) => <>{alt ?? ''}</>,
      // A wide table gets its own scroll box, and a scrollable box must be
      // reachable by keyboard and carry a name. Pattern from
      // design/designsystemet/behov-til-komponent.md, question 14. A group
      // and not a region; see `tableName`.
      table: ({ children: content, node }) => {
        // Named from its number and its columns; see `tableName`.
        const name = tableName(
          Number(node?.properties?.tableNumber ?? 1),
          Number(node?.properties?.tableCount ?? 1),
          columnHeaders(node as HastNode | undefined),
        );
        return (
          // A scrollable box has to be reachable from the keyboard (WCAG 2.1.1).
          // Chrome and Firefox now focus scroll containers on their own, Safari
          // does not, so the tabIndex stays. The rule below assumes tabIndex on
          // a non-interactive element is a mistake; here it is the fix.
          //
          // `ds-focus` draws the ring on :focus-visible. NOT `ds-focus--visible`,
          // which is the forced-on variant and painted a 3 px ring around every
          // table in every answer at rest — worst in dark mode, where it read as
          // a border nobody had drawn (brukerblikk 3, funn 3). The same note is
          // in src/views/filters/DocumentsList.tsx, which got the choice right.
          //
          // `prefer-tag-over-role` offers `fieldset` for a group, and a
          // fieldset is for form controls, with a legend; a table that scrolls
          // is neither. The role on a `div` is the plain way to say «a named
          // group», which is all this box is.
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex, jsx-a11y/prefer-tag-over-role
          <div className="markdown__table ds-focus" role="group" aria-label={name} tabIndex={0}>
            <Table data-size="sm">{content}</Table>
          </div>
        );
      },
      thead: ({ children: content }) => <Table.Head>{content}</Table.Head>,
      tbody: ({ children: content }) => <Table.Body>{content}</Table.Body>,
      tfoot: ({ children: content }) => <Table.Foot>{content}</Table.Foot>,
      tr: ({ children: content }) => <Table.Row>{content}</Table.Row>,
      th: ({ children: content }) => <Table.HeaderCell>{content}</Table.HeaderCell>,
      td: ({ children: content }) => <Table.Cell>{decorate(content)}</Table.Cell>,
      // A thematic break. The changelog sets its dated entries apart with
      // one; an answer has never used it. `Divider` is `aria-hidden`, which
      // is right here — the heading above each entry is what carries the
      // break for a screen reader, the line is for the eye.
      hr: () => <Divider />,
      // Designsystemet styles none of these three. See global.css.
      pre: ({ children: content }) => <pre className="markdown__pre">{content}</pre>,
      code: ({ children: content }) => <code className="markdown__code">{content}</code>,
      blockquote: ({ children: content }) => (
        <blockquote className="markdown__quote">{content}</blockquote>
      ),
    };
  }, [startLevel, targets, onCitationActivate, sourcesLost, searchQuery, markClassName]);

  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[numberTables]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
