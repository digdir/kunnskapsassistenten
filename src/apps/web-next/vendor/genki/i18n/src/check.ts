import { placeholder, type Catalogue, type Message } from './catalogue.js';
import { tagsOf } from './rich.js';

const variants = (message: Message) =>
  typeof message === 'string' ? [message] : Object.values(message).filter((v) => v !== undefined);

const namesOf = (message: Message) =>
  [...new Set(variants(message).flatMap((v) => [...v.matchAll(placeholder)].map((m) => m[1])))]
    .filter((name) => typeof message === 'string' || name !== 'count')
    .sort()
    .join(',');

const tagSet = (message: Message) => [...new Set(variants(message).flatMap(tagsOf))].join(',');

export const catalogueProblems = (source: Catalogue, translation: Catalogue): string[] => {
  const problems: string[] = [];
  for (const [ns, messages] of Object.entries(source)) {
    for (const [key, original] of Object.entries(messages)) {
      const id = `${ns}.${key}`;
      const translated = translation[ns]?.[key];
      if (translated === undefined) {
        problems.push(`${id}: missing`);
        continue;
      }
      if (variants(translated).some((v) => !v.trim())) problems.push(`${id}: empty`);
      if (typeof original !== typeof translated) problems.push(`${id}: plural mismatch`);
      if (namesOf(original) !== namesOf(translated))
        problems.push(`${id}: placeholders {${namesOf(original)}} vs {${namesOf(translated)}}`);
      if (tagSet(original) !== tagSet(translated))
        problems.push(`${id}: tags <${tagSet(original)}> vs <${tagSet(translated)}>`);
      if (variants(translated).some((v) => v.includes('\u2014')))
        problems.push(`${id}: em-dash in copy`);
    }
  }
  for (const [ns, messages] of Object.entries(translation))
    for (const key of Object.keys(messages))
      if (source[ns]?.[key] === undefined) problems.push(`${ns}.${key}: not in source`);
  return problems;
};
