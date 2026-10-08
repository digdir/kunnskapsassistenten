import type { MessageStatus } from '../../model';

/** Title and body for one of the panel's empty states. */
export type SourcesEmptyState = {
  title: string;
  description: string;
};

/**
 * Nothing has been asked yet. The only state that may say «når du har stilt et
 * spørsmål», and it names the selected corpus, since there is no answer.
 */
export function noAnswerYet(corpusName: string): SourcesEmptyState {
  return {
    title: 'Ingen kilder ennå',
    description: `Kildene vises her når du har stilt et spørsmål. Hvert utdrag er et sitat fra et dokument på ${corpusName}, med samme nummer som markøren i svaret.`,
  };
}

// Per status, without `streaming`, which is loading; only what the frontend sees.
const BY_STATUS: Record<Exclude<MessageStatus, 'streaming'>, SourcesEmptyState> = {
  complete: {
    title: 'Ingen kilder til dette svaret',
    description: 'Svaret viser ikke til noen utdrag fra dokumentene.',
  },
  aborted: {
    title: 'Svaret ble avbrutt før kildene kom',
    description:
      'Kildene kommer sist i et svar. Still spørsmålet på nytt for å se hvilke dokumenter det bygger på.',
  },
  error: {
    title: 'Svaret kom ikke fram',
    description: 'Da kom kildene heller ikke. Prøv spørsmålet på nytt.',
  },
  'needs-clarification': {
    title: 'Kunnskapsassistenten spurte om en avklaring',
    description: 'Kildene kommer når du har svart på spørsmålet i samtalen.',
  },
};

// Markers, but no stored excerpts: live keeps the conversation, not the chunks.
const NOT_STORED: SourcesEmptyState = {
  title: 'Kildene er ikke lagret for denne samtalen',
  description:
    'Svaret viser til utdrag, men de ble ikke lagret sammen med samtalen. Still spørsmålet på nytt for å få et svar med kilder du kan åpne.',
};

// No markers, from a store that keeps no sources (the BFF): unknown, not none.
const NOT_KEPT: SourcesEmptyState = {
  title: NOT_STORED.title,
  description:
    'Kildene blir ikke lagret sammen med samtalen. Still spørsmålet på nytt for å se hvilke dokumenter svaret bygger på.',
};

/**
 * @param citationCount how many `[n]` the answer carries, when that is known.
 *   A finished answer that cited something and has no excerpts lost them; one
 *   that cited nothing never had any.
 * @param sourcesNotStored the store kept no sources for this answer, so none
 *   is not known to mean none.
 */
export function emptyStateFor(
  status: Exclude<MessageStatus, 'streaming'>,
  citationCount?: number,
  sourcesNotStored?: boolean,
): SourcesEmptyState {
  if (status === 'complete' && citationCount !== undefined && citationCount > 0) {
    return NOT_STORED;
  }
  if (status === 'complete' && sourcesNotStored) return NOT_KEPT;
  return BY_STATUS[status];
}
