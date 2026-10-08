import { createContext } from 'react';

/**
 * Which citation the user last asked to see.
 *
 * `nonce` counts up on every request, including a repeat of the same number.
 * Without it, clicking `[3]`, scrolling away and clicking `[3]` again would
 * change nothing, because the value is identical — and the sources panel
 * would have no way to know it was asked a second time.
 */
export type ActiveCitation = {
  /** 1-indexed, as written in the answer. */
  number: number;
  nonce: number;
  /**
   * Which answer the marker sits in.
   *
   * Without it the sources panel cannot tell `[2]` in the first answer from
   * `[2]` in the third: both are number 2, and each answer numbers its own
   * excerpts from 1. Undefined while the chat view has no message id to give,
   * and the panel then resolves the marker against the answer already on
   * screen — which is what it did before.
   */
  messageId?: string;
};

export type CitationContextValue = {
  activeCitation: ActiveCitation | undefined;
  /**
   * The chat view calls this when the user activates a `[n]` marker.
   *
   * `messageId` says which answer the marker is in. Optional so the call that
   * exists today keeps compiling; pass it and the panel can switch to that
   * answer's sources instead of guessing.
   */
  showCitation: (number: number, messageId?: string) => void;
};

export const CitationContext = createContext<CitationContextValue | undefined>(undefined);
