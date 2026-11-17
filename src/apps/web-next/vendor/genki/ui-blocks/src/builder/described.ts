import { blockCatalogue, coverKey, nameKey, type BlockId } from './catalogue.js';
import { enBuilder, nbBuilder, type BuilderKey } from './i18n.js';

export interface Worded {
  nb: string;
  en: string;
}

export interface DescribedBlock {
  id: BlockId;
  name: Worded;
  covers: Worded[];
}

const worded = (key: BuilderKey): Worded => {
  const name = key.slice('builder.'.length) as keyof typeof nbBuilder;
  return { nb: nbBuilder[name], en: enBuilder[name] };
};

/** The built blocks and the reader's needs each covers, in both languages, for the builder assistant. */
export const describedBlocks = (): DescribedBlock[] =>
  blockCatalogue
    .filter((spec) => spec.status === 'built')
    .map((spec) => ({
      id: spec.id,
      name: worded(nameKey(spec.id)),
      covers: spec.covers.map((need) => worded(coverKey(need))),
    }));
