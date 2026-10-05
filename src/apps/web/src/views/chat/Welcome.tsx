import { Heading } from '@digdir/designsystemet-react';
import { Kickstarters } from './Kickstarters';

type WelcomeProps = {
  /** The signed-in user's first name. Figma hardcodes «Simen»; this does not. */
  userName?: string;
  onPickKickstarter: (question: string) => void;
  /** The three suggestions for the corpus on screen. */
  kickstarters: readonly string[];
};

/**
 * What a reader meets before the first question: a greeting and three
 * suggestions.
 *
 * Not the shared `EmptyState` from src/components: that one says «there is
 * nothing here». This one is the start of a conversation, and it is the
 * fullest screen in the flow rather than the emptiest.
 *
 * The greeting is two lines in Figma, «Hei, Simen 👋» and «Hva lurer du på?».
 * Without a name the first line would read «Hei,  👋», so it falls back to a
 * plain «Hei 👋». The waving hand is decorative — a screen reader announcing
 * «vinkende hånd» in the middle of a greeting adds nothing — so it is hidden
 * and the greeting is a real heading either way.
 *
 * Both lines are ONE heading with a break between them, which is how Figma
 * draws it: a single text node holding two lines. Making the second line a
 * heading of its own put an entry in the outline with nothing under it, next
 * to the «Forslag» heading that does name something.
 */
export function Welcome({ userName, onPickKickstarter, kickstarters }: WelcomeProps) {
  return (
    <>
      <div className="ka-chat-greeting">
        <Heading data-size="lg" level={2}>
          {userName ? `Hei, ${userName} ` : 'Hei '}
          <span aria-hidden="true">👋</span>
          <br />
          Hva lurer du på?
        </Heading>
      </div>
      <Kickstarters onPick={onPickKickstarter} questions={kickstarters} />
    </>
  );
}
