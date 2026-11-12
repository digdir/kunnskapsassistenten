import { defaultLocale, intlLocale, type Locale } from './locale.js';

export interface Plural {
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
}
export type Message = string | Plural;
export type Namespace = { readonly [key: string]: Message };
export type Catalogue = { readonly [namespace: string]: Namespace };

export type Translation<T> = T extends string
  ? string
  : { readonly [K in keyof T]: Translation<T[K]> };

export type Catalogues<C extends Catalogue> = { readonly nb: C } & {
  readonly [L in Exclude<Locale, 'nb'>]: Translation<C>;
};

export type MessageKey<C extends Catalogue> = {
  [N in keyof C & string]: `${N}.${keyof C[N] & string}`;
}[keyof C & string];

type MessageAt<C extends Catalogue, K extends string> = K extends `${infer N}.${infer M}`
  ? N extends keyof C
    ? M extends keyof C[N]
      ? C[N][M]
      : never
    : never
  : never;

type Names<S> = S extends `${string}{${infer P}}${infer Rest}` ? P | Names<Rest> : never;
type ParamNames<M> = M extends string
  ? Names<M>
  : M extends Plural
    ? Names<M[keyof M & keyof Plural]> | 'count'
    : never;

export type Value = string | number | Date;
export type ParamsOf<C extends Catalogue, K extends string, V = Value> = {
  [P in ParamNames<MessageAt<C, K>>]: P extends 'count' ? number : V;
};
export type ParamArgs<C extends Catalogue, K extends string, V = Value> = [
  ParamNames<MessageAt<C, K>>,
] extends [never]
  ? []
  : [params: ParamsOf<C, K, V>];

export type PlainKey<C extends Catalogue> = {
  [K in MessageKey<C>]: ParamArgs<C, K> extends [] ? K : never;
}[MessageKey<C>];

export const defineNamespace = <const N extends Namespace>(namespace: N): N => namespace;
export const defineCatalogue = <const C extends Catalogue>(catalogue: C): C => catalogue;

const pluralRules = new Map<Locale, Intl.PluralRules>();
const pluralOf = (locale: Locale) => {
  let rules = pluralRules.get(locale);
  if (!rules) pluralRules.set(locale, (rules = new Intl.PluralRules(intlLocale(locale))));
  return rules;
};

export const selectVariant = (message: Message, locale: Locale, count: unknown): string => {
  if (typeof message === 'string') return message;
  const n = typeof count === 'number' ? count : Number(count);
  if (n === 0 && message.zero !== undefined) return message.zero;
  const category = pluralOf(locale).select(Number.isFinite(n) ? n : 0) as keyof Plural;
  return message[category] ?? message.other;
};

export const lookup = (catalogue: Catalogue, key: string): Message | undefined => {
  const dot = key.indexOf('.');
  return catalogue[key.slice(0, dot)]?.[key.slice(dot + 1)];
};

export const placeholder = /\{(\w+)\}/g;

export const formatValue = (value: unknown, locale: Locale): string => {
  if (typeof value === 'number') return new Intl.NumberFormat(intlLocale(locale)).format(value);
  if (value instanceof Date)
    return new Intl.DateTimeFormat(intlLocale(locale), {
      dateStyle: 'long',
      timeZone: 'Europe/Oslo',
    }).format(value);
  return String(value);
};

export const interpolate = (
  template: string,
  params: Record<string, unknown> | undefined,
  locale: Locale,
) =>
  template.replace(placeholder, (whole, name: string) =>
    params && name in params ? formatValue(params[name], locale) : whole,
  );

export interface Translator<C extends Catalogue> {
  <K extends MessageKey<C>>(key: K, ...params: ParamArgs<C, K>): string;
  readonly locale: Locale;
  template<K extends MessageKey<C>>(key: K, params?: Record<string, unknown>): string;
  has(key: string): key is MessageKey<C>;
}

export const createTranslator = <C extends Catalogue>(
  catalogues: Catalogues<C>,
  locale: Locale,
): Translator<C> => {
  const own = catalogues[locale] as Catalogue;
  const fallback = catalogues[defaultLocale] as Catalogue;
  const template = (key: string, params?: Record<string, unknown>) => {
    const message = lookup(own, key) ?? lookup(fallback, key);
    if (message === undefined) return key;
    return selectVariant(message, locale, params?.count);
  };
  const t = (key: string, params?: Record<string, unknown>) =>
    interpolate(template(key, params), params, locale);
  return Object.assign(t, {
    locale,
    template,
    has: (key: string): key is MessageKey<C> => lookup(fallback, key) !== undefined,
  }) as Translator<C>;
};
