# PR #31, panelhode som ikke ruller, og en flate som faktisk skiller

2026-09-15, anmelderen (KA CC). `feat/panel-scroll` @ `ef0abbc`
(`cf5343d`, `37afba0`, `ef0abbc`). Fasit:
`design/_briefs/bygg/rolle-5f-brukerblikk.md`, brukerblikk-funn 2, 4, 7 og 15.

**Klar. Ingen blokkerende.** Alle fire funnene er rettet, og målt rettet.

## Portene

| Sjekk                                               | Resultat                     |
| --------------------------------------------------- | ---------------------------- |
| `build` / `lint` / `format:check` / `tokens:verify` | OK                           |
| `npm test`                                          | 130 tester, 17 filer, grønne |
| `npm run test:e2e`                                  | 56 grønne, 0 røde            |
| axe (`a11y.sh`, 1440, begge ruter, lys og mørk)     | **0 brudd**                  |

## De fire funnene, målt

Kildepanelet åpnet med en kildemarkør, 1440, som er tilstanden funnet ble
gjort i:

| Funn                                         | Før                                            | Etter                                                                                |
| -------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| **2** «Skjul kilder» ruller ut av vinduet    | knappen på **y = −955**, panelet rullet 987 px | knappen på **y = 32, i vinduet**, mens `.sidebar-content` er rullet 756 px           |
| **7** innholdet klippet uten rulleindikasjon | hele plassen rullet                            | rullingen ligger på innholdsregionen, hodet står                                     |
| **4** navigasjonspanelet uten flate i mørk   | kant **1,73:1** mot grunnen, 1,91 mot flata    | kant **3,95:1** mot grunnen i lys, **4,23:1** i mørk                                 |
| **15** kildepanelet uten egen flate          | asymmetrisk med vilje                          | Lars sin linje: panelet deler hovedkolonnens grunn. Målt `rgba(0, 0, 0, 0)` på begge |

Funn 4 er verdt en setning ekstra. Flata mot grunnen er fortsatt 1,10 i lys
og 1,11 i mørk — det er kanten som gjør jobben nå, og den er over 3:1 i begge
moduser, som er terskelen for et grafisk element. Det er riktig løsning på
riktig sted: det var aldri flata som skulle skille to nesten like mørke
farger.

## Flatesplitten er dokumentert

Jeg ba om at den ble skrevet ned, siden railen har flate og det åpne
kildepanelet ikke har det. Den står i `global.css`:

> A rail keeps a surface whichever column it is, including the sources panel
> that has none while open. That is the point of the rail: a folded column has
> to read as a column, and on the page's own ground it read as a hole (Lars,
> 2026-09-15). Open, the sources panel is not folded away and has the answer
> beside it to belong to.

Målt: begge railer har panelflate i begge moduser (`rgb(255,255,255)` /
`rgb(32,40,52)`), det åpne kildepanelet har ingen. Bevisst, begrunnet, og nå
umulig å «rette» ved et uhell.

## 380 og ikke 400

Utledningen er et ekte funn og verdt å ha: en container query spør om
containerens **innholdsboks**, så det 400 px brede navigasjonspanelet svarer
399 fordi det bruker en piksel på sin egen kant — og `width < 400px` traff det
også, og ga det bredeste panelet den smaleste paddingen. 380 ligger klar av
både kildepanelets gulv på 336 og navigasjonspanelets 399.

Hodet og innholdet får samme padding, så de står på linje: målt hode-x 1105,
knapp-x 1125, kort-x 1126.

## Kan

### 1. Paddingregelen snur tekstbredden på hodet

Prøvemerget med #24 og målt, som er tilstanden begge lander i:

| Bredde | Panel         | Padding | Utdragets tekstkolonne |
| ------ | ------------- | ------- | ---------------------- |
| 1440   | 336 (klemt)   | 20 px   | **277 px**, 18 linjer  |
| 1536   | 432 (romslig) | 36 px   | **269 px**, 18 linjer  |

`278` i kommentaren stemmer på pikselen — fint målt av #5.

Men resultatet er at det **klemte** panelet setter tekst i en bredere spalte
enn det romslige. 336-panelet får 20 px padding og kompakt kortlayout fra #24;
432-panelet får 36 px og romslig. Netto åtte piksler i favør av det smale.

Åtte piksler er ingenting å se på, og ingen av tallene er gale hver for seg.
Men intensjonen — «mer plass gir romsligere tekst» — er snudd nøyaktig ved
grensa, og det er den slags som ser ut som en feil hvis noen måler den senere
uten å vite hvorfor. Enten senk paddingen litt over 380 også, eller skriv
inversjonen inn der terskelen står.

## Det som er riktig, og hvor jeg sjekket det

- **Hodet er sticky, ikke fast.** Det ruller med når plassen er kortere enn
  innholdet og stopper i toppen, i stedet for å legge beslag på høyde den
  ikke trenger.
- **Paddingen flyttet fra plassen til hodet og innholdet**, som er det som
  lar innholdsregionen rulle under et hode som står stille uten at teksten
  klippes i kanten.
- **Railen har egen padding** (`--ka-rail-padding-inline`, de 24 i
  `railWidth`), så container query-en ikke gir den smalpanel-paddingen.
- `--ka-panel-border` er én variabel begge plassene leser, så kanten ikke kan
  drifte fra hverandre.
- Ingen heksfarger, ingen nye tallverdier i px, ingen `!important`.
- Tre filer, alle #5 sine. `tests/` er urørt.

## Til dirigenten

1. **Klar for Lars.**
2. Funn 1 er en åtte-pikslers inversjon og ikke noe som haster. Verdt å ta
   når noen likevel er inne i den terskelen.
3. Med #24 og #31 sammen er brukerblikk-funn 1 nede fra 174 til **277 px** på
   1440 — fra 30 linjer til 18 for samme avsnitt. Det er der jeg ville stoppet.
