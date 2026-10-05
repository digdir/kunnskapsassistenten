# PR #92, `fix/sources-link-names`: hvert navn sitt eget

Anmeldt 2026-09-17. Hode `678c9ae`, base `main` (`dda6c43`).
`git merge-tree --write-tree origin/main 678c9ae` går rent.

Seks filer, 206 linjer inn. Dette er funnet mitt fra #70, og #4 har tatt det
lenger enn jeg beskrev det.

**Ingen blokkerende funn. Én «bør», tre «kan».** «Bør» er at ingen av de fire
nye påstandene måler det navnet de handler om — og at det er målt hva det
koster.

## Målingene

Kjørt på sammenslåingen, maskinen for meg selv, e2e på min port 4173.

| Port                                        | Resultat           |
| ------------------------------------------- | ------------------ |
| `npm run build`                             | grønn              |
| `npm run lint`                              | grønn              |
| `npm run format:check`                      | grønn              |
| `npm run tokens:verify`                     | grønn              |
| `npm test`                                  | 56 filer, 584/584  |
| `KA_E2E_PORT=4173 CI=true npm run test:e2e` | 131/131 på 2,0 min |

131 og ikke 129: #93 er merget inn i `main` siden #4 målte.

## Det som er riktig

1. **Navnene er unike der det teller: i tilgjengelighetstreet.** Jeg leste dem
   ut med `ariaSnapshot`, ikke fra DOM-teksten. Ni lenker i panelet, ingen to
   like:

   ```
   link "Les dokumentet på Kudos , utdrag 1, Årsrapport … (åpnes i ny fane)"
   link "Les dokumentet på Kudos , utdrag 2, Årsrapport … (åpnes i ny fane)"
   link "Les dokumentet på Kudos , Årsrapport … (åpnes i ny fane)"
   ```

   Pluss de tre snarveislenkene, som bærer dokumenttittelen fra før.

2. **Den synlige flata er urørt.** Alle seks Kudos-lenkene måler 199 px, som
   beskrivelsen sier, og snarveislenkene 252, 251 og 204. Tillegget er
   `ds-sr-only` og legger ingenting til i layouten.
3. **Mellomrommet foran kommaet er ekte, og det er dokumentert.** Navnet
   beregnes som «… på Kudos , utdrag 1 …», fordi accname skjøter en tekstnode
   og et element med mellomrom. Kommentarene i begge komponentene sier det,
   sier hvorfor det ikke kan fjernes uten å gjøre hele navnet til én
   `aria-label`, og sier at det er stumt i tale. Det stemmer, og det sparer
   neste person for jakten.
4. **Søket kan ikke få fantomtreff av den skjulte teksten.** Det var den
   risikoen ved å legge tekst i DOM-en: en trefferteller som plutselig teller
   dokumenttitler. `buildSearchIndex` bygger fra `excerpt.text` i modellen, ikke
   fra DOM, så det kan ikke skje. Sjekket, ikke antatt.
5. **E2E-testen åpner utdragene først**, fordi en lenke inne i et lukket
   `details` ikke er i tilgjengelighetstreet, og den verner seg mot den stille
   løkka med `expect(names.length).toBeGreaterThan(1)`. Begge deler er riktige,
   og begrunnelsen står i testen.

## Bør: ingen av de fire påstandene måler navnet

Tre unit-tester i `SourcesView.test.tsx` og den nye e2e-testen i
`tests/e2e/sources.spec.ts` leser alle `link.textContent`. Det er ikke det
tilgjengelige navnet, og de to er beviselig forskjellige her: unit-testen
påstår

```
'Les dokumentet på Kudos, utdrag 1, Årsrapport Nkom 2025 (åpnes i ny fane)'
```

mens navnet en skjermleser faktisk sier er «… på Kudos **,** utdrag 1 …», med
mellomrommet fra punkt 3. Testen påstår altså en streng ingen bruker hører.

**Målt hva det koster.** Jeg la inn én generisk `aria-label="Les dokumentet på
Kudos"` på begge lenkene — nøyaktig den endringen PR-ens egne kommentarer peker
på som veien til å bli kvitt mellomrommet — og da er alle seks navnene like
igjen, altså feilen PR-en retter, i full styrke:

| Påstand                               | Med `aria-label` på | Resultat            |
| ------------------------------------- | ------------------- | ------------------- |
| e2e «ingen to lenker heter det samme» | ja                  | **grønn**, 1 passed |
| `SourcesView.test.tsx`, alle tre      | ja                  | **grønn**, 32/32    |

Vakten ryker altså på den neste endringen koden selv inviterer til. Mutasjonen
er tilbakestilt.

Hva som virker i stedet:

- **E2E:** `region.ariaSnapshot()` gir navnene rett fra treet — det er sånn jeg
  målte punkt 1. Fila er min, så dette er min oppfølging, ikke #4 sin.
- **Unit:** `getByRole('link', { name })` går gjennom
  `dom-accessibility-api`, som testing-library allerede har med seg. Ingen ny
  avhengighet. Den delen er #4 sin.

## Kan

### 1. Den usiterte vekslebryteren mister dokumentet

For et sitert utdrag heter bryteren «Åpne utdrag 3», som er unikt i hele
panelet. For et **usitert** heter den «Åpne utdrag 2 av 5» — uten tittel, med
vilje, fordi den står under sin egen dokumentoverskrift. Da heter to usiterte
utdrag på samme plass i to forskjellige dokumenter det samme.

Før PR-en het den «utdrag fra `<tittel>`», som kolliderte den andre veien: to
usiterte utdrag i samme dokument fikk samme navn. Den nye er bedre, men ikke
helt unik, og lenka ved siden av har løst nøyaktig dette ved å legge på
tittelen.

Dette er **lest i koden, ikke målt**: mocken har ingen usiterte utdrag, som #4
selv skriver. Én interpolasjon om dere vil ha samme garanti for bryterne.

### 2. Unikheten hviler på at titlene er ulike

To Kudos-dokumenter med samme tittel gir to like navn på dokumentlenkene.
Ikke nåbart i mocken, og kanskje ikke i Kudos heller, men det er antakelsen
navnet bygger på.

### 3. Unntaket for `tests/` står ikke i PR-en

PR-en endrer `tests/e2e/sources.spec.ts`, som er min. Dirigentens brief nevner
e2e-testen, så unntaket er tydeligvis gitt — men det står ingen steder i
PR-en, og det er der neste leser ser etter. Én linje i beskrivelsen, som #5
skrev i #93.

## Til dirigenten

Klar for Lars. «Bør» krever ingen endring i produksjonskoden — den er riktig —
bare i det som vokter den, og halvparten av den jobben er min. Jeg tar
e2e-siden i PR-en jeg har i kø; unit-siden er tre linjer hos #4.
