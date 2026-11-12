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

/** `undefined` when not offered; else whether this browser already chose the next client. */
const offered = async (fetcher: typeof fetch): Promise<{ chosen: boolean } | undefined> => {
  try {
    const response = await fetcher('/api/next/ui', { headers: { Accept: 'application/json' } });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { available?: unknown; ui?: unknown };
    return body.available === true ? { chosen: body.ui === 'next' } : undefined;
  } catch {
    return undefined;
  }
};

interface Props {
  fetcher?: typeof fetch;
  reload?: () => void;
  /** A full navigation, to the next client's front page. */
  go?: (href: string) => void;
}

/** A list item for the foot of the navigation panel, or nothing. */
export function TryNextVersion({
  fetcher = fetch,
  reload,
  go = (href) => location.assign(href),
}: Props) {
  const [shown, setShown] = useState<{ chosen: boolean }>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    void offered(fetcher).then((found) => current && setShown(found));
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
            // Chosen already: this is an info page the next client links to (decisions/0013).
            if (shown.chosen) return go('/');
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
