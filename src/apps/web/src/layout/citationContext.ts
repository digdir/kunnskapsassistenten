import { createContext } from 'react';

/**
 * Which citation the user last asked to see: a `[n]` marker (`number`), or a document from
 * «Kilder brukt i svaret» (`documentId`), never both. `nonce` counts up on every request, so
 * clicking the same `[3]` again still makes the sources panel react.
 */
export type ActiveCitation = {
  /** 1-indexed, as written in the answer. Unset when a document was asked for. */
  number?: number;
  /** The document asked for, whose card the panel goes to without marking anything. */
  documentId?: string;
  nonce: number;
  /** Which answer the marker is in (each numbers from 1); unset means the answer on screen. */
  messageId?: string;
};

export type CitationContextValue = {
  activeCitation: ActiveCitation | undefined;
  /** Called when the user activates a `[n]` marker; `messageId` picks that answer's sources. */
  showCitation: (number: number, messageId?: string) => void;
  /** Called from «Kilder brukt i svaret»: the document's card, not one of its excerpts. */
  showDocument: (documentId: string, messageId?: string) => void;
};

export const CitationContext = createContext<CitationContextValue | undefined>(undefined);
