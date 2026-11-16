# PR #82, `fix/chat-blikk3`: søkestripa i view-hodet, og to ting til fra runde 3

2026-09-16, anmelderen (KA CC). Anmeldt på `1a06c30` slått sammen med
`origin/main` (`a241fc7`) — sammenslåingen er fast-forward, så det som måles er
det som merges. Bygget app på `vite preview` 5184, 1440 × 900 og 1280 × 720,
lys og mørk.

Svarer på brukerblikk runde 3, funn 1, 3 og 6.

## Portene

| Port             | Resultat                                    |
| ---------------- | ------------------------------------------- |
| `build`          | grønt                                       |
| `lint`           | grønt                                       |
| `format:check`   | grønt                                       |
| `tokens:verify`  | grønt                                       |
| `test` (vitest)  | 539 av 539, 53 filer                        |
| `test:e2e`       | **128 av 128**, 1,9 min, port 4173, CI=true |
| axe, stripa åpen | **0 brudd**, lys og mørk                    |

Elleve filer, og de to utenfor `src/views/chat/` er de to beskrivelsen
navngir med dirigentens unntak: `src/components/Markdown.tsx` (ett ord) og
`src/api/mock/MockChatClient.ts` (lagringsstien fra #76). Ingenting annet.

## Funn 1 er lukket

Målt på 1440 × 900, samme handling som i rapporten:

|                                  | runde 3                    | nå                     |
| -------------------------------- | -------------------------- | ---------------------- |
| søkefeltet                       | y = 685–727                | **y = 32–74**          |
| `elementFromPoint` midt i feltet | `DIV.ka-composer__buttons` | **`INPUT.ds-input`**   |
| telleren                         | bak skrivefeltet           | synlig, «1 av 2 treff» |
| skrivefeltets overkant           | y = 610                    | y = 623                |

Hodet er `position: sticky` og blir stående gjennom «Neste treff»; feltet står
på y = 32 både før og etter. Stripa sier «Søk i svar 1 av 2» med to svar i
tråden og «Søk i svaret» med ett — målt begge.

Tre ting til, målt fordi de er nye tilstander og ikke fordi jeg tvilte:

- **Tab-rekkefølgen i hovedkolonnen** er stripa først og så innholdet:
  `INPUT · Tøm · Forrige treff i svaret · Neste treff i svaret · Lukk søk i
svaret · Tabell · Kilde 1 … · Kilde 3 …`. Portalen og DOM-en er enige, som
  kommentaren i `AnswerMessage.tsx` sier den har sørget for.
- **Escape** lukker stripa og gir fokus tilbake til «Søk i svaret».
- **Bytter du tråd med søket åpent**, lukkes stripa og markeringene forsvinner.
  Ingen rest fra forrige samtale.
- Vekslingsknappen har `aria-expanded`, så tilstanden finnes for skjermleser
  selv om navnet er det samme åpen og lukket.

Én-om-gangen-oppførselen er en reell endring og står i beskrivelsen. Målt: å
åpne søket på svar 2 lukker det på svar 1, tømmer feltet og fjerner svar 1
sine markeringer. Det er det en enkelt festet stripe ser ut som, og jeg har
ingen innvending.

## Funn 3 er lukket

```
i hvile          klasse «markdown__table ds-focus»   outline: none      :focus-visible false
med fokus        outline: rgb(31,44,61) solid 3px    :focus-visible true
```

`tabIndex={0}` står, så den rullende boksen er fortsatt nåbar.

## Funn 6 er lukket, i begge stopptilfellene

```
stoppet FØR første ord     før reload «Tenkte i 6 sekunder»   etter «Tenkte i 6 sekunder»
stoppet MIDT i strømmen    før reload «Tenkte i 2 sekunder»   etter «Tenkte i 2 sekunder»
                           690 tegn svartekst begge ganger
```

Det andre tilfellet er det beskrivelsen selv peker på som risikoen — en lagret
tid og en utregnet tid som spriker, altså runde 2 punkt 5 om igjen. Den spriker
ikke.

## Funn

### 1. Svaret ruller gjennom et 32 px bånd over den festede stripa — bør

**1440 × 900 og 1280 × 720, begge moduser.** `blikk3/pr82-05-hodet-og-gapet-1440x900-light.png`

Hovedregionen har `padding-block-start`, så view-hodet begynner på y = 32 og
ikke på 0. Over det er det ikke bakgrunn, men svar:

```
main.getBoundingClientRect().top        0
.view-head.getBoundingClientRect().top  32
elementFromPoint(x, 4)   → P.ds-paragraph
elementFromPoint(x, 12)  → P.ds-paragraph
elementFromPoint(x, 24)  → P.ds-paragraph      (1280: DIV.markdown)
```

På skjermbildet står linja «og Nye Altinn [1].» over stripa, og linja under
den er klippet på midten av stripas underkant. En stripe som er festet for å
være synlig har altså tekst som løper forbi over den.

Ikke innført av denne PR-en i den forstand at paddingen var der før — men den
var usynlig så lenge hovedregionens view-hode var tomt, og denne PR-en er det
som fyller den. Dirigenten har alt lagt den ut som **#83**
(`fix/view-head-padding`), så den er eid. Jeg måler den der.

## Til dirigenten

Ingen blokkerende, ingen «kan». Ett «bør», og det er allerede #83.

Tre funn fra runde 3 er lukket, og de er lukket på den måten rapporten ba om:
funn 1 i den plassen #74 laget for det, funn 3 med ett ord, funn 6 uten å
gjenåpne runde 2 punkt 5. Suiten er 128/128 på sammenslåingen, målt her.
