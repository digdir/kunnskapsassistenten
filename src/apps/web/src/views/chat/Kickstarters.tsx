import { Button, Heading } from '@digdir/designsystemet-react';
import { FileTextIcon } from '@navikt/aksel-icons';

type KickstartersProps = {
  /** Fills the compose field. It deliberately does not send (answer 40). */
  onPick: (question: string) => void;
  /**
   * The three to offer, chosen by the caller.
   *
   * Handed in rather than read here, because which three depends on the
   * corpus and the corpus is the shell's. A leaf that went looking for it
   * would need a router to read a hook it only reads — see `ChatView`.
   */
  questions: readonly string[];
};

/**
 * Three ready-made questions on the empty state, for the corpus on screen.
 *
 * Each row is a tertiary Button (answer 40), not a chip: these are long,
 * corpus-specific questions, and a row can hold one. The follow-up
 * suggestions under an answer are chips, because they are short.
 *
 * Picking one fills the field and leaves the caret there, so the reader can
 * edit before sending. That is the whole point of a kickstarter: it starts
 * the question, it does not ask it.
 *
 * A plain div, not a labelled section: a labelled section is a landmark, and
 * three buttons are not worth one. The heading carries the structure on its
 * own, and without the landmark there is no id to hand around either.
 */
export function Kickstarters({ onPick, questions }: KickstartersProps) {
  return (
    <div className="ka-kickstarters">
      <Heading data-size="2xs" level={3}>
        Forslag
      </Heading>
      <ul className="ka-kickstarters__list">
        {questions.map((question) => (
          <li key={question}>
            <Button
              className="ka-kickstarter"
              data-color="neutral"
              onClick={() => onPick(question)}
              variant="tertiary"
            >
              <FileTextIcon aria-hidden className="ka-kickstarter__icon" />
              {question}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
