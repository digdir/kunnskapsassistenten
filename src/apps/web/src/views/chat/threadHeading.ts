import type { Message, Thread } from '../../model';

/**
 * The `h2` over a conversation: the thread title, and whether it is worth
 * looking at.
 *
 * The same conversation looked like two different pages depending on how the
 * reader got there: `/threads/:id` drew the thread title as an `h2` with the
 * question under it, `/` drew no heading at all, so the first heading in the
 * column was the answer's own `h3` (brukerblikk 2026-09-15, finding 5). The
 * head is the same on both routes now.
 *
 * Until a thread has a title of its own, the first sentence of the first
 * question stands in. That title is the question again, and the question is
 * right under it, so the conductor settled it on 2026-09-15: a title that
 * only repeats the question is visually hidden. The heading stays in the
 * document, so the outline a screen reader walks is the same on both routes
 * and in both states; it is the second copy on screen that goes. A real title
 * — from the backend, or generated later from more than the first sentence —
 * is shown with the question under it, as Figma draws it.
 *
 * Whether a title is the question over again is the thread's own answer, not
 * something guessed from the text: `titleFromQuestion` is set by whoever made
 * the title (`threadFromQuestion` in src/model/thread.ts), and it stores the
 * whole question rather than a first sentence, so comparing the two strings
 * would say «different» for any question of more than one sentence. A thread
 * that carries no flag is one nobody has claimed to have named after the
 * question, and the stand-in below is ours and always is.
 *
 * The stand-in is a label rather than a sentence, so it loses the question
 * mark or full stop the question ended on, the way the titles it replaces are
 * written («Regnskap og bevilgning i DSS sine årsrapporter», «Digdir:
 * tildelingsbrev mot årsrapport»).
 */
export type ThreadHeading = {
  /** The `h2` text. */
  title: string;
  /**
   * True when the title says no more than the question under it. The heading
   * is then structure only, and carries `ds-sr-only`.
   */
  repeatsQuestion: boolean;
};

/** Past this the line reads as a paragraph rather than as a title. */
const MAX_LENGTH = 80;

/** Sentence end followed by a space: «.», «?», «!», «…», with «?!» allowed. */
const SENTENCE_END = /[.?!…]+(?=\s)/u;

/** The same marks where the sentence simply stops. */
const TRAILING_END = /[.?!…]+$/u;

function firstSentence(question: string): string {
  const text = question.trim().replace(/\s+/gu, ' ');
  const end = text.search(SENTENCE_END);
  const sentence = end < 0 ? text : text.slice(0, end + text.slice(end).search(/\s/u));
  return sentence.replace(TRAILING_END, '').trimEnd();
}

/** Cuts on a word boundary, so a title never ends mid-word. */
function shorten(text: string): string {
  if (text.length <= MAX_LENGTH) return text;
  const cut = text.lastIndexOf(' ', MAX_LENGTH);
  return `${text.slice(0, cut > 0 ? cut : MAX_LENGTH).trimEnd()} …`;
}

/**
 * The heading to draw, or undefined when there is nothing to head — an
 * untouched front page has no thread and no question yet.
 */
export function threadHeading(
  thread: Pick<Thread, 'title' | 'titleFromQuestion'> | undefined,
  messages: Message[],
): ThreadHeading | undefined {
  const named = thread?.title.trim();
  if (named) {
    return { title: named, repeatsQuestion: thread?.titleFromQuestion === true };
  }

  // No thread yet, or one the backend has not named: the first sentence of
  // the first question stands in, and it is the question over again by
  // construction.
  const question = messages.find((message) => message.role === 'user')?.content;
  if (!question) return undefined;

  const standIn = shorten(firstSentence(question));
  return standIn.length > 0 ? { title: standIn, repeatsQuestion: true } : undefined;
}

/**
 * The thread's name for the browser's title (WCAG 2.4.2), or undefined when
 * there is nothing to name yet.
 *
 * The heading's title, except that a title which is the question over again
 * is cut to its first sentence, the way the stand-in is. A thread made from a
 * question stores the whole question as its title, so the same conversation
 * was «Hva sier årsrapporten om tilsyn» while it was being asked and «Hva
 * sier årsrapporten om tilsyn? Og om frekvenser.» after going back to it:
 * measured in the browser, from the front page and back from «Onboarding».
 * A title of its own is used as it is.
 */
export function threadPageTitle(
  thread: Pick<Thread, 'title' | 'titleFromQuestion'> | undefined,
  messages: Message[],
): string | undefined {
  const heading = threadHeading(thread, messages);
  if (!heading) return undefined;
  return heading.repeatsQuestion ? shorten(firstSentence(heading.title)) : heading.title;
}
