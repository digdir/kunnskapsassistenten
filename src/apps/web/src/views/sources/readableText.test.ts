import { describe, expect, test } from 'vitest';
import { parseHeadingPath } from '../../api/live/mcp';
import { readableDocuments, readableExcerptText, readableHeading } from './readableText';

/*
 * Real chunks from Kudos, cut short: `metadata` and `content_markdown` as they
 * stand in Benjamin's `KUDOS_preprod_v4_*` chunk collection, read 2026-09-28.
 * The id in each comment is `doc_num/chunk_index`.
 */

/** 372017/1, DFØs årsrapport 2024, the chunk #170 showed with the anchor. */
const DFO_2024_METADATA =
  '{"Header 1" "DFØs årsrapport 2024", "Header 2" "<span id=\\"page-4-0\\"></span>**1 Leders beretning**"}';

/** 106439/19: an anchor and bold on every step. */
const BOLD_STEPS_METADATA =
  '{"Header 1" "<span id=\\"page-14-0\\"></span>**5.3 Årsrapport**", "Header 3" "**4.2 Beredskaps- og kontinuitetsplanverk**", "Header 2" "**5.1 Styringsdokumenter**"}';

/** 375022/117: the anchor in the middle of the path. */
const NOTE_METADATA =
  '{"Header 3" "REGNSKAPSPRINSIPPER FOR BRUTTOBUDSJETTERTE VIRKSOMHETER", "Header 1" "6.2 Kontantregnskapet 2024", "Header 2" "<span id=\\"page-37-0\\"></span>NOTE 4 Andre driftskostnader"}';

/** 372017/1: Marker's page marker between two paragraphs. */
const PAGE_BREAK =
  'Regjeringen har pekt ut offentlige anskaffelser som et viktig område. Vi ser en positiv utvikling i virksomhetenes modenhet både når det gjelder bruk av digitale verktøy og innen bærekraftige anskaffelser.\n\n{5}\n\n------------------------------------------------\n\n\n\nGjennom markedsplassen for skytjenester bidrar vi til å forbedre tilgjengeligheten for skytjenester til offentlig sektor.';

/** 140/22: italic run-in heading and a list. */
const ITALIC_AND_LIST =
  'Nedenfor er Direktoratet for økonomistyrings (DFØ) vurderinger av søknadene.\n\n*1) Søknad om unntak fra krav til årsrapport for statlige virksomheter* Det følger av bestemmelser om økonomistyring i staten pkt. 2.3.3, jf. pkt. 1.5.1, at en statlig virksomhet skal utarbeide en årsrapport som inneholder seks deler, med følgende benevnelse og rekkefølge:\n\n- I. Leders beretning\n- II. Introduksjon til virksomheten og hovedtall\n- III. Årets aktiviteter og resultater';

/** 375022/117: a table with an empty spacer row, and footnotes in `<sup>`. */
const TABLE_AND_FOOTNOTES =
  '|                                                   | 31.12.2024 |\n|---------------------------------------------------|------------|\n|                                                   |            |\n| Husleie1)                                         | 3 024 010  |\n| Vedlikehold egne bygg og anlegg                   | 0          |\n| Sum andre driftskostnader                         | 10 795 764 |\n\n<sup>1)</sup> I tillegg til husleien føres også annen lokalleie på denne posten.';

/** 372017/0: the table of contents, a `<br>` inside a cell. */
const BREAK_IN_CELL =
  '{1}\n\n------------------------------------------------\n\n| 1 Leders beretning<br>4 |   |\n|----------------------------------------------|---|\n| 2 Introduksjon til virksomheten og hovedtall<br>6 |   |';

/** 375022/117: a sparse row in a wider table. */
const SPARSE_ROW =
  '|                        | Immaterielle<br>eiendeler | Tomter, bygninger<br>og annen fast<br>eiendom | Sum       |\n|------------------------|---------------------------|-----------------------------------------------|-----------|\n| Varighet 1-5 år        |                           | 2 912 432                                     | 2 912 432 |';

describe('readableHeading, the heading path as live gives it', () => {
  test('drops the page anchor and the bold, keeps the path', () => {
    expect(readableHeading(parseHeadingPath(DFO_2024_METADATA))).toBe(
      'DFØs årsrapport 2024 › 1 Leders beretning',
    );
  });

  test('cleans every step, not only the first', () => {
    expect(readableHeading(parseHeadingPath(BOLD_STEPS_METADATA))).toBe(
      '5.3 Årsrapport › 4.2 Beredskaps- og kontinuitetsplanverk › 5.1 Styringsdokumenter',
    );
  });

  test('cleans an anchor in the middle of the path', () => {
    expect(readableHeading(parseHeadingPath(NOTE_METADATA))).toBe(
      'REGNSKAPSPRINSIPPER FOR BRUTTOBUDSJETTERTE VIRKSOMHETER › 6.2 Kontantregnskapet 2024 › NOTE 4 Andre driftskostnader',
    );
  });

  test('drops a step that was nothing but an anchor, with its separator', () => {
    expect(readableHeading('Årsrapport 2024 › <span id="page-2-0"></span>')).toBe(
      'Årsrapport 2024',
    );
    expect(readableHeading('<span id="page-2-0"></span>')).toBeUndefined();
  });

  test('leaves no heading as no heading', () => {
    expect(readableHeading(undefined)).toBeUndefined();
  });
});

describe('readableExcerptText, the chunk as the reader sees it', () => {
  test("drops Marker's page marker and its dashes, keeps the paragraphs", () => {
    const text = readableExcerptText(PAGE_BREAK);
    expect(text).not.toContain('{5}');
    expect(text).not.toMatch(/-{3,}/);
    expect(text).toBe(
      'Regjeringen har pekt ut offentlige anskaffelser som et viktig område. Vi ser en positiv utvikling i virksomhetenes modenhet både når det gjelder bruk av digitale verktøy og innen bærekraftige anskaffelser.\n\nGjennom markedsplassen for skytjenester bidrar vi til å forbedre tilgjengeligheten for skytjenester til offentlig sektor.',
    );
  });

  test('starts at the text when the chunk starts with page 0 and its dashes', () => {
    // #5 met one in live on #227 (05.10): a chunk that began with `{0}` and a
    // line of dashes, the first page of its document. Nothing of the marker
    // may stand above the first sentence, not even the blank lines after it.
    const text = readableExcerptText(
      '{0}\n\n------------------------------------------------\n\nÅrsrapport 2024 for Direktoratet for forvaltning og økonomistyring.',
    );
    expect(text).toBe('Årsrapport 2024 for Direktoratet for forvaltning og økonomistyring.');
  });

  test('drops the italic markers and draws list items as bullets', () => {
    const text = readableExcerptText(ITALIC_AND_LIST);
    expect(text).not.toContain('*');
    expect(text).toContain(
      '1) Søknad om unntak fra krav til årsrapport for statlige virksomheter Det følger av',
    );
    expect(text).toContain(
      'rekkefølge:\n\n• I. Leders beretning\n• II. Introduksjon til virksomheten og hovedtall\n• III. Årets aktiviteter og resultater',
    );
  });

  test('draws a table row as a line, without pipes, delimiter or spacer rows', () => {
    const text = readableExcerptText(TABLE_AND_FOOTNOTES);
    expect(text).not.toContain('|');
    expect(text).not.toContain('---');
    expect(text.split('\n').slice(0, 4)).toEqual([
      '– · 31.12.2024',
      'Husleie¹⁾ · 3 024 010',
      'Vedlikehold egne bygg og anlegg · 0',
      'Sum andre driftskostnader · 10 795 764',
    ]);
  });

  test('turns a <br> inside a cell into a space', () => {
    expect(readableExcerptText(BREAK_IN_CELL)).toBe(
      '1 Leders beretning 4\n2 Introduksjon til virksomheten og hovedtall 6',
    );
  });

  test('keeps an empty cell before a number, so the number keeps its column', () => {
    expect(readableExcerptText(SPARSE_ROW)).toBe(
      '– · Immaterielle eiendeler · Tomter, bygninger og annen fast eiendom · Sum\nVarighet 1-5 år · – · 2 912 432 · 2 912 432',
    );
  });
});

describe('readableExcerptText, footnote marks and exponents stay raised', () => {
  test('raises a mark Marker left glued to the word', () => {
    const text = readableExcerptText(TABLE_AND_FOOTNOTES);
    expect(text).toContain('Husleie¹⁾ · 3 024 010');
    expect(text).not.toContain('Husleie1)');
  });

  test('raises the mark in <sup> before the note, and drops the tag', () => {
    const text = readableExcerptText(TABLE_AND_FOOTNOTES);
    expect(text).not.toContain('<sup>');
    expect(text).toContain(
      '\n\n¹⁾ I tillegg til husleien føres også annen lokalleie på denne posten.',
    );
  });

  test('raises an exponent in <sup>, in the text and in the heading', () => {
    expect(readableExcerptText('Areal på 1 200 m<sup>2</sup> og 10<sup>-3</sup> per år.')).toBe(
      'Areal på 1 200 m² og 10⁻³ per år.',
    );
    expect(readableHeading('Noter › Husleie<sup>1)</sup>')).toBe('Noter › Husleie¹⁾');
  });

  test('keeps a parenthesis in a cell that closes one opened before it', () => {
    expect(
      readableExcerptText(
        [
          '| Areal (1 000 m2) | Utslipp (CO2) |',
          '| 1) Utslipp (tonn CO2) | a) redusere og b) øke fangst (målt i CO2) |',
          '| 1) kontor og 2) lager (1 000 m2) | 1) Husleie2) |',
        ].join('\n'),
      ),
    ).toBe(
      [
        'Areal (1 000 m2) · Utslipp (CO2)',
        '1) Utslipp (tonn CO2) · a) redusere og b) øke fangst (målt i CO2)',
        '1) kontor og 2) lager (1 000 m2) · 1) Husleie²⁾',
      ].join('\n'),
    );
  });

  test('raises a glued mark only in a table cell, not in prose or a heading', () => {
    for (const text of [
      'Tall for Q4) og Q1).',
      'tonn CO2) per år.',
      '1) Utslipp (tonn CO2) økte i 2024.',
      'Husleie1) i løpende tekst.',
    ]) {
      expect(readableExcerptText(text)).toBe(text);
    }
    expect(readableHeading('Noter › Husleie1)')).toBe('Noter › Husleie1)');
  });

  test('keeps a list number and a section number as they are', () => {
    expect(readableExcerptText('1) Første punkt\nSe punkt 2) og tabell 4.1).')).toBe(
      '1) Første punkt\nSe punkt 2) og tabell 4.1).',
    );
  });

  test('keeps <sup> content it has no superscript for as plain text', () => {
    expect(readableExcerptText('Husleie<sup>a)</sup> og drift.')).toBe('Husleiea) og drift.');
  });
});

describe('readableExcerptText, HTML is text or nothing', () => {
  test('never lets a tag through, and never keeps a script', () => {
    const text = readableExcerptText(
      'Før<img src="x" onerror="alert(1)"> etter.<script>alert(2)</script> <span id="page-4-0"></span>Slutt.',
    );
    expect(text).toBe('Før etter. Slutt.');
  });

  test('drops a tag with a / straight after its name', () => {
    expect(readableExcerptText('<svg/onload=alert(1)>svg')).toBe('svg');
    expect(readableExcerptText('Før<img/src=x onerror=alert(1)> etter.')).toBe('Før etter.');
    expect(readableHeading('<span/id="page-4-0"></span>1 Leders beretning')).toBe(
      '1 Leders beretning',
    );
  });

  test('leaves no tag or comment that taking another one out put together', () => {
    expect(readableExcerptText('Før <scr<script>ipt> etter.')).toBe('Før etter.');
    expect(readableExcerptText('Før <!<!<!-- -->-- -->-- skjult --> etter.')).toBe('Før etter.');
    expect(readableExcerptText('Før <scr<b>ipt>alert(1)</scr</b>ipt> etter.')).toBe('Før etter.');
    expect(readableExcerptText('| Sum <scr<script>ipt> | 5 |')).toBe('Sum · 5');
    expect(readableHeading('<sp<b>an id="page-4-0"></span>1 Leders beretning')).toBe(
      '1 Leders beretning',
    );
  });

  test('shows an escaped tag as the characters the document meant', () => {
    expect(readableExcerptText('Feltet heter &lt;span&gt; i malen.')).toBe(
      'Feltet heter <span> i malen.',
    );
  });

  test('leaves a < in prose alone', () => {
    expect(readableExcerptText('Andelen var < 5 % i 2024, og a<b gjelder.')).toBe(
      'Andelen var < 5 % i 2024, og a<b gjelder.',
    );
  });
});

describe('readableExcerptText, what is not markup stays', () => {
  test('an escaped star, a multiplication and a snake_case name', () => {
    expect(readableExcerptText('Regn 5 * 3 * 2, se \\*fotnote og feltet doc_num_id.')).toBe(
      'Regn 5 * 3 * 2, se *fotnote og feltet doc_num_id.',
    );
  });

  test('every escaped character comes back as itself', () => {
    expect(
      readableExcerptText(
        'Tegn: \\\\ \\` \\* \\_ \\{ \\} \\[ \\] \\( \\) \\# \\+ \\- \\. \\! \\| \\" \\\' \\~ \\< \\>',
      ),
    ).toBe('Tegn: \\ ` * _ { } [ ] ( ) # + - . ! | " \' ~ < >');
  });

  test('a private-use character the text has stays itself', () => {
    // U+E037, U+E039 and U+E03C are in Kudos chunks, counted 2026-09-29.
    const privateUse = 'abc,  og .';
    expect(readableExcerptText(privateUse)).toBe(privateUse);
    expect(readableExcerptText('Se \\*fotnote .')).toBe('Se *fotnote .');
    expect(readableHeading(`Note › ${privateUse}`)).toBe(`Note › ${privateUse}`);
  });

  test('drops a noncharacter, so every placeholder put back is one made here', () => {
    expect(readableExcerptText('a﷒b og ﷐c')).toBe('ab og c');
  });

  test('a hash that is not a heading', () => {
    expect(readableExcerptText('Kapittel #3 handler om lønn.')).toBe(
      'Kapittel #3 handler om lønn.',
    );
  });

  test('plain text comes back as it went in', () => {
    const plain = 'DFØ har hatt en samlet tildeling på 1 151 millioner kroner.';
    expect(readableExcerptText(plain)).toBe(plain);
  });
});

describe('readableDocuments', () => {
  test('cleans the text and the heading of every excerpt, and nothing else', () => {
    const [document] = readableDocuments([
      {
        id: '372017',
        title: 'Årsrapport Direktoratet for forvaltning og økonomistyring 2024',
        excerpts: [
          {
            id: '372017-1',
            citationNumber: 1,
            relevance: 'high',
            heading: parseHeadingPath(DFO_2024_METADATA),
            text: PAGE_BREAK,
          },
        ],
      },
    ]);
    expect(document.title).toBe('Årsrapport Direktoratet for forvaltning og økonomistyring 2024');
    expect(document.excerpts[0]).toMatchObject({
      id: '372017-1',
      citationNumber: 1,
      relevance: 'high',
      heading: 'DFØs årsrapport 2024 › 1 Leders beretning',
    });
    expect(document.excerpts[0].text).not.toContain('{5}');
  });
});
