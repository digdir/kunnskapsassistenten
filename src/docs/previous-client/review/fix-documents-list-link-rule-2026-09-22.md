# PR #146, dokumentet uten adresse sier hvorfor

Branch `fix/documents-list-link-rule`, anmeldt 2026-09-22 i to runder,
`1133be0` og `ce0dd56`. To filer i `src/views/filters/`.

Lukker brukerblikk 7 funn 2: lista over dokumentene svaret bygger på tegnet
noen titler som lenker og noen som svart tekst, uten at noe sa hvorfor.
Kildepanelet har sagt det om det samme dokumentet hele tiden.

## Portene

| Port            | Runde 1 (`1133be0`) | Runde 2 (`ce0dd56`)      |
| --------------- | ------------------- | ------------------------ |
| `build`         | exit 0              | exit 0                   |
| `lint`          | exit 0              | exit 0                   |
| `format:check`  | exit 0              | exit 0                   |
| `tokens:verify` | exit 0              | exit 0                   |
| `npm test`      | exit 0, 879         | exit 0, **885**          |
| e2e (4173)      | exit 0, 151         | ikke kjørt, etter avtale |

## Funn

### 1. Notatet tar en linje, og kommentaren sa at det ikke gjorde det — **bør**

Kommentaren over konstanten lovet at setningen «joins the type, the
organisation and the year on the row's own small line rather than taking a
line of its own from a panel that is over its height budget».

Målt med samme script på begge sider, 1440 px, navigasjonspanelet 400 px:

| Mål                | `main` | #146 runde 1 |
| ------------------ | ------ | ------------ |
| linjer i metalinja | 1      | **2**        |
| radhøyde           | 62     | **80**       |
| listehøyde         | 293    | **311**      |

Den tar ikke en egen **rad**, men den bryter til en linje til, og raden vokser
18 px. Det er ikke i seg selv mye. Det som gjorde det til en «bør» er hvem det
gjelder: setningen finnes for **mappebaserte korpus, der ingen dokumenter har
adresse**, og der får hver eneste rad den. Fem synlige rader er ~90 px i et
panel PR-en selv beskriver som over høydebudsjettet. Mock-korpuset, med én
rad av tre uten adresse, er det minste tilfellet og ikke det største.

**Rettet på en bedre måte enn den ble meldt.** Jeg ba om at kommentaren og
målingen skulle bli enige. #2 målte i stedet båndet der ordvalget avgjør:
linja er 306 px, «, uten lenke» tar 66 av dem mot setningens 123, og det gir
rundt 57 px med egenskaper der den korte formen står på én linje og den lange
ville brutt. Utenfor det båndet endrer ordvalget ingenting, og mock-korpuset
er utenfor i begge retninger. Kommentaren sier nå at de 18 pikslene er prisen
for å si det i det hele tatt.

Det er forskjellen på en kommentar som forklarer og en som beroliger: den
neste som kommer forbi har et tall å regne med i stedet for en påstand å tro
på.

### 2. Skilletegnet bar to slags opplysninger — **kan**

«Årsrapport · Nasjonal kommunikasjonsmyndighet · 2024 · Ingen offentlig
lenke»: de tre første er egenskaper ved dokumentet, den fjerde er en egenskap
ved lenka. Samme form som kan 4 på #138, der valget én PR tidligere ble å
skille dem.

Rettet med komma i runde 2, og begrunnelsen står i koden: punktene skiller hva
dokumentet **er**, og dette er ikke en fjerde egenskap ved dokumentet. Det
leser også bedre som én setning for en skjermleser enn en firedelt punktliste
gjorde.

### 3. To strenger som skal si det samme, i to mapper — **kan**

Kommentaren begrunner duplikatet med at views ikke kan importere fra
hverandre. Det stemmer, men det er ikke det eneste alternativet: `src/model/`
er det delte hjemmet, og sjekklista i `docs/review/README.md` sier at norsk
brukertekst bor der, slik `relevanceLabels` viser mønsteret.

Samtidig ligger `OWN_DOCUMENT_NO_LINK` allerede i
`src/views/sources/origin.ts`, så praksisen i repoet peker motsatt vei — og de
to strengene er ulike med vilje, kort og lang, så «må stemme overens» er
svakere enn det høres ut. Står åpen hos #5, ikke som en rest her.

## Riktig, og hvor jeg sjekket det

- **Raden med adresse er urørt.** Målt før og etter: «Årsrapport · Nasjonal
  kommunikasjonsmyndighet · 2025» og «Tildelingsbrev · Digitaliserings- og
  forvaltningsdepartementet · 2026», begge fortsatt lenker, begge uendret.
- **Listehøyden vokser nøyaktig det den ene raden vokser**, 18 px. Ingenting
  annet i lista flyttet seg.
- **Tilfellet uten metadata er dekket av en test**, og fikk sin egen konstant
  med stor forbokstav i runde 2 — `NO_LINK_ALONE` — fordi notatet da starter
  linja. Et hjørne jeg ikke ba om.

## Til dirigenten

Ingen rest. Kan 3 ligger hos #5 som en delt streng, ikke som en mangel her.
