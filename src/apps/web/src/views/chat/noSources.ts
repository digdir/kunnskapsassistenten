import type { Message } from '../../model';
import { NO_HITS_FILTERED, NO_HITS_WHOLE_CORPUS } from './text';

/**
 * Whether a finished answer stands with no sources behind it, so the card
 * says so (`NO_SOURCES_WARNING`). Exactly the answers the sources panel calls
 * «Ingen kilder til dette svaret», so the two never disagree.
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
