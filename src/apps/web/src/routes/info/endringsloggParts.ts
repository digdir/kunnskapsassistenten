/*
 * Lifted from the old Kunnskapsassistenten, kept as content and nothing else:
 * no styling and no scripts came along. See InfoPage.tsx for how it is drawn.
 */
import type { InfoPart } from './InfoPage';

export const endringsloggParts: InfoPart[] = [
  {
    kind: 'markdown',
    text: `# 09.06.2025

## Designsystemet

> Designsystemet er en felles verktøykasse med grunnleggende UI-komponenter, retningslinjer og mønstre, som du kan bruke når du utvikler digitale tjenester. Designsystemet bidrar til effektiv produktutvikling og helhetlige brukeropplevelser.

Vi har tatt i bruk komponenter fra Designsystemet for å gjøre det enklere for oss å iterere raskt på nye designkonsepter og samtidig opprettholde god praksis for brukervennlighet og tilgjengelighet.

## Kilder

- Avsnitt fra kildene våre i Kudos vises nå i en panel på høyre siden. Lesbarheten er betydelig forbedret.
- Du kan nå søke i kildene, treff blir vist i gult

---

# 03.06.2025

## Generelt

Denne gangen var det så mange forbedringer at vi måtte porsjonere det ut!

Noen av dere har kanskje merket disse endringene allerede, likevel gir vi en oppsummering her.

## Endringer

- Vi har en foreløpig løsning som gjør det mulig å velge mellom "mine tråder" og "andres tråder" da tar vi ikke bort læringsmulighetene i denne test-fasen, men gjør det enklere å holde styr på egne tråder.
- Nytt prod miljø gir bedre ytelse og kapasitet for flere samtidige brukere
- Ny importrutine gjør en betydelig bedre jobb på konvertering fra PDF til Markdown
  - Dette øker kvaliteten i alle andre deler av løsningen.
  - Totalt 5801 dokumenter er nå i Kunnskapsassistenten
    - Antall dokumenter vil øke over tid nå at vi har integrert løsningen mot KUDOS APIet
- Du kan kopiere link til tråden din, f.eks for å dele med en kollega
- Du finner link til [tilbakemeldingsskjema](https://forms.office.com/Pages/ResponsePage.aspx?id=D1aOAK8I7EygVrNUR1A5kdzW-oe0-GdPryUbr_2_X9dUNE1YRDNLRzZXTUEwS0JZWDlQN1NDUkNDOC4u) i løsningen

Nå som det har skjedd litt større endringer, håper vi dere kan teste litt også fylte ut tilbakemeldingsskjema en gang til. På denne måten kan vi se om det faktisk har skjedd noen forbedringer for dere  😇

---

# 02.06.2025

Heisann dere 👋

I dag skal vi dele en stor seier, en svakhet, og noen muligheter gående framover.

## Seieren

"Oppdaterte dokumenter" er nok den mest etterspurte tilbakemeldingen vi får, og da er det ekstra gøy å si at det har vi nå.

Fra og med i dag finner du dokumenter fra 2020-2025 (så langt de har blitt publisert på Kudos) i Kunnskapsassistenten. Vi har de samme dokumenttypene som tidligere – årsrapport, tildelingsbrev, evalueringer og statusrapporter. Men vi kan også meddele at vi har lagt til Proposisjoner til Stortinget og Strategi/plan!

## Svakheten

I løpet av denne prosessen har vi oppdaget en svakhet i datakvaliteten. Vi tror den egentlig har vært der hele tida, men at det ikke har vært like tydelig *hva* som har skjedd.

Flere av dere har sikkert fått tilbakemeldinger fra Kunnskapsassistenten som lyder som:

> "Jeg har dessverre ikke spesifikke data om.."

> "Jeg har dessverre ikke tilgang til dokumenter fra.."

> "Jeg har ikke informasjon om.."

Når vi graver i kildene selv (altså ser gjennom PDFene) ser vi at informasjonen faktisk finnes i flere av disse tilfellene. Sånn skal det ikke være, og det er noe vi følger nøye med på.

For øyeblikket graver vi fram eksempler hvor det har skjedd, og dokumenterer nøye underveis, slik at vi forstår problemet bedre, og er bedre rustet til å fikse det.

Har du noen egne eksempler? Skriv til oss her, eller send det spesifikt til [marie.berntsen@digdir.no](mailto:marie.berntsen@digdir.no)

Med det sagt har den nye importrutinen vår sørget for bedre kvalitet på andre måter og mer konsekvent formateringer!

## Muligheter gående framover

Vi nevnte at vi har oppdaterte dokumenter i Kunnskapsassistenten nå, som er flott, men det som er enda bedre er *hvordan* det skjer. Nå går vi nemlig fra en manuelt krevende jobb til en mer automatisert løsning, som bygges på [det åpne APIet til KUDOS](https://kudos.dfo.no/%C3%A5pne-data).

Resultatet av det arbeidet er at så fort en ny årsrapport lastet opp til KUDOS vil den også være tilgjengelig i Kunnskapsassistenten. Det har vært en klar forventning fra flere av dere, og nå er det også realiteten. For øyeblikket har vi nå 5201 dokumenter totalt.

I tillegg er vi nå mye bedre rustet for å hente inn nye dokumenttyper

---

# 22.04.2025

Håper alle sammen har hatt en god påske!

Rett før påske fikk vi inn **statusrapporter** for 2020-2024. Kudos definerer statusrapport som en oppsummering av nåværende situasjon, fremdrift eller tilstand innenfor et prosjekt, en virksomhet eller område.

Vi har også endret litt på modellens systeminstrukser, slik at assistenten lettere kan forklare deg hva den kan hjelpe deg med og evt hva den ikke kan gjøre enda.

Vi fortsetter arbeidet, ikke nøl med å ta kontakt hvis dere lurer på noe! I løpet av denne uken er det også ønskelig å få tilbakemeldinger via dette skjemaet:

[Tilbakemeldingsskjema](https://forms.office.com/Pages/ResponsePage.aspx?id=D1aOAK8I7EygVrNUR1A5kdzW-oe0-GdPryUbr_2_X9dUNE1YRDNLRzZXTUEwS0JZWDlQN1NDUkNDOC4u)

---

# 24.03.2025

Hei alle sammen!

Det har skjedd noen endringer i løsningen, det er ikke mange denne gangen, men de er litt \\"synlige\\" 🤓

## Oppsummert

- Utvidet input-område (der du skriver spørsmålet ditt) med støtte for linjeskift (trykk Shift + Enter)
- Disclaimer-tekst som sier \\"Kunnskapsassistenten kan gjøre feil. Husk å sjekke viktig informasjon.\\"
- Små visuelle forbedringer (gradient bak input-område)
- Vi vil snart laste opp en ny dokumenttype: statusrapporter fra 2020-2024 – stay tuned!

---

# 26.02.2025

I går hadde vi i prosjektgruppen et arbeidsmøte hvor vi justerte systeminstruksene og testet endringene fortløpende.

Vi ble enige om noen innledende justeringer som har gjort modellen mer bevisst på sin egen rolle og hvordan den kan hjelpe brukeren. Nå kan modellen gi informasjon om hvilke og hvor mange dokumenter den har tilgjengelig 😊 I tillegg skal det endelige svaret inkludere kilder i parentes, slik at man vet hvilke av de relevante kildene som faktisk er brukt.

Det spennende – og utfordrende – med systeminstrukser er at én justering kan påvirke en annen, noe som kan gi uventede utslag i hvordan modellen responderer. Derfor gjelder det å holde tunga rett i munnen og gjøre én endring av gangen. Vi kommer til å eksperimentere videre med dette!

---

# 18.02.2025

Hei alle sammen!

Filtrering viser nå korrekt antall dokumenter i parantes, også etter at man har valgt noen verdier å filtrere på.  Noen dokumenter manglet søkebegrep etter Chunkr-import som vi gjorde, dette er nå rettet opp i. Vi oppdaget blant annet at man ikke fikk noe svar hvis man valgte Bufdir og noen andre virksomheter - dette skal være rettet opp i nå.

Det betyr at det skal være litt lettere å teste igjen 🕺

Igjen gi beskjed hvis noe ikke virker riktig!

I denne sprinten på teknisk side jobber vi med å teste noen endringer i systeminstrukser og få modellen til å søke på nye kilder etter oppfølgingsspørsmål. Vi kommer også til å dele litt mer fremover rundt innsikt og funn fra arbeidet.

---

# 17.01.2025

## Lagt til

- Resterende 2023 dokumenter, som ikke kom med i første import, er nå inkludert
- Filtrering
- Du har mulighet til å gjøre åpne søk (slik som tidligere, ved å skrive inn spørsmålet ditt) eller filtrere på virksomhet, dokumenttype og år (gjerne sjekk hva som gir dere best svar og utforsk om den blir mer treffsikker når du spør om flere virksomheter og filtrerer deretter)

***Endret*** Grunnleggende endring på hvordan modellen tolker/bedrer lesbarheten til dokumentene

- Før var det noe av innholdet i dokumentene som ikke var lesbart for modellen (som tekst i tabeller osv). Dette er ikke en synlig endring for dere, men vi har sett at utdragene modellen henter (basert på ditt spørsmål) er mer fullstendig - dermed kan vi være tryggere på at modellen ikke har mistet noe informasjon

## Fjernet

- Debug false-knapp som var forstyrrende element

## Fikset

- Bugs er fikset
  - Det kan dukke opp nye bugs, men vi skal ha fikset det gamle som at send-knappen ikke fungerte osv. Gjerne si ifra hvis dere legger merke til noe annet.
- Du skal komme rett til Kudos når du trykker på kilden (det var noen feil her før ved at man kom til nettsider som var fjernet)

---

# 26.11.2024

## Lagt til

- Lagt til "tenke-steg" for å vise hva modellen jobber med underveis, før du faktisk får et svar
- Gjort det enklere å starte en ny tråd
- For at du skal få god kvalitet på svarene, fra gang til gang, har vi gjort noen justeringer på instruksene til KI-modellen for å øke stabiliteten

## Endret

- Forenklet venstre meny
- Plassert kildene under det første svaret, på bakgrunn av hypotesen om at man først vil se svaret, for deretter å vurdere kildene det er basert på

## Sikkerhet

- Mer stabil interaksjon med Azure og OpenAI etter en større restrukturering i koden`,
  },
];
