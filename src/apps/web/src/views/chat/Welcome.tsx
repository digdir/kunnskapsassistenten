import { Heading } from '@digdir/designsystemet-react';
import { Kickstarters } from './Kickstarters';

type WelcomeProps = {
  /** The signed-in user's first name. Figma hardcodes a name; this does not. */
  userName?: string;
  onPickKickstarter: (question: string) => void;
  /** The three suggestions for the corpus on screen. */
  kickstarters: readonly string[];
};

/**
 * What a reader meets before the first question, not the shared `EmptyState`.
 * Both greeting lines are ONE heading with a break, since a second would be
 * an outline entry with nothing under it, and the name may be missing.
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
