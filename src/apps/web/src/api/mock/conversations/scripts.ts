import { sourceFrom, type ScriptedConversation } from './types';

/**
 * The eleven cached conversations.
 *
 * Three of them are the kickstarter questions from the empty state word for
 * word, so pressing a suggestion and sending it gets a real answer. That is
 * the whole of point 5 in the brief, and it needed no change to the chat
 * view: the questions were already written, so the answers were written to
 * fit them rather than the other way round.
 *
 * Two of those three ask about years the corpus does not hold, and the
 * answers say so. That is not a gap in the fixture — it is what a retrieval
 * assistant does when the archive stops short of the question, and it is
 * worth being able to look at.
 */

/** «Hva rapporteres om regnskap … i DSS sine årsrapporter for 2022 og 2023?» */
const dssRegnskap: ScriptedConversation = {
  id: 'dss-regnskap',
  question:
    'Hva rapporteres om regnskap, kostnader og bevilgning i DSS sine årsrapporter for 2022 og 2023?',
  threadTitle: 'Regnskap og bevilgning i DSS sine årsrapporter',
  daysAgo: 0,
  answer: `# Regnskap og bevilgning hos DSS

Jeg finner ingen årsrapport fra Departementenes sikkerhets- og
serviceorganisasjon for 2022 eller 2023 i dette korpuset. Den nyeste er
**årsrapporten for 2025**, og svaret under bygger på den og på et supplerende
tildelingsbrev for 2026.

Årsrapporten for 2025 er bygget opp med økonomisk rapportering som en egen
del: den inneholder årsregnskap, noter og vedlegg [1]. Rapporten omtaler også
kontraktsoppfølging etter merknader fra Riksrevisjonen [2], som er det
nærmeste den kommer en vurdering av kostnadskontroll.

På bevilgningssiden er det tildelingsbrevene som er kilden. Det supplerende
brevet for 2026 gir DSS fullmakt til å belaste kap. 1500, post 21 med inntil
3 millioner kroner til forberedelser til innflytting i nytt regjeringskvartal
[3], og ber om oversikt over utbetalinger per tertial [4].

Vil du at jeg skal se etter tallene for 2022 og 2023 i andre dokumenttyper,
for eksempel tildelingsbrev fra de årene?`,
  documents: [
    sourceFrom('a1c3a188-a28d-4d96-b95a-2ab7cd0cf565', [
      {
        text: 'Dokumentet inneholder årsregnskap, noter og vedlegg inkludert likestillingsredegjørelse.',
        heading: 'Årsregnskap',
        relevance: 'high',
        citationNumber: 1,
      },
      {
        text: 'Den omtaler også arbeid med informasjonssikkerhet, kontraktsoppfølging etter Riksrevisjonens merknader og tiltak for å styrke leveransen av felles administrative tjenester.',
        heading: 'Kontraktsoppfølging',
        relevance: 'high',
        citationNumber: 2,
      },
      {
        text: "Årsrapporten for 2025 beskriver DSS' virksomhet, resultater, prioriteringer og økonomiske rapportering i året.",
        relevance: 'medium',
      },
    ]),
    sourceFrom('ec9d16b4-057a-45eb-86cc-5a484947faaa', [
      {
        text: 'Digitaliserings- og forvaltningsdepartementet gir fullmakt til DSS til å belaste kap. 1500, post 21 med inntil 3 mill. kroner i 2026 for førebuingar til innflytting i nytt regjeringskvartal byggetrinn 1.',
        heading: 'Fullmakt',
        relevance: 'high',
        citationNumber: 3,
      },
      {
        text: 'Det blir også bedt om oversikt over utførte utbetalingar per tertial og for heile året.',
        heading: 'Rapportering',
        relevance: 'medium',
        citationNumber: 4,
      },
    ]),
  ],
  retrieval: {
    hitCount: 9,
    documentCount: 2,
    keywords: ['DSS årsrapport', 'årsregnskap', 'bevilgning', 'kap. 1500'],
  },
  thinkingSteps: [
    {
      id: 'dss-1',
      kind: 'reasoning',
      label: 'Jeg leser spørsmålet',
      detail:
        'Spørsmålet gjelder tre ting for DSS: regnskap, kostnader og bevilgning, og to bestemte år.',
      durationMs: 900,
    },
    {
      id: 'dss-2',
      kind: 'search',
      label: 'Jeg søker i korpuset',
      queries: ['DSS årsrapport 2022', 'DSS årsrapport 2023', 'årsregnskap bevilgning'],
      durationMs: 1400,
    },
    {
      id: 'dss-3',
      kind: 'reasoning',
      label: 'Jeg finner ingen årsrapport for de årene',
      detail:
        'Korpuset har årsrapporten for 2025. Jeg svarer på det som finnes, og sier hva som mangler i stedet for å tie om det.',
      durationMs: 1100,
    },
    {
      id: 'dss-4',
      kind: 'read',
      label: 'Jeg leser årsrapporten for 2025 og et supplerende tildelingsbrev',
      durationMs: 1300,
    },
    { id: 'dss-5', kind: 'finalizing', label: 'Jeg skriver svaret', durationMs: 800 },
  ],
  followUps: [
    'Finnes det tildelingsbrev til DSS fra 2022 og 2023?',
    'Hva sier Riksrevisjonen om kontraktsoppfølgingen?',
    'Hva koster innflyttingen i nytt regjeringskvartal?',
  ],
};

/** «Hvilke utfordringer rapporterer Udir om i evaluering om lærerspesialtordningen?» */
const udirLaererspesial: ScriptedConversation = {
  id: 'udir-laererspesial',
  question: 'Hvilke utfordringer rapporterer Udir om i evaluering om lærerspesialtordningen?',
  threadTitle: 'Evaluering av lærerspesialordningen',
  daysAgo: 3,
  outcome: 'needs-clarification',
  answer: `Jeg finner ingen evaluering av **lærerspesialordningen** i dette
korpuset, så jeg vil ikke gjette på hva den sier.

Utdanningsdirektoratet har derimot en sluttrapport fra evalueringen av
**Kompetanseløftet for spesialpedagogikk og inkluderende praksis**, som
handler om kompetanse tett på barn og elever og kan være det du er ute etter.

Vil du at jeg

- ser på evalueringen av Kompetanseløftet i stedet,
- søker bredere på «lærerspesial» i alle dokumenttyper, eller
- leter i tildelingsbrevene til Utdanningsdirektoratet etter oppdrag om
  ordningen?`,
  documents: [],
  retrieval: { hitCount: 0, documentCount: 0, keywords: ['lærerspesialordningen', 'evaluering'] },
  thinkingSteps: [
    {
      id: 'udir-1',
      kind: 'reasoning',
      label: 'Jeg leser spørsmålet',
      detail: 'Det gjelder en bestemt ordning og en bestemt evaluering av den.',
      durationMs: 800,
    },
    {
      id: 'udir-2',
      kind: 'search',
      label: 'Jeg søker etter evalueringen',
      queries: ['lærerspesialordningen evaluering', 'lærerspesial Utdanningsdirektoratet'],
      durationMs: 1500,
    },
    {
      id: 'udir-3',
      kind: 'reasoning',
      label: 'Jeg finner ingenting om den ordningen',
      detail:
        'Å svare på nærmeste treff uten å si fra ville sett ut som et svar på spørsmålet. Jeg spør heller.',
      durationMs: 1000,
    },
  ],
  followUps: [
    'Se på evalueringen av Kompetanseløftet i stedet',
    'Søk bredere på «lærerspesial»',
    'Hva sier tildelingsbrevene til Udir om ordningen?',
  ],
};

/** «Hva rapporterer Digdir om prioriteringene i tildelingsbrevene … sammenlignet med årsrapportene?» */
const digdirStyring: ScriptedConversation = {
  id: 'digdir-styring',
  question:
    'Hva rapporterer Digdir om prioriteringene i tildelingsbrevene fra 2022 og 2023 sammenlignet med årsrapportene?',
  threadTitle: 'Digdir: tildelingsbrev mot årsrapport',
  daysAgo: 4,
  answer: `# Styringssignal mot rapportert resultat

Korpuset har ikke tildelingsbrev eller årsrapport for Digdir fra 2022 og
2023. Det nærmeste paret er **tildelingsbrevet for 2026** og **årsrapporten
for 2025**, og de kan sammenliknes på samme måte: det ene sier hva som skal
prioriteres, det andre hva som ble gjort.

| Tema | Tildelingsbrev 2026 | Årsrapport 2025 |
| --- | --- | --- |
| Nye Altinn | Fastsatt som krav [1] | Gjennomført og prioritert [3] |
| Kunstig intelligens | Fastsatt som krav [1] | KI Norge omtalt [3] |
| Digital sikkerhet | Fastsatt som krav [1] | Sikkerhet og beredskap omtalt [4] |
| eID og digital lommebok | Ikke nevnt | Omtalt [3] |

Tildelingsbrevet er et styringsdokument: det redegjør for Stortingets
budsjettvedtak og departementets styringssignal [2], og fastsetter
prioriteringer, mål og krav — blant annet digital sikkerhet, kunstig
intelligens og Nye Altinn [1].

Årsrapporten svarer på det samme settet ovenfra og ned. Den beskriver
gjennomføring og prioriteringer knyttet til Nye Altinn, eID og digital
lommebok, arbeidet med kunstig intelligens, samt tjenester som Digitalt
dødsbo [3], og redegjør for styring, sikkerhet og beredskap, universell
utforming og ressursbruk [4].

Det som står i årsrapporten men ikke i tildelingsbrevet — eID, digital
lommebok, Digitalt dødsbo — er verdt å merke seg: enten er det ført videre
fra tidligere år, eller så er det Digdirs egne prioriteringer.`,
  documents: [
    sourceFrom('425f1413-c963-49a7-83b7-5580c0b2c19d', [
      {
        text: 'Dokumentet fastsetter prioriteringer, mål og krav for Digdir, blant annet digital sikkerhet, kunstig intelligens og utvikling av digitale løsninger som Nye Altinn.',
        heading: 'Prioriteringer og krav',
        relevance: 'high',
        citationNumber: 1,
      },
      {
        text: 'Dette tildelingsbrevet redegjør for Stortingets budsjettvedtak og Digitaliserings- og forvaltningsdepartementets styringssignal for Digitaliseringsdirektoratet (Digdir) i 2026.',
        relevance: 'medium',
        citationNumber: 2,
      },
      {
        text: 'Tildelingsbrevet inneholder rammer og fullmakter, samt rapporterings- og resultatoppfølgingskrav.',
        relevance: 'low',
      },
    ]),
    sourceFrom('a1b78fa3-9a8d-40d3-a549-190610d766ed', [
      {
        text: 'Rapporten beskriver gjennomføring og prioriteringer knyttet til Nye Altinn, eID og digital lommebok, arbeidet med kunstig intelligens (KI Norge), samt tjenester som Digitalt dødsbo.',
        heading: 'Gjennomføring',
        relevance: 'high',
        citationNumber: 3,
      },
      {
        text: 'Den redegjør for styring, sikkerhet og beredskap, universell utforming og ressursbruk, og vurderer fremtidsutsikter og videre prioriteringer for digital samhandling i offentlig sektor.',
        heading: 'Styring og ressursbruk',
        relevance: 'high',
        citationNumber: 4,
      },
    ]),
  ],
  retrieval: {
    hitCount: 11,
    documentCount: 2,
    keywords: ['Digdir tildelingsbrev', 'årsrapport', 'prioriteringer', 'Nye Altinn'],
  },
  thinkingSteps: [
    {
      id: 'digdir-1',
      kind: 'reasoning',
      label: 'Jeg leser spørsmålet',
      detail: 'Det ber om en sammenlikning: styringssignal mot rapportert resultat.',
      durationMs: 900,
    },
    {
      id: 'digdir-2',
      kind: 'search',
      label: 'Jeg søker etter begge dokumenttypene',
      queries: ['Digdir tildelingsbrev', 'Digdir årsrapport prioriteringer'],
      durationMs: 1400,
    },
    {
      id: 'digdir-3',
      kind: 'reasoning',
      label: 'Årene i spørsmålet finnes ikke',
      detail: 'Jeg bruker det nærmeste paret, 2026 og 2025, og sier at det er det jeg gjør.',
      durationMs: 1100,
    },
    {
      id: 'digdir-4',
      kind: 'read',
      label: 'Jeg leser begge og stiller dem opp mot hverandre',
      durationMs: 1600,
    },
    { id: 'digdir-5', kind: 'finalizing', label: 'Jeg skriver svaret', durationMs: 900 },
  ],
  followUps: [
    'Hva står i tilleggsbrevene for 2026?',
    'Hvilke krav er nye fra året før?',
    'Hva rapporterer Digdir om ressursbruk?',
  ],
};

/** One document, and nothing else to say. */
const bufdirBarnevern: ScriptedConversation = {
  id: 'bufdir-barnevern',
  question: 'Hva er hovedutfordringene Bufdir rapporterer om i institusjonsbarnevernet?',
  aliases: ['Hva sier Bufdir om kapasitet i barnevernet?'],
  threadTitle: 'Hovedutfordringer i institusjonsbarnevernet',
  daysAgo: 6,
  answer: `# Kapasitet og fosterhjem

Bufdirs årsrapport for 2024 peker på to utfordringer som henger sammen:
**kapasitet i institusjonsbarnevernet** og **lav tilgang til fosterhjem** [1].

Rapporten oppsummerer hovedutfordringer og tiltak innen barnevern,
familievern og likestilling [1], og beskriver arbeid med midlertidige stans i
enkelte adopsjoner og tiltak for bedre tverrsektorielt samarbeid,
kompetanseheving og digitalisering [2].

Dette er den eneste årsrapporten fra Bufdir i korpuset som omtaler
institusjonsbarnevernet direkte, så svaret står på ett dokument. Vil du at
jeg ser i strategiene deres i tillegg?`,
  documents: [
    sourceFrom('3240b8df-64ce-481d-877c-99e7b751e90d', [
      {
        text: 'Årsrapporten for 2024 oppsummerer hovedutfordringer og tiltak innen barnevern, familievern og likestilling, med særlig fokus på kapasitetsutfordringer i institusjonsbarnevernet og lav tilgang til fosterhjem.',
        heading: 'Hovedutfordringer',
        relevance: 'high',
        citationNumber: 1,
      },
      {
        text: 'Direktoratet har også arbeidet med midlertidige stans i enkelte adopsjoner og gjennomført tiltak for bedre tverrsektorielt samarbeid, kompetanseheving og digitalisering.',
        heading: 'Tiltak',
        relevance: 'high',
        citationNumber: 2,
      },
      {
        text: 'Barne-, ungdoms- og familiedirektoratet (Bufdir) og Bufetat arbeider for en trygg barndom, gode oppvekstvilkår og inkluderende samfunn.',
        relevance: 'medium',
      },
      {
        text: '2024 markerte Bufdirs 20-årsjubileum.',
        relevance: 'low',
      },
    ]),
  ],
  retrieval: {
    hitCount: 4,
    documentCount: 1,
    keywords: ['institusjonsbarnevern', 'fosterhjem', 'kapasitet'],
  },
  thinkingSteps: [
    {
      id: 'bufdir-1',
      kind: 'search',
      label: 'Jeg søker på institusjonsbarnevern',
      queries: ['institusjonsbarnevern kapasitet', 'fosterhjem tilgang'],
      durationMs: 1300,
    },
    {
      id: 'bufdir-2',
      kind: 'read',
      label: 'Jeg leser Bufdirs årsrapport for 2024',
      durationMs: 1200,
    },
    {
      id: 'bufdir-3',
      kind: 'reasoning',
      label: 'Bare ett dokument dekker dette',
      detail: 'Jeg sier det i svaret, så det ikke ser ut som et bredt belegg.',
      durationMs: 900,
    },
  ],
  followUps: [
    'Hva sier Bufdirs forsyningsstrategi om kapasitet?',
    'Hvordan er dette fulgt opp i disponeringsbrevet?',
    'Hva rapporteres om fosterhjem i 2025?',
  ],
};

/** Twelve excerpts across six documents, for grouping and «Vis flere dokumenter». */
const digitaliseringBredt: ScriptedConversation = {
  id: 'digitalisering-bredt',
  question: 'Hvordan omtales digitalisering på tvers av virksomhetene i 2026?',
  aliases: ['Hva sier dokumentene om digitalisering i 2026?'],
  threadTitle: 'Digitalisering på tvers av virksomhetene',
  daysAgo: 7,
  answer: `# Digitalisering som gjennomgående tema

Digitalisering går igjen i alle dokumenttypene i 2026, men den betyr
forskjellige ting fra sted til sted.

**Som forenkling for andre.** Nærings- og fiskeridepartementet knytter den
til å redusere administrative byrder gjennom forenklet regelverk og gjenbruk
av data [1], med mål om økt automatisering og færre rapporteringsplikter [2].
Direktoratet for byggkvalitet får ekstra midler nettopp til digitalisering og
forenkling av plan- og byggesaksprosessene [3], der presiseringen retter opp
en manglende spesifikasjon i det opprinnelige tildelingsbrevet [4].

**Som personvern og risiko.** Datatilsynet skal sikre personvern i
digitalisering, inkludert arbeid med kunstig intelligens og regulatoriske
sandkasser [5], og har egne oppdrag knyttet til nasjonale portaler for AI og
digital sikkerhet [6].

**Som penger og programmer.** Det supplerende brevet til DIO overfører ubrukt
bevilgning og øker kap. 1515 med om lag 718,5 millioner kroner [7], med
detaljer om felles IKT-tjenester i departementsfellesskapet [8].

**Som leveranse.** Digdir rapporterer på Nye Altinn, eID, digital lommebok og
KI Norge [9], og på styring, sikkerhet og beredskap [10].

**Og som virkemiddel i utlandet.** Kunnskapsbanken har digitalisering som ett
av seks satsningsområder for å styrke statlig kapasitet i samarbeidsland
[11][12].

Det er verdt å merke seg at ingen av dokumentene definerer digitalisering.
Ordet bærer alt fra saksbehandlingssystemer til KI-politikk.`,
  documents: [
    sourceFrom('a21788a6-8656-4411-b650-b96fde4b6c3d', [
      {
        text: 'Strategien beskriver tiltak for å redusere næringslivets administrative byrder gjennom forenklet regelverk, digitalisering og gjenbruk av data.',
        heading: 'Forenkling',
        relevance: 'high',
        citationNumber: 1,
      },
      {
        text: 'Målene omfatter økt automatisering, «Fra plikt til flyt», færre rapporteringsplikter og bedre tilsyn.',
        heading: 'Mål',
        relevance: 'high',
        citationNumber: 2,
      },
    ]),
    sourceFrom('69c1ae61-b1c7-4e68-ae1c-38cda6ee3c86', [
      {
        text: 'Departementet presiserer fordelingen av ekstra midler til Direktoratet for Byggkvalitet for 2026, knyttet til digitalisering og forenkling av plan- og byggesaksprosessene.',
        heading: 'Fordeling av midler',
        relevance: 'high',
        citationNumber: 3,
      },
      {
        text: 'Presiseringen skal rette opp manglende spesifikasjon i det opprinnelige tildelingsbrevet.',
        relevance: 'low',
        citationNumber: 4,
      },
    ]),
    sourceFrom('a14aee78-af67-46fc-890a-4e9c01873395', [
      {
        text: 'Brevet legg vekt på å sikra personvern i digitalisering, inkludert arbeid med kunstig intelligens, regulatoriske sandkassar og samarbeid med andre etatar.',
        heading: 'Personvern i digitalisering',
        relevance: 'high',
        citationNumber: 5,
      },
      {
        text: 'Det gir særskilde oppdrag knytt til trygg oppvekst for barn og unge, nasjonale portalar for AI og digital sikkerheit, samt krav til rapportering om klima, inkludering og bruk av konsulentar.',
        heading: 'Særskilte oppdrag',
        relevance: 'medium',
        citationNumber: 6,
      },
    ]),
    sourceFrom('a144e585-0950-4da5-97e8-89b4813656b1', [
      {
        text: 'Dokumentet aukar løyvingane på kap. 1515 med om lag 718,503 millionar kroner og viser nye disponible løyvingar for ulike postar og program.',
        heading: 'Overføring av bevilgning',
        relevance: 'high',
        citationNumber: 7,
      },
      {
        text: 'Det gir detaljar om overføringar til prosjekt for IKT i RKV, program for felles IKT-tenester i departementsfellesskapet og felles system for saksbehandling og arkivering.',
        heading: 'Programmer',
        relevance: 'medium',
        citationNumber: 8,
      },
    ]),
    sourceFrom('a1b78fa3-9a8d-40d3-a549-190610d766ed', [
      {
        text: 'Rapporten beskriver gjennomføring og prioriteringer knyttet til Nye Altinn, eID og digital lommebok, arbeidet med kunstig intelligens (KI Norge), samt tjenester som Digitalt dødsbo.',
        heading: 'Leveranser',
        relevance: 'high',
        citationNumber: 9,
      },
      {
        text: 'Den redegjør for styring, sikkerhet og beredskap, universell utforming og ressursbruk, og vurderer fremtidsutsikter og videre prioriteringer for digital samhandling i offentlig sektor.',
        heading: 'Styring',
        relevance: 'medium',
        citationNumber: 10,
      },
    ]),
    sourceFrom('a2a2fcd3-e03c-42af-a470-ac1267a691a7', [
      {
        text: 'Den fastsetter ett strategisk mål om bærekraftig statlig kapasitet og seks satsningsområder, blant annet landinnsatser, digitalisering, resultatstyring og synliggjøring.',
        heading: 'Satsningsområder',
        relevance: 'medium',
        citationNumber: 11,
      },
      {
        text: 'Strategien beskriver Kunnskapsbankens rolle og mål for perioden 2026–2030, med fokus på å styrke statlig kapasitet i samarbeidsland gjennom norske statlige virksomheter.',
        relevance: 'low',
        citationNumber: 12,
      },
    ]),
  ],
  retrieval: {
    hitCount: 26,
    documentCount: 6,
    keywords: ['digitalisering', 'forenkling', 'kunstig intelligens', 'IKT', 'personvern'],
  },
  thinkingSteps: [
    {
      id: 'dig-1',
      kind: 'reasoning',
      label: 'Jeg leser spørsmålet',
      detail: 'Det er et bredt spørsmål på tvers, ikke om én virksomhet.',
      durationMs: 800,
    },
    {
      id: 'dig-2',
      kind: 'search',
      label: 'Jeg søker bredt på digitalisering',
      queries: ['digitalisering 2026', 'digital forenkling', 'IKT tildelingsbrev'],
      durationMs: 1500,
    },
    {
      id: 'dig-3',
      kind: 'read',
      label: 'Jeg leser seks dokumenter fra fire dokumenttyper',
      durationMs: 2100,
    },
    {
      id: 'dig-4',
      kind: 'reasoning',
      label: 'Jeg grupperer etter hva ordet betyr hvert sted',
      detail: 'Forenkling, personvern, penger, leveranse og bistand er fem ulike ting.',
      durationMs: 1300,
    },
    { id: 'dig-5', kind: 'finalizing', label: 'Jeg skriver svaret', durationMs: 1000 },
  ],
  followUps: [
    'Hvilke virksomheter har størst bevilgning til digitalisering?',
    'Hva sier dokumentene om kunstig intelligens spesielt?',
    'Er det noen som definerer digitalisering?',
  ],
};

/** The one that fails. */
const klimaFeil: ScriptedConversation = {
  id: 'klima-feil',
  question: 'Hvordan har klimagassutslippene utviklet seg i statlige virksomheter?',
  threadTitle: 'Klimagassutslipp i statlige virksomheter',
  daysAgo: 9,
  answer: '',
  documents: [],
  retrieval: { hitCount: 0, documentCount: 0, keywords: [] },
  // The language model is the part that is down, which is the one case where
  // the reader can be told their question and filter are untouched. No
  // `message`: the text belongs to the code, see views/chat/errorText.ts.
  failure: { code: 'model-unavailable' },
  thinkingSteps: [
    {
      id: 'klima-1',
      kind: 'search',
      label: 'Jeg søker etter klimagassregnskap',
      queries: ['klimagassutslipp statlige virksomheter', 'klimaregnskap'],
      durationMs: 1400,
    },
    {
      id: 'klima-2',
      kind: 'read',
      label: 'Jeg leser treffene',
      durationMs: 1600,
    },
  ],
  followUps: [],
};

/** Long keywords, so «Fremgangsmåte» has to cope with them. */
const forskningKunnskapsgrunnlag: ScriptedConversation = {
  id: 'forskning-kunnskapsgrunnlag',
  question:
    'Hva sier dokumentene om kunnskapsgrunnlag, datatilgjengelighet og samordning av forskningsmiljøer?',
  threadTitle: 'Kunnskapsgrunnlag og samordning av forskning',
  daysAgo: 12,
  answer: `# Fragmenterte miljøer og data som ikke er tilgjengelige

To dokumenter tar opp dette fra hver sin kant.

Bufdirs strategi for forskning og evaluering identifiserer utfordringene
direkte: **fragmenterte forskningsmiljøer, manglende datatilgjengelighet og
behov for bedre samordning** [1]. Den svarer med tiltak for solide
forskningsmiljøer, bedre utnyttelse av ressurser, kvalitetssikrede data og
formidling [2], og avgrenser seg til forskning og evaluering som virkemidler
for å utvikle kunnskapsgrunnlaget [3].

Forskningsrådets budsjettforslag for 2027 ser det ovenfra: det fokuserer på
helhet i forskningspolitikken og adresserer kunnskapsbehov i samfunnet [4],
og foreslår en gradvis økning i offentlige FoU-budsjetter mot 1,2 prosent av
BNP innen 2032 [5].

De to peker på hver sin løsning for samme problem — Bufdir på samordning av
miljøene, Forskningsrådet på nivået på bevilgningene.`,
  documents: [
    sourceFrom('a14aee78-61a0-4454-be7b-b87781695321', [
      {
        text: 'Dokumentet identifiserer sentrale utfordringer som fragmenterte forskningsmiljøer, manglende datatilgjengelighet og behov for bedre samordning',
        heading: 'Utfordringer',
        relevance: 'high',
        citationNumber: 1,
      },
      {
        text: 'og legger opp til tiltak for solide forskningsmiljøer, bedre utnyttelse av ressurser, kvalitetssikrede data og formidling av forskningsresultater.',
        heading: 'Tiltak',
        relevance: 'high',
        citationNumber: 2,
      },
      {
        text: 'Den avgrenser til forskning og evaluering som virkemidler for å utvikle kunnskapsgrunnlaget, beskriver formål, delmål og tverrgående perspektiver, og legger vekt på praksisnær og tverrfaglig forskning samt inkludering av målgrupper, særlig barn og unge.',
        relevance: 'medium',
        citationNumber: 3,
      },
    ]),
    sourceFrom('987461a2-6260-4deb-ab9b-296056dac256', [
      {
        text: 'Forskningsrådets budsjettforslag 2027 fokuserer på helhet i forskningspolitikken, adresserer kunnskapsbehov i samfunnet og konkretiserer departementsvise satsingsforslag.',
        heading: 'Innretning',
        relevance: 'high',
        citationNumber: 4,
      },
      {
        text: 'Det foreslås en gradvis økning i offentlige FoU-budsjetter for å oppnå målet om 1,2 prosent av BNP innen 2032.',
        heading: 'FoU-andel',
        relevance: 'high',
        citationNumber: 5,
      },
    ]),
  ],
  retrieval: {
    hitCount: 13,
    documentCount: 2,
    keywords: [
      'kunnskapsgrunnlag og datatilgjengelighet',
      'samordning av forskningsmiljøer',
      'praksisnær og tverrfaglig forskning',
      'offentlige FoU-budsjetter som andel av BNP',
    ],
  },
  thinkingSteps: [
    {
      id: 'forsk-1',
      kind: 'reasoning',
      label: 'Jeg leser spørsmålet',
      detail: 'Tre begreper som henger sammen: kunnskapsgrunnlag, data og samordning.',
      durationMs: 900,
    },
    {
      id: 'forsk-2',
      kind: 'search',
      label: 'Jeg søker med lange søkestrenger',
      queries: [
        'kunnskapsgrunnlag og datatilgjengelighet',
        'samordning av forskningsmiljøer i forvaltningen',
      ],
      durationMs: 1700,
    },
    { id: 'forsk-3', kind: 'read', label: 'Jeg leser to strategidokumenter', durationMs: 1400 },
    { id: 'forsk-4', kind: 'finalizing', label: 'Jeg skriver svaret', durationMs: 900 },
  ],
  followUps: [
    'Hvilke tiltak foreslår Bufdir konkret?',
    'Hva er FoU-andelen i dag?',
    'Hvem andre omtaler datatilgjengelighet?',
  ],
};

const folkehelse: ScriptedConversation = {
  id: 'folkehelse-tiltak',
  question: 'Hvilke folkehelsetiltak foreslår Helsedirektoratet for 2026?',
  threadTitle: 'Folkehelsetiltak 2026',
  daysAgo: 18,
  answer: `# Innspill til ny folkehelsemelding

Helsedirektoratets innspill foreslår tiltak på tre nivåer: levevaner,
helsetrusler og det systematiske folkehelsearbeidet lokalt, regionalt og
nasjonalt [1].

Konkret omfatter forslagene

- avgifts- og reguleringstiltak,
- nasjonale satsinger på fysisk aktivitet,
- styrket helse- og omsorgsberedskap,
- tiltak for helsekompetanse og håndtering av infodemi, og
- bedre bruk av registerdata og støtteredskaper for kommunene [2].

Tiltakene bygger blant annet på NOU 2025 og på internasjonalt samarbeid som
JA PreventNCD [3].`,
  documents: [
    sourceFrom('a27bf9e6-eb4d-4a50-9f5e-a5fc44446a26', [
      {
        text: 'Rapporten oppsummerer folkehelseutfordringer og foreslår tiltak innen levevaner, helsetrusler og for å styrke det systematiske folkehelsearbeidet lokalt, regionalt og nasjonalt.',
        heading: 'Innretning',
        relevance: 'high',
        citationNumber: 1,
      },
      {
        text: 'Forslagene omfatter avgifts- og reguleringstiltak, nasjonale satsinger på fysisk aktivitet, styrket helse- og omsorgsberedskap, tiltak for helsekompetanse og infodemi-håndtering, samt bedre bruk av registerdata og støtteredskaper for kommunene.',
        heading: 'Forslag',
        relevance: 'high',
        citationNumber: 2,
      },
      {
        text: 'Tiltakene bygger blant annet på NOU 2025 og internasjonalt samarbeid som JA PreventNCD.',
        heading: 'Grunnlag',
        relevance: 'medium',
        citationNumber: 3,
      },
      {
        text: 'Dette dokumentet er Helsedirektoratets innspill til arbeidet med ny folkehelsemelding og presenterer forslag til tiltak for 2026.',
        relevance: 'low',
      },
    ]),
  ],
  retrieval: {
    hitCount: 7,
    documentCount: 1,
    keywords: ['folkehelsetiltak', 'levevaner', 'beredskap', 'registerdata'],
  },
  thinkingSteps: [
    {
      id: 'folke-1',
      kind: 'search',
      label: 'Jeg søker på folkehelsetiltak 2026',
      queries: ['folkehelsetiltak 2026', 'folkehelsemelding innspill'],
      durationMs: 1300,
    },
    {
      id: 'folke-2',
      kind: 'read',
      label: 'Jeg leser innspillet fra Helsedirektoratet',
      durationMs: 1400,
    },
    { id: 'folke-3', kind: 'finalizing', label: 'Jeg skriver svaret', durationMs: 800 },
  ],
  followUps: [
    'Hva er infodemi-håndtering?',
    'Hvilke avgiftstiltak nevnes?',
    'Hva sier NOU 2025 om dette?',
  ],
};

const isbjorn: ScriptedConversation = {
  id: 'isbjorn-arktis',
  question: 'Hva er hovedtrusselen mot isbjørn i norsk Arktis, og hvem har ansvaret?',
  threadTitle: 'Bevaring av isbjørn i norsk Arktis',
  daysAgo: 26,
  answer: `# Klimaendringer og tap av sjøis

Hovedtrusselen er **klimaendringer og tap av sjøis**, forsterket av
langtransportert forurensing og økende menneskelig aktivitet [1].

Strategien svarer med kunnskapsbasert forvaltning, overvåking og tiltak for å
redusere lokale påvirkninger som ferdsel og miljøgifter [2] — altså det som
faktisk kan styres nasjonalt, siden hovedtrusselen ikke kan det.

Ansvaret ligger hos **Miljødirektoratet**, med bidrag fra Sysselmesteren på
Svalbard og Norsk Polarinstitutt [3]. Strategien erstatter den tidligere
handlingsplanen fra 2013 [4].`,
  documents: [
    sourceFrom('a14b59cc-0192-4ca8-932e-3fe3743eabf9', [
      {
        text: 'Hovedtrusselen er klimaendringer og tap av sjøis, forsterket av langtransportert forurensing og økende menneskelig aktivitet.',
        heading: 'Trusselbilde',
        relevance: 'high',
        citationNumber: 1,
      },
      {
        text: 'Den legger vekt på kunnskapsbasert forvaltning, overvåking og tiltak for å redusere lokale påvirkninger som ferdsel og miljøgifter.',
        heading: 'Tiltak',
        relevance: 'high',
        citationNumber: 2,
      },
      {
        text: 'Miljødirektoratet har det overordnede ansvaret, med bidrag fra Sysselmesteren på Svalbard og Norsk Polarinstitutt.',
        heading: 'Ansvar',
        relevance: 'high',
        citationNumber: 3,
      },
      {
        text: 'Strategien erstatter tidligere handlingsplan (M16 - 2013).',
        relevance: 'medium',
        citationNumber: 4,
      },
    ]),
  ],
  retrieval: {
    hitCount: 5,
    documentCount: 1,
    keywords: ['isbjørn', 'sjøis', 'Svalbard', 'miljøgifter'],
  },
  thinkingSteps: [
    {
      id: 'isbj-1',
      kind: 'search',
      label: 'Jeg søker på isbjørn og Arktis',
      queries: ['isbjørn norsk Arktis', 'bevaring isbjørn tiltak'],
      durationMs: 1200,
    },
    {
      id: 'isbj-2',
      kind: 'read',
      label: 'Jeg leser strategien fra Miljødirektoratet',
      durationMs: 1300,
    },
    {
      id: 'isbj-3',
      kind: 'reasoning',
      label: 'Jeg skiller trussel fra tiltak',
      detail: 'Hovedtrusselen kan ikke styres nasjonalt; tiltakene handler om det som kan.',
      durationMs: 1000,
    },
    { id: 'isbj-4', kind: 'finalizing', label: 'Jeg skriver svaret', durationMs: 800 },
  ],
  followUps: [
    'Hva sier strategien om ferdsel på Svalbard?',
    'Hvilke miljøgifter er det snakk om?',
    'Hva sto i handlingsplanen fra 2013?',
  ],
};

const helseVentetid: ScriptedConversation = {
  id: 'helse-ventetid',
  question: 'Hvilke krav stilles til de regionale helseforetakene om ventetid og teknologi i 2026?',
  threadTitle: 'Krav til helseforetakene i 2026',
  daysAgo: 48,
  answer: `# Ventetid, psykisk helsevern og teknologi

Oppdragsdokumentet for 2026 setter mål om rask tilgang til trygge
helsetjenester, redusert ventetid, styrking av psykisk helsevern og
rusbehandling, samt satsinger på forskning, kompetanse og kvinnehelse [1].

Det konkretiseres i oppdrag: direkte tildeling av time, innføring av digitalt
helsekort for gravide og tiltak for å redusere ventetider [2].

På teknologisiden vektlegges samarbeid med kommuner, Helsedirektoratet, FHI
og KS, og **bruk av teknologi og KI for å øke produktivitet og
pasientsikkerhet** [3].`,
  documents: [
    sourceFrom('a19b555c-22d0-48a7-84a3-1ad5a5913168', [
      {
        text: 'Det beskriver mål om rask tilgang til trygge helsetjenester, redusert ventetid, styrking av psykisk helsevern og rusbehandling, samt satsinger på forskning, kompetanse og kvinnehelse.',
        heading: 'Mål',
        relevance: 'high',
        citationNumber: 1,
      },
      {
        text: 'Dokumentet fastsetter kvalitativ målsetting, indikatorarbeid og konkrete oppdrag som direkte tildeling av time, innføring av digitalt helsekort for gravide og tiltak for å redusere ventetider.',
        heading: 'Oppdrag',
        relevance: 'high',
        citationNumber: 2,
      },
      {
        text: 'Det vektlegger også samarbeid med kommuner, Helsedirektoratet, FHI, KS og bruk av teknologi og KI for å øke produktivitet og pasientsikkerhet.',
        heading: 'Samarbeid og teknologi',
        relevance: 'high',
        citationNumber: 3,
      },
    ]),
  ],
  retrieval: {
    hitCount: 6,
    documentCount: 1,
    keywords: ['ventetid', 'psykisk helsevern', 'kunstig intelligens', 'oppdragsdokument'],
  },
  thinkingSteps: [
    {
      id: 'helse-1',
      kind: 'search',
      label: 'Jeg søker i oppdragsdokumentene for 2026',
      queries: ['oppdragsdokument 2026 ventetid', 'regionale helseforetak KI'],
      durationMs: 1400,
    },
    {
      id: 'helse-2',
      kind: 'read',
      label: 'Jeg leser oppdragsdokumentet til Helse Midt-Norge',
      durationMs: 1500,
    },
    { id: 'helse-3', kind: 'finalizing', label: 'Jeg skriver svaret', durationMs: 800 },
  ],
  followUps: [
    'Hva er digitalt helsekort for gravide?',
    'Hvilke indikatorer brukes på ventetid?',
    'Gjelder det samme for de andre helseregionene?',
  ],
};

const naeringsforenkling: ScriptedConversation = {
  id: 'naering-forenkling',
  question: 'Hvordan skal effekten av forenklingstiltak for næringslivet måles?',
  threadTitle: 'Måling av forenkling for næringslivet',
  daysAgo: 310,
  answer: `# Oppgaveregisteret som målestokk

Strategien for forenklinger 2026–2029 peker ut **Oppgaveregisteret som
hovedverktøy for å måle effekter** [1].

Prioriteringen skal skje der tiltakene gir størst samfunnsøkonomisk gevinst,
med særlig vekt på små virksomheters digitalisering [2]. Arbeidet forutsetter
samarbeid mellom departementer, etater, kommuner og næringslivet [1].

Målene selv er formulert som retning og ikke som tall: økt automatisering,
«Fra plikt til flyt», færre rapporteringsplikter og bedre tilsyn [3]. Hva som
teller som oppnådd, står ikke i sammendraget.`,
  documents: [
    sourceFrom('a21788a6-8656-4411-b650-b96fde4b6c3d', [
      {
        text: 'Oppgaveregisteret skal brukes som hovedverktøy for å måle effekter, og arbeidet forutsetter samarbeid mellom departementer, etater, kommuner og næringslivet.',
        heading: 'Måling',
        relevance: 'high',
        citationNumber: 1,
      },
      {
        text: 'Prioritering vil skje der tiltak gir størst samfunnsøkonomisk gevinst, med særlig vekt på små virksomheters digitalisering.',
        heading: 'Prioritering',
        relevance: 'high',
        citationNumber: 2,
      },
      {
        text: 'Målene omfatter økt automatisering, «Fra plikt til flyt», færre rapporteringsplikter og bedre tilsyn.',
        heading: 'Mål',
        relevance: 'medium',
        citationNumber: 3,
      },
    ]),
  ],
  retrieval: {
    hitCount: 5,
    documentCount: 1,
    keywords: ['Oppgaveregisteret', 'forenkling', 'samfunnsøkonomisk gevinst'],
  },
  thinkingSteps: [
    {
      id: 'naer-1',
      kind: 'search',
      label: 'Jeg søker på forenkling og måling',
      queries: ['forenkling næringslivet måling', 'Oppgaveregisteret effekt'],
      durationMs: 1300,
    },
    { id: 'naer-2', kind: 'read', label: 'Jeg leser forenklingsstrategien', durationMs: 1200 },
    {
      id: 'naer-3',
      kind: 'reasoning',
      label: 'Målene er retning, ikke tall',
      detail: 'Jeg sier det, i stedet for å late som om sammendraget har måltall.',
      durationMs: 900,
    },
    { id: 'naer-4', kind: 'finalizing', label: 'Jeg skriver svaret', durationMs: 800 },
  ],
  followUps: [
    'Hva er «Fra plikt til flyt»?',
    'Hvem eier Oppgaveregisteret?',
    'Hvilke rapporteringsplikter skal bort?',
  ],
};

/** All eleven, in the order they were written. */
export const scriptedConversations: ScriptedConversation[] = [
  dssRegnskap,
  udirLaererspesial,
  digdirStyring,
  bufdirBarnevern,
  digitaliseringBredt,
  klimaFeil,
  forskningKunnskapsgrunnlag,
  folkehelse,
  isbjorn,
  helseVentetid,
  naeringsforenkling,
];
