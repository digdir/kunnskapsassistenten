import { defineCatalogue, defineNamespace, type Translation } from '@genai/i18n';
import { defineTranslations } from '@genai/i18n/react';

const nbApproach = defineNamespace({
  title: 'Fremgangsmåte',
  // Over the steps in the `list` variant, the dev boards' tool.
  caption: 'Slik jobbet assistenten med svaret',
  done: 'ferdig',
  active: 'pågår',
  waiting: 'venter',
  workingFor: { one: 'Har jobbet i {count} sekund', other: 'Har jobbet i {count} sekunder' },
  read: { one: 'Leste {count} dokument', other: 'Leste {count} dokumenter' },
  used: 'brukte {count}',
  usedOnly: { one: 'Brukte {count} kilde', other: 'Brukte {count} kilder' },
  took: { one: 'tok {count} sekund', other: 'tok {count} sekunder' },
  tookOnly: { one: 'Tok {count} sekund', other: 'Tok {count} sekunder' },
  // How long one step took, beside it.
  stepTime: '{seconds} s',
  stepTimeUnder: 'under {seconds} s',
  usedInAnswer: 'Brukt i svaret: kilde {sources}.',
  showRead: { one: 'Vis det som ble lest', other: 'Vis de {count} som ble lest' },
  showReadSoFar: { one: 'Vis det som er lest', other: 'Vis de {count} som er lest' },
  explainMissing: 'Utdyp hva som mangler',
  stepOf: 'Steg {n} av {total}: {title}',
  step: 'Steg {n}: {title}',
  repeated: { one: '{title} ({count} gang)', other: '{title} ({count} ganger)' },
  excerptsRead: { one: 'Leste {count} utdrag nøye', other: 'Leste {count} utdrag nøye' },
  document: '{title}, {detail}',
  readAndUsed: '{read}, {used}',
  footer: '{summary} · {took}',
  hiddenStatus: '({status})',
  shownStatus: '· {status}',
});

const enApproach = {
  title: 'Approach',
  caption: 'How the assistant worked on the answer',
  done: 'done',
  active: 'in progress',
  waiting: 'waiting',
  workingFor: { one: 'Has worked for {count} second', other: 'Has worked for {count} seconds' },
  read: { one: 'Read {count} document', other: 'Read {count} documents' },
  used: 'used {count}',
  usedOnly: { one: 'Used {count} source', other: 'Used {count} sources' },
  took: { one: 'took {count} second', other: 'took {count} seconds' },
  tookOnly: { one: 'Took {count} second', other: 'Took {count} seconds' },
  stepTime: '{seconds} s',
  stepTimeUnder: 'under {seconds} s',
  usedInAnswer: 'Used in the answer: source {sources}.',
  showRead: { one: 'Show what was read', other: 'Show the {count} that were read' },
  showReadSoFar: { one: 'Show what has been read', other: 'Show the {count} read so far' },
  explainMissing: 'Say more about what is missing',
  stepOf: 'Step {n} of {total}: {title}',
  step: 'Step {n}: {title}',
  repeated: { one: '{title} ({count} time)', other: '{title} ({count} times)' },
  excerptsRead: { one: 'Read {count} excerpt closely', other: 'Read {count} excerpts closely' },
  document: '{title}, {detail}',
  readAndUsed: '{read}, {used}',
  footer: '{summary} · {took}',
  hiddenStatus: '({status})',
  shownStatus: '· {status}',
} satisfies Translation<typeof nbApproach>;

/** Approach's own words, so a host that imports another block loads none of them. */
export const nb = defineCatalogue({ approach: nbApproach });
export const en = { approach: enApproach } satisfies Translation<typeof nb>;

export const { useT, translator } = defineTranslations({ nb, en });
