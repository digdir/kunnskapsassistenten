# Kunnskapsassistenten, applikasjonen

**Frontenden til Kunnskapsassistenten, bygd på `digdir-headless-rag`.**

Samme produkt, samme brukeropplevelse, ny teknologi og en annen backend. Den
skal kunne kjøres ved siden av den "gamle"
[Kunnskapsassistenten](https://test.kunnskap.digdir.cloud) og sammenlignes med
den. Selve poenget er byttet: hold frontenden konstant, bytt motoren under, og
finn ut hva den nye backenden faktisk klarer.

**Porten er gjennomført.** Klienten er skrevet om fra bunnen i Preact, snakker
med `digdir-headless-rag` over det offentlige API-et, og gir svar med kilder
mot Kudos-korpuset: tråder, strømmede svar med statusetiketter, kildepanel med
utdrag, filtre og innlogging. Underveis ga det elleve dokumenterte hull i
backendens offentlige kontrakt, og noe for [`../evals`](../evals) å kjøre mot.

## Utrullet

<https://qa.kunnskap.digdir.cloud>

Logg inn med Entra ID. Kontoer som finnes i tenanten slipper inn.

To ting er ikke på plass i det utrullede miljøet, og begge ligger i backenden,
ikke her:

- **Svar.** `test.rag.digdir.cloud` tilbyr bare `fact-checker` og
  `retrieve-only`, og avviser de agentiske RAG-modusene med `mode_not_allowed`.
  Appen er koblet opp og klar; den dagen agenten er slått på der, svarer den.
- **Filtre.** Den utrullede backenden tar ikke imot filteret fra klienten, så
  chipsene vises deaktivert med en forklaring. De slår seg på av seg selv når
  backenden begynner å ta imot dem, uten ny utrulling.

Mot en lokal backend med de foreslåtte endringene virker begge deler, og det
er der sammenligningen mot dagens Kunnskapsassistent gjøres.

```
apps/web           Vite + Preact + Designsystemet (-css / -web). Ingen hemmeligheter.
apps/server        Hono. Holder API-nøkkelen. Det eneste som snakker med backenden.
packages/contract  Typene som går mellom de to.
```

```
Preact SPA ──► apps/server ──► digdir-headless-rag
               (BFF-en)        /api/mcp     samtale + strømming
                               /v1/models   oppslag
                          ──► Typesense     fasetter, utdrag fra kilder
                                            (ingen av delene finnes i API-et)
```

Nettleseren får aldri API-nøkkelen. Det er et krav fra backenden, ikke en
preferanse: den autentiserer applikasjoner og ikke personer, og `X-User-Id`
godtas uten verifisering. Derfor må noe på serversiden _være_ identiteten. Se
[`decisions/0002`](decisions/0002-backend-for-frontend.md).

## Komme i gang

```sh
mise install && mise trust                       # node 22.18+, kjører TypeScript direkte
npm install
cp apps/server/.env.example apps/server/.env     # sett DIGDIR_API_BASE og DIGDIR_API_KEY
npm run doctor                                   # sjekker backenden før du starter
npm run dev                                      # server :8787, SPA :5173
```

`npm run doctor` er den raske måten å finne ut hvorfor ingenting virker.
Den sjekker at nøkkelen autentiserer, at den gir tilgang til agenten som er
satt opp, at samtale-API-et svarer, og at Typesense er tilgjengelig. Feiler
noe, sier den hva du skal endre.

To backender, styrt av `DIGDIR_API_BASE`:

|                                 |                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `https://test.rag.digdir.cloud` | utrullet testmiljø. Ingenting å kjøre selv, men du trenger en nøkkel for det miljøet. |
| `http://localhost:8099`         | lokalt. Oppsett ligger i `digdir-headless-rag`.                                       |

Nøkler gjelder per miljø: en som er laget lokalt autentiserer ikke mot den
utrullede backenden. Typesense er valgfritt. Uten det kjører appen fint, men
filterraden skjules og kildekortene viser ingen utdrag.

## Kommandoer

|                     |                                    |
| ------------------- | ---------------------------------- |
| `npm run dev`       | begge appene, med watch            |
| `npm run doctor`    | sjekk forbindelsen til backenden   |
| `npm run build`     | produksjonsbygg av SPA-en          |
| `npm test`          | server (node:test) og web (vitest) |
| `npm run typecheck` | alle tre prosjektene               |
| `npm run format`    | prettier                           |

## Status

Den portede brukeropplevelsen virker ende til ende mot Kudos-korpuset: tråder,
strømmede svar med statusetiketter, og kilder med utdrag.

Den samme builden kjører mot begge versjoner av backenden. Se [Hva backenden
støtter](#hva-backenden-støtter).

|                                                         |                                                                                                                         |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Samtale over `/api/mcp`, SSE-strømming, statusetiketter | ferdig                                                                                                                  |
| Trådliste: søk, endre navn, slett                       | ferdig                                                                                                                  |
| Flere turer i samme tråd, startskjerm                   | ferdig                                                                                                                  |
| Kildepanel: snarveier, kort, utdrag, husket per tråd    | ferdig                                                                                                                  |
| Kopier svar og lenke, tilbakemeldingslenke, nøkkelord   | ferdig                                                                                                                  |
| Innlogging                                              | ferdig. Engangskode i drift, Entra ID venter på samtykke. Av lokalt. Se [Innlogging](#innlogging)                       |
| Utrulling til Azure Container Apps                      | utrullet og i bruk. Se [`deploy/`](deploy/README.md)                                                                    |
| Filterpanel: fasetter, chips med antall, låst per tråd  | vises alltid. Deaktivert med forklaring når backenden ikke tar imot filtre, og slår seg på av seg selv når den gjør det |
| Genererte trådtitler                                    | faller tilbake på spørsmålet til backenden lager en                                                                     |
| `Vis andres tråder`                                     | deaktivert, API-et kan ikke liste tråder du ikke eier                                                                   |
| Mapper                                                  | droppet. Backenden har tagger, ikke mapper                                                                              |

## Hva backenden støtter

Serveren måler det ved oppstart i stedet for å anta det, og eksponerer
resultatet på `/api/capabilities`. Da virker den samme builden mot begge
versjoner av backenden, og filtrene slår seg på uten ny utrulling den dagen
endringene er inne.

Filtermålingen er en faktisk test, ikke en erklæring: den sender et filter som
ikke kan treffe noe, og sammenligner med samme søk uten filter. Kommer det
treff uten filter og null med, kom filteret fram. Uten den kontrollen ville en
backend som er nede sett ut som en som støtter filtre.

Tvinges med `KA_CAPABILITIES="filters"` eller `"no-filters"`.

## Innlogging

`AUTH_MODE` velger mekanisme.

|         |                                                                 |
| ------- | --------------------------------------------------------------- |
| `entra` | Entra ID. Det som kjører på `qa.kunnskap.digdir.cloud`.         |
| `off`   | Kun lokalt. Usignert id, hvem som helst kan bli hvem som helst. |

Utelater du `AUTH_MODE` utledes den: `entra` hvis Azure-variablene er satt,
ellers `off`. Serveren skriver hvilken modus den kjører i ved hver oppstart.

Ingen token når nettleseren, bare en signert informasjonskapsel. `/api/*`
svarer 401 uten innlogging, og `/api/health` er åpen. Hvem som slipper inn,
bestemmes av Entra ID og ikke av appen. `AUTH_MODE=off` nekter å starte hvis
`APP_ORIGIN` ikke er localhost. Oppsett i [`deploy/README.md`](deploy/README.md).

## Dokumentasjon

[`decisions/`](decisions/) er på engelsk, som resten av koden og som
`digdir-headless-rag`: hvorfor Preact, hvorfor en BFF, hvorfor `/api/mcp`
framfor `/v1`.

[`deploy/README.md`](deploy/README.md) dekker utrulling til Azure og
innlogging.

## Hvor ting ligger

| Hvor                         | Hva                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/`                       | **Dette.** Applikasjonen: SPA, server og kontrakt.                                             |
| [`../docs/`](../docs)        | Designarbeid, akseptansekriterier, innsikt.                                                    |
| [`../evals/`](../evals)      | Evalueringene, som denne gir noe å kjøre mot.                                                  |
| `digdir/digdir-headless-rag` | **Backenden.** Brukes kun over HTTP.                                                           |
| `digdir/digdir-rag`          | **Arkivert.** Den opprinnelige Clojure-monolitten. Kilde til norsk tekst, ikke en avhengighet. |
| `digdir/digdir-rag-frontend` | **Egen alfa-demo.** Uten sammenheng med dette, tross navnet.                                   |

Arbeidsmateriale som hører til prosjektet men ikke til repoet, som den
opprinnelige planen, presentasjonene og det fangede stilarket, ligger utenfor i
`_notes/` ved siden av utsjekkene.
