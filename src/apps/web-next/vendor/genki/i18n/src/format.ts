import { intlLocale, type Locale } from './locale.js';

export type DateInput = Date | string | number;
export type DateStyle = 'short' | 'medium' | 'long';

const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));
const invalid = (value: DateInput) => Number.isNaN(toDate(value).getTime());

const relativeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

export interface Format {
  readonly locale: Locale;
  date(value: DateInput, style?: DateStyle): string;
  time(value: DateInput): string;
  dateTime(value: DateInput, style?: DateStyle): string;
  month(value: DateInput, options?: { year?: boolean }): string;
  weekday(value: DateInput): string;
  number(value: number, options?: Intl.NumberFormatOptions): string;
  decimal(value: number, digits?: number): string;
  percent(value: number, digits?: number): string;
  currency(value: number, options?: { digits?: number }): string;
  relative(value: DateInput, now?: DateInput): string;
  list(items: readonly string[], type?: 'conjunction' | 'disjunction'): string;
  bytes(value: number): string;
}

export const createFormat = (locale: Locale, timeZone = 'Europe/Oslo'): Format => {
  const tag = intlLocale(locale);
  const dates = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(tag, { timeZone, ...options });
  const numbers = (options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(tag, options);
  const time = (value: DateInput) => {
    if (invalid(value)) return '';
    const parts = dates({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(
      toDate(value),
    );
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    return `${part('hour')}${locale === 'en' ? ':' : '.'}${part('minute')}`;
  };
  const date = (value: DateInput, style: DateStyle = 'long') =>
    invalid(value)
      ? ''
      : dates(
          style === 'short'
            ? { day: '2-digit', month: '2-digit', year: 'numeric' }
            : { day: 'numeric', month: style === 'long' ? 'long' : 'short', year: 'numeric' },
        ).format(toDate(value));
  return {
    locale,
    date,
    time,
    dateTime: (value, style = 'long') =>
      invalid(value)
        ? ''
        : locale === 'en'
          ? `${date(value, style)}, ${time(value)}`
          : `${date(value, style)} kl. ${time(value)}`,
    month: (value, options = {}) =>
      invalid(value)
        ? ''
        : dates({ month: 'long', ...(options.year ? { year: 'numeric' } : {}) }).format(
            toDate(value),
          ),
    weekday: (value) => (invalid(value) ? '' : dates({ weekday: 'long' }).format(toDate(value))),
    number: (value, options) => numbers(options).format(value),
    decimal: (value, digits = 1) =>
      numbers({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value),
    percent: (value, digits = 0) =>
      numbers({ style: 'percent', maximumFractionDigits: digits }).format(value),
    currency: (value, options = {}) =>
      numbers({
        style: 'currency',
        currency: 'NOK',
        currencyDisplay: locale === 'en' ? 'code' : 'symbol',
        minimumFractionDigits: options.digits ?? 0,
        maximumFractionDigits: options.digits ?? 2,
      }).format(value),
    relative: (value, now = new Date()) => {
      if (invalid(value)) return '';
      const seconds = (toDate(value).getTime() - toDate(now).getTime()) / 1000;
      const [unit, size] =
        relativeUnits.find(([, s]) => Math.abs(seconds) >= s) ?? (['second', 1] as const);
      return new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }).format(
        Math.round(seconds / size),
        unit,
      );
    },
    list: (items, type = 'conjunction') => new Intl.ListFormat(tag, { type }).format(items),
    bytes: (value) => {
      const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
      const index = Math.min(
        units.length - 1,
        Math.floor(Math.log(Math.max(value, 1)) / Math.log(1024)),
      );
      return numbers({
        style: 'unit',
        unit: units[index],
        unitDisplay: 'short',
        maximumFractionDigits: index === 0 ? 0 : 1,
      }).format(value / 1024 ** index);
    },
  };
};
