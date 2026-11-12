import { Link } from '@digdir/designsystemet-react';
import { SparklesIcon } from '@navikt/aksel-icons';
import { useEffect, useState } from 'react';
import { chooseNext } from './chooseNext';
import './tryNextVersion.css';

/*
 * «Prøv ny versjon»: the way into the next client (apps/web-next), which the same server serves
 * to a browser that chose it (src/decisions/0013). Kept apart from the rest of this client, so it
 * goes whole with the toggle. Drawn only when the server says the next client is offered
 * (`GET /api/next/ui`); with it switched off that route is gone, and nothing is drawn.
 */

export const TRY_NEXT_LABEL = 'Prøv ny versjon';

const offered = async (fetcher: typeof fetch): Promise<boolean> => {
  try {
    const response = await fetcher('/api/next/ui', { headers: { Accept: 'application/json' } });
    if (!response.ok) return false;
    const body = (await response.json()) as { available?: unknown };
    return body.available === true;
  } catch {
    return false;
  }
};

interface Props {
  fetcher?: typeof fetch;
  reload?: () => void;
}

/** A list item for the foot of the navigation panel, or nothing. */
export function TryNextVersion({ fetcher = fetch, reload }: Props) {
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    void offered(fetcher).then((yes) => current && setShown(yes));
    return () => {
      current = false;
    };
  }, [fetcher]);

  if (!shown) return null;
  return (
    <li>
      <Link asChild data-size="sm">
        <button
          type="button"
          className="try-next-version"
          aria-busy={busy || undefined}
          onClick={() => {
            setBusy(true);
            chooseNext(fetcher, reload).catch(() => setBusy(false));
          }}
        >
          <SparklesIcon aria-hidden />
          {TRY_NEXT_LABEL}
        </button>
      </Link>
    </li>
  );
}
