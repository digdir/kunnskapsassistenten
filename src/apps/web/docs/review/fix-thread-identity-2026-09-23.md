# PR #156 og #157: tråden får et navn den kan svare på

Anmeldt av KA CC natt til 2026-09-23. To PR-er som lukker begge funnene fra
brukerblikk runde 8, og som til slutt måtte måles sammen.

## #156, hovedkolonnen viser at tråden lastes

`fix/thread-loading-state`, `3b86df4` → `298f3ac`. Sju filer.

Funn 2 i runde 8 var at en tråd som lastes møtte leseren med forsidens «Hei 👋
Hva lurer du på?» og tre forslag, mens filterpanelet i samme millisekund
tegnet skjeletter. To paneler, samme øyeblikk, og bare det ene sa sant.

Nå står det ett spørsmål og ett svar i skjelettform i stedet. Målt fra 120 ms
og utover:

| ms         | lastetilstand | hilsen | «Forslag» | meldinger | skrivefelt |
| ---------- | ------------- | ------ | --------- | --------- | ---------- |
| 120        | ja            | nei    | nei       | 0         | virker     |
| 300 → 2200 | nei           | nei    | nei       | 2         | virker     |

**0 axe-brudd i lys og mørk** i lastetilstanden — en tilstand ingen test kjørte
axe på før. Første Tab-stopp er «Hopp til hovedinnhold», ikke noe inne i
skjelettet, og skrivefeltet virker mens skjelettet står. Det siste er hele
grunnen til at gapet finnes (#66, #149), og det er intakt.

### Funnet: kunngjøringen lå i et område som dukket opp med teksten sin

`ThreadLoading` monterte sitt eget `<output className="ds-sr-only">Henter
samtalen</output>`, og hele komponenten kom til syne på én gang. Målt ved
120 ms: elementet fantes, og teksten sto i det fra første avlesning.

Det er mønsteret sjekklista i `docs/review/README.md` advarer mot — et
live-område monteres før innholdet, aldri sammen med det — og det som gjorde
det lett å melde var at **viewet allerede hadde et område som gjør det
riktig**: `ChatView.tsx:576` har en permanent `aria-live="polite"` som bare
bytter tekst, og den sto tom mens lastetilstanden var på skjermen.

Rettet i `298f3ac`, og ført helt ut:

- teksten settes fra en **effekt**, ikke under render, så den blir en endring
  i et område som allerede var der — og det er endringen en skjermleser
  melder, ikke innholdet den finner
- ordene **forsvinner i samme render** som skjelettet, så området ikke blir
  stående og si «Henter samtalen» over en samtale som er kommet
- gated på at det ikke finnes meldinger, så et spørsmål stilt i gapet beholder
  sine egne kunngjøringer

## #157, adressen bærer backendens id

`fix/live-thread-id-from-backend`, `1b6d51a` → `b05b287`. Ni filer.

Hovedfunnet i runde 8: i live skrev appen en adresse med en id klienten fant
på, mens backenden lagret samtalen under sin egen. Samtalen kunne ikke åpnes
igjen av noen, og «Kopier lenke til tråden» kopierte nettopp den adressen.

Målt på wire, live, egen port:

|                                  | runde 8                 | etter #157                       |
| -------------------------------- | ----------------------- | -------------------------------- |
| `POST /api/conversations` svarte | `rskfhAR3otaiib3NJiKfQ` | `xsp7wQtqQlEE_i3SOTh0d`          |
| adressen                         | `/threads/e68ee39e-…`   | `/threads/xsp7wQtqQlEE_i3SOTh0d` |
| gjenåpning etter reload          | **404**                 | **200, samtalen tegnes**         |

Og den andre halvdelen PR-en retter, oppfølging i en lest tråd:

|                                  | før oppfølgingen | etter |
| -------------------------------- | ---------------- | ----- |
| `POST /api/conversations` totalt | 1                | **1** |
| meldinger                        | 2                | 4     |

Hele nettverksloggen for økta er tre kall: én `POST` og to `GET` på samme id.

### Det jeg lette etter, og ikke fant

**Mock-siden.** Mockens lager er nøklet på den id-en klienten fant på, så en
endring av hvem som bestemmer id-en kunne gått rett gjennom live og knekt
mock. Vaktene «en samtale startet på forsida overlever en reload» og «et
spørsmål fra forsida gir samtalen en adresse» er begge grønne, og jeg leste
dem i lista framfor å nøye meg med at suiten var det. Mockens `createThread`
er dessuten synkron, så det finnes ikke et vindu der svaret blir ferdig før
samtalen er navngitt.

**Vakta mot å skrive over en leser som har gått videre** er på plass:
`if (startedRef.current?.id !== placeholder.id) return;` før adopsjonen
brukes. Og feilstien lar stedfortrederen stå, altså nøyaktig det appen gjorde
før dette fantes — en fiks som gjorde en manglende metode til en ødelagt
samtale ville vært verre enn hullet.

## Sammenslåingen, som måtte måles for seg

#156 tegner en lastetilstand når adressen navngir en tråd som ikke er lest.
#157 flytter adressen midt i et svar. Spørsmålet ingen av PR-ene kunne svare
på alene: kan det andre utløse det første?

Målt på 26 avlesninger à 150 ms mens et svar strømmer, fra forsiden:

| Mål                | `main` uten #157 | sammenslåingen      |
| ------------------ | ---------------- | ------------------- |
| skjelett underveis | 0                | **0**               |
| hilsen etter send  | 0                | **0**               |
| adressen           | klientens uuid   | **backendens navn** |

Skjelettet slår ikke inn, og grunnen er den PR-en oppgir: `replaceState` er
usynlig for ruteren, så `threadId` blir stående `undefined` på forsiden
gjennom hele adopsjonen, og `loading` leser nettopp `threadId`.

## Det som står igjen

Vinduet der adressen ennå er stedfortrederen. I mock er det borte før første
avlesning; i live er det rundturen til `POST /api/conversations`, målt til å
være over innen 1,2 s. En leser som rekker «Kopier lenke» der får fortsatt en
død adresse. Det er ikke en innvending mot PR-en — hullet går fra permanent
til et brøkdels sekund — men det er ikke null, og det står i `docs/todo.md`
sammen med identiteten i `ka.user.v1`, som er det egentlige hinderet for å
dele en lenke med noen andre.

## Om min egen måling

Jeg brukte **tre** live-spørsmål på #157 og ikke to. Det første scriptet
krasjet på en `JSON.parse` jeg hadde latt stå halvferdig, etter at spørsmålet
var sendt og besvart — så det ga ingen måling.

Lærdommen er enkel og billig: **prøv scriptet mot mock først**, der spørsmål
er gratis. Jeg gjorde det for sammenslåingsmålingen etterpå, og den satt på
første forsøk.
