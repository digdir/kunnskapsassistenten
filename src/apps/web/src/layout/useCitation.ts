import { use } from 'react';
import { CitationContext, type CitationContextValue } from './citationContext';

/**
 * Connects the answer and the sources panel: the chat view calls `showCitation(n)`, the sources
 * panel reads `activeCitation`. The shell holds the state, so the views never import each other
 * and either can move to another slot.
 */
export function useCitation(): CitationContextValue {
  const value = use(CitationContext);
  if (!value) {
    throw new Error('useCitation må brukes inne i en LayoutProvider.');
  }
  return value;
}
