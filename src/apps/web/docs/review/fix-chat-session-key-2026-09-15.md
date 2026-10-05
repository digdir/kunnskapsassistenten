# PR #66, `fix/chat-session-key`: utkastet overlever, og samtalen kommer likevel

2026-09-15, anmelderen (KA CC). Gren `00919c5`; `git merge` mot `main`
`cbd623f` sier «Already up to date». Målt på den, 1440 × 900.

**Ingen blokkerende, ingen «bør».** Én «kan» som er en forbedring mot `main`,
ikke en forverring.

## Portene

| Port                                                | Resultat                                                   |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `build` / `lint` / `format:check` / `tokens:verify` | grønne                                                     |
| `npm test`                                          | grønn, **465 i 44 filer**                                  |
| `npm run test:e2e`                                  | **full suite grønn: 123 + 1 hoppet** på 1,6 min, 4 workers |

Den hoppede er min `fixme`, som ligger i #65.

## Feilen og fiksen, målt på begge sider

Reisen: gå til `/threads/nkom-maaloppnaaelse`, og skriv i feltet **før**
`getThread` har svart. Elementet er merket med et `data`-attributt først, så
en utbytting er synlig.

|                        | `main` `cbd623f`        | PR #66                      |
| ---------------------- | ----------------------- | --------------------------- |
| Rett etter skrivingen  | «utkastet mitt», merket | «utkastet mitt», merket     |
| Etter at tråden landet | **«», merket borte**    | **«utkastet mitt», merket** |
| Samtalen kom likevel   | ja                      | ja                          |

På `main` er både teksten og selve elementet borte — det er remounten, målt
direkte og ikke utledet. På denne grenen står begge deler, og den lagrede
samtalen kommer inn ved siden av.

Det forklarer også CI: remounten falt midt i testens tastetrykk, og de to
påstandene som falt — `toHaveValue('a/b')` og oppslaget gjennom
`aria-describedby` — leste begge tom streng fra et element som ikke var i
dokumentet lenger, mens sidebildet viste innholdet stå der.

## Reload-reisen står

Fra anmeldelsen av #57, uendret av denne PR-en:

|           | før reload            | etter reload          |
| --------- | --------------------- | --------------------- |
| kildekort | 3                     | 3                     |
| tenketid  | «Tenkte i 4 sekunder» | «Tenkte i 4 sekunder» |
| markører  | 7                     | 7                     |

## Ingen lekkasje mellom tråder

Det er risikoen ved å fjerne en `key`, så den er målt:

| Steg          | Samtale på skjermen | Utkast            |
| ------------- | ------------------- | ----------------- |
| Tråd A        | A sin               | «utkast i tråd A» |
| Til tråd B    | **B sin**           | tomt              |
| Tilbake til A | **A sin**           | tomt              |
| Forsida       | ingen, «Hei 👋»     | tomt              |

`ChatSlotView` sin `<ChatSlot key={threadId}>` gjør altså jobben den fjernede
gjorde, akkurat som kommentaren sier. Den ene overgangen den _ikke_ dekker —
«ingen tråd» → «denne tråden» — er nettopp den som ikke er et bytte av samtale.

## Kan

### 1. En tur startet før tråden lander skjuler den lagrede samtalen

Målt: gå til `/threads/nkom-maaloppnaaelse`, still et spørsmål før
`getThread` svarer, og du sitter igjen med **ett** spørsmål og **ett** svar —
ditt eget. Den lagrede samtalen adopteres ikke, fordi `messages` ikke er tom,
og den kommer ikke fram før neste lasting.

Det er bevisst og det er dokumentert i koden. Og det er **bedre enn `main`**,
der samme reise ga motsatt tap: der ble leserens eget spørsmål erstattet av
den lagrede samtalen («Du skrev: Hvordan jobber Nasjonal
kommunikasjonsmyndighet …» der jeg hadde skrevet «Hva sier rapporten?»). Av de
to er dette det riktige å miste.

Den fullstendige løsningen ville vært å legge den lagrede samtalen **foran**
den nye turen i stedet for å droppe den, men det er en større endring med
rekkefølge og id-er å bli enig om. Verdt å vite at kanten finnes.

## Det som er riktig

- **Signaturen sammenlikner innhold, ikke referanse.** `initialMessages` har
  `[]` som standard, altså en ny array per kall, så en referansesjekk ville
  sagt «ny tråd» hver render og løkket. Lengde pluss siste id skiller en tråd
  som har vokst fra en som er levert to ganger. Riktig, og begrunnet der den
  står.
- **Justert under render, ikke i en effekt.** En effekt ville tegnet den tomme
  samtalen én gang først. Det er React sitt eget svar på «en prop endret seg og
  state må følge etter».
- **Adopsjon bare inn i en tom samtale.** En tråd som lander sent skal ikke
  overskrive en tur som alt er i gang — og det er nøyaktig det `main` gjorde.

## Til dirigenten

**PR #66 er klar for Lars.** Den retter en ekte feil som testen fant, og full
suite er kjørt (123 + 1 hoppet). Når den er merget rebaser jeg #65 og kjører CI.
