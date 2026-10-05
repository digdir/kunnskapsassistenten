# PR #115, send og vedlegg inn i feltraden: 88 px, ikke 72

Anmeldt 2026-09-21 av KA CC. `9e47f85` slått sammen med `main 1e88705`, ingen
konflikt. Fire porter grønne, 700 enhetstester og 145 e2e grønne på 4173.

## Gevinsten, mot grunnlinja

Grunnlinja er `main 0855670`, med definisjonen Lars valgte 21.09: leservinduet
er alt mellom hodet og skrivefeltet.

| Del                           | Grunnlinje    | Nå               |
| ----------------------------- | ------------- | ---------------- |
| Klebrig nederst, 1280 og 1440 | 302           | **214**          |
| `.ka-composer` (feltraden)    | 154           | **90**           |
| Oppfølgingschips              | 32            | 32               |
| Bunntekst                     | 48, to linjer | **24**, én linje |
| Leservindu 1280               | 418           | **506**          |
| Leservindu 1440               | 598           | **686**          |

**−88 px, der brief-en regnet −72.** De siste 16 kommer to steder fra, og bare
det ene sto i oppdraget: knapperaden tok med seg sin egen `gap` da den
forsvant, og `.ka-composer` har fått `padding` fra `--ds-size-3` til
`--ds-size-2`. Det siste er en reell visuell innstramming som ikke står i
brief-en. Den er liten og den kler raden, men den er verdt å si høyt, så
ingen tror hele gevinsten kom av H1′ og H3 alene.

## Målt oppførsel

- **Send-knappen:** navn «Send spørsmålet», `disabled` på tomt felt.
  Fokusringen målt med **ekte Tab** og ikke `focus()`: `:focus-visible` på,
  `outline: solid 3px` pluss skygge.
- **Under sending** blir knappen «Avbryt genereringen» med `aria-busy="true"`,
  og **fokus overlever byttet** — målt: `document.activeElement` er fortsatt
  knappen etterpå. React beholder DOM-noden fordi det er samme komponent på
  samme plass; det er ikke gratis, og det er riktig her. Uten det ville en
  tastaturbruker som trykket send havnet på `<body>`, som er fella
  README-sjekklista har et eget punkt om.
- **Feltet vokser og knappene blir med ned:** 72 → 116 px med et spørsmål som
  brytes over tre linjer, og begge knappenes underkant er lik feltets.
  `align-items: flex-end` gjør det kommentaren lover.
- **Hintet:** `title` på tekstfeltet, målt «Trykk Cmd + / for å hoppe hit» på
  dev-serveren. Den utskrevne versjonen for skjermleser står fortsatt på
  `aria-describedby`, og hopplenka fra #116 sier det samme.
- **Ingen rester:** `.ka-composer__shortcut` finnes verken i markup eller CSS.

## WCAG AA

0 axe-brudd i lys og mørk på trådruta. De uavklarte er de kjente fra `main`
(Suggestions skyggemarkup, skrivefeltet, chipene). Bunnteksten er også
`incomplete` hos axe, så den er målt for hånd: **5,97:1 i lys, 6,86:1 i mørk**,
over AA-kravet på 4,5:1.

## Funn

Ingen blokkerende, ingen bør. Tre «kan»:

1. **`aria-busy` på avbryt-knappen gjør lite av det den ser ut til å gjøre.**
   `Composer.tsx:141`. Attributtet sier «dette elementet oppdateres» og leses
   stort sett ikke på en knapp; det som forteller en skjermleserbruker at noe
   skjer, er live-området på svaret. Behold den gjerne, brief-en ber om den,
   men den bærer ikke meldingen.
2. **Tab inn i skrivefeltet starter nå på en inert knapp.** Bindersen står
   først i raden med `aria-disabled="true"`. Det er det brief-en ber om, og
   Ctrl + / hopper rett i feltet.
3. **Figma-avviket er ikke skrevet ned der fasiten bor.**
   `design/omraader/molecules/skjermer/chat-input.md` beskriver fortsatt
   `secondaryButtons` som «binders-ikon nede til venstre», altså raden som er
   borte. Avviket er besluttet (H1′, Lars 21.09) og begrunnet i koden, men
   spesifikasjonsfila sier noe annet enn appen.
