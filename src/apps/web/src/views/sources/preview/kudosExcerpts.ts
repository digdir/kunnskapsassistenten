import type { SourceDocument } from '../../../model';

/**
 * Real Kudos chunks, as they reach the panel: `metadata` through
 * `parseHeadingPath` for the heading, `content_markdown` for the text. Read
 * from the `KUDOS_preprod_v4_*` chunk collection 2026-09-28 and cut
 * short; the ids are `doc_num/chunk_index`.
 *
 * Live sends the heading but not yet the text (API-bestilling A1), and the BFF
 * sends the text but not the heading, so neither mode shows both today. This
 * is the only place they stand together.
 */
export const kudosMarkdownSources: SourceDocument[] = [
  {
    id: '372017',
    title: 'Årsrapport Direktoratet for forvaltning og økonomistyring 2024',
    documentType: 'Årsrapport',
    organisation: 'Direktoratet for forvaltning og økonomistyring',
    year: 2024,
    excerpts: [
      {
        id: '372017-1',
        citationNumber: 1,
        relevance: 'high',
        heading: 'DFØs årsrapport 2024 › <span id=\\"page-4-0\\"></span>**1 Leders beretning**',
        text: 'Regjeringen har pekt ut offentlige anskaffelser som et viktig område. Vi ser en positiv utvikling i virksomhetenes modenhet både når det gjelder bruk av digitale verktøy og innen bærekraftige anskaffelser.\n\n{5}\n\n------------------------------------------------\n\n\n\nGjennom markedsplassen for skytjenester bidrar vi til å forbedre tilgjengeligheten for skytjenester til offentlig sektor ved å legge til rette for sikre og kostnadseffektive løsninger.',
      },
    ],
  },
  {
    id: '375022',
    title: 'Årsrapport 2024',
    documentType: 'Årsrapport',
    year: 2024,
    excerpts: [
      {
        id: '375022-117',
        citationNumber: 2,
        relevance: 'medium',
        heading:
          'REGNSKAPSPRINSIPPER FOR BRUTTOBUDSJETTERTE VIRKSOMHETER › 6.2 Kontantregnskapet 2024 › <span id=\\"page-37-0\\"></span>NOTE 4 Andre driftskostnader',
        text: '|                                                   | 31.12.2024 |\n|---------------------------------------------------|------------|\n|                                                   |            |\n| Husleie1)                                         | 3 024 010  |\n| Vedlikehold egne bygg og anlegg                   | 0          |\n| Vedlikehold og ombygging av leide lokaler2)       | 8 775      |\n| Sum andre driftskostnader                         | 10 795 764 |\n\n<sup>1)</sup> I tillegg til husleien føres også annen lokalleie på denne posten.',
      },
    ],
  },
  {
    id: '140',
    title: 'Svar på søknad om unntak fra økonomiregelverket',
    excerpts: [
      {
        id: '140-22',
        citationNumber: 3,
        relevance: 'low',
        heading:
          '**Statens direkte økonomiske engasjement i petroleumsvirksomheten (SDØE) søknad om fornyelse av tidligere innvilgede unntak fra økonomireglementet** › **6 Særskilte krav** › **Våre vurderinger av unntakssøknadene**',
        text: 'Nedenfor er Direktoratet for økonomistyrings (DFØ) vurderinger av søknadene.\n\n*1) Søknad om unntak fra krav til årsrapport for statlige virksomheter* Det følger av bestemmelser om økonomistyring i staten pkt. 2.3.3, jf. pkt. 1.5.1, at en statlig virksomhet skal utarbeide en årsrapport som inneholder seks deler, med følgende benevnelse og rekkefølge:\n\n- I. Leders beretning\n- II. Introduksjon til virksomheten og hovedtall\n- III. Årets aktiviteter og resultater\n- IV. Styring og kontroll i virksomheten\n- V. Vurdering av framtidsutsikter\n- VI. Årsregnskap',
      },
    ],
  },
];
