import { describe, expect, it } from 'vitest';
import type { SourceDocument } from '../../model';
import {
  answerAsPlainText,
  announcedText,
  answerWithSources,
  copyReceipt,
  referenceList,
} from './answerText';

const ANSWER = `## Måloppnåelse

Første avsnitt med en kilde [1]. Og en til [12].

### Hovedmål

- Sikre nett
- God konkurranse

| Tema | 2022 | 2023 |
| --- | --- | --- |
| Avvik | Kvartalsvis | Kvartalsvis |

Siste avsnitt.`;

describe('answerAsPlainText', () => {
  it('drops the citation markers', () => {
    const text = answerAsPlainText('Et svar [1] med to [23] markører.');
    expect(text).toBe('Et svar med to markører.');
  });

  it('keeps heading and list text but not their marks', () => {
    const text = answerAsPlainText(ANSWER);
    expect(text).toContain('Måloppnåelse');
    expect(text).not.toContain('## ');
    expect(text).toContain('Sikre nett');
    expect(text).not.toContain('- Sikre nett');
  });

  it('turns table rows into tab separated columns and drops the rule', () => {
    const text = answerAsPlainText(ANSWER);
    expect(text).toContain('Tema\t2022\t2023');
    expect(text).not.toContain('---');
  });
});

describe('announcedText', () => {
  it('says nothing before the first finished paragraph', () => {
    expect(announcedText('Svaret har så vidt begy')).toBe('');
  });

  it('stops at the last blank line, so half a sentence is never read out', () => {
    const streaming = 'Første avsnitt.\n\nAndre avsnitt er ikke ferd';
    expect(announcedText(streaming)).toBe('Første avsnitt.');
  });

  it('grows as paragraphs finish', () => {
    const one = announcedText('Ett.\n\nTo er underveis');
    const two = announcedText('Ett.\n\nTo.\n\nTre er underveis');
    expect(two.length).toBeGreaterThan(one.length);
    expect(two).toContain('To.');
  });
});

describe('referenceList', () => {
  const documents: SourceDocument[] = [
    {
      id: 'd1',
      title: 'Årsrapport Nkom 2022',
      url: 'https://kudos.dfo.no/dokument/nkom-2022',
      organisation: 'Nasjonal kommunikasjonsmyndighet',
      year: 2022,
      excerpts: [
        { id: 'e2', text: '', relevance: 'medium', citationNumber: 2, page: 58 },
        { id: 'e1', text: '', relevance: 'high', citationNumber: 1, page: 41 },
        // Retrieved but never cited: it belongs in the panel, not in a list
        // of what the answer leaned on.
        { id: 'e9', text: '', relevance: 'low' },
      ],
    },
    {
      id: 'd2',
      title: 'Tildelingsbrev 2023',
      excerpts: [{ id: 'e3', text: '', relevance: 'high', citationNumber: 3 }],
    },
  ];

  it('writes one line per cited excerpt, in marker order', () => {
    expect(referenceList(documents)).toEqual([
      '[1] Nasjonal kommunikasjonsmyndighet (2022). Årsrapport Nkom 2022, s. 41. https://kudos.dfo.no/dokument/nkom-2022',
      '[2] Nasjonal kommunikasjonsmyndighet (2022). Årsrapport Nkom 2022, s. 58. https://kudos.dfo.no/dokument/nkom-2022',
      // No organisation, no year, no page and no URL: a folder-based corpus
      // has none of them, and «, s. undefined» would be worse than nothing.
      '[3] Tildelingsbrev 2023.',
    ]);
  });

  it('has nothing to list when the answer cited nothing', () => {
    expect(referenceList([])).toEqual([]);
  });
});

describe('answerWithSources', () => {
  const documents: SourceDocument[] = [
    {
      id: 'd1',
      title: 'Årsrapport Nkom 2022',
      year: 2022,
      excerpts: [{ id: 'e1', text: '', relevance: 'high', citationNumber: 1, page: 41 }],
    },
  ];

  it('keeps the markers and puts the references under the answer', () => {
    const copied = answerWithSources('Nkom rapporterer kvartalsvis [1].', documents);

    expect(copied).toBe(
      [
        'Nkom rapporterer kvartalsvis [1].',
        '',
        'Kilder',
        '[1] (2022). Årsrapport Nkom 2022, s. 41.',
      ].join('\n'),
    );
  });

  it('falls back to clean text when there is nothing to point at', () => {
    // A stopped turn has markers and no sources. Markers pointing at a list
    // that is not there would be worse than no markers.
    expect(answerWithSources('Nkom rapporterer kvartalsvis [1].', [])).toBe(
      'Nkom rapporterer kvartalsvis.',
    );
  });
});

describe('copyReceipt', () => {
  it('counts what went along, with the singular form when it is one', () => {
    expect(copyReceipt(3)).toBe('Svaret og 3 kilder er kopiert.');
    expect(copyReceipt(1)).toBe('Svaret og 1 kilde er kopiert.');
    expect(copyReceipt(0)).toBe('Svaret er kopiert.');
  });
});
