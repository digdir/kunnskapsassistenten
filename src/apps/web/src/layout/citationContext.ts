import { createContext } from 'react';

/**
 * Which citation the user last asked to see. `nonce` counts up on every request, so clicking the
 * same `[3]` again still makes the sources panel react.
 */
export type ActiveCitation = {
  /** 1-indexed, as written in the answer. */
  number: number;
  nonce: number;
  /** Which answer the marker is in (each numbers from 1); unset means the answer on screen. */
  messageId?: string;
};

export type CitationContextValue = {
  activeCitation: ActiveCitation | undefined;
  /** Called when the user activates a `[n]` marker; `messageId` picks that answer's sources. */
  showCitation: (number: number, messageId?: string) => void;
};

export const CitationContext = createContext<CitationContextValue | undefined>(undefined);
