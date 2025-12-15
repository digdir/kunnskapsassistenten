
| **Relatert til** | [Påbegynt sikkerhetsvurdering i Confluence](https://digdir.atlassian.net/wiki/spaces/SK/pages/3279585490/Vurdering+av+ny+funksjon+i+Kunnskapsassistenten?atl_p=eyJpIjoiOWU1YTg3ZjEtMzcyNC01OTk0LTViNzItMGJiY2ViMGEzODI1IiwidCI6ImZvbGxvd2luZ0ZlZWRSZWFkTW9yZSIsInNvdXJjZSI6ImVtYWlsIiwiZSI6ImNjLW5vdGlmaWNhdGlvbnNfZm9sbG93aW5nX2ZlZWQiLCJmYyI6IkZPTExPV0lORyIsImZyIjoxfQ) |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | in progress (ferdig design, påbegynt utvikling i agentmiljøet)                                                                                                                                                                                                                                                                                                             |

## Linker til arbeid

- [Arbeid i Figma](https://www.figma.com/design/dD3Xs8rJe1TYU5fb65VKEY/Kunnskapsassistenten?node-id=1129-31033&p=f&t=4AJfWvXcDmz9BIfr-11)

## Formål

La brukeren laste opp dokumenter som tilleggskilder til det vi får fra Kudos.

## Skisser

![](Pasted%20image%2020251215094330.png)

## Kjappe tanker

- Dette vil henge sammen med muligheten til å bruke andre kilder med åpne data (APIer som ..)
	- OECD-kilder
	- 

## Antagelser


##  Stegvis tilnærming

Dette er et forslag på hvordan en stegvis utvikling av det å laste opp egne dokumenter kan se ut. Hvor vi prøver å ta høyde for både sikkerhet og brukeropplevelse samtidig, og hva som kan gi verdi fra starten av.

Her tar vi høyde for at ingen tråder er åpne, men alle er private og lukkede.

For å ha alt på det rene måtte vi vel i så fall slettet tråden i sin helhet og, siden innholdet i dokumentet gjenspeiles i svaret du får i tråden.

Et viktig premiss for implementasjonen foreslått nedenfor er at all tilgangstyring styres gjennom Sharepoint (og eventuelt GoogleDrive/iCloud/Dropbox og andre tjenester på sikt).

Deling av tråder er ny funksjonalitet som vi må vurdere som en separat greie. Det krever at vi setter oss mer inn i hvordan Sharepoint-integrasjon vil henge sammen med deling av tråder.

|                                | **Første steg**<br><br>Kun i testmiljø                                                                                                                                                                                                                                                                                                                                                                             | **Andre steg**<br><br>I produksjon                                                                                                       | **Tredje steg**<br><br>I produksjon                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Funksjonalitet**             | Laste opp dokumenter direkte i Kunnskapsassistenten                                                                                                                                                                                                                                                                                                                                                                | Sharepoint-integrasjon som erstatning for “vanlig opplasting av dokumenter” (kan teste interaksjon med plug-in på Digdir sin sharepoint) |                                                                                                                                                 |
| **Sikkerhet**                  | Dokumentene du laster opp er kun synlig for deg, i dine private og lukkede tråder (krever at vi går vekk fra det å ha åpne tråder)                                                                                                                                                                                                                                                                                 | Benytter eksisterende tilgangstyring i Sharepoint                                                                                        |                                                                                                                                                 |
| **Videreutvikling og analyse** | KA-teamet, som systemutviklerne, har tilgang til alt innhold, også tråder som inkluderer opplastede dokumenter, for å forbedre løsningen                                                                                                                                                                                                                                                                           | Kun tilgjengelig for personer fra KA-teamet som har skrevet under på en databehandler-avtale                                             | Ingen tilgang med mindre brukeren velger å gi tilbakemelding på løsningen. Eller at det er særskilt behov for systemutvikler å se på innholdet. |
| **Lagring**                    | - Bruker kan slette eget dokument og egne tråder, vi informerer om hva det innebærer i grensesnittet<br>    <br>- Bruker kan se tittel på dokumentet som ble slettet - for å huske hva hen lastet opp<br>    <br>- Dokumentene slettes ikke med mindre brukeren selv gjør det                                                                                                                                      | (**S**) Som steg 1, men opplastede dokumenter slettes automatisk etter 30/60/90 dager med inaktivitet (hvis sikkerhetskrav krever dette) |                                                                                                                                                 |
| **Informasjon til brukeren**   | - Disclaimer til bruker i grensesnittet:<br>    <br>    - _“Du kan alltid slette dokumentene, men for å fjerne alle spor er du også nødt til å slette tråden. gjør oppmerksom på at administratorer i løsningen kan se trådene og dokumentet, og har særskilt databehandler-avtale for dette. Ditt opplastede dokument brukes ikke til å trene språkmodellen.”_<br>        <br>- Ikke last opp gradert informasjon |                                                                                                                                          |                                                                                                                                                 |

## Definisjon av dokumentene som kan lastes opp

|   | Offentlige dokumenter | Dokumenter som skal offentliggjøres | Dokumenter som kan gis ut ved innsynsforespørsel | Dokumenter som ikke skal/kan offentliggjøres |
|---|-----------------------|-------------------------------------|-----------------------------------------------|-----------------------------------------------|
| **Ingen sensitiv informasjon** | Publiserte forskningsrapporter, statistikk, lover, nettsteder, avisartikler | Utkast til høringsnotater, faglige vurderinger |                                               |                                               |
| **Sensitiv info (interne vurderinger)** |                       |                                     |                                               | R-notater, interne strategidokumenter, dokumenter med taushetsplikt, beredskapsplaner |
| **+ Person-opplysninger** |                       | Dokumenter med anonymiserte data    |                                               | Arbeidskontrakter, personalmapper              |
| **+ Særlig kategori av sensitive person-opplysninger** |                       | Aggregert helsedata til statistikk   |                                               | Pasientjournaler, helserapporter               |
| **+ Forretnings-hemmeligheter** |                       |                                     | Interne vurderinger ved anskaffelser + sladdede dokumenter fra leverandør | Tilbud anskaffelser usladdet                    |
| **Kan gi konkurransefordeler** |                       | Anbudsgrunnlag før offentliggjøring |                                               |                                               |
| **+ Har sperrefrist** |                       | Statsbudsjett før offentliggjøring, enkelte proposisjoner, børssensitiv informasjon |                                               |                                               |
| **+ Sikkerhetsgradert informasjon** |                       |                                     |                                               | Dokumenter merket BEGRENSET, KONFIDENSIELT, HEMMELIG, STRENGT HEMMELIG |

##  Omfang

|   |   |
|---|---|
|**Must have:**  <br>Add your project's core requirements|- Laste opp ett dokument om gangen<br>    <br>- Opplastings-ikon<br>    <br>    - import { UploadIcon } from '@navikt/aksel-icons';|
|**Nice to have:**  <br>Add anything you want but don't strictly need|- Laste opp flere dokumenter om gangen<br>    <br>- “Drag and drop”-opplasting<br>    <br>- “Empty state” som beskriver hva man skal gjøre|
|**Not in scope:**  <br>Add anything you don't want to include|- Muligheten til å redigere dokumentene du laster opp<br>    <br>    - Eller noen form for å endre innholdet som er i dokumentene (utenom eventuelt metadata)|

##  Antagelser

Å ikke kunne laste opp egne dokumenter vil oppleves som en “dealbreaker”, eller være blokkerende, for flere av brukerne våres, siden de håndterer interne dokumenter som ikke kan deles med andre.

##  Åpne spørsmål

|                                                                                                                                                                                                                        |                                                                                                                                                       |                                                                      |                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------- |
| **Spørsmål**                                                                                                                                                                                                           | **Kommentar**                                                                                                                                         | **Svar**                                                             | **Dato besvart**      |
| Hvor viktig er det egentlig for brukeren å dele tråder i det hele tatt?<br><br>Eller sagt på en annen måte:<br><br>Hvor stort savn ville det vært for brukeren hvis vi ikke tilrettelegger for deling i det hele tatt? |                                                                                                                                                       | e.g., We'll announce the feature with a blog post and a presentation | Type // to add a date |
| Er det en fordel eller ulempe dersom dokumentet automatisk slettes etter 30 dager med inaktivitet?                                                                                                                     | Ref punktet under lagring i steg 2 “Opplastede dokumenter slettes automatisk etter 30/60/90 dager med inaktivitet (hvis sikkerhetskrav krever dette)” |                                                                      |                       |
| Burde vi også tilrettelegge for at man kan legge ved dokumenter i chatboksen?                                                                                                                                          |                                                                                                                                                       |                                                                      |                       |
![Vedlegg i chatboksen](Pasted%20image%2020251215094350.png)

##  Interaksjon og design

Dette er utforsket fra et designståsted i sammenheng med

https://digdir.atlassian.net/wiki/spaces/SK/pages/3347546115

##  Referanser

Sagt om funksjonaliteten i workshop med pilotbrukerne (juni 2025):

> _Veldig ønskelig!_

> _Må kun være tilgjengelig for den enkelte sluttbrukeren, og sikkert._

Altså at dokumentene ikke deles med andre, og at sikkerheten er ivaretatt.

> _Tilleggskilde er 10/10!_