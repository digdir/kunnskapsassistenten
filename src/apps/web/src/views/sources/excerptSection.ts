import { HEADING_SEPARATOR } from './readableText';

/** The section an excerpt is from, the last level of its heading path: what titles it. */
export function excerptSection(heading: string | undefined): string | undefined {
  return heading?.split(HEADING_SEPARATOR).at(-1)?.trim() || undefined;
}

/** The whole heading path, when a level above the section says where in the document it is. */
export function headingContext(heading: string | undefined): string | undefined {
  return heading?.includes(HEADING_SEPARATOR) ? heading : undefined;
}
