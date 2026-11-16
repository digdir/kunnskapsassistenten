# PR #124, «Dine dokumenter»: to AA-funn axe ikke ser

Anmeldt 2026-09-21 av KA CC, to runder. Fem porter med exit-kode lest i begge,
alle 0; 784 og 789 enhetstester, 145 og 149 e2e.

## Runde 1: to blokkerende, begge WCAG AA

Begge er usynlige for axe, som meldte **0 brudd og 0 uavklarte** i sonen i
både lys og mørk. Det er verdt å merke seg for neste anmeldelse: axe leser
markup i et øyeblikk, og begge disse handler om hva som skjer over tid.

**1. Ingenting sa fra når en opplasting begynte, ble ferdig eller feilet
(4.1.3 Status Messages).** Raden skrev «Laster opp … 20 %», «… 47 %», «… 93 %»
og så resultatet, men teksten ble byttet stille ut. Målt: null live-områder
inne i sonen, og de som fantes i panelet fra før sto tomme før, under og etter.

**2. Fokus falt til `<body>` når et dokument ble fjernet (2.4.3 Focus
Order).** Målt med ekte tastatur, ikke `focus()`: Tab til «Fjern notat.pdf»
(steg 15), Enter, `document.activeElement` er `<body>`. Både når lista ble tom
og når det sto et dokument igjen.

Ett «kan»: framdrift vises som tekst uten strek, mens `UserDocument.progress`
ble et tall «fordi designet tegner en bar» (#117). Eierens valg; står.

## Runde 2: begge løst, målt på nytt

**4.1.3.** `<output class="ds-sr-only">`, montert **tomt ved start** — før
innholdet, som er regelen — og `output` har `role="status"` implisitt. Fire
meldinger på to filer, målt med MutationObserver:

1. «Laster opp notat.pdf»
2. «notat.pdf er lastet opp»
3. «Laster opp feil-rapport.pdf»
4. «feil-rapport.pdf ble ikke lastet opp. Opplastingen mislyktes. Prøv igjen.»

De tre overgangene, ingen prosenter. Samme måling på #125 ga 18 meldinger på
halvannet sekund; denne er mønsteret de to bør dele.

**2.4.3.** Tre dokumenter, Tab til fjern-knappen, Enter:

| Fjernet  | Fokus etterpå |
| -------- | ------------- |
| Øverste  | rada under    |
| Nederste | rada over     |
| Siste    | filvelgeren   |

Aldri `<body>`. Og fokuset i det siste tilfellet er synlig — `:focus-visible`
med ring både på inputen og på `.ds-file-upload` via `:focus-within`. Verdt å
måle: en fiks som flytter fokus til et felt uten ring bytter 2.4.3 mot 2.4.7.

## Målt, og riktig fra første runde

- **Live, på egen port med nøkkelen fra `.env.local`:** sonen står, men
  inviterer ikke til noe — ingen filvelger, ingen knapper, ingen «Ny», bare
  «Opplasting er ikke tilgjengelig i denne tjenesten ennå.» Det er det
  `UploadClient.unavailable` finnes for, og «Ny» som forsvinner med
  funksjonen er det brukerblikk-funn 13 egentlig handlet om.
- **Feilstien:** `feil-rapport.pdf` viser feilen i raden og **lagres ikke** —
  bare `notat.pdf:ready` står i `ka.documents.v1`. Regelen fra #117 holder
  gjennom UI-laget.
- Skuffa på 1100 har sonen innenfor kanten, med filvelger.
