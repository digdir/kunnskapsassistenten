import type { MessageStatus } from '../../model';

/** Title and body for one of the panel's empty states. */
export type SourcesEmptyState = {
  title: string;
  description: string;
};

/**
 * Nothing has been asked yet — the untouched front page.
 *
 * This is the only empty state that may say «når du har stilt et spørsmål»,
 * and keeping it apart from the ones below is the point of this file. The
 * panel used to show it after a stopped answer too, which told a reader who
 * had just watched a question being answered that they had not asked one
 * (design/brukerreiser-2026-09-15.md, punkt 7).
 *
 * It names the corpus for the same reason everything else in this panel does:
 * «et dokument på Kudos» over a NorQuAD deployment is a false promise about
 * what the reader is about to search (KA CC on #139). The SELECTED corpus,
 * not an answer's — there is no answer here, that is what this state is — so
 * it is the one place in the panel where the chooser is the right source.
 */
export function noAnswerYet(corpusName: string): SourcesEmptyState {
  return {
    title: 'Ingen kilder ennå',
    description: `Kildene vises her når du har stilt et spørsmål. Hvert utdrag er et sitat fra et dokument på ${corpusName}, med samme nummer som markøren i svaret.`,
  };
}

/**
 * What an answer with no sources means, per status.
 *
 * `streaming` is missing on purpose: an answer still being written is not
 * empty, it is loading, and the view draws `SourcesPlaceholder` for it. The
 * `Exclude` is what makes the compiler say so if anyone adds a status later.
 *
 * The texts avoid claiming more than the frontend knows. «Svaret viser ikke
 * til noen utdrag» is observable; «den fant ingenting» would be a guess about
 * what the search did.
 */
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

/**
 * An answer whose excerpts were never stored, which is not an answer without
 * sources.
 *
 * Live mode, measured 2026-09-16: the backend keeps the conversation but not
 * the chunks behind it, so a thread opened from the list has an answer with
 * `[1]`–`[4]` in it and nothing behind them. «Svaret viser ikke til noen
 * utdrag fra dokumentene» is then a sentence the reader can disprove by
 * looking at the answer beside it.
 */
const NOT_STORED: SourcesEmptyState = {
  title: 'Kildene er ikke lagret for denne samtalen',
  description:
    'Svaret viser til utdrag, men de ble ikke lagret sammen med samtalen. Still spørsmålet på nytt for å få et svar med kilder du kan åpne.',
};

/**
 * @param citationCount how many `[n]` the answer carries, when that is known.
 *   A finished answer that cited something and has no excerpts lost them; one
 *   that cited nothing never had any. Undefined keeps the older wording, so
 *   nothing changes until the chat view starts counting.
 */
export function emptyStateFor(
  status: Exclude<MessageStatus, 'streaming'>,
  citationCount?: number,
): SourcesEmptyState {
  if (status === 'complete' && citationCount !== undefined && citationCount > 0) {
    return NOT_STORED;
  }
  return BY_STATUS[status];
}
