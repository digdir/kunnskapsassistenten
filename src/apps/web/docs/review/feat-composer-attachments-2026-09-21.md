# PR #125, vedlegg i skrivefeltet: vakta sto på knappen, ikke på handlingen

Anmeldt 2026-09-21 av KA CC, to runder. Fem porter med exit-kode lest i begge,
alle 0; 782 og 804 enhetstester, 145 og 149 e2e på 4173.

## Runde 1: to blokkerende

**1. Enter sendte mens en opplasting pågikk, og vedlegget forsvant i
stillhet.** Send-knappen var riktig `disabled` mens filen lastet — men
tastaturveien gikk utenom. Målt: chipen på «notat.pdf 13 %», knappen
`disabled`, Enter i skrivefeltet → turen startet med én gang, og da
opplastingen var ferdig sto meldinga **uten** «Med vedlegg». Ingen feilmelding,
ingen chip igjen.

Enter er den vanligste måten å sende på. En vakt som bare står på knappen er
en vakt på tegningen, ikke på handlingen.

**2. Fokus falt til `<body>` når en chip ble fjernet (WCAG 2.4.3).** Målt med
ekte tastatur: Tab til «Fjern vedlegget notat.pdf», Enter, `activeElement` er
`<body>`. Samme felle som i #124, samme dag.

**Bør, runde 1:** live-området sa fra 18 ganger på halvannet sekund — hvert
prosentsteg, pluss en «0 %» rett før «lastet opp», en tilstand som aldri var
sann. En `polite`-kø leses opp etter tur, så leseren hørte prosenter lenge
etter at filen var ferdig.

**Bør, runde 1:** i live tok skrivefeltet imot filen og avviste den etterpå,
mens `UploadClient.unavailable` finnes for å slippe akkurat det — kontrakten
sier det i klartekst, og #124 gjorde det riktig.

## Runde 2: alle fire tatt

|                        | målt                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Enter under opplasting | turen starter ikke, teksten står, «Vent til vedlegget er lastet opp.» annonseres                                   |
| Fokus etter fjern      | «Spørsmål til Kunnskapsassistenten»                                                                                |
| Live-meldinger         | 2 per fil, start og utfall — 4 på to filer                                                                         |
| Live-tilstand          | bindersen er `aria-disabled` og heter «Legg ved dokument. Opplasting er ikke tilgjengelig i denne tjenesten ennå.» |

To måter å løse det siste på, begge riktige: #124 fjerner filvelgeren helt,
#125 gjør knappen inert med grunnen i navnet. Skrivefeltet trenger knappen
stående for radens skyld, så forskjellen er begrunnet.

**Bør, runde 2:** vente-beskjeden blir stående etter at ventingen er over.
Målt seks sekunder etter Enter: det ene live-området sier «notat.pdf er lastet
opp og lagt ved.», det andre sier fortsatt «Vent til vedlegget er lastet opp.»
En instruksjon som ikke er sann lenger, i et område som finnes for å si hva
som er sant nå.

## Runde 3: beskjeden går når grunnen går

| Øyeblikk                                | Live-området sier                                             |
| --------------------------------------- | ------------------------------------------------------------- |
| Rett etter Enter, chip under opplasting | «Laster opp notat.pdf.» + «Vent til vedlegget er lastet opp.» |
| Etter at opplastingen falt til ro       | bare «notat.pdf er lastet opp og lagt ved.»                   |

Avledet under render i stedet for holdt i state, som er den riktige formen: en
beskjed som skal være sann akkurat nå, skal ikke overleve sin egen grunn. Og
andre Enter virker — turen starter, og meldinga har «Med vedlegg».

## Målt, og riktig

- **Vedlegget når spørsmålet:** «Med vedlegg: notat.pdf» på leserens egen
  melding, og svaret har markørene `[1]`–`[6]` med det opplastede dokumentet
  som kilde 1. Hele stien fra #117 henger sammen, ende til ende.
- Live-området er montert før innholdet og skrives fra en effekt, ikke under
  render. Mønsteret var riktig fra første runde; det var frekvensen som var
  feil.
- Slipp på hele den hvite boksen, med knappen som alternativ — ingenting
  krever draging (WCAG 2.5.7).

## Egne målefeil, notert

Jeg trodde først at svaret hang, fordi det ikke var ferdig elleve sekunder
etter Enter. Dev-serveren kjører mocken i `realistic`, og svaret strømmet
fortsatt etter seksti. Det var utålmodighet, ikke en feil — og det er verdt å
skrive ned, fordi e2e-suiten kjører `fast` og gir en helt annen tidsfølelse
enn den serveren en anmeldelse måles på.
