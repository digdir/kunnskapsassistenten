import { intlLocale, type Locale } from '@genai/i18n';

/** A size limit in words, in mebibytes like the host's check. */
export const limitText = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

/** A file size in decimal units, as file managers count; empty for a size that is not one. */
export const fileSize = (bytes: number, locale: Locale): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1000) return `${Math.round(bytes)} B`;

  const kilobytes = bytes / 1000;
  if (kilobytes < 1000) return `${Math.round(kilobytes)} kB`;

  const megabytes = kilobytes / 1000;
  const unit = megabytes < 1000 ? 'MB' : 'GB';
  const value = megabytes < 1000 ? megabytes : megabytes / 1000;
  return `${value.toLocaleString(intlLocale(locale), { maximumFractionDigits: 1 })} ${unit}`;
};
