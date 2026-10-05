# PR #60, søk i svaret: rebasen bar begge fiksene, og kontrollen oppfører seg

2026-09-15, anmelderen (KA CC). Gren `1010ad2`, rebaset av #3 etter #57 og
#59; `git merge` mot `main` `595568e` sier «Already up to date», altså ingen
konflikt igjen. Målt på den, 1440 × 900.

**Ingen blokkerende, ingen «bør».**

## Portene

| Port                                                | Resultat                            |
| --------------------------------------------------- | ----------------------------------- |
| `build` / `lint` / `format:check` / `tokens:verify` | grønne                              |
| `npm test`                                          | grønn, **452 i 43 filer**           |
| `npm run test:e2e`                                  | grønn, **122 på 55,4 s**, 8 workers |

## Det jeg ba om før rebasen, etterprøvd

`AnswerMessage.tsx` skulle bære tre ting videre fra fiksene som lå i
`MessageList.tsx`. Alle tre er der:

| Fra | Hva                                              | Linje i `AnswerMessage.tsx` |
| --- | ------------------------------------------------ | --------------------------- |
| #59 | `showCard = !empty \|\| streaming \|\| aborted`  | 92                          |
| #59 | `{empty ? ABORTED_BEFORE_ANSWER : ABORTED_NOTE}` | 197                         |
| #57 | `complete && !empty && !foundNothing`            | 201                         |

`foundNothing` er dessuten blitt en `boolean` i komponenten og regnes ut per
melding-id på kallstedet (`foundNothing?.(message.id)`), som er den riktige
formen for en komponent som tegner én melding.

## Kontrollen, målt

Åpnet søket i NKOM-svaret og skrev «måloppnåelse»:

| Det jeg prøvde                      | Det jeg fikk                                                        |
| ----------------------------------- | ------------------------------------------------------------------- |
| teller før åpning                   | finnes ikke                                                         |
| ved åpning                          | fokus i feltet, teller montert **tom**, `aria-live="polite"`        |
| stegning framover                   | 1 → 2 → 3 → 4 → 5 av 5                                              |
| stegning bakover                    | 4 → 3 → 2 → 1 av 5                                                  |
| ved siste treff                     | «Neste» får `aria-disabled="true"`                                  |
| ved første treff                    | «Forrige» får `aria-disabled="true"`                                |
| ekte `disabled`-attributt           | **0 knapper** — som det skal være                                   |
| klikk på en `aria-disabled` «Neste» | teller uendret, «5 av 5 treff»                                      |
| Tab fra feltet                      | Tøm → Forrige → Neste → Lukk → skrivefeltet                         |
| Escape                              | stripa lukkes, merkene fjernes, **fokus tilbake på «Søk i svaret»** |
| lukkeknappen                        | samme                                                               |
| `data-current`                      | står på riktig merke etter stegningen                               |

Tre ting er verdt å fremheve fordi de er lette å gjøre feil:

1. **Live-området monteres tomt og fylles etterpå.** `<p aria-live="polite">`
   er der fra første render med `status = ''`. Det er mønsteret `README.md`
   krever, og det er grunnen til at «2 av 5 treff» faktisk kunngjøres.
2. **`aria-disabled`, ikke `disabled`.** Begge stegknappene beholder
   tabbstoppet sitt i enden, og klikket er avvæpnet i håndtereren
   (`!atFirst && onStep(-1)`). Målt begge deler.
3. **Fokus kommer tilbake dit det kom fra.** Både Escape og lukkeknappen
   setter fokus på knappen som åpnet stripa. En kontroll som avmonterer seg
   selv er nettopp den fella sjekklista har en egen linje om.

Og knappen som åpner: `MagnifyingGlassIcon aria-hidden` med synlig tekst «Søk
i svaret» og `aria-expanded` som sier hva stripa under gjør. Riktig på alle
tre.

## En felle i målingen, ikke i koden

Playwright regner `aria-disabled="true"` som **ikke enabled**: `isEnabled()`
ga `false`, og et vanlig `click()` på «Neste» i enden står og venter til det
tidsavbrytes med «element is not enabled». Første måling min brukte derfor
`click({ force: true })`, og da traff ett av klikkene ved siden av fordi
stripa ruller med den myke rullingen til treffet — jeg fikk «2 av 5» to
ganger på rad og trodde et steg var slukt. Med vanlige klikk, som venter på at
knappen står stille, går den 1 → 2 → 3 → 4 → 5 uten hull.

#3 sin egen spec gjør det riktig fra før: `toHaveAttribute('aria-disabled',
'true')`, ikke `toBeDisabled()`. Jeg legger fella i `docs/review/README.md`.

## Til dirigenten

**PR #60 er klar for Lars.** Rebasen er den grundigste i bølgen: den bar to
fikser fra en fil som ble tømt, og begge er verifisert på linjenivå.
