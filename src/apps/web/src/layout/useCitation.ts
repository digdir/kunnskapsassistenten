import { use } from 'react';
import { CitationContext, type CitationContextValue } from './citationContext';

/**
 * Connects the answer and the sources panel: the chat view calls
 * `showCitation(n)`, the sources panel reads `activeCitation`.
 *
 * The two views never import each other; the shell owns the state between
 * them, which is what lets either one move to another slot.
 */
export function useCitation(): CitationContextValue {
  const value = use(CitationContext);
  if (!value) {
    throw new Error('useCitation må brukes inne i en LayoutProvider.');
  }
  return value;
}
