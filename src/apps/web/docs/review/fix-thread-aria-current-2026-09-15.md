# PR #63, `fix/thread-aria-current`: fiksen virker, og den avdekker naboen sin

2026-09-15, anmelderen (KA CC). Gren `e9dff1a`, rebaset på `main` `6272d14`;
`git merge` sier «Already up to date». Målt på den, 1440 × 900.

**Ingen blokkerende, ingen «bør».** Én «kan» som er eldre enn PR-en og som
denne endringen er det som gjør synlig.

## Portene

| Port                                                | Resultat                                            |
| --------------------------------------------------- | --------------------------------------------------- |
| `build` / `lint` / `format:check` / `tokens:verify` | grønne                                              |
| `npm test`                                          | grønn, **462 i 44 filer**                           |
| `npm run test:e2e`                                  | grønn, **123 + 1 hoppet** på 1,7 min, **4 workers** |

Den ene hoppede er min egen `fixme`, som denne PR-en er grunnen til å fjerne.
Og suiten kjørte med fire arbeidere, altså er capen fra #64 i drift.

## Testen min vokter faktisk denne endringen

Det var poenget med «bør» nummer 1 i anmeldelsen av #57 — en test som er grønn
uten fiksen låser ingenting. Denne er ikke det. Samme test, samme fil, to
commits:

| Kjørt mot        | Resultat                                                        |
| ---------------- | --------------------------------------------------------------- |
| `main` `6272d14` | **rød**: `toHaveAttribute('aria-current')` fikk `""`, linje 459 |
| PR #63 `e9dff1a` | **grønn**, 11,5 s                                               |

## Hva som er merket, i hver tilstand

| Tilstand                                 | `main` | PR #63 |
| ---------------------------------------- | ------ | ------ |
| Forsida, ingen samtale                   | ingen  | ingen  |
| Tråd åpnet fra lista                     | 1      | **1**  |
| Ukjent rute (`/tull`)                    | ingen  | ingen  |
| Ukjent tråd-id                           | ingen  | ingen  |
| Tilbake til forsida etter en åpen tråd   | ingen  | ingen  |
| Egen fersk tråd, lista åpnet **etterpå** | ingen  | **1**  |
| Egen fersk tråd, etter panelbytte        | ingen  | **1**  |

Oppryddingen koden lover holder: en rute uten samtale lar ikke forrige tråd
stå merket, og det er aldri mer enn én merket om gangen. Det er
`useReportOpenThread` sin `return () => setOpenThreadId(undefined)` som gjør
den jobben, og den er verdt å ha målt.

Løsningen er dessuten riktig sted: skallet vet hvilken samtale som er på
skjermen uansett hvordan adressen kom dit, og `NavLink` kunne per definisjon
ikke vite det, siden `history.replaceState` aldri når ruteren.

## Kan

### 1. En tråd laget mens lista står åpen dukker ikke opp i lista

Målt på **både** `main` og PR #63, så dette er ikke noe denne endringen har
gjort — men det er denne endringen som gjør det synlig, fordi alt annet nå er
merket riktig.

| Rekkefølge                           | `main`   | PR #63       | Rader i lista |
| ------------------------------------ | -------- | ------------ | ------------- |
| A: spør, **så** åpne trådlista       | 0 merket | **1 merket** | 12            |
| B: trådlista **åpen**, så spør       | 0 merket | 0 merket     | **11**        |
| C: som B, bytt til filter og tilbake | 0 merket | **1 merket** | 12            |

Legg merke til radtallet i B: **11**, og første rad er `nkom-maaloppnaaelse`.
Tråden finnes altså ikke i lista i det hele tatt — det er ikke merkingen som
svikter, det er at `ThreadsView` henter trådene én gang når den monteres og
aldri igjen. Bytter du panel og tilbake (C), monteres viewet på nytt, lista
henter igjen, og da er både raden og merket der.

For en leser: du ser på trådene dine, du stiller et spørsmål, svaret kommer —
og lista ved siden av later som ingenting har skjedd til du klikker deg vekk
og tilbake.

Eier er #2 (`ThreadsView`), men det trenger et signal fra skallet om at det er
kommet en tråd, på samme form som `openThreadContext` her. Verdt å se de to i
sammenheng.

**Min egen test dekker bare rekkefølge A.** Jeg utvider den til B når
oppfriskningen finnes; en test for B nå ville vært rød av en eldre grunn enn
den påstanden den skulle bære.

## Til dirigenten

- **PR #63 er klar for Lars.** Ingen blokkerende, ingen «bør».
- Jeg fjerner `fixme`-en i en egen liten PR rett etter denne, ikke ved å pushe
  til #5 sin gren: `tests/` er min, og en push dit ville dessuten gjort
  målingen deres på 124/124 ugyldig.
- **Funn 1 over bør få en eier.** Den er liten i kode og stor for den som
  bruker appen, og den står nå alene igjen i denne flyten.
