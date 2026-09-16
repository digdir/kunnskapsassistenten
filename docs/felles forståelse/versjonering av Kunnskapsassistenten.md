## Formålet

Versjonering gjør det lettere å kommunisere om hvilken iterasjon vi jobber med (som planlegges for tida framover), og hva som er klart for implementering innen kort tid.

Målet er å forbedre kommunikasjonen rundt arbeidet som gjøres, og prioriteringene gående framover.

## Disclaimer

I verden av digital produktutvikling er det flere tilnærminger for versjonering. Om det er “semantisk versjonering” (aka. SemVer), kalender-versjonering eller noe annet.

Hver tilnærming har et etablert sett med regler. Det vi gjør nå er å lage vår egen tilnærming, som er egnet for vårt prosjekt. Av to grunner:

1. Å forenkle kommunikasjonen på tvers av roller
2. For å løsrive vårs fra tankesett som ikke er like gjeldende i vårt tilfelle

## Versjoner

### Hvor er vi nå?

Nåværende versjon kan vi se på som 3.7.0. Det vil si at neste versjon, som inkluderer forbedringer i importrutinen (med Kudos APIet) blir versjon 3.8.0. Vi nærmer oss altså v4.0.0 hvor den store endringen er implementeringen av [designsystemet](https://designsystemet.no/), og forbedringer på ytelsen.

### Hvor har vi vært?

| **Versjon** | **“Major”**                        | **Beskrivelse**                                                                                                                |
| ----------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| v1.0.0      | Manuell bestilling                 | Vi tok kontakt med Append med en bestilling, og fikk et svar på teams/epost når bestillingen var håndtert. Manuell håndtering. |
| v2.0.0      | Slack-chat                         | Stilte spørsmål på Slack, (med oppfølging i tråd?). Delvis automatisert.                                                       |
| v3.0.0      | Web v1                             | Et webgrensesnitt uten konsistent design. Interaktivt, men ikke strukturert.                                                   |
| v4.0.0      | Designsystem + ytelsesforbedringer | Første versjon av designsystemet, strukturert og komponentbasert UI. Oppgraderte databasen.                                    |
| v5.0.0      | Agenter?                           |                                                                                                                                |

## Viktig å merke seg

- Skalaen for “Minor”-tall går fra 0-9, altså v4.1, v4.2, v4.3, v4.4 osv.
    - Major-tall derimot vil kunne fortsette oppover – f. eks v17.0.0
    - Skalaen for “patch”-tall går fra 0-99
- Figma er ikke vår “source of truth”. 
	- Det må være hva som er publisert i produksjonsmiljøet.
	- Det er altså koden som er vår kilde til sannhet, ikke designskissene.

Det kan oppstå tilfeller hvor vi ikke nødvendigvis går i en “logisk rekkefølge” fra en minor-versjon til en major-versjon. Et eksempel på det kan være at vi er på versjon 4.4 (med designsystem++), og takket være ressurser fra KI-laben har vi mulighet til å hoppe opp til v5.0.0 (med agenter) tidligere enn vi hadde sett for oss.

I det tilfellet går vi fra v4.4.0 → v5.0.0, uten å gå innom v4.5, v4.6, v4.7, v4.8, v4.9.0 først.

## Hvor skal dette brukes?

Flere områder:

- Planlegging
- Deploy (kode som publiseres)
- Designskisser
- Endringslogg

Når vi har kommet i gang med bruk av versjonering kan vi vise eksempler på det fra de ulike områdene.

### Designskisser

Innen design kan vi bruke dette til å eksperimentere med konsepter som peker mot neste hovedversjon (f.eks. v5.0.0), eller utvikle små forbedringer som ligger innenfor nåværende versjon (.eks. v4.1.2).

## Hvordan skal det brukes?

Vi låner strukturen fra semantisk versjonering, som er fordelt på tre tall:

> MAJOR.MINOR.PATCH
> 
> f.eks. **4.1.2**

Disse tallene representerer omfanget av endringen, og innsatsen som er lagt ned i arbeidet.

> [!NOTE] Til seinere
> Det er viktig at vi **diskuterer hva som kvalifiserer** til å være en “major” eller “minor” oppdatering.

Dette vurderer vi ut i fra hva som var en betydningsfull arbeidsmengde for vårs som team. Ikke enkeltpersoner.

| **Versjonsnummer** | **Hva det betyr**                                                                                                                          | **Eksempel**                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Major              | Store endringer som endrer produktet på en fundamental måte                                                                                | **4.0.0** = Første versjon av designsystemet i produksjon                                                                                                                                                                                |
| Minor              | Nye funksjoner eller vesentlige forbedringer innen samme paradigme                                                                         | **4.1.0** = Lagt til søk blant kildene                                                                                                                                                                                                   |
| Patch              | Små justeringer og feilrettinger                                                                                                           | **4.1.1** = Rettet opp skrivefeil, og endret tekst i tenkestegene                                                                                                                                                                        |
| Commit ID          | Brukes av utviklerne. Kun relevant for å referere til en spesifikk versjon av testmiljøet. Ikke noe vi kommuniserer utafor prosjektgruppa. | **4.1.1.c1e609a** = En spesifikk iterasjon som er publisert til testmiljøet. Hvis den ikke er godkjent lages det en ny iterasjon som får en ny “commit ID”, f. eks e6a260u, hvor versjonsnummeret i sin helhet da blir **4.1.1.e6a260u** |