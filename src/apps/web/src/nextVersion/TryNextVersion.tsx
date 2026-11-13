import { Link } from '@digdir/designsystemet-react';
import { ArrowUndoIcon, SparklesIcon } from '@navikt/aksel-icons';
import { useEffect, useState } from 'react';
import { infoPages } from '../routes/info/infoPages';
import { backToNext, cameFrom } from './backToNext';
import { chooseNext } from './chooseNext';
import './tryNextVersion.css';

/*
 * «Prøv ny versjon»: the way into the next client (apps/web-next), which the same server serves
 * to a browser that chose it (src/decisions/0013). Kept apart from the rest of this client, so it
 * goes whole with the toggle. Drawn only when the server says the next client is offered
 * (`GET /api/next/ui`); with it switched off that route is gone, and nothing is drawn.
 */

export const TRY_NEXT_LABEL = 'Prøv ny versjon';
export const BACK_TO_NEXT_LABEL = 'Tilbake til ny versjon';

/** On an info page the way in is the next client's front page; a reload may keep this page. */
const onInfoPage = () => infoPages.some(({ path }) => location.pathname === `/${path}`);

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
  /** A full navigation, into the next client. */
  go?: (href: string) => void;
  /** The next client's address the person came from, `?fra=` when the page loaded. */
  from?: string | null;
}

/** A list item for the foot of the navigation panel, or nothing. */
export function TryNextVersion({
  fetcher = fetch,
  reload,
  go = (href) => location.assign(href),
  from = cameFrom,
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
  // Chosen already: this is an info page the next client links to (decisions/0013).
  const back = shown.chosen;
  const Icon = back ? ArrowUndoIcon : SparklesIcon;
  return (
    <li>
      <Link asChild data-size="sm">
        <button
          type="button"
          className="try-next-version"
          aria-busy={busy || undefined}
          onClick={() => {
            if (back) return go(backToNext(from));
            setBusy(true);
            chooseNext(fetcher, onInfoPage() ? () => go('/') : reload).catch(() => setBusy(false));
          }}
        >
          <Icon aria-hidden />
          {back ? BACK_TO_NEXT_LABEL : TRY_NEXT_LABEL}
        </button>
      </Link>
    </li>
  );
}
