# Todo

Saker som er avgjort at skal vente, med hvem som avgjorde og hvorfor. Ikke en
backlog: en sak står her fordi noen har sett den og sagt «ikke nå».

- [ ] **«Kopier lenke til tråden» i live deler ikke med andre.**
      Id-en er rettet i #157 — adressen bærer nå backendens samtale-id, og
      tråden kan åpnes igjen i samme nettleser. Det som står igjen er
      identiteten: `/api/conversations` lister bare tråder med samme
      `X-User-Id`, og den er en tilfeldig verdi i `localStorage` under
      `ka.user.v1`. En annen nettleser ser derfor ikke tråden, og en delt
      lenke fører ikke fram.
      Lars 22.09: vent med skjuling, avklares når UI-et fikses.

- [ ] **Stedfortreder-vinduet: lenken er død i et brøkdels sekund.**
      Adressen skrives når spørsmålet sendes og flyttes til backendens id når
      `POST /api/conversations` svarer (#157). I mock er vinduet borte før
      første avlesning, fordi `createThread` der er synkron. I live er det så
      langt som rundturen — målt til å være over innen 1,2 s, og ikke prøvd
      tettere. En leser som rekker «Kopier lenke» innenfor vinduet får en
      adresse som ikke finnes.
      Notert av dirigenten 23.09 etter anmeldelsen av #157. Ikke målt som et
      problem i praksis; står her så ingen finner det på nytt og tror det er
      nytt.
