## Kort oppsummert

Generativ kunstig intelligens kan absolutt gjøre kunnskapsarbeidet raskere og mer effektivt, men menneskelig innsikt og kvalitetssikring. Som en av behovseierne sa etter demoene:  

> [!quote] Sitat
> >_Kunnskapsarbeid som en læringsprosess er så viktig å ha med oss. Hvis folk har en forestilling om at vi skal trykke på en knapp for å lage et kunnskapsgrunnlag, også får vi ut et dokument, og deretter er det en annen KI-agent i andre enden som leser dokumentet etterpå. Så har vi hoppet over den delen som er som er hele poenget! Nemlig den menneskelige innsikten i hva vi driver med._
  
Sagt på en annen måte – “Vi er ikke ferdige når vi lager et verktøy” (sitat, utvikler)

## Kort om hacke-uka

I september 2025 arrangerte vi i Kunn

Etter demoene på slutten av uka ble det sagt fra den ene behovseieren til gruppa om digitaliseringstiltak:

> _Dette har vært en fest! Det har vært superspennende å være med, og FOR en kompentanse vi har altså. Herregud, det er virkelig imponerende. Det som Eira, Marie, og utviklerne har gjort, altså jeg er målløs. På så kort tid! Det er fantastisk. Om vi bare kunne arbeide sånn, så er vi jo uslåelige altså. Og potensialet her, det er jo gigantisk!_

Av de tre gruppene og casene vi hadde var det to av dem som overlappet mer med hverandre. Casene som handlet om konsulentbruk og digitaliseringsprosjekter handler begge om å gå gjennom mange dokumenter, og finne innsikten underveis. Disse kan derfor sees i sammenheng, mens caset om etatstyring skiller seg ved at brukeren kun ser på 2-3 dokumenter for én og én virksomhet av gangen.

### Bakgrunn og formål

Hacke-uka ble arrangert for å utforske hvordan vi kan møte brukernes stadig mer komplekse og ambisiøse bestillinger – typisk forespørsler som krever analyse av store dokumentmengder, faglig skjønn og høy presisjon. Målet var å teste konsepter som kan støtte kunnskapsarbeid i offentlig sektor, og samtidig ivareta læringsprosessen hos brukerne.

## Nyttige linker

### Demoene fra de ulike gruppene

1. [Demo av løsningen om konsulentbruk](https://vimeo.com/1119042810?fl=tl&fe=ec)
2. [Demo av løsningen om etatstyring](https://vimeo.com/1119042753?share=copy&fl=sv&fe=ci)
3. [Demo av løsningen om digitaliseringstiltak](https://vimeo.com/1119042862?fl=tl&fe=ec)

---

## Bakteppet for hacke-uka

Grunnen til at vi valgte å arrangere hacke-uka var for å utforske hvordan vi kan imøtekomme brukernes mer “ambisiøse bestillinger”, som vi kaller det.

Prakt-eksempelet på en ambisiøs bestilling er som følger

> _Kan du gå gjennom samtlige årsrapporter, tildelingsbrev og evalueringer etter 2023 og lage en liste over samtlige utfordringer nevnt under begreper som økonomistyring, internkontroll, etatsstyring, virksomhetsstyring, tilskuddsforvaltning, stønadsforvaltning, brudd på økonomiregelverket, merknader fra Riksrevisjonen._
> 
> _Sammenstill dette i en tabell hvor begrep om antall tilfeller og år fremgår. I tillegg en stikkordsliste med en omtale av den enkelte utfordring som omtaler hvilke etater som har denne utfordringen._
> 
> _Det er kun aktuelt å se på statlige virksomheter og departement._

### For å besvare spørsmålet må Kunnskapsassistenten altså:

- Analysere 1158 dokumenter
    - Fra 191 virksomheter og departementer
    - Fordelt over to år
- Vurdere innholdet i dokumentene opp mot 8 “faktorer”
    - Forstå hva brukeren mener med et “økonomisk avvik” osv.

Dagens versjon av Kunnskapsassistenten er ikke i stand til å gjennomføre den jobben. Av flere årsaker. Resultatet du får vil være noe sånt som dette:

![](Pasted%20image%2020251215113638.png)

I eksempelet gir Kunnskapsassistenten svar på 7 virksomheter, men det skulle vært nærmere 170-190 totalt

Sånn som vi har tilrettelagt det fram til nå har vi satt en begrensning på ca 10-20 dokumenter i “kontekstvinduet” for et svar. Grunnen til det er blant annent for å redusere risikoen for hallusinering. Som kan oppstå når en språkmodell sjonglerer en stor mengde dokumenter.

Det blir også vanskeligere å legge merke til om hallusinering skjer, siden det er så store mengder info å kvalitetssjekke.

En viktig ting å merke seg er at disse “ambisiøse bestillingene” ikke er unntakstilfeller, men trender. Det som er interessant er at folka som skriver dem havner i hver sin ende av skalaen for hvor godt kjent de er med å bruke kunstig intelligens-verktøy. De uerfarne tror at KI kan gjøre hva som helst, fordi det er man hører i media. De erfarne derimot antar kanskje at de ikke vil få et bra svar, men ønsker fremdeles å teste verktøyet for å se hva det virkelig kan få til. 

### Hva er situasjonen når man skriver en ambisiøs bestilling?

- Du vet hva du leter etter og informasjonen finnes. Informasjonen består av tydlige parametre som ikke krever faglig vurdering for å identifisere. Du har behov for å samle informasjonen i en enkel oversikt
    - For eksempel om du skal forberede deg til et styringsmøte (#etatstyring)
- Du vet hva du leter etter og informasjonen finnes. Det krever faglig skjønn å forstå hva som er relevant informasjon og hva som ikke er det. Du har behov for å samle informasjonen i en enkel oversikt.
- Du vet ikke hva du leter etter før du begynner å lete, og din egen forståelse av hva du ser etter oppdateres underveis. Det kreves faglig skjønn for å forstå hva som er relevant for analysen og hvorfor.

### Kontekster for bruk av oversikt over informasjon

- Informasjonen brukes til å trekke ut noen generelle innsikter og si noe om et overordnet område. Krav til sannsynlighet ikke 100% presisjon.
- Informasjon brukes til å si noen om enkelte virksomheter. for rapportering. Krav til 100% presisjon
- Informasjon trengs/hentes til spesifikke tidspunkt (f.eks. i et årshjul). Krav til tilgang til informasjonen/dokumentene, og evt. mulighet for å få de tilgjengeliggjort
- Styringsmøter og eventuelle adhoc-analyser

### Brukerbehov ved ambisiøse bestillinger

- Definere forskningsspørsmål og hva man ser etter selv, få hjelp til å finne og strukturere data.
- Tillit til resultat
- Få riktig informasjon på aktuelle rapportertingspunkter, uten tolking/oppsummering
- Kvalitetssikre kildene

---

## Innsikt fra de ulike casene

### Konsulentbruk

![Skisse av konseptet om konsulentbruk](Pasted%20image%2020251215113707.png)


> [!important] Beskrivelse av konseptet
Brukeren trener modellen med egne faglige vurderinger over tid — og bygger gradvis en tillitsverdig oversikt gjennom aktiv samhandling med dokumentene.

#### Konseptet forutsetter at..

- Brukeren kan mate inn sitt oppdrag og egen operasjonalisering av oppdraget
- Systemet hjelper brukeren med å definere indikatorer og dimensjoner de er på jakt etter
- Modellen trenes videre basert på brukerens vurderinger av et utvalg dokumenter
- Funnene presenteres i en strukturert tabell som viser hva brukeren leter etter — og hvor det finnes

#### Omfang for hacke-uka

- La brukeren søke opp et tema i dokumentet, og vurdere svarene som bra eller dårlig
- Eksponere brukeren for grunnlaget for vurderingene underveis

> [!info] Verdt å merke seg
> Det er et ønske fra behovseierne å finne bearbeidingene/trådene som andre har gjort, så de kan bruke det arbeidet seinere. Med tanke på sikkerhet, personvern og lagring vil dette være relevant for deling av tråder, som vi har diskutert rundt det å [laste opp egne dokumenter](Last%20opp%20egne%20dokumenter.md).

| **Hva fungerte bra?**                                                                                  | **Hva var utfordringene?**                                                                                           |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Fleksibilitet i modellen                                                                               | Ulik metode ved ulike analyser                                                                                       |
| Bygge egne kategorier                                                                                  | Krever mye av brukeren                                                                                               |
| Mulighet for å søke, vurdere og samle relevante tekst-chunker                                          | Ikke en eksakt vitenskap                                                                                             |
| Reduserer drastisk hvor mye innhold brukeren må lese gjennom, samtidig som vi bevarer læringsprosessen | Siden språkmodellen henter ut informasjon for deg må brukeren ha høy tillit til fremgangsmåten å stole på resultatet |

![](Pasted%20image%2020251215115152.png)

![](Pasted%20image%2020251215115145.png)

![](Pasted%20image%2020251215115138.png)

![](Pasted%20image%2020251215115129.png)

![](Pasted%20image%2020251215115119.png)

---

### Etatstyring

> [!important] **Beskrivelse av konseptet**
> 
> Løsningen sammenligner et tildelingsbrev og en årsrapport ved å hente ut den relevante informasjon ordrett fra dokumentene. Som deretter lar brukeren fokusere på vurdering og kvalitetssikring av innholdet, som skal brukes til et såkalt “forberedelsesnotat”.
> 
> Hvert departement fyller det ut tre ganger for hver statlige virksomhet som de har ansvar for. I DFD sitt tilfelle er det 7 virksomheter, om jeg ikke husker feil.

![Skisse av etatstyringskonseptet](Pasted%20image%2020251215113822.png)

Det som står i den blå boksen under Sammenstilling på høyre side, “Rapportering på vesentlig avvik fra nasjonal strategi for info..” er da den informasjonen fra årsrapporten som er relevant fra styringsparameter 3.

#### Konseptet forutsetter at..

- Man kan sammenligne tildelingsbrev og årsrapport
    - Løsningen samler den relevante informasjonen fra dokumentene
- Etterspurt informasjon gjengis ordrett fra årsrapporten
    - KI-assistenten skal ikke oppsummere, tolke eller reformulere informasjon som hentes

#### Omfang for hacke-uka

- Kun årsrapport og ett tildelingsbrev
    - Arbeidet trenger i utgangspunkt også hovedinstruksen til virksomhetene, og mulighetene til å laste opp supplerende tildelingsbrev og tertialrapporter, men dette er utenfor scope.
- La brukeren hente ut spesifikke rapporteringspunkter fra tildelingsbrevene
- Sammenstille rapporteringspunktene fra tildelingsbrevet med årsrapporten til virksomheten
    - Som deretter legger grunnlaget for vurderingsarbeidet som skal stå i forberedelsesnotatet

**Verdien av konseptet**

- Prosessen forenkles og brukerne bruker mindre tid på å finne og hente ut informasjonen til forberedelsesnotatet
- Brukerne får mer tid til kvalitetssikring og vurderingene som skal gjøres


> [!NOTE] Potensiell gevinst
> 
> En potensiell gevinst med dette caset er at departementet får bedre forståelse for utfordringene til underliggende virksomhet over tid. Man får ikke bare et øyeblikksbilde, men mer kontinuerlig samhandling. Bedre dialog.

| **Hva fungerte bra?**                                                                                                             | **Hva var utfordringene?**                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Kan gjenbruke rapporteringspunktene fra et forberedelsesnotat til det neste, fra samme virksomhet                                 | Tertialrapportene blir ikke publisert for offentligheten, og må da kunne lastes opp direkte |
| Bruk av løsningen til forberedelse                                                                                                | Årsrapporter kommer på ulike tidspunkt                                                      |
| Innsikt i utfordringer over tid                                                                                                   | Hovedinstruks manglet, og er essensiell for arbeidet                                        |
| Kan tilrettelegge for effektmåling som del av løsning, ved å sammenligne tildelingsbrevet opp mot årsrapporten i sammenstillingen | Vanskelig å standardisere rapportering                                                      |
| Mulighet for å samhandle mellom etatstyrer og etat på løpende basis, også mellom etatstyringsmøtene                               |                                                                                             |
| Tilnærmingen kan tilpasses for hver virksomhet (ved å bruke begrepene som faktisk brukes)                                         |                                                                                             |


> [!info] Verdt å merke seg
> 
> Der de andre casene har behov for å se gjennom og sammenligne hundrevis av dokumenter over tid (fra mange virksomheter), gjerne med KI-assistentens hjelp til tolking, skiller dette caset seg ut med å vurdere virksomheter enkeltvis basert på noen få dokumenter. 
> 
> Hvor brukeren har ansvar for kun noen få virksomheter, og ingen ønske om tolkning fra KI-assistenten. Kun hjelp til å hente ut info, for å tilrettelegge for menneskelig vurdering.

---

### Digitaliseringstiltak

**Skisse av grensesnittet for en tabelltilnærming**, basert på [Simons prototype](Simons%20prototype.md):

![Skisse av grensesnittet for en tabelltilnærming](Skisse-tabelltilnærming-hacke-uka.png)

> [!important] **Beskrivelse av konseptet**  
> 
> Digdir må lage en oversikt over pågående og planlagte digitaliseringstiltak for å sørge for en helhetlig og langsiktig prioritering i offentlig sektor. Men det er vanskelig og tidkrevende å få oversikt. Konseptet innebar å lage en spesialisert løsning for dette behovet, men også ivareta balanse mot en generell løsning slik at den kan tilpasses av brukeren. Det var ønskelig å sammenstille oversikten i en tabell, ved å benytte dokumenter fra Kudos.

#### **Konseptet forutsetter..**

- En oversikt over digitaliseringstiltak i offentlig sektor
    - Inkluderer forhåndsdefinert metadata for hver virksomhet
    - Sammenligning og analyse
- Muligheten til å kvalitetssikre innholdet
- Tabellvisning
- Se kilden i en dokumentsamling
- Konvertering til excel
- Laste opp flere dokumenter
- Be om manglende informasjon fra virksomheter


> [!info] Til info
> 
> Ambisjonen her var også at oversikten blir en slags database som kan gjenbrukes til samme forespørsler. Man kan også tenke seg at innholdet oppdateres en gang i året (eller ved gitte intervaller), og at brukeren informeres om oppdateringer på epost f. eks.

> **Nevnt av behovseier:**  
> _Vi har behov for styringsinformasjon, og den må være strukturert på en viss måte (finansiering, kobling til digitaliseringsstrategien osv.)_

#### **Omfang for hacke-uka**

- Skape en oversikt over digitaliseringstiltak kun for kunnskapssektoren for 2024/2025
    - Ambisjonen er å vise at løsningen kan ta høyde for å gjøre samme jobb med **alle** de statlige virksomhetene
- Tilrettelegge for at kunnskapsarbeidere kan bearbeide innholdet
- Vise hvordan KI kan brukes som et verktøy for å frigjøre mer tid til å gjøre faglige vurderinger

#### Verdien av konseptet

> [!important] Verdt å merke seg
> 
> **Tre personer jobbet i to uker for å samle informasjon** om digitaliseringsprosjektene til virksomhetene. Og må fremdeles gjøre det manuelle arbeidet med å sende det tilbake til kvalitetssjekk til virksomhetene for å vurdere om det stemmer.

**Sagt om kvalitetssikring fra en av interessentene:**

> _Om det er vi (mennesker) som gjør kvalitetssjekken som deretter sendes tilbake til virksomhetene, eller om det er KI som gjør det, det er det samme._

| **Hva fungerte bra?**                                                            | **Hva var utfordringene?**                                                                                                                           |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strukturert tabellvisning                                                        | Tabeller må være redigerbare                                                                                                                         |
| Trappetrinnsmodell for datainnhenting, med mulighet for forhåndsutfylte skjemaer | Informasjoner spredt over mange kilder                                                                                                               |
| Forhåndsdefinerte forslag brukeren kan gjøre                                     | Digitaliseringstiltak kan ha ulike navn i ulike dokumenter                                                                                           |
| Kan knekke koden på det å knytte sammen data fra forskjellige kilder             | KI kan gi falske positiver (som å tolke et tiltak som har endret navn f. eks som to ulike tiltak, eller at den finner på nye tiltak som ikke finnes) |
| Tanken om en dedikert agent for kvalitetssikring                                 | Vanskelig å kvalitetssikre automatisk                                                                                                                |
- Trappetrinnsmodell for å skaffe en fullstendig oversikt over digitaliseringstiltak i offentlig sektor
    - Søke i Kudos-databasen
    - Supplere informasjon fra virksomhetens nettside
    - Tabellen fylles ut ved at man sender ut en epost f. eks til deltagere, som selv kan fylle ut en forhåndsutfylt data i tabellen
        - identifiser manglende informasjon (gjennom skjema eller epost)

![Trappetrinnsmodellen](Trappetrinnsmodellen.png)

Det legges vekt på dette med å inkludere virksomhetene som står bak digitaliseringsprosjektene. Hvor f. eks man viser til ferdigutfylt informasjon som virksomheten deretter kan selv redigere, for å nyansere informasjonen i større grad.

> [!info] Agentrolle
> En oppgave for en agent som er dedikert til kvalitetssikring kunne vært å oppdatere et tiltak dersom navnet endrer seg over tid, i og med at digitaliseringstiltak kan ha ulike navn i ulike dokumenter.

**Strukturert tabellvisning over digitaliseringstiltak:**

![Strukturert tabellvisning over digitaliseringstiltak](Pasted%20image%2020251215114633.png)

**Forhåndsdefinerte forslag brukeren kan benytte seg av:**

![Forhåndsdefinerte forslag brukeren kan benytte seg av](Pasted%20image%2020251215114658.png)

> [!NOTE] Framtidig mulighet
> Til en kvalitetssikrende agent kan man velge en språkmodell som er sterk på tallforståelse. I tillegg til å gi agenten tilgang på et programmeringsspråk eller kalkulator som verktøy.

---

## Læring på tvers av caser

### Kunnskapsarbeid

Et viktig funn er at kunnskapsarbeid ikke bare handler om å produsere resultater, men om å lære underveis. Automatisering må ikke fjerne den menneskelige innsikten – det er den som gir verdi. KI-verktøy skal støtte, ikke erstatte, den faglige vurderingen.

Brukerne ønsker:

- Å iterere på oversikter over tid
- Å bruke tidligere arbeid som utgangspunkt for nye analyser
- Å dele metoder og resultater med andre – både internt og eksternt
- Å få indikasjoner, ikke nødvendigvis fasiter

**Utviklerperspektivet:**

- Trenger mer tid til å jobbe med systeminstrukser/prompting
- Om vi skulle gjort det igjen hadde det vært ønskelig å tyvstartet mer, men om man tilrettelegger for mye i forkant kan det også virke begrensende når man er i prosessen
- Det er mulig å få til mye på kort tid, og bygge skreddersydde løsninger med generelle byggeklosser
- KI endrer innsatskostnadene dramatisk – fra dyrt og tidkrevende til lav kost og høy fleksibilitet
- Når samtalene og arbeidet struktureres godt, blir utvikling mer tilgjengelig og iterativ
- Utvikling er ikke lenger flaskehalsen – tverrsektorielt samarbeid kan bli den nye utfordringen
- Vi er ikke ferdige når verktøyet er laget – kompetansebygging og videreutvikling må til

**Behovseierperspektivet:**

- Arbeidet blir mer faglig interessant – mindre administrasjon, mer fokus på innsikt
- Det er viktig å bevare nyanser, avvik og detaljer – ikke alt kan eller bør effektiviseres bort
- KI-verktøy må støtte refleksjon og problematisering, ikke bare levere svar

#### Designperspektivet

- Første halvdelen av uka er ansvaret i større grad hos designeren. Hvor problemstillingen og behovet defineres
- Vi har ikke kontroll over grensesnittet, for det er ikke tid til å iterere over detaljene

### Prinsipper

Disse prinsippene kom fra gruppen om konsulentbruk, men oppfattes som gjeldende for alle gruppene. Prinsippene var ment som retningslinjer for konseptet (i utgangspunktet for caset om konsulentbruk, men gjeldende for flere), for å se om valgene som ble tatt støtter verdiene løsningen skal ha.

1. **Tillitsbyggende og faglig forankret:** Brukeren må kunne stå inne for det som leveres. Det krever forståelse, ikke bare informasjon.
2. **Utforskende og lærende:** Man vet ikke alltid hva man leter etter før man begynner å lete. Analysen utvikler seg underveis.
3. **Tid til refleksjon:** Kunnskap utvikles over tid. Innsikt krever balanse mellom fordypning og fart.
4. **Menneskelig dømmekraft i sentrum:** KI skal støtte, ikke erstatte, den faglige vurderingen.

## Hva kan vi ta med videre fra løsningen/ konseptet vi lagde

### Det som fungerte bra med konseptene

- Koble indikatorer til tekst (eller knytte en kategori til teksten som er valgt)
- Et dedikert arbeidsområde hvor finne, vurdere og samle relevante info som du kan jobbe med informasjon over tid
- Strukturert tabellvisning
    - For å redusere risikoen for å gi feil svar i en stor oversikt, kan vi først gi en tom oversikt som kun viser kategoriene/kriteriene vi tenker å inkludere? Før den er ferdigutfylt
- At agenten/språkmodellen selv kan hente ut info fra virksomheters dokumenter (som årsrapporter og tildelingsbrev)
- At agenten går gjennom dokumenter side for side
    - Gir inntrykket av at den er grundig, samtidig som det er relaterbart for den manuelle prosessen til brukeren.
- Tanken om å ha en dedikert agent for kvalitetssikring ble vurdert som svært nyttig

> _Om det er vi (mennesker) som gjør kvalitetssjekken som deretter sendes til virksomhetene, eller om det er KI som gjør det, det er det samme._

### Det som manglet eller skapte utfordringer

- Behov for å laste opp dokumenter som ikke finnes i Kudos
- Manglende brukervennlighet
- Variasjon i begrepsbruk mellom virksomheter skaper utfordringer for datakvalitet, og gjør det vanskelig å vite om all nyttig info hentes fram av språkmodellen
- Lav tillit til KI-resultater, særlig ved manglende transparens
- Vanskeligheter med å forstå store oversikter
- Det er variasjon i hvordan data registreres fra virksomhetene, og en standardisering av dette er en essensiell del for arbeidet, som ikke dekkes av en KI-løsning.

## Muligheter framover

- Utarbeide satsningsforslag basert på innsiktene fra hacke-uka
- Dra nytte av interne ressurser og kompetanse for videre utvikling
- Utforske hvordan løsningen kan skaleres og tilpasses andre områder og behov
- Bidra til rapporten fra Oppdrag 1-gjengen med konkrete anbefalinger og erfaringer
- Hacke-uka har vist at det er mulig å utvikle kraftfulle, fleksible og læringsfremmende KI-løsninger på kort tid – og at det gir verdi både for fagmiljøene og for offentlig sektor som helhet.
- Relatert til Styringsassistenten: Snu på perspektivet og la underliggende etater bruke løsningen, ikke departementet. Vi laster inn dokumentene og sjekker hvordan vi scorer og så kan vi tilpasse teksten i årsrapporten.
    - Hva hvis begge virksomheter var i samme løsning og kunne samhandle over tid med styring.
    - Legge effektmåling inn i styringsassistenten?
        - Måler mer konkrete ting i dag og ikke faktisk impact.
        - Måle verdiskaping bedre
- Datasett som kan brukes av flere kan være av stor verdi. I tilfelle til konsulentbruk-caset vil datasettet være vel så verdifullt som rapporten som leveres.

## Om hacke-uka som arbeidsform

### Arbeidsform og metode

Hacke-uka som arbeidsform ble opplevd som effektiv og engasjerende. Den ga rom for:

- Tverrfaglig samarbeid
- Å utforske tilnærminger man ikke ville gjort ellers
- Behovseiere ble direkte involvert i utforskning og utvikling
- Refleksjon rundt etablerte arbeidsprosesser (som drar nytte av å bli utfordret), og hvordan teknologi kan brukes for å effektivisere dem

### Hva fungerte godt med arbeidsformen

- Kort vei fra idé til prototype
- Tett samarbeid mellom utviklere og behovseiere
- Mulighet for å teste og justere underveis
- Skapte engasjement og eierskap hos deltakerne
- Casene var tydelig definert i forkant, uten at de ble begrensende i praksis
- Viktig å prioritere planlegging i forkant, for det tjener man på når man først er i gang
- Nyttig med separate gjennomganger med de ulike rollene hver for seg
    - At designerne får stilt sine spørsmål om hva som er forventet av dem
    - Utviklerne får forberedt tilganger, og tatt teknologivalg som de trenger
    - Behovseierne får tid til å reflektere kort om hva som utgjør caset
- Nyttig med tørrtrening i forkant for å forstå hva som ikke er godt nok, eller hvordan man tilrettelegger for samarbeid
- Forberedelser er viktig
- Alle deltagerne var forberedt på det som skulle gjøres

### Utfordringer med arbeidsformen

- Begrenset tid til å fordype seg i komplekse problemstillinger
    - Siden behovseierne hadde satt av så mye tid de første to dagene fikk vi fremdeles dykket dypt ned i behovene
- Stammespråk kan skape en barriere
- “Flere kokker mer søl”-situasjon, hvor de større gruppene hadde vanskeligere for å ta beslutninger enn de små gruppene
    - Ulempen med mindre grupper derimot er at man er ekstra sårbar for sykdom f. eks.
        - I løpet av uka var det 4 av deltagerne som ble syke, og måtte droppe en eller to dager
- Designrollen i denne arbeidsformen handler mer om kommunikasjon. For det var ikke tid til å iterere på løsningen, og gjøre noe særlig forbedringer på brukeropplevelsen. Siden det krever mer arbeid fra utvikleren som måtte fokusere på å komme til et punkt hvor prototypen var brukbar.

### Potensielle løsninger eller forbedringer

- Hadde vært nyttig med forklaring på ofte brukte begreper
    - Kanskje det er noe som kunne vært definert i forkant av hacke-uka?
- Det at noen deltagere “kommer og går” blir mer til støy enn det er til hjelp
    - Enten så er du med, eller så er du ikke med
- Felles informasjonskanal
    - Både for teamene hver for seg, men også for alle deltagerne for å si ting som “Møtes til en avslutning om 15 min” f. eks
- Samle og informere om post-its, penner, og eventuelt annet stæsj som kan brukes i arbeidet

---

> [!NOTE] Til info
> Hacke-uka ble oppsummert av Sigrid Nafstad (DIO) og Simen Strøm Braaten (Digdir).