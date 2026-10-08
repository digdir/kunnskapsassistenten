import type { Message } from '../../model';
import { NO_HITS_FILTERED, NO_HITS_WHOLE_CORPUS } from './text';

/**
 * Whether a finished answer stands with no sources behind it, and the card
 * says so (`NO_SOURCES_WARNING`).
 *
 * The same answers the sources panel calls «Ingen kilder til dette svaret»
 * (`emptyStateFor` in views/sources), so the two never disagree:
 *
 * - finished, with text, and no excerpts, whether the sources frame came
 *   empty or never came;
 * - but not an answer whose text cites `[n]` that were not stored with it.
 *   That one had sources and the store lost them, and the panel says
 *   «Kildene er ikke lagret» instead;
 * - and not an answer read back from a store that keeps no sources per
 *   answer (`sourcesNotStored`), which is the BFF. There an empty list says
 *   nothing at all, and an answer that had sources but cited none of them
 *   was warned about after a reload (measured 06.10 on :8791).
 *
 * Not the client's own «Fant ingen utdrag …» either. That is not an answer to
 * check against the documents; it says nothing was found, and the warning
 * would say it again.
 */
export function lacksSources(message: Message): boolean {
  return (
    message.role === 'assistant' &&
    message.status === 'complete' &&
    message.content.trim() !== '' &&
    (message.sources?.length ?? 0) === 0 &&
    (message.citationCount ?? 0) === 0 &&
    !message.sourcesNotStored &&
    message.content !== NO_HITS_WHOLE_CORPUS &&
    message.content !== NO_HITS_FILTERED
  );
}
