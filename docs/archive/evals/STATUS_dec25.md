# Status

- Gjennomført en POC som ble presentert på KA-teamet 19.12.2025.
- Dataene som ble brukt ligger her [output_test_run_dec25](golden_questions/output_test_run_dec25)
- Her ble det vist fram dashboard, se [dashboard](./eval_from_golden_questions/dashboard/)
- Skjermbilder fra demo ligger her [skjermbilder_dasboard](docs/skermbilder_dasboard)
- Beskrivelse av flyt for generering av metrikker ligger her [README.md](README.md)

## Metrikker
I POC brukte vi følgende metrikker som ikke krevde referansesvar. Metrikkene kommer fra deepeval og brukes til å evaluere RAG-systemer.
- Answer relevancy
- Contextual relevancy
- Faithfulness

Følgende metrikker krever referanse og ble ikke brukt:
- Contextual precision
- Contextual recall


## Forslag til videre eval arbeid

- Hente lavthengende frukter. Lag eksempler på QA-par for enkle spørsmålstyper, som Locate og Simple QA usage modes. Se [usage modes](./docs/usage_modes.md)

- Lag spørsmål/forventning til svar basert på brukertilbakemeldinger. Bruk GEval fra deepeval. Bygg eval-sett fortløpende basert på tilbakemeldinger. Brukes til regresjonstesting, og til å måle effekt av feilrettninger/ny funksjonalitet.
- Generer spørsmål/svar basert på chunks. Kan bruke embeddings+clustering algoritme for å finne et test-sett som dekker bredden av dokumenter. Lag score basert på hvor høy opprinnelig chunk rankes av KA. 
- Vanskelig/krever eksperthjelp. Hent referansesvar for et sett med spørsmål. Bruk similarity eller LLM til å sammenligne. 
  - Man trenger muligens ikke fulle tekstsvar, men heller skive ned 2-3 påstandene med nøkkelinformasjon(?)
    - fungerer for Contextual recall. Vil sjekke om context underbygger alle påstandene i referanse - Fungerer for ufullstendig referansesvar
    - fungerer *litt* for Contextual precision. Vil sjekke om relevant chunk er høyere ranket enn urelevant informasjon. Bruker input og referanse - Problematisk hvis referansesvar er ufullstendig?
  - Bruk KA til å generere svar? Få eksperter til å ranke og eventuelt justere svarene. 


## Forslag til metrikker
- Metrikk for kildebruk: KA henter fra primærkilde. Bruker ikke sekundærkilde når primærkilde ikke er tilgjengelig
- 