import { threadTime } from '../../components';

type AnswerTimeProps = {
  /** ISO 8601 from {@link Message.createdAt}. */
  createdAt: string;
};

/**
 * When the answer came, in the action row under it.
 *
 * «Den jeg kjørte før møtet på tirsdag» was unanswerable inside a
 * conversation: the thread list got a time on every row (#34), and the answer
 * the reader was actually looking at had none (brukerreiser 2026-09-15,
 * punkt 3).
 *
 * The same `threadTime` the list uses, so a thread that says «fredag» in the
 * list does not say something else once it is open. That is why the helper
 * moved to `src/components/`: two callers, and a view may not import another
 * view.
 *
 * The question above gets no stamp of its own. The answer is what a reader
 * refers back to, and a time over every turn would double the count without
 * adding a fact — the question is the line directly above this one.
 *
 * A turn that came back as `needs-clarification` gets one, in the same words:
 * «Svaret kom» is the moment the assistant replied, and it replied — with a
 * question rather than an answer, but at a time the reader can refer to.
 * Without it a restored conversation that ended in a clarification had a
 * hole, when every row in the thread list says when (the conductor,
 * 2026-09-16).
 *
 * Restored answers show the time they were given, not the time they were
 * loaded: `createdAt` is written when the turn happens and stored with it
 * (`recordMockTurn`), the same discipline `thoughtMs` follows. An answer that
 * changed its timestamp on reload would be the «Tenkte i 2 sekunder» bug
 * again, in a different field.
 *
 * Two texts, because the two readers need different amounts. The short one is
 * what the list draws, and it is short because the list has a group heading
 * over it saying roughly when — «Siste 30 dager», «2025». Here there is no
 * such heading, so «12. mai» alone does not say which year, and `title` is a
 * tooltip a screen reader never reads. So the visible text stays the list's,
 * and the announced one is whole.
 */
export function AnswerTime({ createdAt }: AnswerTimeProps) {
  const when = threadTime(createdAt);
  // An answer with a broken timestamp shows none. «Invalid Date» under a
  // finished answer would be worse than saying nothing, which is the same
  // call `threadTime` makes for a thread row.
  if (!when) return null;

  return (
    <time className="ka-answer-time" dateTime={when.dateTime} title={when.title}>
      <span aria-hidden="true">{when.text}</span>
      <span className="ds-sr-only">Svaret kom {when.title}</span>
    </time>
  );
}
