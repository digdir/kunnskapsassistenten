import { Heading } from '@digdir/designsystemet-react';

/**
 * Route `/`. Only the page's level 1 heading: the greeting, the kickstarters
 * and the compose field belong to the chat view in the main slot, and a second
 * welcome here would be a copy that drifts.
 */
export function NewConversation() {
  return (
    <Heading level={1} className="ds-sr-only">
      Kunnskapsassistenten
    </Heading>
  );
}
