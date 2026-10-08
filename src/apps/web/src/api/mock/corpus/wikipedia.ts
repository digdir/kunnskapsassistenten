import type { SourceDocument } from '../../../model';
import type { CorpusDocument } from './index';

/**
 * A second corpus for mock mode, so switching corpus can be seen and measured.
 *
 * **Everything here is invented.** That is the difference between this file
 * and `kudos-korpus.json` beside it: the Kudos corpus is real metadata and
 * real summaries, fetched and committed as the record of what Kudos served,
 * and nothing in it is generated. This one is written by us to stand in for a
 * corpus of Wikipedia articles, because mock mode had one corpus and a
 * chooser with one entry draws nothing — so corpus switching could not be
 * seen in mock, or measured in e2e (KA CC on #129).
 *
 * It is written in TypeScript rather than as a second JSON on purpose. A JSON
 * file in this folder reads as a fetched record, and a fabricated one sitting
 * next to a real one under the same extension is exactly the kind of thing
 * somebody later mistakes for data.
 *
 * The articles are modelled on the NorQuAD corpus the live stack holds —
 * `norquad-docs`, 351 Norwegian Wikipedia articles — so the shape a reader
 * meets in mock is the shape live has. Eight, not 351: enough for the facets
 * to have something to count and the list to have something to show.
 */
export const WIKIPEDIA_MOCK_KEY = 'norquad-mock';

/**
 * Articles carry no `documentType` the way a Kudos report does, so the type
 * is «Artikkel» throughout and the facet is honest about being one value
 * wide. The organisation is the encyclopedia itself, and the year is the
 * article's own subject year where it has one.
 *
 * `url` is empty and that is deliberate: these documents do not exist, and a
 * link to a Wikipedia article whose text we invented would send a reader off
 * to check a quotation they would not find. `sourceFrom` is not used for
 * them; the sources below carry no `kudosUrl` at all.
 */
export const wikipediaDocuments: CorpusDocument[] = [
  {
    id: 'wiki-vinter-ol-2010',
    title: 'Vinter-OL 2010',
    type: 'Artikkel',
    organisation: 'Wikipedia',
    year: 2010,
    summary:
      'De 21. olympiske vinterleker ble arrangert i Vancouver i Canada. Norge tok 23 medaljer, ni av dem av gull.',
    url: '',
  },
  {
    id: 'wiki-skottlands-historie',
    title: 'Skottlands historie',
    type: 'Artikkel',
    organisation: 'Wikipedia',
    year: 1707,
    summary:
      'Skottland var et eget kongerike fram til unionen med England i 1707. Artikkelen dekker tida fra de piktiske kongedømmene til unionen.',
    url: '',
  },
  {
    id: 'wiki-johann-sebastian-bach',
    title: 'Johann Sebastian Bach',
    type: 'Artikkel',
    organisation: 'Wikipedia',
    year: 1750,
    summary:
      'Tysk komponist og organist i barokken. Han skrev blant annet Matteuspasjonen, Brandenburgkonsertene og Das wohltemperierte Klavier.',
    url: '',
  },
  {
    id: 'wiki-ubuntu',
    title: 'Ubuntu (operativsystem)',
    type: 'Artikkel',
    organisation: 'Wikipedia',
    year: 2004,
    summary:
      'En Linux-distribusjon basert på Debian, første gang utgitt i 2004. Den kommer i utgaver for skrivebord, tjener og sky.',
    url: '',
  },
  {
    id: 'wiki-afghanistan',
    title: 'Afghanistan',
    type: 'Artikkel',
    organisation: 'Wikipedia',
    year: 1919,
    summary:
      'Innlandsstat i Sør-Asia, med Hindu Kush gjennom landet. Artikkelen dekker geografi, historie og befolkning.',
    url: '',
  },
  {
    id: 'wiki-nordlys',
    title: 'Nordlys',
    type: 'Artikkel',
    organisation: 'Wikipedia',
    year: 1902,
    summary:
      'Lysfenomen på nattehimmelen i polare strøk, som oppstår når ladde partikler fra sola treffer atmosfæren. Kristian Birkeland viste sammenhengen med jordas magnetfelt.',
    url: '',
  },
  {
    id: 'wiki-fotosyntese',
    title: 'Fotosyntese',
    type: 'Artikkel',
    organisation: 'Wikipedia',
    year: 1779,
    summary:
      'Prosessen der planter, alger og noen bakterier bruker lysenergi til å lage karbohydrater av karbondioksid og vann.',
    url: '',
  },
  {
    id: 'wiki-bokmaal',
    title: 'Bokmål',
    type: 'Artikkel',
    organisation: 'Wikipedia',
    year: 1929,
    summary:
      'Den ene av de to skriftlige målformene i norsk, ved siden av nynorsk. Navnet ble vedtatt i 1929; før det het den riksmål.',
    url: '',
  },
];

/**
 * The one canonical answer this corpus gives, with its sources.
 *
 * One and not eleven: what this corpus is for is showing that a switch
 * changes the answer, the sources and the suggestions. A second scripted
 * conversation would be a second thing to keep true.
 *
 * The markers are 1-indexed into the flat excerpt list below, the same rule
 * the Kudos answer follows.
 */
export const WIKIPEDIA_MOCK_ANSWER = `# Artikler i dette korpuset

Korpuset er en liten samling artikler fra norsk Wikipedia, satt sammen for å
vise hvordan assistenten oppfører seg over et annet korpus enn Kudos.

## Hva som er her

Artiklene spenner vidt: idrettshistorie [1], europeisk historie [2] og
naturvitenskap [3]. Ingen av dem er forvaltningsdokumenter, så spørsmål om
årsrapporter og tildelingsbrev har ingen kilder å hvile på her.

## Hva det betyr for svarene

Et spørsmål som passer korpuset får kilder fra det. Et spørsmål som ikke gjør
det, får si det heller enn å svare fra noe annet.`;

export const wikipediaMockSources: SourceDocument[] = [
  {
    id: 'wiki-vinter-ol-2010',
    title: 'Vinter-OL 2010',
    documentType: 'Artikkel',
    organisation: 'Wikipedia',
    year: 2010,
    // No `url` and no `kudosUrl`: the article is invented, and a link would
    // send the reader to check a quotation that is not there.
    excerpts: [
      {
        id: 'wiki-vinter-ol-2010-1',
        citationNumber: 1,
        relevance: 'high',
        heading: 'Medaljer',
        text: 'De 21. olympiske vinterleker ble arrangert i Vancouver i Canada. Norge tok 23 medaljer, ni av dem av gull.',
      },
    ],
  },
  {
    id: 'wiki-skottlands-historie',
    title: 'Skottlands historie',
    documentType: 'Artikkel',
    organisation: 'Wikipedia',
    year: 1707,
    excerpts: [
      {
        id: 'wiki-skottlands-historie-1',
        citationNumber: 2,
        relevance: 'medium',
        heading: 'Unionen med England',
        text: 'Skottland var et eget kongerike fram til unionen med England i 1707.',
      },
    ],
  },
  {
    id: 'wiki-nordlys',
    title: 'Nordlys',
    documentType: 'Artikkel',
    organisation: 'Wikipedia',
    year: 1902,
    excerpts: [
      {
        id: 'wiki-nordlys-1',
        citationNumber: 3,
        relevance: 'medium',
        heading: 'Årsak',
        text: 'Nordlys oppstår når ladde partikler fra sola treffer atmosfæren. Kristian Birkeland viste sammenhengen med jordas magnetfelt.',
      },
    ],
  },
];
