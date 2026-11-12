// Where «Tilbake til ny versjon» on an info page goes, from the `?fra=` the next client's menu sets.

/** The next client's address its menu passed in `fra`, read once so it outlives moves in here. */
export const cameFrom = new URLSearchParams(location.search).get('fra');

/** The next client's front page, with the thread in `from` when that is where the person was. */
export const backToNext = (from: string | null | undefined, origin = location.origin) => {
  if (!from) return '/';
  try {
    const url = new URL(from, origin);
    return url.origin === origin && url.pathname === '/' ? `/${url.search}` : '/';
  } catch {
    return '/';
  }
};
