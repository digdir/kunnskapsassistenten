/**
 * A backend's address, if the app may put it in an `href`: absolute `http(s)`
 * only, as an allow list, since a corpus document's address has no guaranteed
 * shape. Its own file, because both clients need it and neither owns the rule.
 */
export function publicUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
}
