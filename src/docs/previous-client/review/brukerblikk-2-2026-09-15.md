# Brukerblikk runde 2: hva ser rart ut etter bølgen 15.09

2026-09-15, anmelderen (KA CC). `main` = `5be38f1`, mock-modus, bygget app på
`vite preview` 5182, **1440 × 900, lys og mørk**.

Runde 1 så på skallet slik det sto 15.09 om morgenen. Denne runden ser på det
som kom etter: elleve cachede samtaler, filteret som når spørringen, kilder per
svar, oppsamlingsruta, husket tilstand, tidsstempler, korpuslinja, snarveien og
feilkodene. **Ti PR-er på én dag.**

Alt her er grønt i axe og i e2e-suiten — 94 tester — og ingenting under er en
regresjon i noe som ble målt. Det er ting som ser rart ut for en som bruker
appen.

Skjermbilder og rådata i
`design/skjermbilder-frontend/blikk2/`.

## Sammendrag

| Eier                | Funn       |
| ------------------- | ---------- |
| #3 hovedkolonne     | 1, 5, 6, 7 |
| #4 kildepanel       | 3          |
| #5 skall og layout  | 1, 2       |
| #2 navigasjonspanel | 4          |

**Funn 1 er den eneste som gjør noe uopprettelig for leseren.** Resten er
ting som gjør appen dårligere å lese.

---

## 1. En gjenopprettet samtale står igjen uten kildene sine

**1440, lys og mørk.** `blikk2/14-etter-reload-light.png`
**Eier: #3 og #5.** **Rett nå.**

Still et spørsmål, vent til svaret er ferdig, last siden på nytt. Samtalen
kommer tilbake — det er hele poenget med at mocken husker den — men de to
sidepanelene gjør ikke det:

```
FØR reload    kildepanelet: «Snarveier til dokumentene» + 3 kildekort
              «Fra Kudos»:  2 dokumentlenker
ETTER reload  kildepanelet: «Ingen kilder ennå — Kildene vises her når du har
                             stilt et spørsmål.»
              «Fra Kudos»:  «Dokumentene som er relevante for søket ditt vises her.»
```

Svaret på skjermen er helt: **sju markører, alle som ekte lenker**,
«Fremgangsmåte 5 treff i 3 dokumenter», tenkepanelet med sine steg. Og
`sessionStorage` har kildene — den lagrede turen står som `assistant` med tre
dokumenter.

Så meldingen **har** kildene sine; det er skallet som aldri får dem. Og et
klikk på `[1]` gjør ingenting: panelet blir stående på tomtilstanden.

To panelet sier altså til en leser som ser på et ferdig, sitert svar at hen
ikke har spurt om noe. Det er den samme løgnen punkt 7 i runde 1 handlet om,
i en ny tilstand — og denne gangen står den i to paneler samtidig.

Jeg vet ikke hvilken av de to som mister den. Kandidatene er rapporteringen i
chat-viewet (`reported`-signaturene og `clearAnswerSources` i samme
oppstart) og opprydningen i `ChatSlotView`. Målingen sier bare at meldingen er
hel og at skallet er tomt.

## 2. Sidens egen beskjed er den minste skriften på skjermen

**1440, lys og mørk.** `blikk2/15-tull-dark.png`
**Eier: #5.**

Målt på `/tull`:

| Tekst                                 | Nivå | Størrelse |
| ------------------------------------- | ---- | --------- |
| «Siden finnes ikke» — hele sidas sak  | `h2` | **18 px** |
| «Filtrering» — en panelbolk           | `h2` | 24 px     |
| «Dokumenter» — en underbolk i panelet | `h3` | 21 px     |
| Brødteksten under                     | `p`  | 16 px     |

Det eneste som står i hovedkolonnen er altså mindre enn to overskrifter i
sidepanelet og to piksler større enn vanlig tekst. `/threads/<ukjent>` måler
det samme: «Fant ikke tråden» er 18 px.

`EmptyState` tegner alltid `data-size="2xs"`, som er riktig for en tom liste
inne i et panel. #39 ga den `level` fordi semantikken måtte følge stedet;
størrelsen ble stående igjen. En tomtilstand som **er** siden, bør se ut som
det.

## 3. «Kilder til svar 1 av 2» ruller ut av syne mens du leser utdraget

**1440, begge moduser.** `blikk2/13-to-svar-velger-light.png`
**Eier: #4.**

Linja som sier hvilket svar kildene hører til er det som gjør «Utdrag 2»
entydig — det står i komponentens egen dokumentasjon, og det er riktig. Men
ingenting i kildepanelet er `position: sticky` (målt: null treff på «sticky» i
`src/views/sources/`), så hele viewet ruller, overskriften «Kilder» og
velgeren med.

Og markøren ruller deg **dit utdraget er**. På skjermbildet står leseren i
utdrag 1 av svar 1, og det eneste på skjermen som kunne sagt hvilket svar det
er, er rullet bort.

Det er ikke en feil i noe som ble bygget; det er en konsekvens av at panelet
fikk et nytt førsteelement etter at rullingen var bestemt. Verdt en vurdering
sammen med panelhodet.

## 4. Dokumentlista i filterpanelet ligger under skjermkanten

**1440 × 900.** `blikk2/13-to-svar-velger-light.png`
**Eier: #2, og #5 for rekkefølgen i panelet.**

Målt med et svar på skjermen: innholdet i navigasjonspanelet er **1227 px** i
en flate på **778 px**, og første dokumentrad under «Fra Kudos» starter på
**y = 818** i et 900 px høyt vindu. Ingen av radene er synlige uten å rulle.

Lista er reell — panelet ruller, og radene er der — men rekkefølgen i panelet
er nå: korpuslinje, tre fasettfelt med hver sin «Ingen avgrensning», og så
dokumentene svaret faktisk bygger på. Det som endrer seg med hvert svar ligger
nederst, under det som sjelden endrer seg.

Korpuslinja er ny og tar 63 px av det. Den er verdt plassen — den sier hvor
svarene kommer fra, som ingenting gjorde før — men den skjøv noe ned, og det
er verdt å vite hva.

## 5. Den samme samtalen sier to forskjellige tenketider

**Målt på samme svar, før og etter en reload.**
**Eier: #3.**

```
live           «Tenkte i 2 sekunder»
etter reload   «Tenkte i 4 sekunder»
```

Det ene er klokketid mens svaret ble til, det andre er summen av tenkestegenes
egne `durationMs` slik de ble lagret. Ingen av dem er gal hver for seg, men en
leser som laster på nytt ser et nytt tall på noe som ikke har endret seg.

E2E-testen for reload sammenligner derfor svarteksten og ikke hele meldinga;
det står i `funksjonssjekk.md`.

## 6. Tastatursnarveien står foran ansvarsfraskrivelsen

**Alle skjermbilder med skrivefeltet.**
**Eier: #3.**

Linja under feltet er nå:

> Trykk Cmd + / for å hoppe hit · Kunnskapsassistenten kan gjøre feil. Husk å
> sjekke viktig informasjon.

To setninger på én linje, midtstilt, og den brekker til to linjer på 1440. Den
ene er en bekvemmelighet for den som bruker tastatur; den andre er det
designet har bestemt at skal stå under feltet i alle fire variantene av
`chatInput`. Nå kommer bekvemmeligheten først.

Ikke feil, og hintet fortjener en plass. Men rekkefølgen sier hvilken av dem
som er viktigst, og den sier feil.

## 7. «Er det noe mer jeg kan hjelpe deg med?» under et svar som ikke fant noe

**Målt med «simuler ingen treff».**
**Eier: #3.** (Meldt i anmeldelsen av #49.)

Hele svaret leser:

> Fant ingen utdrag om dette i dokumentene. Prøv å stille spørsmålet med andre
> ord, gjerne med ord du venter å finne i dokumentene. **Er det noe mer jeg kan
> hjelpe deg med?**

Oppfølgingsforslagene er fjernet under et slikt svar, med den riktige
begrunnelsen at «Kan du utdype?» ber assistenten si mer om ingenting.
`CLOSING_QUESTION` gjør det samme én linje over, med ord i stedet for knapper.

---

## Det som er blitt bedre siden runde 1

Verdt å skrive ned, fordi det er mye:

- **Punkt 5 er lukket.** `[2]` i første svar åpner første svars utdrag to, og
  båndet blir igjen i svaret det hører til. Målt.
- **Punkt 7 er lukket.** Et avbrutt svar gir «Svaret ble avbrutt før kildene
  kom», en avklaring gir «Kunnskapsassistenten spurte om en avklaring». Ingen
  av dem sier lenger «du har ikke spurt om noe».
- **Punkt 12 er lukket.** Seks feilkoder, seks overskrifter, og «Ingen tilgang»
  har ingen «Prøv igjen»-knapp å trykke forgjeves på.
- **Punkt 4 er lukket.** Escape og «Tilbake til svaret» fra et utdrag.
- **Punkt 3 og 11 er lukket.** Tidsstempel på hver trådrad, og én linje som
  sier hva korpuset dekker.
- **Punkt 8 er lukket.** Hopp-lenke rett til skrivefeltet, og den tegnes bare
  når det finnes et felt å hoppe til.
- **En adresse som ikke finnes er en side.** Den var helt blank.
- **Kontrastsaken på fasettlistene er lukket som ikke reprodusert**, målt
  uavhengig to ganger og nå låst med en test i den ene tilstanden ingen hadde
  målt: lista åpen med tastaturet, en rad framhevet, i begge moduser.

## Til dirigenten

- **Funn 1 først.** Den gjør «samtalen overlever en reload» halvferdig, og den
  er den eneste her som tar noe fra leseren.
- Funn 2 er én prop. Funn 5, 6 og 7 er avgjørelser mer enn feil.
- Funn 3 og 4 handler begge om hva som ligger øverst i et panel som ruller.
  De hører sammen og bør ses sammen.
