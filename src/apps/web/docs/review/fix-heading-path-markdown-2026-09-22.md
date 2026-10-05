# PR #147, overskriftsstien uten rå Markdown

Branch `fix/heading-path-markdown`, sha `c15bafa`, anmeldt 2026-09-22. To
filer i `src/api/live/`.

Lukker brukerblikk 7 funn 1: kildepanelet viste «Europas historie 1789–1914 ›
Noter## Referanser## Litteratur». Det var det eneste stedet i live der noe fra
backend nådde skjermen uten å gå gjennom Markdown-tegneren.

## Portene

| Port            | Utfall                                          |
| --------------- | ----------------------------------------------- |
| `build`         | exit 0                                          |
| `lint`          | exit 0                                          |
| `format:check`  | exit 0                                          |
| `tokens:verify` | exit 0                                          |
| `npm test`      | exit 0, 883 tester                              |
| e2e (4173)      | exit 0, 151 bestått, på sammenslåingen med #146 |

## Funn

Ingen.

## Målt i live, ett spørsmål

Egen dev-port, `VITE_KA_TENANT=demo`,
`VITE_KA_DATASETS=norquad-docs=Wikipedia (NorQuAD)|351 artikler`. «Hva var
bakgrunnen for første verdenskrig?», 20 sekunder, svar med kilder.

**Ingen `#` noe sted i kildepanelet.** Jeg lette i hele `aside`-teksten og
ikke bare i stiene, fordi et funn om rå Markdown ikke er lukket før det er
borte fra hele flata. Stiene leser slik:

- Europas historie 1789–1914 › Stille før stormen (1900–1914) › Mot krig (1911–1914)
- Europas historie 1789–1914 › Stille før stormen (1900–1914) › Allianser og maktkamp › Tysklands vindu: Boerkrigen og Bokseropprøret (1899–1901)
- Europas historie 1789–1914 › Imperialisme og radikalisering (1871–1899) › Nasjonalisme og imperialisme › Europa og Midtøsten: Russland, Det osmanske rike og panslavisme (1871–1878)

Ingen konsollvarsler. Fraskrivelsen navngir korpuset.

## Riktig, og hvor jeg sjekket det

- **Regelen er mellomrommet, ikke firkanten.** `#+\s+` krever noe etter løpet,
  så «Kapittel #3» overlever helt. Det er den ene avgjørelsen som gjør en
  strykefiks trygg i stedet for grådig, og testen står på den.
- **`#+` og ikke `#{1,6}`, med grunnen skrevet ned**: seks er grensen for en
  overskrift et menneske har skrevet, og dette er et løp en chunker har laget.
  En umulig sjuende firkant skal svelges, ikke vises.
- **Kantene er lest i koden og dekket av tester**: en verdi som slutter med en
  markør gir et tomt ledd som filtreres bort; en verdi som bare er `###` gir
  `undefined`; en verdi som begynner med markøren mister det tomme første
  leddet; `«  Noter  »` trimmes.
- **`#Navn` uten mellomrom beholder firkanten**, og det er riktig: det er
  ingen overskrift i Markdown heller, så å stryke den ville vært å endre tekst
  som ikke er en markør.
- **Råverdiene i testene er målte og merket som målte**, med dato, datasett og
  spørsmål. Det er forskjellen på en test som vokter en virkelighet og en som
  vokter en antakelse — og det er grunnen til at fiksen kunne velge riktig
  regel: målingen viste at `##` ikke var et skilletegn backend hadde valgt,
  men Markdown inne i **én** verdi, der chunkeren hadde kjørt tre
  søskenoverskrifter sammen.
- **Begrensningen står i koden.** Søsken tegnes som nesting, fordi strengen
  ikke sier hvilket nivå de lå på. Kommentaren sier det rett ut og peker på
  bestillingen som er den varige veien, i stedet for å la neste person oppdage
  det.

## Til dirigenten

Utenfor PR-en, sett i samme kjøring: kildekortets tittel står som «Europas
historie 1789 1914» — tankestreken er borte mellom årstallene, mens den står
riktig i stien rett under. Tittelen kommer fra backendens `title`/`doc_title`.
Samme form finnes i mock, der `kudos-korpus.json` har «Årsrapport Nasjonal
kommunikasjonsmyndighet 2025» med dobbelt mellomrom. Begge er data og ikke
kode. Logget til Benjamin-lista og fixturene.
