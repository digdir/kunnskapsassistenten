import { Link } from '@digdir/designsystemet-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { plainClick } from '../dom.js';
import type { RowTime } from './grouping.js';

export interface ThreadRowProps {
  title: string;
  href: string;
  /** The conversation on screen. */
  current: boolean;
  time: RowTime | undefined;
  dataset: string | undefined;
  /** A plain click, for a host with its own router. Clicks that open a new tab are the browser's. */
  onOpen: (() => void) | undefined;
  /** The title wraps, up to the lines its style allows, at the panel's size (the `nav` variant). */
  wrap?: boolean | undefined;
}

/** Where the hover box is drawn, in viewport coordinates. */
interface Anchor {
  top: number;
  left: number;
  /** The row's width, which a wrapping row's box keeps, so it opens downward over the row. */
  width: number;
}

/** One thread: a link named by its title alone, with a box showing what its lines cut off. */
export const ThreadRow = ({
  title,
  href,
  current,
  time,
  dataset,
  onOpen,
  wrap = false,
}: ThreadRowProps) => {
  const titleId = useId();
  const titleRef = useRef<HTMLSpanElement>(null);
  const rowRef = useRef<HTMLAnchorElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | undefined>(undefined);

  useEffect(() => {
    const element = titleRef.current;
    if (!element) return;
    // A pixel of slack absorbs sub-pixel rounding on rows where nothing is hidden. A wrapping title
    // is cut below its last line, not at its end.
    const measure = () =>
      setClipped(
        element.scrollWidth - element.clientWidth > 1 ||
          (wrap && element.scrollHeight - element.clientHeight > 1),
      );
    measure();
    // Again once the web font has loaded: a title that fits only in the fallback face needs a box.
    let live = true;
    const fonts: FontFaceSet | undefined = document.fonts;
    void fonts?.ready.then(() => {
      if (live) measure();
    });
    if (typeof ResizeObserver === 'undefined')
      return () => {
        live = false;
      };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      live = false;
      observer.disconnect();
    };
    // `current` too: the open row is bolder, which widens the title without resizing its box.
  }, [title, current, wrap]);

  const show = useCallback(() => {
    const row = rowRef.current;
    // Only when something is hidden: a box repeating a title already seen whole gives nothing.
    if (!row || !clipped) return;
    const box = row.getBoundingClientRect();
    setAnchor({ top: box.top, left: box.left, width: box.width });
  }, [clipped]);

  const hide = useCallback(() => setAnchor(undefined), []);

  // The box hangs past the row's edge, so moving onto it is not a leave (WCAG 1.4.13, hoverable).
  const leave = useCallback((event: PointerEvent<Element>) => {
    const to = event.relatedTarget;
    const node = to instanceof Node ? to : null;
    if (node && (rowRef.current?.contains(node) || overlayRef.current?.contains(node))) return;
    setAnchor(undefined);
  }, []);

  const meta = (withTime: boolean) =>
    time || dataset ? (
      <span className="uib-threads-meta">
        {time ? (
          withTime ? (
            <time className="uib-threads-time" dateTime={time.dateTime} title={time.title}>
              {time.text}
            </time>
          ) : (
            <span className="uib-threads-time">{time.text}</span>
          )
        ) : null}
        {dataset ? <span className="uib-threads-dataset">{dataset}</span> : null}
      </span>
    ) : null;

  return (
    <Link
      ref={rowRef}
      href={href}
      // A wrapping row keeps the panel's size, so its spacing is the panel's tokens, not a small link's.
      data-size={wrap ? undefined : 'sm'}
      className="uib-threads-thread"
      aria-current={current ? 'page' : undefined}
      // The title alone: with the time in it, the name would change with the clock.
      aria-labelledby={titleId}
      onClick={(event) => {
        if (!onOpen || !plainClick(event)) return;
        event.preventDefault();
        onOpen();
      }}
      onPointerEnter={show}
      onPointerLeave={leave}
      onFocus={show}
      onBlur={hide}
    >
      <span className="uib-threads-thread-title" id={titleId} ref={titleRef}>
        {title}
      </span>
      {meta(true)}
      {/* Inside the link, so a click on the box is a click on the row, middle click included. */}
      {anchor ? (
        <RowOverlay
          ref={overlayRef}
          anchor={anchor}
          wrap={wrap}
          onDismiss={hide}
          onPointerLeave={leave}
        >
          <span className="uib-threads-overlay-title">{title}</span>
          {meta(false)}
        </RowOverlay>
      ) : null}
    </Link>
  );
};

const clipping = new Set(['auto', 'scroll', 'hidden', 'clip']);

/** Where the list is seen, in viewport coordinates: the box it scrolls in, or else the window. */
const clipOf = (from: Element | null): { top: number; bottom: number } => {
  for (let node = from; node; node = node.parentElement)
    if (clipping.has(getComputedStyle(node).overflowY)) return node.getBoundingClientRect();
  return { top: 0, bottom: window.innerHeight };
};

interface RowOverlayProps {
  anchor: Anchor;
  /** A wrapping row's box: the row's width and size, opening downward over the row. */
  wrap: boolean;
  /** Escape, a scroll, a resize: anything that ends the hover from outside. */
  onDismiss: () => void;
  onPointerLeave: (event: PointerEvent<Element>) => void;
  ref: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

/**
 * The whole row again, across the panel's edge, or down over the row when it wraps (WCAG 1.4.13:
 * dismissible, hoverable, persistent).
 */
const RowOverlay = ({
  anchor,
  wrap,
  onDismiss,
  onPointerLeave,
  ref,
  children,
}: RowOverlayProps) => {
  useEffect(() => {
    // Captured and prevented, so the first Escape closes the box and not a dialog around the panel.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onDismiss();
    };
    document.addEventListener('keydown', onKeyDown, true);
    // Captured, so a scroll inside the panel closes it too.
    window.addEventListener('scroll', onDismiss, true);
    window.addEventListener('resize', onDismiss);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onDismiss, true);
      window.removeEventListener('resize', onDismiss);
    };
  }, [onDismiss]);

  // A wrapping row's box opens downward, so from a row at the end of the list it would run past
  // where the list scrolls, over what is pinned under it: the reader at the panel's foot and the
  // line over it, which stay in sight for the focus (WCAG 2.4.11). It moves up as far as it must,
  // and is never taller than that box. Before the paint, so it is never drawn where it would cover.
  const [fit, setFit] = useState<{ top: number; room: number }>();
  useLayoutEffect(() => {
    const box = ref.current;
    if (!wrap || !box) return;
    const clip = clipOf(box.parentElement);
    const room = clip.bottom - clip.top;
    const height = Math.min(box.getBoundingClientRect().height, room);
    setFit({ top: Math.min(Math.max(anchor.top, clip.top), clip.bottom - height), room });
  }, [anchor, wrap, ref]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="uib-threads-overlay"
      onPointerLeave={onPointerLeave}
      data-size={wrap ? undefined : 'sm'}
      style={{
        insetBlockStart: `${fit?.top ?? anchor.top}px`,
        insetInlineStart: `${anchor.left}px`,
        ...(wrap
          ? {
              inlineSize: `${anchor.width}px`,
              ...(fit ? { maxBlockSize: `${fit.room}px` } : {}),
            }
          : {
              maxInlineSize: `calc(100vw - ${anchor.left}px - var(--genai-threads-overlay-edge-gap, var(--ds-size-4)))`,
            }),
      }}
    >
      {children}
    </div>
  );
};
