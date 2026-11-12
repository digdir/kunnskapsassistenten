import { Fieldset, Radio } from '@digdir/designsystemet-react';
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useId,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  createTranslator,
  formatValue,
  type Catalogue,
  type Catalogues,
  type MessageKey,
  type Translator,
} from './catalogue.js';
import { createFormat } from './format.js';
import { defaultLocale, isLocale, localeNames, locales, negotiate, type Locale } from './locale.js';
import { parseRich, type RichNode } from './rich.js';

export interface LocaleState {
  locale: Locale;
  preference: Locale | null;
  setPreference(preference: Locale | null): void;
}

const LocaleContext = createContext<LocaleState>({
  locale: defaultLocale,
  preference: null,
  setPreference: () => undefined,
});

export interface LocaleProviderProps {
  preference?: Locale | null;
  initialPreference?: Locale | null;
  detected?: string | readonly string[] | undefined;
  onPreferenceChange?: (preference: Locale | null) => void;
  title?: Partial<Record<Locale, string>>;
  children?: ReactNode;
}

export const LocaleProvider = ({
  preference: controlled,
  initialPreference = null,
  detected,
  onPreferenceChange,
  title,
  children,
}: LocaleProviderProps) => {
  const outer = useContext(LocaleContext);
  const [own, setOwn] = useState<Locale | null>(initialPreference);
  const preference = controlled === undefined ? own : controlled;
  const locale = preference ?? negotiate(detected) ?? outer.locale;
  const setPreference = useCallback(
    (next: Locale | null) => {
      setOwn(next);
      onPreferenceChange?.(next);
    },
    [onPreferenceChange],
  );
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  }, [locale]);
  const documentTitle = title?.[locale];
  useLayoutEffect(() => {
    if (documentTitle && typeof document !== 'undefined') document.title = documentTitle;
  }, [documentTitle]);
  const value = useMemo(
    () => ({ locale, preference, setPreference }),
    [locale, preference, setPreference],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = () => useContext(LocaleContext);

export const useFormat = () => {
  const { locale } = useLocale();
  return useMemo(() => createFormat(locale), [locale]);
};

type TagNames<S> = S extends `${string}<${infer T}>${infer Rest}`
  ? T extends `/${string}`
    ? TagNames<Rest>
    : (T extends `${infer N}/` ? N : T) | TagNames<Rest>
  : never;
type Strings<M> = M extends string ? M : M[keyof M & ('one' | 'other' | 'zero')];
type ParamNames<S> = S extends `${string}{${infer P}}${infer Rest}` ? P | ParamNames<Rest> : never;
type At<C extends Catalogue, K extends string> = K extends `${infer N}.${infer M}`
  ? N extends keyof C
    ? C[N][M & keyof C[N]]
    : never
  : never;

export type RichParams<C extends Catalogue, K extends string> = {
  [P in ParamNames<Strings<At<C, K>>>]: ReactNode | Date;
} & {
  [T in TagNames<Strings<At<C, K>>>]: (children: ReactNode) => ReactNode;
};

export interface ReactTranslator<C extends Catalogue> extends Translator<C> {
  rich<K extends MessageKey<C>>(key: K, params: RichParams<C, K>): ReactElement;
}

const renderNodes = (
  nodes: RichNode[],
  params: Record<string, unknown>,
  locale: Locale,
): ReactNode[] =>
  nodes.map((node, i) => {
    if (node.kind === 'text') return node.text;
    const value = params[node.name];
    if (node.kind === 'param') {
      if (typeof value === 'number' || value instanceof Date)
        return <Fragment key={i}>{formatValue(value, locale)}</Fragment>;
      return <Fragment key={i}>{value as ReactNode}</Fragment>;
    }
    const children = renderNodes(node.children, params, locale);
    const render = typeof value === 'function' ? (value as (c: ReactNode) => ReactNode) : null;
    return <Fragment key={i}>{render ? render(children) : children}</Fragment>;
  });

export const defineTranslations = <C extends Catalogue>(catalogues: Catalogues<C>) => {
  const cache = new Map<Locale, ReactTranslator<C>>();
  const translator = (locale: Locale): ReactTranslator<C> => {
    const cached = cache.get(locale);
    if (cached) return cached;
    const t = createTranslator(catalogues, locale);
    const rich = (key: string, params: Record<string, unknown>) => (
      <>{renderNodes(parseRich(t.template(key as MessageKey<C>, params)), params, locale)}</>
    );
    const made = Object.assign(t, { rich }) as ReactTranslator<C>;
    cache.set(locale, made);
    return made;
  };
  const useT = () => translator(useLocale().locale);
  return { useT, translator, catalogues };
};

const own = defineTranslations({
  nb: { language: { legend: 'Språk / Language', auto: 'Som nettleseren' } },
  en: { language: { legend: 'Språk / Language', auto: 'Same as browser' } },
});

export interface LanguageChoiceProps {
  onChange?: (preference: Locale | null) => void;
  description?: ReactNode;
  className?: string;
}

export const LanguageChoice = ({ onChange, description, className }: LanguageChoiceProps) => {
  const { preference, setPreference } = useLocale();
  const t = own.useT();
  const name = useId();
  const options: [Locale | null, string][] = [
    [null, t('language.auto')],
    ...locales.map((l): [Locale, string] => [l, localeNames[l]]),
  ];
  return (
    <Fieldset data-size="sm" className={className}>
      <Fieldset.Legend>{t('language.legend')}</Fieldset.Legend>
      {description ? <Fieldset.Description>{description}</Fieldset.Description> : null}
      {options.map(([value, label]) => (
        <Radio
          key={value ?? 'auto'}
          name={name}
          value={value ?? 'auto'}
          label={label}
          {...(value ? { lang: value } : {})}
          checked={preference === value}
          onChange={() => {
            setPreference(value);
            onChange?.(value);
          }}
        />
      ))}
    </Fieldset>
  );
};

export const InLocale = ({ locale, children }: { locale: Locale; children?: ReactNode }) => (
  <LocaleProvider initialPreference={locale}>{children}</LocaleProvider>
);

export const inEnglish = (ui: ReactNode) => <InLocale locale="en">{ui}</InLocale>;

export const storedPreference = (storage: Storage | undefined, key = 'genai.language') => ({
  load: (): Locale | null => {
    try {
      const value = storage?.getItem(key);
      return isLocale(value) ? value : null;
    } catch {
      return null;
    }
  },
  save: (preference: Locale | null) => {
    try {
      if (preference) storage?.setItem(key, preference);
      else storage?.removeItem(key);
    } catch {
      return;
    }
  },
});
