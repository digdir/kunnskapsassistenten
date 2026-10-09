import { Divider, Heading, Link, List, Paragraph, Table } from '@digdir/designsystemet-react';
import { Children, useMemo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CitationTarget } from '../model';
import { HighlightedText } from './HighlightedText';
import { MIN_QUERY_LENGTH, findHits } from './textSearch';

/**
 * Renders an answer's markdown onto Designsystemet components. Block spacing, `pre`/`code`,
 * `blockquote` and the wide-table scroll box are styled in global.css; Designsystemet has none.
 */
export type MarkdownProps = {
  /** The markdown to render. */
  children: string;
  /** Level of a top-level `#`; deeper ones count up to 6. The size follows depth, not level. */
  startLevel?: 2 | 3 | 4;
  /** Links each `[n]` to excerpt n in the sources panel; one with no target stays plain text. */
  citations?: CitationTarget[];
  /**
   * Sources never arrived (answer stopped), so a `[n]` says so. Off by default: `[1]` may be prose.
   */
  sourcesLost?: boolean;
  /** Called when the reader activates a marker, with its number. */
  onCitationActivate?: (citationNumber: number) => void;
  /**
   * Wraps matches in `<mark>` per block; the caller counts and steps through them in the DOM.
   */
  searchQuery?: string;
  /** Class on each `<mark>`; without it the browser's default yellow stands in. */
  markClassName?: string;
};

// Only `http(s)` to another origin and `mailto:` become links: answers repeat untrusted corpus
// text, and a same-origin link such as `/auth/logout` ends the session on a click. An allowlist,
// so unforeseen schemes are refused; the address is returned as written.
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

/** What a `[n]` says when the excerpt behind it never arrived. */
export const MISSING_SOURCE = 'Kilden kom ikke fram';

// Replaces `[n]` with a superscript link to the excerpt, named by document and page: a bare
// «[3]» tells a screen reader user nothing.
function withCitations(
  children: ReactNode,
  targets: Map<number, CitationTarget>,
  onActivate?: (citationNumber: number) => void,
  sourcesLost?: boolean,
): ReactNode {
  // No early return when `targets` is empty: a stopped answer has markers and
  // no sources, which is exactly the case the unlinked marker below is for.

  return Children.map(children, (child, childIndex) => {
    if (typeof child !== 'string') return child;

    const parts: ReactNode[] = [];
    let consumed = 0;

    for (const match of child.matchAll(CITATION_MARKER)) {
      const number = Number(match[1]);
      const target = targets.get(number);

      // No excerpt behind the marker (answer stopped before the sources arrived): plain text that
      // says why, with sr-only text because `title` alone is mouse-only.
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
            // `preventDefault`: following the href would navigate to `/threads/:id#excerpt-n`
            // and remount the chat slot. The href stays for screen readers, new tabs and copying.
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

// Wraps search matches in `<mark>`, after `withCitations` so a `[n]` link is left alone, with the
// same `findHits` as the sources panel. Per block, as react-markdown hands them over.
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

// Numbers and counts the tables in one answer, on the hast properties the `table` component
// reads. A rehype plugin, because a counter in a component would count again on re-render.
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

// The scroll box's name, from the header row since a markdown table has no caption. A group, not
// a region: as regions every table was a landmark, and repeated names broke `landmark-unique`.
// Past `NAMED_COLUMNS` the rest are counted, to keep the name short.
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
      // Only an address out of the app becomes a link (`linkableHref`). Same tab, because a
      // new-tab warning cannot be worded into someone else's sentence (WCAG 3.2.5, G200).
      // `noreferrer`, so the linked host does not learn `/threads/<id>`.
      a: ({ children: content, href }) => {
        const address = href ? linkableHref(href) : undefined;
        if (!address) return <>{content}</>;
        return (
          <Link href={address} rel="noreferrer">
            {content}
          </Link>
        );
      },
      // Never fetch an image from an answer: the browser GETs `src` on render with the session
      // cookie, so `![x](/auth/logout)` in a corpus document would sign the reader out.
      img: ({ alt }) => <>{alt ?? ''}</>,
      // A wide table gets its own scroll box, which must be reachable by
      // keyboard and carry a name. A group, not a region; see `tableName`.
      table: ({ children: content, node }) => {
        const name = tableName(
          Number(node?.properties?.tableNumber ?? 1),
          Number(node?.properties?.tableCount ?? 1),
          columnHeaders(node as HastNode | undefined),
        );
        return (
          // tabIndex: Safari does not focus scroll containers (WCAG 2.1.1). `ds-focus`, not the
          // forced-on `ds-focus--visible`; a named `div` group, since `fieldset` is for forms.
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
      // `Divider` is `aria-hidden`, which is right: in the changelog the
      // heading after each break carries it for a screen reader.
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
