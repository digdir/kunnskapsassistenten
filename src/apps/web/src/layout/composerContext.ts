import { createContext } from 'react';

/**
 * Whether a compose field is on screen right now.
 *
 * The shell draws «Hopp til skrivefeltet», and the shell is the one place
 * that cannot know whether the field it points at exists: the field is
 * mounted by whichever view holds the conversation, and that view has states
 * without one. «Fant ikke tråden» is the one that shipped.
 *
 * The link was drawn from `routeOwnsMain` instead, which answers a different
 * question — «does the route draw the main slot itself» — and on
 * `/threads/<ukjent>` the two answers disagree: the route does not draw main,
 * the chat view draws «Fant ikke tråden» in it, and Tab Tab Enter left the
 * keyboard standing on a link to an element that was not in the document.
 * Measured by KA CC, 2026-09-15.
 *
 * So the view says so and the shell asks. A count rather than a flag, because
 * the answer has to survive two composers overlapping for a render: React
 * mounts the replacement before it unmounts the one being replaced, and a
 * flag would report «no field» in the middle of a swap while one is on
 * screen the whole time.
 */
export type ComposerContextValue = {
  /** True while at least one compose field is mounted. */
  hasComposer: boolean;
  /** A compose field appeared. Always paired with `removeComposer`. */
  addComposer: () => void;
  /** The compose field went away. */
  removeComposer: () => void;
};

/**
 * Inert by default rather than `undefined`, which is the opposite of what
 * `useAnswerSources` and the other shared contexts do, and deliberately:
 * those hold state a view cannot work without, so a missing provider is a
 * bug worth throwing over. This one is a view telling the chrome something.
 * A view mounted on its own — which is every view test, in four owners'
 * folders — should not have to build a provider to say it, and «nobody is
 * listening» is a true answer. The only reader is the shell, in the same file
 * that provides it.
 */
export const ComposerContext = createContext<ComposerContextValue>({
  hasComposer: false,
  addComposer: () => {},
  removeComposer: () => {},
});
