const THIS_MACHINE = new Set(['localhost', '127.0.0.1', '[::1]']);

/** `origin` parsed when its host is exactly this machine over http or https, else undefined. */
export function localOrigin(origin: string): URL | undefined {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  return THIS_MACHINE.has(url.hostname) ? url : undefined;
}
