import type { SourceDocument } from '../../../model';
import type { CorpusDocument } from './index';

/**
 * A second, invented corpus, so corpus switching can be seen in mock and measured in e2e. In
 * TypeScript, not JSON, so it is never mistaken for fetched data like `kudos-korpus.json`.
 * Modelled on the live stack's NorQuAD corpus (`norquad-docs`), but only eight articles.
 */
export const WIKIPEDIA_MOCK_KEY = 'norquad-mock';

/**
 * One type («Artikkel») and one organisation (Wikipedia). `url` is empty on purpose: the articles
 * do not exist, and a link would send the reader to check a quotation they would not find.
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
 * The one canonical answer this corpus gives. One is enough to show that a
 * switch changes the answer, sources and suggestions. Markers index the flat
 * excerpt list below, as for Kudos.
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
    // No `url` or `kudosUrl`: the article is invented.
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
