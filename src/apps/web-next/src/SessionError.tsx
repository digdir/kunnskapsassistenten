// When the server cannot say who is signed in: a sentence and a way to try again.
import { Button, Heading, Paragraph } from '@digdir/designsystemet-react';

export const SessionError = () => (
  <main className="ka-next-session-error">
    <Heading level={1} data-size="sm">
      Kunnskapsassistenten svarer ikke
    </Heading>
    <Paragraph>Vi fikk ikke kontakt med tjenesten. Prøv igjen om litt.</Paragraph>
    <div className="ka-next-session-error-actions">
      <Button onClick={() => location.reload()}>Prøv igjen</Button>
    </div>
  </main>
);
