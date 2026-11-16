# PR #119, «Tråder» i panelhodet: 60 px, og to kontroller utenfor flata

Anmeldt 2026-09-21 av KA CC, to runder. Fire porter grønne i begge; e2e 145
på 4173.

## Gevinsten

Målt med tømt `localStorage` på 1280, 1440 og 1920 — samme tall hver gang,
fordi hodet er tekst og knapper og ikke skalerer med vinduet.

| Del                            | Før     | Etter   |
| ------------------------------ | ------- | ------- |
| Filterhodet (`.view-head`)     | 137     | **77**  |
| Panelraden (`.sidebar-header`) | 42      | 48      |
| **Toppen** (raden + hodet)     | **179** | **125** |

Tab-rekkefølgen er den bestilte — Skjul → Tråder → smalere → bredere →
rulleregionen — og fokus etter bytte er riktig begge veier: «Tråder» gir
fokus til «Filtrer dokumenter», og tilbake igjen til «Tråder». Ingenting
faller til `<body>`.

## Runde 1: ett blokkerende funn

**Panelraden rant over med 72 px, og breddekontrollene havnet utenfor
panelet.** Tre elementer i en rad med 399 − 2 × 36 px padding: «Skjul tråder
og filter» 209, «Tråder» 123, breddeknappene 88. `scrollWidth` 471 mot
`clientWidth` 399, og `.panel` har `overflow: hidden` og slutter på x = 400.

| Kontroll               | Høyre kant | Nåbar med peker |
| ---------------------- | ---------- | --------------- |
| Skjul tråder og filter | 245        | ja              |
| Tråder                 | 375        | ja              |
| Gjør … smalere         | 425        | **nei**         |
| Gjør … bredere         | 471        | **nei**         |

«Nåbar» er `document.elementFromPoint` på kontrollens eget midtpunkt.

Med tastatur skjer noe annet: Tab til breddeknappene får nettleseren til å
rulle `.panel` 72 px sideveis (`scrollLeft: 72`), og da blir de nåbare — men
hele panelinnholdet flytter seg, «Skjul» fra 245 til 173. Med `overflow:
hidden` finnes verken rullefelt eller hjul å rulle tilbake med.

**Og suiten var grønn.** `resize.spec.ts` klikker breddeknappene, og
Playwrights `click()` ruller først elementet inn i syne — akkurat som fokus
gjør. En test som klikker beviser ingenting om hvor en kontroll står. Det er
hele grunnen til at vakta i #126 leser geometri i stedet.

## Runde 2: løst av #121, og målt

Med ikonknappen fra #121 er raden 42 + 123 + 88 = **253** av 399, overflod 0,
`scrollLeft` 0, og alle fire kontrollene nåbare — på alle tre bredder.

## Ett funn til budsjettet: i skuffa er N1 et nullsumbytte

Ved siden av svaret var hoderaden der fra før med sammenleggingsknappen, så de
60 px view-hodet gir fra seg er rene. I skuffa var raden tom og skjult, og nå
tegnes den:

|                    | før             | etter   |
| ------------------ | --------------- | ------- |
| Hoderad i skuffa   | `display: none` | 48      |
| View-hodet         | 137             | 77      |
| `.sidebar-content` | **808**         | **744** |

64 px lagt til over rulleregionen og 60 tatt bort i hodet: **4 px netto i feil
retning**, i den layouten der hodet allerede tok størst andel av vinduet. N1
betaler seg bare over brytepunktet. Logget i regnskapet av dirigenten; ingen
endring gjort.
