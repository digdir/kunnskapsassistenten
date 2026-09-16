## Bakgrunn

### Mål:

Å forstå hvordan brukerne kvalitetssikrer svarene fra KA.

### Antall tester:

3 (planlagt 5, men stoppet da funnene var konsistente).

### Metode:

Vi brukte to skisser:

- Skisse 1: Chat med ToggleGroup (tre innganger til dokumentvisning: togglegroup, lenke i svaret, knapp «vis kilder»).
    
- Skisse 2: Dokumentvisning.
    

---

## Anbefalinger basert på hva vi har lært

1. Flytt dokumentvisningen fra midten til høyre side
    
2. Lage en enkel prototype av hvordan en kildeliste kunne fungert
    
3. Navigasjonen til dokumentet: Et minstekrav bør være at kilden som refereres til i slutten av et avsnitt lenker direkte til den relevante siden i dokumentet den stammer fra
    
    1. Det gjør den ikke i dag. Manglende dokumentvisning trenger ikke være et hinder dersom det er mulig å linke til en spesifikk side og åpne PDFen som en ny fane i nettleseren i stedet.
        
4. ToggleGroup-komponenten bør innføres når tabelltilnærmingen implementeres
    
    1. Slik at man kan bytte mellom chat og tabell/oversikt.
        

### Flytt dokumentvisningen fra midten til høyre side

For å optimalisere for sammenligning, i stedet for lesbarhet (som vi hadde gjort i testen) anbefaler vi å flytte dokumentvisningen inn i sidepanelet på høyre side. Som på bildet under skjules bak knappen “Vis verktøy” (arbeidstittel riktignok), hvor man også kan finne funksjonalitet som [https://digdir.atlassian.net/wiki/spaces/SK/pages/3292299265](https://digdir.atlassian.net/wiki/spaces/SK/pages/3292299265).

Det blir desto viktigere at sidepanelene kan justeres i bredden dersom dokumentvisningen flyttes inn. Altså at man kan trekke ut og inn bredden av sidepanelet for å tilpasse for skjermen man bruker, og størrelsen man ønsker

Også her kan vi hente inspirasjon (eller eventuelt kode i noen tilfeller) både fra prototypen til Simon, som ble nevnt tidligere, eller prototypen fra gruppa som jobbet med digitaliseringstiltak under hacke-uka (som er basert på Simons prototype) -> [https://digdir.atlassian.net/wiki/spaces/SK/pages/3559981058](https://digdir.atlassian.net/wiki/spaces/SK/pages/3559981058).

Prototypen fra hacke-uka, med dokumentvisning på høyresida

### Lage en enkel prototype av en kildeliste

Dette vil være nyttig for å konkretisere behovet, og utforske hvordan interaksjonen kan se ut, for at brukeren skal sitte igjen med ønskelig sluttresultat.

Sigrid har allerede utforsket dette i Figma Make, som du kan se på skjermbildet under

Ved å kopiere kildelisten fra skissen, og lime den inn et annet sted (et arbeidsdokument f. eks) ville det sett slik ut:

> Nasjonal kommunikasjonsmyndighet. (2024). Årsrapport NKOM 2024. https://www.nkom.no/årsrapport-2024
> 
> Nasjonal sikkerhetsmyndighet. (2024). Cybersikkerhet i kritisk infrastruktur. https://www.nsm.no/cybersikkerhet-2024

### Navigasjonen til dokumentet

Under testene brukte vi en enkel videreutvikling av det vi har i produksjonsmiljøet i dag. For øyeblikket er det kun en referanse til kilden – _"Årsrapport UIO 2021" –_ som er brukt i enden av avsnittet (som markert med gult i dette i bildet under).

Referansene i dagens produksjonsmiljø, uten lenker

Referansene fra testgrunnlaget, med lenker

Et teknisk spørsmål vi må stille er – er dette nivået vi skal legge vårs på? At en kilde kun knyttes til et avsnitt i sin helhet? Eller vil det være relevant å ha ulike kilder fra setning til setning?

**Teknisk antagelse**

Å linke til riktig side i PDFen er lett. Det har vi faktisk allerede gjort.

Å markere gjeldende avsnitt/setninger i en PDF-visning (aka. gule ut teksten) vil derimot være vanskelig, og vil i så fall kreve mer tid til å utforske hvordan det kunne vært gjort på en god måte.

Enn så lenge anbefales det at vi linker til rett side i dokumentet, og lar brukeren leite derfra.

#### Neste steg i navigasjon

Neste steg i å forbedre hvordan vi kommuniserer kildene som er brukt i svar kan være å gå i retningen av fotnoter.

Sett inn bilde av fotnoter fra Simons prototype

Disse fotnotene kan deretter samles nederst i svaret, og vise nøyaktig hvilke kilder som er brukt for det spesifikke svaret. Her kan vi hente inspirasjon fra prototypen som ble laget av Simon Archer Dreyer i første halvdel av 2025:

Det arbeidet er også knyttet opp mot en større oppgave om å “[https://digdir.atlassian.net/wiki/spaces/SK/pages/3276210214](https://digdir.atlassian.net/wiki/spaces/SK/pages/3276210214)”.

## Hva lærte vi?

- Brukerne vil raskt og enkelt til kilden, med nøyaktig sidehenvisning. De forventer at lenken i svaret tar dem direkte til riktig side i dokumentet.
- Sammenlignbarhet fremfor lesbarhet
    - Kontroll mot kilden er viktigere enn optimal lesbarhet (refererer til hvor vi plasserer dokumentvisningen i grensesnittet — i midten, hvor det får mye plass, eller i høyre sidepanel hvor den alltid er tilgjengelig, men har mindre plass tilgjengelig)
- Navigasjon i dokumenter: Ønske om innholdsfortegnelse, men usikkert om reelt behov eller vane.
- Brukerne er gode på kildekontroll
    - Vi skal legge til rette for god kilde**bruk**, ikke overta ansvaret for kilde**kontroll**.
- Oppsummering av kilder: Referanseliste (i [norsk APA-stil](https://sikt.no/norsk-apa-referansestil)) eller kildeoppsummering ville vært nyttig.
    

### Observasjoner om grensesnitt

- Alle brukte lenken i svaret for dokumentvisning.
- Ingen la merke til [toggle-groupen](https://storybook.designsystemet.no/?path=/docs/komponenter-togglegroup--docs) eller «vis kilder»-knappen, da de så på chattebildet.
    - Da de så på dokumentvisningen derimot var det noen som la merke til den.
        - Tolkningen vår er riktignok at dette er et mønster det er behov for å lære seg, og bli vant til, som vi ikke bør avskrive utelukkende fordi den ikke ble lagt merke til. Den vil nemlig være nyttig som navigasjonsverktøy for chat, tabell (på sikt) og eventuelt en funksjonalitet til.

### Hva må vi utforske mer?

1. Styrk etterprøvbarhet med bedre kildehenvisning.
2. Vurder behovet for innholdsfortegnelse og navigasjon i PDF som fremtidig forbedring.

Etterprøvbarhet betyr at leseren enkelt kan kontrollere og validere informasjonen som presenteres.

**I henhold til** [**norsk APA-mal**](https://sikt.no/norsk-apa-referansestil) **innebærer dette:**

- Presise kildehenvisninger i teksten
    - Forfatter-år-systemet, med sideangivelse ved direkte sitat.
- Fullstendig referanseliste
    - Alle kilder nevnt i teksten skal ha komplett informasjon (forfatter, år, tittel, utgiver, DOI/URL).
- Konsistens og transparens
    - Henvisninger skal være korrekte og tydelige, slik at leseren kan finne kilden uten tvil.


Formålet er å sikre sporbarhet, troverdighet og vitenskapelig integritet i teksten.