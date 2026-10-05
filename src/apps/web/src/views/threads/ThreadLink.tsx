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
  /**
   * The whole corpus label, when there is more than one corpus to tell apart.
   * The view decides that; see ThreadsView.
   */
  corpusLabel?: string;
};

/** Where the hover box is drawn, in viewport coordinates. */
type Anchor = { top: number; left: number };

/**
 * One thread's row: the title on one line, and under it when it was last
 * touched and which corpus it was asked of.
 *
 * THE WHOLE ROW IS THE LINK (Lars, 23.09). The time and the corpus used to
 * sit beside it, outside the link, so the bottom half of every row was dead
 * to the pointer. They are inside it now, and the name is still the title
 * alone: `aria-labelledby` points at the title span, so a screen reader says
 * «NKOM måloppnåelse, lenke» and not «NKOM måloppnåelse 14:32 Kudos, 938
 * dokumenter (mock)» — a name that changes as the clock moves and that nobody
 * can ask for by voice. That is the reason the two were kept out of the link
 * in #67 and #106, and it still holds; only the click surface changed.
 *
 * One line, always, with an ellipsis (Lars, 23.09). `Thread.title` is the
 * reader's own question until a backend writes a real title, so an untitled
 * thread was the one row that took two lines where «NKOM måloppnåelse» took
 * one. The whole title stays in the DOM and is read by a screen reader; what
 * is cut is only what is drawn.
 *
 * What is cut comes back on hover and on focus, as a box that may hang over
 * the panel's edge — see {@link RowOverlay}. It replaces the `title`
 * attribute the row used to carry: a native tooltip cannot be styled, cannot
 * hold the metadata line, and is read as a description after the name a
 * screen reader has just said.
 */
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

    /*
     * An ellipsis leaves the element's own box at one line and the content
     * wider. The pixel of slack is for sub-pixel text widths, which round the
     * two apart on a row where nothing is hidden.
     *
     * Width rather than height now that the row is one line: the question is
     * no longer whether a third line fell off, but whether the end of the
     * sentence did.
     */
    const measure = () => setClipped(element.scrollWidth - element.clientWidth > 1);
    measure();

    /*
     * Again when the web font has arrived.
     *
     * Inter is loaded from altinncdn, and `document.fonts.status` is still
     * `loading` while these rows first measure themselves — so the first
     * answer is about the fallback face, whose metrics are not Inter's. A row
     * that fits in the fallback and not in Inter kept its tooltip off, and
     * the reader had no way to the rest of the question (KA CC on #80).
     *
     * `document.fonts` is absent in jsdom, so this is read as optional.
     */
    let live = true;
    const fonts: FontFaceSet | undefined = document.fonts;
    void fonts?.ready.then(() => {
      if (live) measure();
    });

    // jsdom has no ResizeObserver, and nothing there has a layout to measure
    // in the first place. Same guard as the shell's region head.
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
    /*
     * `current` is in here for a reason a resize cannot cover: the open row is
     * drawn semibold (see threads.css), which makes the same title about 6 px
     * wider without changing the box it is drawn in. `ResizeObserver` watches
     * the box, so it stays silent through exactly the change that can push
     * the end of a title out of sight. Measured by KA CC on #80.
     */
  }, [thread.title, current]);

  const show = useCallback(() => {
    const row = rowRef.current;
    // Only when something is actually hidden. A box that repeats a title the
    // reader can already see whole promises them the rest and hands them the
    // same sentence — the rule the `title` attribute followed before it.
    if (!row || !clipped) return;

    const box = row.getBoundingClientRect();
    setAnchor({ top: box.top, left: box.left });
  }, [clipped]);

  const hide = useCallback(() => setAnchor(undefined), []);

  /*
   * The pointer left the row — or the box — but not necessarily the pair.
   *
   * The box hangs past the row's right edge, and moving out there is moving
   * off the row: with a plain `pointerleave` the box shut itself while the
   * pointer was standing on it, which is the classic failure of WCAG 1.4.13
   * «hoverable» (KA CC on #160). `relatedTarget` is where the pointer went,
   * so the two elements can be treated as one surface — and it is read
   * rather than timed, so nothing depends on how fast anybody moves.
   *
   * `null` means it left for somewhere with no element under it, the window
   * included. That is a leave.
   */
  const leave = useCallback((event: PointerEvent<Element>) => {
    /*
     * `instanceof Node` and not a cast: `relatedTarget` is typed as an
     * element but is not always one. It is `null` when the pointer left for
     * nowhere, and in jsdom it is a bare object — which `Node.contains`
     * rejects with a TypeError, so a cast would throw inside the handler and
     * leave the box open for ever (measured while writing the test below).
     */
    const to = event.relatedTarget;
    const node = to instanceof Node ? to : null;
    if (node && (rowRef.current?.contains(node) || overlayRef.current?.contains(node))) return;
    setAnchor(undefined);
  }, []);

  return (
    <>
      <Link asChild data-size="sm" className="threads-view__thread">
        {/*
          `aria-current="page"` — not the colour — is what makes the open
          thread available to a screen reader, and the style hangs off the
          same attribute so the two can never drift.

          It came from `NavLink`, which reads the router's location, until
          2026-09-15. That missed the commonest way in: a conversation the
          reader starts on `/` gets its address from `history.replaceState`,
          which the router never sees, so the thread they had just made stayed
          unmarked until a reload (KA CC). The shell knows which conversation
          is on screen however the address got there; see openThreadContext.ts.
        */}
        <RouterLink
          ref={rowRef}
          aria-current={current ? 'page' : undefined}
          aria-labelledby={titleId}
          to={`/threads/${thread.id}`}
          onPointerEnter={show}
          onPointerLeave={leave}
          onFocus={show}
          onBlur={hide}
        >
          <span className="threads-view__thread-title" id={titleId} ref={titleRef}>
            {thread.title}
          </span>

          {/*
            Inside the link, so the pointer hits the row wherever it lands,
            and out of the link's name by `aria-labelledby` above. The corpus
            is left out entirely when there is only one — see ThreadsView.
          */}
          <span className="threads-view__meta">
            {when && (
              <time className="threads-view__time" dateTime={when.dateTime} title={when.title}>
                {when.text}
              </time>
            )}
            {corpusLabel && <span className="threads-view__corpus">{corpusLabel}</span>}
          </span>

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

/**
 * The row again, whole, across the panel's edge.
 *
 * INSIDE the link, and that is the whole trick: `position: fixed` takes it
 * out of the panel's scrolling box — which clips its children, and crossing
 * that edge is the one thing this box exists to do — while the DOM keeps it
 * a descendant of the row. So a click on the box is a click on the row, with
 * middle-click and «open in new tab» included, and nothing has to re-state
 * where the row goes. It was a portal on `document.body` until KA CC measured
 * #160: the box covered the row and swallowed the click.
 *
 * It is anchored at the row's own top-left corner and painted in the row's
 * hover surface and radius, so it reads as the row growing rather than as a
 * second thing appearing elsewhere.
 *
 * `aria-hidden`, and that is not a shortcut: the whole title is already in
 * the row's DOM and is already the link's accessible name, so a screen reader
 * has it. Saying it again here would read the same sentence twice.
 *
 * WCAG 1.4.13 (content on hover or focus):
 *
 *   Dismissible — Escape closes it without moving the pointer or the focus.
 *   The listener is on the document because the pointer may be what opened
 *   it, and then nothing in the row has focus to catch a key.
 *   Persistent — it stays until the pointer leaves the row, focus leaves it,
 *   or Escape. Nothing times it out.
 *   Hoverable — the box takes the pointer, and the row treats the two as one
 *   surface: a move from the row onto the box is not a leave, and neither is
 *   the way back. It had `pointer-events: none` until KA CC measured #160:
 *   the part that hangs past the panel edge is NOT over the row, so the
 *   pointer going there ended the hover and shut the box the reader was
 *   reading.
 *
 * It is anchored to a place in the window rather than to the row, so a scroll
 * or a resize moves the row out from under it. Both close it.
 */
export function RowOverlay({ anchor, onDismiss, onPointerLeave, ref, children }: RowOverlayProps) {
  useEffect(() => {
    /*
     * Escape closes the box, and ONLY the box.
     *
     * In drawer mode the panel is a `dialog`, and the same key press is the
     * dialog's own close request: one Escape closed the box AND the drawer,
     * and moved focus to «Vis tråder og filter» (KA CC on #160). 1.4.13 asks
     * for a way to dismiss the box WITHOUT moving either, and in the drawer
     * there was none.
     *
     * `preventDefault` in the capture phase, before the dialog gets the key,
     * is the order the platform uses itself: a popover inside a dialog closes
     * before the dialog does. The second Escape closes the drawer, because
     * this listener left with the box.
     */
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
      /*
       * The row's own size scale. Designsystemet's `data-size` rescales the
       * font and spacing tokens for everything under it, and the row is `sm`:
       * without this the box drew the same title at 14 px against the row's
       * 16 and the time at 12 against 11, so the box was narrower than the
       * text it exists to show and never reached the panel edge (measured).
       */
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
