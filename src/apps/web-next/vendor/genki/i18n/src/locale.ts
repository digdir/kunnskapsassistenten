export const locales = ['nb', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'nb';

export const isLocale = (value: unknown): value is Locale =>
  locales.some((locale) => locale === value);

const intlTags: Record<Locale | 'nn', string> = { nb: 'nb-NO', nn: 'nn-NO', en: 'en-GB' };

export const intlLocale = (locale: Locale) => intlTags[locale];

export const localeNames: Record<Locale, string> = { nb: 'Norsk bokmål', en: 'English' };

const match = (tag: string): Locale | undefined => {
  const base = tag.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  if (isLocale(base)) return base;
  if (base === 'no' || base === 'nn') return 'nb';
  return undefined;
};

const ranked = (header: string) =>
  header
    .split(',')
    .map((entry, index) => {
      const [tag = '', ...params] = entry.split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { tag: tag.trim(), q: q ? Number(q.slice(2)) : 1, index };
    })
    .filter((e) => e.tag && e.tag !== '*' && !Number.isNaN(e.q) && e.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map((e) => e.tag);

export const negotiate = (
  preferred: string | readonly string[] | null | undefined,
): Locale | undefined => {
  if (!preferred) return undefined;
  const tags = typeof preferred === 'string' ? ranked(preferred.replaceAll(' ', ',')) : preferred;
  for (const tag of tags) {
    const found = match(tag);
    if (found) return found;
  }
  return undefined;
};

export const resolveLocale = (
  ...candidates: (string | readonly string[] | null | undefined)[]
): Locale => {
  for (const candidate of candidates) {
    const found = negotiate(candidate);
    if (found) return found;
  }
  return defaultLocale;
};
