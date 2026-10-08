import { Link } from '@digdir/designsystemet-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Link as RouterLink } from 'react-router';
import { threadTime } from '../../components';
import type { Thread } from '../../model';

export type ThreadLinkProps = {
  thread: Thread;
  /** This is the conversation on screen. See openThreadContext.ts. */
  current: boolean;
  /** The whole corpus label; undefined when there is only one corpus. */
  corpusLabel?: string;
};

/** Where the hover box is drawn, in viewport coordinates. */
type Anchor = { top: number; left: number };

/** One thread's row; {@link RowOverlay} shows what its one line cuts off. */
export function ThreadLink({ thread, current, corpusLabel }: ThreadLinkProps) {
  const titleId = useId();
  const titleRef = useRef<HTMLSpanElement>(null);
  const rowRef = useRef<HTMLAnchorElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | undefined>(undefined);
  const when = threadTime(thread.updatedAt);

  useEffect(() => {
    const element = titleRef.current;
    if (!element) return;

    // An ellipsis keeps the box at one line and widens the content. The pixel
    // of slack absorbs sub-pixel rounding on rows where nothing is hidden.
    const measure = () => setClipped(element.scrollWidth - element.clientWidth > 1);
    measure();

    // Again once the web font (Inter, from altinncdn) has loaded: the first
    // measure may be of the fallback face, and a title that fits only in it
    // would get no box. `document.fonts` is absent in jsdom.
    let live = true;
    const fonts: FontFaceSet | undefined = document.fonts;
    void fonts?.ready.then(() => {
      if (live) measure();
    });

    // jsdom has no ResizeObserver, and no layout to measure either.
    if (typeof ResizeObserver === 'undefined') {
      return () => {
        live = false;
      };
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      live = false;
      observer.disconnect();
    };
    // `current` too: the open row is semibold (threads.css), which widens the
    // title without resizing its box, so ResizeObserver does not fire.
  }, [thread.title, current]);

  const show = useCallback(() => {
    const row = rowRef.current;
    // Only when something is hidden: a box repeating a title already seen
    // whole promises more and gives nothing.
    if (!row || !clipped) return;

    const box = row.getBoundingClientRect();
    setAnchor({ top: box.top, left: box.left });
  }, [clipped]);

  const hide = useCallback(() => setAnchor(undefined), []);

  // The box hangs past the row's edge, so moving between row and box is not a
  // leave (WCAG 1.4.13, hoverable). `relatedTarget` says where the pointer
  // went, so no timer is needed; `null` (nowhere) is a leave.
  const leave = useCallback((event: PointerEvent<Element>) => {
    // `instanceof`, not a cast: in jsdom `relatedTarget` is a bare object, and
    // `Node.contains` would throw on it and leave the box open.
    const to = event.relatedTarget;
    const node = to instanceof Node ? to : null;
    if (node && (rowRef.current?.contains(node) || overlayRef.current?.contains(node))) return;
    setAnchor(undefined);
  }, []);

  return (
    <>
      <Link asChild data-size="sm" className="threads-view__thread">
        {/* The style hangs off `aria-current`, so screen reader and colour agree. From
            the shell, not `NavLink`: a thread started on `/` gets its address by
            `history.replaceState`, which the router never sees. */}
        <RouterLink
          ref={rowRef}
          aria-current={current ? 'page' : undefined}
          /* The title alone: with the time in it, the name would change with the clock. */
          aria-labelledby={titleId}
          to={`/threads/${encodeURIComponent(thread.id)}`}
          onPointerEnter={show}
          onPointerLeave={leave}
          onFocus={show}
          onBlur={hide}
        >
          <span className="threads-view__thread-title" id={titleId} ref={titleRef}>
            {thread.title}
          </span>

          <span className="threads-view__meta">
            {when && (
              <time className="threads-view__time" dateTime={when.dateTime} title={when.title}>
                {when.text}
              </time>
            )}
            {corpusLabel && <span className="threads-view__corpus">{corpusLabel}</span>}
          </span>

          {/* Inside the link, so a click on the box is a click on the row, middle
              click included; a portal on the body would swallow it. */}
          {anchor && (
            <RowOverlay ref={overlayRef} anchor={anchor} onDismiss={hide} onPointerLeave={leave}>
              <span className="threads-view__overlay-title">{thread.title}</span>
              <span className="threads-view__meta">
                {when && <span className="threads-view__time">{when.text}</span>}
                {corpusLabel && <span className="threads-view__corpus">{corpusLabel}</span>}
              </span>
            </RowOverlay>
          )}
        </RouterLink>
      </Link>
    </>
  );
}

export type RowOverlayProps = {
  anchor: Anchor;
  /** Escape, a scroll, a resize — anything that ends the hover from outside. */
  onDismiss: () => void;
  /** The pointer left the box. The row decides whether that ends the hover. */
  onPointerLeave: (event: PointerEvent<Element>) => void;
  /** So the row can tell «the pointer moved onto the box» from «it left». */
  ref: RefObject<HTMLDivElement | null>;
  children: ReactNode;
};

/** The whole row again, across the panel's edge (WCAG 1.4.13: dismissible, hoverable,
 * persistent). Not `title`, which cannot be styled or hold the metadata line. */
export function RowOverlay({ anchor, onDismiss, onPointerLeave, ref, children }: RowOverlayProps) {
  useEffect(() => {
    // On the document: the pointer may have opened the box with nothing focused.
    // Capture and `preventDefault` close only the box, before the drawer's
    // `dialog` sees the same Escape, as a popover inside a dialog does.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onDismiss();
    };
    document.addEventListener('keydown', onKeyDown, true);
    // Capture, so a scroll inside the panel closes it too: a scroll on an
    // inner region never reaches the window by bubbling.
    window.addEventListener('scroll', onDismiss, true);
    window.addEventListener('resize', onDismiss);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onDismiss, true);
      window.removeEventListener('resize', onDismiss);
    };
  }, [onDismiss]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="threads-view__overlay"
      onPointerLeave={onPointerLeave}
      /* The row's own `sm` scale: Designsystemet's `data-size` rescales the
         tokens under it, and without it the box draws another text size. */
      data-size="sm"
      style={{
        insetBlockStart: `${anchor.top}px`,
        insetInlineStart: `${anchor.left}px`,
        // Never past the window's own edge, whatever the title measures.
        maxInlineSize: `calc(100vw - ${anchor.left}px - var(--ds-size-4))`,
      }}
    >
      {children}
    </div>
  );
}
