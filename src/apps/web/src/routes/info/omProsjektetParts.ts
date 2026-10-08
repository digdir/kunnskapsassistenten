/*
 * Lifted from the old Kunnskapsassistenten, kept as content and nothing else:
 * no styling and no scripts came along. See InfoPage.tsx for how it is drawn.
 */
import type { InfoPart } from './InfoPage';

export const omProsjektetParts: InfoPart[] = [
  {
    kind: 'markdown',
    text: `Arbeidet med KI-assistert kunnskapsarbeid startet som et initiativ fra ansatte i Digitaliseringsdirektoratet (Digdir), med mål om å effektivisere et kunnskapsoppdrag gitt til dem av Digitaliserings- og forvaltningsdepartementet. Avdelingen for sammenhengende tjenester og livshendelser fikk i oppdrag å kartlegge status for innovasjon i staten, og levere et kunnskapsgrunnlag til departementet.

I denne sammenhengen fikk et lite team mulighet til å utforske nye arbeidsformer og teknologier. De valgte å samarbeide med et oppstartsselskap for å undersøke potensialet for bruk av kunstig intelligens på offentlige dokumenter. Gjennom dette arbeidet ble det tydelig at Kudos-databasen – som samler kunnskaps- og styringsdokumenter fra offentlig sektor – representerte en verdifull kilde for kunnskapsinnhenting.

Mot slutten av Digdir sitt oppdrag ble et kunnskapsgrunnlag levert, og teamet delte sine erfaringer med bruk av KI. Det ble samtidig klart at det fantes et bredere behov – både internt i Digdir og hos andre offentlige aktører – for verktøy som gjør det enklere å utforske og hente ut innsikt fra store mengder tekstbasert kunnskap.

I samarbeid med avdelingen for brukeropplevelse og data utviklet teamet derfor et enkelt webgrensesnitt. Løsningen bygger på en RAG-arkitektur (retrieval-augmented generation), som kobler en stor språkmodell med pålitelige, offentlige datakilder fra Kudos. Dette gir brukerne mulighet til å effektivt utforske kvalitative data om offentlig sektor på en intuitiv måte.

Prosjektet har vært drevet fram gjennom en eksperimentell og iterativ tilnærming, med tidlig involvering av brukere og kontinuerlig testing. Teamet består i dag av en tverrfaglig gruppe med forretningsutviklere, designere og utviklere, og prosjektet er nå en del av porteføljen til Digdirs nyopprettede KI R&D LAB.

Produktet eksisterer i dag som en betaversjon, og testes av flere kunnskapsarbeidere i statlig sektor. Parallelt arbeides det med videreutvikling av løsningen for å kunne møte ulike brukerbehov og støtte bredere bruk i offentlig forvaltning.`,
  },
];
