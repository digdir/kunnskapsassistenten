import { Heading } from '@digdir/designsystemet-react';

/**
 * The empty state, route `/`.
 *
 * Like the thread route, this contributes the page's level 1 heading and
 * nothing else. The greeting, the kickstarters and the compose field belong
 * to the chat view, which the shell mounts in the main slot; a second welcome
 * written here would be a copy that drifts.
 */
export function NewConversation() {
  return (
    <Heading level={1} className="ds-sr-only">
      Kunnskapsassistenten
    </Heading>
  );
}
