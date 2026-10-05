# Kom i gang: kjøre appen og få en endring ut

For deg som vil se appen på din egen maskin, endre den med Claude Code og få
endringen ut på testadressen, uten å være utvikler. Skrevet for macOS.

Du får:

- appen på din maskin, med oppdiktede svar fra et ekte dokumentarkiv (mock), uten
  hemmeligheter og uten backend;
- Claude Code i samme mappe, som gjør endringene når du ber om dem;
- endringen ute på testadressen noen minutter etter at pull requesten er merget.

**Testadressen** står på
[repoets side på GitHub](https://github.com/larsekhansen/kunnskapsassistenten-frontend),
i sidespalta: under **Deployments → test**, og øverst under «About».

## Ord som går igjen

| Ord                | Hva det er                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Terminal           | Programmet der du skriver kommandoene under. Programmer → Verktøy → Terminal.                          |
| Gren (branch)      | En egen kopi av koden der endringen din bor til den er klar. `main` er den som er ute.                 |
| Pull request (PR)  | Forslaget om å ta grenen din inn i `main`, på GitHub.                                                  |
| CI                 | Sjekkene GitHub kjører på hver PR: tester, bygg og at appen starter. Grønn betyr at alle gikk gjennom. |
| Merge              | Å ta PR-en inn i `main`. Det er det som ruller den ut.                                                 |
| Utrulling (deploy) | At den nye versjonen legges ut på testadressen. Skjer av seg selv etter merge.                         |

## 1. Installere, én gang

Kommandoene skrives i Terminal, én linje om gangen, og avsluttes med Enter.

**git.** Skriv `git --version`. Står det et versjonsnummer, er det installert.
Hvis macOS i stedet spør om å installere «command line developer tools», trykk
**Installer** og vent til det er ferdig.

Fortell git hvem du er. Bruk samme e-post som på GitHub:

```sh
git config --global user.name "Fornavn Etternavn"
git config --global user.email "deg@digdir.no"
```

**Node 24.** Last ned macOS-installasjonen for versjon 24 (LTS) fra
[nodejs.org](https://nodejs.org/en/download) og kjør den. Lukk Terminal, åpne
den igjen, og sjekk:

```sh
node --version
```

Det skal stå `v24` og noe mer.

**GitHub.** Du trenger en konto på [github.com](https://github.com), og Lars må
gi den skrivetilgang til repoet. Du får en invitasjon på e-post; godta den.

**GitHub CLI** (`gh`), så Claude Code kan lage pull requests for deg. Last ned
macOS-installasjonen fra [cli.github.com](https://cli.github.com) og kjør den.
Logg så inn:

```sh
gh auth login
```

Velg **GitHub.com**, **HTTPS**, **Yes** på spørsmålet om å bruke innloggingen
for git, og **Login with a web browser**. Følg det som står i nettleseren.

**Claude Code:**

```sh
curl -fsSL https://claude.ai/install.sh | bash
```

Spør Lars hvilken konto du skal logge inn med første gang du starter den.

## 2. Hente koden og kjøre appen

```sh
mkdir -p ~/prosjekter
cd ~/prosjekter
git clone https://github.com/larsekhansen/kunnskapsassistenten-frontend.git
cd kunnskapsassistenten-frontend
npm ci
npm run dev
```

Åpne <http://localhost:5173> i nettleseren. Det er appen, i mock: svarene er
skrevet på forhånd, men dokumentene er ekte, og filtrene virker. Målt i en
fersk klone med tom npm-cache 28.09: **13 sekunder** fra `git clone` til appen
svarer, det meste av det `npm ci`. På et tregere nett tar `npm ci` lengre tid.

Står det en annen adresse enn 5173 i Terminal, bruk den; da var porten opptatt.
Stopp appen med **Ctrl+C**. Neste gang trenger du bare:

```sh
cd ~/prosjekter/kunnskapsassistenten-frontend
git switch main
git pull
npm ci
npm run dev
```

Noen spørsmål får mocken til å vise tilstander som ellers er vanskelige å se,
for eksempel `simuler feil` og `simuler ingen treff`. Hele lista står i
[README, «Mock-modus»](../README.md#mock-modus-spørsmål-som-gjør-noe-spesielt).

## 3. Gjøre en endring med Claude Code

La appen stå og gå. Åpne en ny fane i Terminal (**Cmd+T**), og start Claude
Code i samme mappe:

```sh
cd ~/prosjekter/kunnskapsassistenten-frontend
claude
```

Claude Code leser `CLAUDE.md` i repoet og kjenner reglene der. Si hva du vil,
med dine egne ord. For eksempel:

> Lag en ny gren. Gjør teksten under spørsmålsfeltet litt mindre, og vis meg
> hvor i koden det står.

Endringen vises i nettleseren med en gang, uten at du laster siden på nytt.
Fortsett til du er fornøyd.

## 4. Få endringen ut

Be Claude Code om det:

> Kjør sjekkene, commit endringen, push grenen og åpne en pull request.

Den svarer med en lenke til pull requesten. Åpne den. Nederst ser du sjekkene
(CI). De tar **ca. 7 minutter**. Når alle er grønne, trykk **Merge pull
request** og så **Confirm merge**.

Etter merge starter utrullingen av seg selv. Du ser den under **Actions →
Deploy** på GitHub. Når den er grønn, er endringen ute på testadressen. Last
siden på nytt der.

Blir en sjekk rød, be Claude Code: «CI feilet på pull requesten, finn ut hvorfor
og rett det.» Den kan lese hva som feilet.

## 5. Når noe går galt

- **Testadressen viser noe som er feil etter en merge.** Åpne den mergede pull
  requesten på GitHub og trykk **Revert**. Det lager en ny pull request som
  angrer endringen. Merge den, så rulles den forrige versjonen ut igjen.
- **`npm ci` feiler.** Sjekk at `node --version` sier v24. Står det noe annet,
  installer Node 24 på nytt og åpne Terminal igjen.
- **Claude Code får ikke pushet eller laget PR.** Kjør `gh auth status`. Står
  det at du ikke er logget inn, kjør `gh auth login` igjen.
- **Noe annet.** Spør Claude Code først; lim inn feilmeldingen. Spør Lars hvis
  det ikke løser seg.
