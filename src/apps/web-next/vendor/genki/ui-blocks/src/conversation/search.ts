import { readFootnotes } from '../answer/citations.js';
import { renderBlocks, type VisibleText } from '../markdown/Markdown.js';
import type { ConversationAnswer } from './types.js';

/**
 * The words an answer is drawn with, and where each drawn leaf starts in them: what the search
 * looks in, so a hit lands on the characters it names. The same walk `Answer` draws with, and the
 * same footnotes: a `[N]` the answer draws as a footnote, drops, or marks as lost is no text to
 * search, and any other `[N]` is. The conversation's tests hold this to the drawing on real answers.
 */
export const answerVisibleText = (
  answer: Pick<ConversationAnswer, 'text' | 'sources' | 'markers' | 'status'>,
): VisibleText => {
  const { marks } = readFootnotes(answer.text, answer.sources, answer.markers);
  const lost = answer.status === 'aborted';
  let text = '';
  const offsets: number[] = [];
  renderBlocks(
    answer.text,
    (n, key) => (marks.has(key) || (lost && n < 1000) ? false : undefined),
    true,
    (value) => {
      offsets.push(text.length);
      text += value;
      return value;
    },
    () => {
      text += '\n';
    },
  );
  return { text, offsets };
};
