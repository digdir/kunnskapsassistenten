// The text of KA's own pages, written as Markdown and drawn with Designsystemet. Only what those
// pages use is read: `#` and `##` headings, paragraphs, `-` lists nested by two spaces, `>`
// quotes, `---` between entries, links, `**bold**`, `*italic*` and `***both***`. Anything else
// is text. The text is this client's own, fixed at build time, never an answer or a source.
import { Divider, Heading, Link, List, Paragraph } from '@digdir/designsystemet-react';
import { Fragment, type ReactNode } from 'react';

export type Item = { text: string; items: Item[] };

export type Block =
  | { kind: 'heading'; depth: 1 | 2; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'list'; items: Item[] }
  | { kind: 'divider' };

const HEADING = /^(#{1,2})\s+(\S.*)$/;
const ITEM = /^( *)-\s+(\S.*)$/;
const QUOTE = /^>\s?(.*)$/;
const DIVIDER = /^-{3,}$/;

/** The blocks of `text`, in order. A blank line ends a paragraph, a quote and a list. */
export function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  // The list being read, one array per depth: `open[0]` is its top level.
  let open: Item[][] = [];
  let lines: string[] = [];
  let quoting = false;

  const flush = () => {
    if (lines.length > 0) {
      blocks.push({ kind: quoting ? 'quote' : 'paragraph', text: lines.join(' ') });
      lines = [];
    }
    quoting = false;
    open = [];
  };

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (DIVIDER.test(trimmed)) {
      flush();
      blocks.push({ kind: 'divider' });
      continue;
    }
    const heading = HEADING.exec(trimmed);
    if (heading) {
      flush();
      blocks.push({
        kind: 'heading',
        depth: heading[1] === '#' ? 1 : 2,
        text: heading[2] ?? '',
      });
      continue;
    }
    const item = ITEM.exec(line);
    if (item) {
      if (open.length === 0) {
        flush();
        const top: Item[] = [];
        blocks.push({ kind: 'list', items: top });
        open = [top];
      }
      // Two spaces a level, and never deeper than one under the item before.
      const depth = Math.min(Math.floor((item[1] ?? '').length / 2), open.length);
      open = open.slice(0, depth === 0 ? 1 : depth);
      if (depth > 0) {
        const parent = open[depth - 1]?.at(-1);
        if (parent) open.push(parent.items);
      }
      open.at(-1)?.push({ text: item[2] ?? '', items: [] });
      continue;
    }
    const quote = QUOTE.exec(trimmed);
    if (quote) {
      if (!quoting) flush();
      quoting = true;
      lines.push((quote[1] ?? '').trim());
      continue;
    }
    if (quoting || open.length > 0) flush();
    lines.push(trimmed);
  }
  flush();
  return blocks;
}

const INLINE =
  /\[([^\]]+)\]\(([^)\s]+)\)|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\\(.)/g;

/** Only links that leave this site, or write an email. */
const linkable = (href: string) => /^(?:https:\/\/|mailto:)/.test(href);

/** `text` with its links and emphasis. */
export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  for (const match of text.matchAll(INLINE)) {
    const [whole] = match;
    const [, label, href, both, bold, italic, escaped] = match;
    if (match.index > at) out.push(text.slice(at, match.index));
    const key = String(match.index);
    if (label !== undefined && href !== undefined)
      out.push(
        linkable(href) ? (
          <Link key={key} href={href}>
            {inline(label)}
          </Link>
        ) : (
          label
        ),
      );
    else if (both !== undefined)
      out.push(
        <strong key={key}>
          <em>{both}</em>
        </strong>,
      );
    else if (bold !== undefined) out.push(<strong key={key}>{bold}</strong>);
    else if (italic !== undefined) out.push(<em key={key}>{italic}</em>);
    else out.push(escaped ?? whole);
    at = match.index + whole.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

// The text is fixed at build time and never reordered, so a block's place is its identity.
const listOf = (items: Item[]): ReactNode => (
  <List.Unordered>
    {items.map((item, index) => (
      <List.Item key={index}>
        {inline(item.text)}
        {item.items.length > 0 ? listOf(item.items) : null}
      </List.Item>
    ))}
  </List.Unordered>
);

const blockOf = (block: Block): ReactNode => {
  switch (block.kind) {
    case 'heading':
      return block.depth === 1 ? (
        <Heading level={2} data-size="md">
          {inline(block.text)}
        </Heading>
      ) : (
        <Heading level={3} data-size="xs">
          {inline(block.text)}
        </Heading>
      );
    case 'paragraph':
      return <Paragraph>{inline(block.text)}</Paragraph>;
    case 'quote':
      return (
        <blockquote className="ka-page-quote">
          <Paragraph>{inline(block.text)}</Paragraph>
        </blockquote>
      );
    case 'list':
      return listOf(block.items);
    case 'divider':
      return <Divider />;
  }
};

/** `text` drawn, its `#` one level under the page's `h1`, and its `##` two. */
export const Markdown = ({ text }: { text: string }) => (
  <>
    {blocksOf(text).map((block, index) => (
      <Fragment key={index}>{blockOf(block)}</Fragment>
    ))}
  </>
);
