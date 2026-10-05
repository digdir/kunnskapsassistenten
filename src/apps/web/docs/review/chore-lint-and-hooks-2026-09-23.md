# PR #159 og #161: linteren og hookene som bærer den

Anmeldt av KA CC 2026-09-23. To PR-er fra samme oppdrag fra Lars: «installere
en slags linter som forteller deg sånt, så du slipper å sjekke selv», og så
«noen pre-commit hooks med stylelint». Den første lager porten, den andre
flytter den til der man committer.

## #159, en linter som sier fra om CSS nettleserne ikke støtter

`chore/css-compat-lint`, `e189851` → `216f5a2`, merget som `4555208`. To
runder: 0 blokkerende, 1 bør og 1 kan i den første, 0 funn i den andre.

### At den er en port, og ikke en advarsel

Målt med en midlertidig fil med uprefikset `line-clamp`, og fjernet etterpå:

| Hva                            | Exit                  |
| ------------------------------ | --------------------- |
| `stylelint` på fila            | **2**                 |
| `npm run lint:css` med fila    | **2**                 |
| `npm run lint` med fila        | **2**                 |
| `npm run lint` uten den        | **0**                 |
| en ren fil (flex, gap, tokens) | **0**, ingen utskrift |

Exit-koden er det som er verdt å ha målt. En linter som skriver en advarsel
og avslutter med 0 er en linter ingen oppdager at de har brutt, og det er
samme klasse som unit-saken fra #117.

Det beste i PR-en er sammenligningen av de to tilleggene, målt mot vår egen
CSS: det caniuse-baserte fanget **ikke** det Lars faktisk så, og meldte fire
ting ingen kan gjøre noe med. Nøkkelen i det valgte er
`allow: { prefix: false }`: MDN fører `line-clamp` som støttet i alle motorer
_med_ `-webkit-`, og med standardinnstillingen tier linteren om nøyaktig den
skrivemåten som ikke virker.

### bør: nettleserlista var blitt en policy ingen hadde bestemt

`package.json` sa `last 2 versions`. `npx browserslist` ga ti nettlesere,
ingenting eldre enn Safari 26.5. To grunner til at det var verdt en
avgjørelse: lista er hele linterens virkelighet, så den kan aldri si fra om
det som brekker på en iPhone som har sluttet å få oppdateringer — og den var
det eneste stedet i repoet som sa hvilke nettlesere vi støtter. Jeg fant ingen
uttalt policy i `README.md`, `CONTRIBUTING.md` eller `design/`.

Rettet i `216f5a2`: `.browserslistrc` med `defaults, not dead, Safari >= 16,
iOS >= 16`, bekreftet av Lars, og med grunnen i fila. At den ligger for seg
selv er riktig av den grunnen som står der: JSON tåler ikke en begrunnelse.

### kan: `&&` skjulte CSS-feil bak JS-feil

`oxlint && lint:css` sjekket ikke CSS-en når JS var rød. Rettet i samme sha,
og målt i alle tre tilfellene, som er det eneste som skiller en kombinert
exit-kode fra en som ser kombinert ut:

| Hva er rødt | Exit  | Kjørte begge?                  |
| ----------- | ----- | ------------------------------ |
| bare JS     | **1** | ja                             |
| bare CSS    | **2** | ja                             |
| begge       | **2** | ja, begge feilene i utskriften |

### Lista er bredere enn garantien

`npx browserslist` løser nå til **81** nettlesere, med `op_mini all`, `kaios`
og `and_uc` via `defaults`. Målt: `position: sticky`, `var()` og
`display: grid` gir ingen treff, selv om Opera Mini ikke støtter noen av dem.
Tillegget sjekker i praksis fem motorer: Chrome, Edge, Firefox, Safari og iOS
Safari. Det er ikke en feil — ellers ville hver fil i repoet vært rød — men de
81 er ikke et løfte om støtte.

### Linterens første ekte fangst

`--ka-target-grow: max(0px, calc(24px - 1lh))` fra #142 løfter «Vis mer om
korpuset» til 24 px treffhøyde (WCAG 2.5.8). `lh` kom i Safari 16.4, så i
16.0–16.3 faller hele verdien bort, paddingen blir 0 og knappen er tilbake på
21 px. Kommentaren i koden lovet en reserve «den dagen noen måler at det betyr
noe». Med iOS 16 innenfor policyen er den dagen nå, og reserven kom med #160.

## #161, pre-commit og pre-push

`chore/git-hooks`, `b0ac014` → `65f208f`, merget som `2d01fa1`. To runder: 2
blokkerende i den første, 0 funn i den andre.

### Målt i en egen klone, ikke i et arbeidstre

`prepare` kjører `simple-git-hooks` på `npm install`, og arbeidstrærne deler
`.git/hooks`. En måling i arbeidstreet mitt ville installert hooken for alle
fire de andre midt i arbeidet deres — det var nettopp det som hadde skjedd
dagen før (#5 ryddet og skrev regelen). Jeg sjekket den delte mappa før og
etter begge rundene: bare `.sample`-filer.

### blokkerer 1: grenen lot seg ikke installere

```
npm error Missing: yaml@2.9.1 from lock file
```

`lint-staged` drar inn `yaml`, og låsefila manglet den. `npm ci` var exit 0 på
`main` og exit 1 på grenen, og CI døde på det etter 8 sekunder.

**Mine fem porter var grønne likevel.** De kjører mot et `node_modules` som
alt står der. Installerbarhet er ikke en av portene — `npm ci` er den, og CI
kjører den først. Står nå under «Sånn går en review» i README.

### blokkerer 2: vakta sto inne i det den skulle vokte

Hooken lovet «ukjent på grenen → exit 0». Med hooken installert og
`origin/main` sjekket ut:

```
sh: scripts/hooks/pre-commit.sh: No such file or directory
exit=1
```

Vakta lå inne i skriptet, og skriptet er det som ikke finnes på en gren fra
før PR-en. Det er samme utfall som PR-en ble skrevet for å hindre (#2 måtte
bruke `SKIP_SIMPLE_GIT_HOOKS=1`), og det ville truffet nøyaktig mens noen
hadde installert hooken og andre sto på grener som ikke kjente den. Rettet i
`65f208f` ved å legge vakta i hook-kommandoen i `package.json`:

```sh
[ -f scripts/hooks/pre-commit.sh ] || exit 0; sh scripts/hooks/pre-commit.sh
```

### Runde 2, samme metode

| Hva                                      | Runde 1                     | Runde 2                  |
| ---------------------------------------- | --------------------------- | ------------------------ |
| `npm ci` på grenen                       | **exit 1**, «Missing: yaml» | **exit 0**               |
| hookene installert                       | —                           | `pre-commit`, `pre-push` |
| commit med uprefikset `line-clamp`       | exit 1                      | **exit 1**               |
| commit på `origin/main`, hook installert | **exit 1**, «No such file»  | **exit 0**, 39 ms        |
| delte `.git/hooks` etterpå               | rene                        | **rene**                 |

39 ms er det riktige tallet: hooken avslutter uten å starte noe.

### Riktig, og hvor jeg sjekket det

- **`pre-push` er `tsc -b` og ikke vitest**, begrunnet med 47,9 s mot 3. En
  hook som legger et minutt på hver push er en hook folk slår av, og da
  mister man `tsc` også.
- **Prettier kjører med `--check` og ikke `--write`**, så hooken endrer ikke
  filer under føttene på den som committer.
- **Ren commit er 1,1 s i steady state.** Den første var 7 s, og jeg målte tre
  til før jeg skrev det ned: det er `lint-staged` sitt eget oppsett første
  gang, ikke kostnaden.

## Etter merge

Målt i mitt eget arbeidstre på `main` `2d01fa1`: `npm install` exit 0,
`lint-staged` på plass, og den delte `.git/hooks` har `pre-commit` og
`pre-push` med vakta i kommandoen. Denne rapporten er committet gjennom
hooken: prettier-sjekken på den stagede fila, 0,78 s.

## Om min egen måling

E2E-suiten på #159 runde 1 ble startet på load 18,36, over grensen på 8 som er
min egen regel. Den ga 151/151 og exit 0, så den er ikke falsk — men tallet
skal stå her, siden jeg ikke leste det før jeg startet.
