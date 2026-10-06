# Funksjonsflagg

Flagg er forsøk som skal kunne prøves side om side og tas bort når valget er
tatt. Innstillinger (`#innstillinger`) er valg som blir. Alle flagg er av til
noen slår dem på, og de lagres per nettleser under `ka.flags.v1`. «Logg ut»
sletter dem (`beforeLogout` i `src/api/session.ts`).

## Slå på et flagg

- **Menyen:** legg `#feature-flags` til i adressen, for eksempel
  `http://localhost:5173/#feature-flags`. Menyen heter «Eksperimenter» og har
  en bryter per flagg. Å lukke den tar hashen ut igjen.
- **En lenke:** `?flagg=mobile-top-row`, eller flere med komma
  (`?flagg=a,b`). Lenken slår bare på. Parameteren tas ut av adressen, og
  menyen åpnes, så den som fikk lenken ser hva som ble slått på og kan slå det
  av. Ukjente id-er gjør ingenting.

## Flaggene

| Id               | Hva                                                         | Issue                                                                                        |
| ---------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `mobile-top-row` | Panelene som en rad øverst på telefon, i stedet for skinner | [digdir/kunnskapsassistenten#120](https://github.com/digdir/kunnskapsassistenten/issues/120) |

## Legge til og ta bort

- **Legge til:** en rad i `FLAGS` i `flags.ts`, med id, tittel, én linje
  beskrivelse og lenke til issuen. Les flagget med `useFlag('id')`, eller
  `isFlagOn('id')` utenfor en komponent.
- **Ta bort:** når valget er tatt, slett raden og alle `useFlag`-kall for den.
  TypeScript sier fra om kall som står igjen. Et flagg som er lagret i en
  nettleser, men som ikke står i lista, leses som av.
- Bruk aldri en id om igjen til et annet forsøk: en gammel lenke ville slått
  på noe annet enn den lovet.
