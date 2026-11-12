// When the server cannot say who is signed in: a sentence, a way to try again, and the way back
// to the old client, which does not need this.
import { Button, Heading, Paragraph } from '@digdir/designsystemet-react';
import { switchClient } from './switchClient';

export const SessionError = () => (
  <main className="ka-next-session-error">
    <Heading level={1} data-size="sm">
      Kunnskapsassistenten svarer ikke
    </Heading>
    <Paragraph>Vi fikk ikke kontakt med tjenesten. Prøv igjen om litt.</Paragraph>
    <div className="ka-next-session-error-actions">
      <Button onClick={() => location.reload()}>Prøv igjen</Button>
      <Button variant="secondary" onClick={() => void switchClient('classic')}>
        Tilbake til gammel versjon
      </Button>
    </div>
  </main>
);
