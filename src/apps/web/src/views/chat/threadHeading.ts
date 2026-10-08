import type { Message, Thread } from '../../model';

/**
 * The `h2` over a conversation, the same on both routes. A title that only
 * repeats the question is visually hidden but stays in the document, and
 * whether it does is `titleFromQuestion`'s answer, never guessed.
 */
export type ThreadHeading = {
  /** The `h2` text. */
  title: string;
  /** True when the title says no more than the question under it. The heading
     is then structure only, and carries `ds-sr-only`. */
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

/** The heading to draw, or undefined when there is nothing to head — an
   untouched front page has no thread and no question yet. */
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
 * The thread's name for the browser's title (WCAG 2.4.2). The heading's
 * title, except that one repeating the question is cut to its first sentence:
 * a thread stores the WHOLE question, which gives two different tab titles.
 */
export function threadPageTitle(
  thread: Pick<Thread, 'title' | 'titleFromQuestion'> | undefined,
  messages: Message[],
): string | undefined {
  const heading = threadHeading(thread, messages);
  if (!heading) return undefined;
  return heading.repeatsQuestion ? shorten(firstSentence(heading.title)) : heading.title;
}
