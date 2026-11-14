// The words a layout is drawn with, as data: what `@genai/ui-assembly`'s `AssistantProfile` holds
// that JSON can hold, so the builder can edit it and a host can store it with the layout. What
// only code can say stays the host's: the reader, the profile menu, the sign-out, the family of
// services and a function from a document's number to its link.

/** The kinds of field a profile may mark; a year field offers only years. */
export const fieldKinds = ['year'] as const;
export type FieldKind = (typeof fieldKinds)[number];

/** The kinds of document number a link is chosen by, tried in this order. */
export const documentIdPatterns = ['digits', 'uuid', 'any'] as const;
export type DocumentIdPattern = (typeof documentIdPatterns)[number];

/**
 * The years a year field offers, newest first. Anything else it holds, such as page numbers or a
 * year centuries ahead, is left out, but a value the reader has chosen is always kept.
 */
export interface YearBounds {
  /** The first year offered; 1900 without it. */
  first?: number | undefined;
  /** The last year offered; the year it is in Norway without it. */
  last?: number | undefined;
}

/** One filter field as the reader sees it. Whether its values are integers is the dataset's. */
export interface ProfileField {
  id: string;
  label: string;
  /** The field's name over its row in the next look's filter, singular: «Dokumenttype». */
  heading?: string | undefined;
  kind?: FieldKind | undefined;
  /** For a field of `kind: 'year'`, the years it offers. Without it, 1900 up to this year. */
  years?: YearBounds | undefined;
}

/** One collection as the reader sees it. */
export interface ProfileCorpus {
  /** The collection's name in the page, «Kudos». */
  label?: string | undefined;
  description?: string | undefined;
  /** The fields offered and their order; the rest of the collection's fields are not. */
  fields?: readonly ProfileField[] | undefined;
  /** The plural of each document type, for «Leser fra 45 778 årsrapporter». */
  typePlurals?: Readonly<Record<string, string>> | undefined;
  /** The field the document type is in, for the line above. */
  typeField?: string | undefined;
  /** Where a document lives: an https address per kind of number, `{id}` where it goes. */
  documentLinks?: Readonly<Partial<Record<DocumentIdPattern, string>>> | undefined;
  /**
   * The facets that describe one document, read by its number for the line under its title in
   * «Dokumenter»: the field holding the number, and the fields to show.
   */
  about?: { idField: string; fields: readonly string[] } | undefined;
}

/** A trial the reader may turn on in «Innstillinger», «Eksperimenter». */
export interface ProfileExperiment {
  id: string;
  title: string;
  description?: string | undefined;
  /** Where it is discussed, such as its issue, with the link's words. */
  href?: string | undefined;
  hrefLabel?: string | undefined;
}

/** The profile as data: JSON only, stored with a layout, and filled in by a host's own profile. */
export interface ProfileData {
  /** Who answers, in the page and for a screen reader. */
  assistantName?: string | undefined;
  /** The questions offered under the greeting. */
  suggestions?: readonly string[] | undefined;
  /** The follow-ups offered over the field after an answer (the current look). */
  followUps?: readonly string[] | undefined;
  /** Per collection, by its key, as `/v1/models` gives it in `dataset-config-key`. */
  corpora?: Readonly<Record<string, ProfileCorpus>> | undefined;
  experiments?: readonly ProfileExperiment[] | undefined;
  /** The note at the foot of «Innstillinger». */
  settingsNote?: string | undefined;
}

// ── The shape ──

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const optional = (value: unknown, test: (value: unknown) => boolean) =>
  value === undefined || test(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isStrings = (value: unknown) => Array.isArray(value) && value.every(isString);
const isYear = (value: unknown) => typeof value === 'number' && Number.isInteger(value);

const isKind = (value: unknown): value is FieldKind =>
  (fieldKinds as readonly unknown[]).includes(value);
const isPattern = (value: string): value is DocumentIdPattern =>
  (documentIdPatterns as readonly string[]).includes(value);

const isField = (value: unknown) =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.label) &&
  optional(value.heading, isString) &&
  optional(value.kind, isKind) &&
  optional(
    value.years,
    (years) => isRecord(years) && optional(years.first, isYear) && optional(years.last, isYear),
  );

const isCorpus = (value: unknown) =>
  isRecord(value) &&
  optional(value.label, isString) &&
  optional(value.description, isString) &&
  optional(value.fields, (fields) => Array.isArray(fields) && fields.every(isField)) &&
  optional(
    value.typePlurals,
    (plurals) => isRecord(plurals) && Object.values(plurals).every(isString),
  ) &&
  optional(value.typeField, isString) &&
  optional(
    value.documentLinks,
    (links) =>
      isRecord(links) &&
      Object.entries(links).every(([pattern, url]) => isPattern(pattern) && isString(url)),
  ) &&
  optional(
    value.about,
    (about) => isRecord(about) && isString(about.idField) && isStrings(about.fields),
  );

const isExperiment = (value: unknown) =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.title) &&
  optional(value.description, isString) &&
  optional(value.href, isString) &&
  optional(value.hrefLabel, isString);

/**
 * A profile read from JSON, when it is one: each field of the type it should be, a field's kind and
 * a link's kind of number known, years whole. A key it does not know is passed over, as the
 * layout's are. The shape only; `profileProblems` holds the limits.
 */
export const isProfileData = (value: unknown): value is ProfileData =>
  isRecord(value) &&
  optional(value.assistantName, isString) &&
  optional(value.suggestions, isStrings) &&
  optional(value.followUps, isStrings) &&
  optional(
    value.corpora,
    (corpora) => isRecord(corpora) && Object.values(corpora).every(isCorpus),
  ) &&
  optional(
    value.experiments,
    (experiments) => Array.isArray(experiments) && experiments.every(isExperiment),
  ) &&
  optional(value.settingsNote, isString);

// ── The limits ──

/** The most a profile may hold, as JSON in UTF-8. */
export const PROFILE_MAX_BYTES = 32 * 1024;

/** The longest text of each kind, and the most entries in each list, in a profile. */
export const profileLimits = {
  /** A name, label, heading, title or a link's words. */
  name: 80,
  /** A suggestion or a follow-up. */
  question: 200,
  /** A collection's or a trial's description. */
  description: 500,
  settingsNote: 1_000,
  /** A field's or a collection's id, and a document type. */
  id: 128,
  /** A link or link template. */
  url: 500,
  questions: 6,
  corpora: 20,
  fields: 30,
  typePlurals: 200,
  aboutFields: 10,
  experiments: 10,
} as const;

export type ProfileProblem =
  | { rule: 'profile-too-large'; bytes: number; max: number }
  | { rule: 'text-too-long'; path: string; max: number }
  | { rule: 'too-many'; path: string; max: number }
  | { rule: 'link-not-https'; path: string }
  | { rule: 'unknown-kind'; path: string; kind: string };

const HTTPS = 'https://';

/**
 * Whether a link, or a link template with `{id}`, is an https address whose host comes before the
 * number and names no user, so no document's number can change where it leads.
 */
export const isHttpsLink = (link: string) => {
  if (!link.startsWith(HTTPS)) return false;
  const rest = link.slice(HTTPS.length);
  const hostEnd = rest.search(/[/?#]/);
  const host = hostEnd < 0 ? rest : rest.slice(0, hostEnd);
  if (host.length === 0 || host.includes('@') || host.includes('{id}')) return false;
  try {
    return new URL(link.split('{id}').join('0')).protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Every limit a profile breaks, each with its path in the layout: its size, each text's length,
 * each list's length, links that are not https, and a field kind the assembly does not know.
 */
export const profileProblems = (profile: ProfileData, at = 'profile'): ProfileProblem[] => {
  const problems: ProfileProblem[] = [];
  const bytes = new TextEncoder().encode(JSON.stringify(profile)).length;
  if (bytes > PROFILE_MAX_BYTES)
    problems.push({ rule: 'profile-too-large', bytes, max: PROFILE_MAX_BYTES });
  const text = (value: string | undefined, path: string, max: number) => {
    if (value !== undefined && value.length > max)
      problems.push({ rule: 'text-too-long', path, max });
  };
  const count = (length: number, path: string, max: number) => {
    if (length > max) problems.push({ rule: 'too-many', path, max });
  };
  const link = (value: string | undefined, path: string) => {
    if (value === undefined) return;
    text(value, path, profileLimits.url);
    if (!isHttpsLink(value)) problems.push({ rule: 'link-not-https', path });
  };
  const texts = (list: readonly string[] | undefined, path: string, max: number) => {
    if (!list) return;
    count(list.length, path, profileLimits.questions);
    list.forEach((value, i) => text(value, `${path}[${i}]`, max));
  };

  text(profile.assistantName, `${at}.assistantName`, profileLimits.name);
  texts(profile.suggestions, `${at}.suggestions`, profileLimits.question);
  texts(profile.followUps, `${at}.followUps`, profileLimits.question);
  text(profile.settingsNote, `${at}.settingsNote`, profileLimits.settingsNote);

  const corpora = Object.entries(profile.corpora ?? {});
  count(corpora.length, `${at}.corpora`, profileLimits.corpora);
  for (const [key, corpus] of corpora) {
    const path = `${at}.corpora.${key}`;
    text(key, path, profileLimits.id);
    text(corpus.label, `${path}.label`, profileLimits.name);
    text(corpus.description, `${path}.description`, profileLimits.description);
    text(corpus.typeField, `${path}.typeField`, profileLimits.id);
    const fields = corpus.fields ?? [];
    count(fields.length, `${path}.fields`, profileLimits.fields);
    fields.forEach((field, i) => {
      const fieldPath = `${path}.fields[${i}]`;
      text(field.id, `${fieldPath}.id`, profileLimits.id);
      text(field.label, `${fieldPath}.label`, profileLimits.name);
      text(field.heading, `${fieldPath}.heading`, profileLimits.name);
      const kind: unknown = field.kind;
      if (kind !== undefined && !isKind(kind))
        problems.push({ rule: 'unknown-kind', path: `${fieldPath}.kind`, kind: String(kind) });
    });
    const plurals = Object.entries(corpus.typePlurals ?? {});
    count(plurals.length, `${path}.typePlurals`, profileLimits.typePlurals);
    for (const [type, plural] of plurals) {
      text(type, `${path}.typePlurals`, profileLimits.id);
      text(plural, `${path}.typePlurals.${type}`, profileLimits.id);
    }
    for (const [pattern, url] of Object.entries(corpus.documentLinks ?? {}))
      link(url, `${path}.documentLinks.${pattern}`);
    if (corpus.about) {
      text(corpus.about.idField, `${path}.about.idField`, profileLimits.id);
      count(corpus.about.fields.length, `${path}.about.fields`, profileLimits.aboutFields);
      corpus.about.fields.forEach((field, i) =>
        text(field, `${path}.about.fields[${i}]`, profileLimits.id),
      );
    }
  }

  const experiments = profile.experiments ?? [];
  count(experiments.length, `${at}.experiments`, profileLimits.experiments);
  experiments.forEach((experiment, i) => {
    const path = `${at}.experiments[${i}]`;
    text(experiment.id, `${path}.id`, profileLimits.id);
    text(experiment.title, `${path}.title`, profileLimits.name);
    text(experiment.description, `${path}.description`, profileLimits.description);
    link(experiment.href, `${path}.href`);
    text(experiment.hrefLabel, `${path}.hrefLabel`, profileLimits.name);
  });
  return problems;
};
