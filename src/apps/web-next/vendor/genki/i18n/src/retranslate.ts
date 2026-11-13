import { placeholder, type Catalogue, type Message, type Plural } from './catalogue.js';
import type { Locale } from './locale.js';

interface Pattern {
  regex: RegExp;
  names: string[];
  target: string;
  literal: number;
}

const escape = (text: string) => text.replace(/[.*+?^$()|[\]\\]/g, '\\$&');

const pairs = (source: Message, target: Message): [string, string][] => {
  if (typeof source === 'string')
    return [[source, typeof target === 'string' ? target : target.other]];
  const t = typeof target === 'string' ? { other: target } : target;
  return (Object.entries(source) as [keyof Plural, string][]).map(([category, text]) => [
    text,
    t[category] ?? t.other,
  ]);
};

export type Retranslate = (text: string) => string | undefined;

export const createRetranslator = (
  source: Catalogue,
  translations: Partial<Record<Locale, Catalogue>>,
  locale: Locale,
): Retranslate => {
  const target = translations[locale];
  if (!target) return () => undefined;
  const exact = new Map<string, string>();
  const patterns: Pattern[] = [];
  for (const [ns, messages] of Object.entries(source)) {
    for (const [key, message] of Object.entries(messages)) {
      const translated = target[ns]?.[key];
      if (translated === undefined) continue;
      for (const [from, to] of pairs(message, translated)) {
        const names = [...from.matchAll(placeholder)].map((m) => m[1] ?? '');
        if (names.length === 0) {
          exact.set(from, to);
          continue;
        }
        const body = from
          .split(placeholder)
          .map((piece, i) => (i % 2 === 1 ? '([\\s\\S]+?)' : escape(piece)))
          .join('');
        const literal = from.replace(placeholder, '').length;
        patterns.push({ regex: new RegExp(`^${body}$`), names, target: to, literal });
      }
    }
  }
  patterns.sort((a, b) => b.literal - a.literal);
  return (text) => {
    const hit = exact.get(text);
    if (hit !== undefined) return hit;
    for (const pattern of patterns) {
      const m = pattern.regex.exec(text);
      if (!m) continue;
      const values = Object.fromEntries(pattern.names.map((name, i) => [name, m[i + 1] ?? '']));
      return pattern.target.replace(placeholder, (whole, name: string) => values[name] ?? whole);
    }
    return undefined;
  };
};
