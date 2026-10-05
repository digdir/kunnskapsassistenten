# PR #133, bytte starter ny tråd: og de to kantene rundt

Anmeldt 2026-09-21 av KA CC. `0886f73` slått sammen med `main`, ingen
konflikt. Fem porter med exit-kode lest, alle 0; 822 enhetstester, 149 e2e.

## Målt i mock med begge korpus

| Steg                       | Målt                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Spørsmål på Kudos          | `/threads/3112377a…`, ett svar                                                                               |
| Bytte til Wikipedia (mock) | URL tilbake til `/`, **0 svar på skjermen**, utkastet står i feltet                                          |
| Spørsmål på Wikipedia      | `/threads/638e7fae…` — en annen tråd                                                                         |
| Trådlista                  | «… dette korpuset om?» med «Wikipedia (mock)», «… Nkom med måloppnåelse?» med «Kudos, 938 dokumenter (mock)» |

Bør 2 fra #131 er lukket, og korpuset står riktig på begge radene.

## To kanter jeg prøvde i tillegg

**Bytte to ganger uten å spørre:** 0 tråder myntet. Et bytte alene lager
ingenting.

**Bytte midt i et strømmende svar:** under strømmen ett svar med
`aria-busy="true"`; rett etter byttet er skjermen tom, send-knappen tilbake
til «Send spørsmålet» uten busy, og tre sekunder senere har ingenting kommet
etterpå. Turen slippes skikkelig — ingen spøkelsestekst skriver seg inn i den
nye samtalen. Det var den ene rekkefølgen kommentarene ikke sa noe om.

## Funn, begge «kan»

**1. Et spørsmål som avbrytes av et korpusbytte etterlater seg ingenting** —
verken tråd eller tekst i feltet. #108 gikk motsatt vei for den andre
avbruddsformen: en feilet tur lagres med notis, nettopp fordi «en feil som
ikke overlevde en oppfriskning betydde at tråden ikke engang hadde
spørsmålet». Her er avbruddet leserens eget og ikke tjenestens, så å kaste det
er forsvarlig — men de to sier nå forskjellige ting om samme spørsmål, og
valget står ikke skrevet noe sted.

**2. De elleve skriptede trådene har ingen korpusetikett** mens alle nye har.
Lista leser derfor blandet. `src/api/mock/` er #5 sin, så ikke denne PR-ens å
rette — men synlig først nå som mock har to korpus.

## Om mekanismen

Forklaringen i beskrivelsen holder, og den er en ekte forklaring og ikke en
gjetning: adressen til den første tråden skrives med `history.replaceState`,
som routeren aldri ser, så velgerens `navigate('/')` er en no-op — ingenting
remonteres, og `startedRef` beholdt den gamle tråden. Begge halvdelene slippes
derfor der endringen er observerbar.

## En målefeil hos meg

Første kjøring så ut til å vise utkastet inni trådtittelen. Det var
`Control+A` på macOS, som flytter skrivemerket til linjestart i stedet for å
merke alt, så spørsmålet ble satt foran utkastet. Ren kjøring gir ren tittel.

Og en til, som ikke ble et funn: jeg leste først trådradenes tekst gjennom
`<a>`-elementet og konkluderte at ingen rad viste korpus. Korpusetiketten er
et søsken til lenka, ikke inni den. **Les raden, ikke lenka.**
