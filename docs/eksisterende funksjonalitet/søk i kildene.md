
| **Relatert til** |          |
| ---------------- | -------- |
| **Status**       | complete |
## Linker til arbeid

- [Arbeidet i figma](https://digdir.atlassian.net/wiki/spaces/SK/pages/3563782192/Forbedring+S+k+blant+kildene#:~:text=Nyttige%20linker-,Arbeidet%20i%20Figma,-%2C%20Testmilj%C3%B8et)
- [Testmiljøet](https://test.kunnskap.digdir.cloud/)

## Formål

Sørge for at brukeren blir informert om at det finnes søkeresultater, og at man kan navigere til forrige og neste treff.

## Bakgrunn

Søket på høyresiden her er det vi jobber med å forbedre. Til å starte med var det ingen indikasjon på om du hadde fått treff på søket ditt, siden du selv måtte scrolle ned for å finne markerte ord blant kildene.

![Før forbedringer kildesøk](../images/Pasted%20image%2020251215092401.png)
Om du følger nøye med kan du se et eksempel på det i demofilmen fra seminaret vi hadde på Mesh:

<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1144800912?h=5fa0bc9cba&amp;title=0&amp;byline=0&amp;portrait=0&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="Demo av Kunnskapsassistenten 16-09-2025"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>

Der ser du at man må scrolle ned etter du har gjort søket ditt, for å se hvor i kildene søkeordet er markert i gult.

## Endringene vi har gjort

1. Lagt inn knapper for å navigere til forrige og neste treff
    1. Som altså navigerer deg direkte til søkeresultatene dine, én etter én.
2. Lagt til tekst som sier hvor mange treff du har på søket ditt    
3. Lagt til “empty state” dersom du ikke får noen treff på søket ditt
4. Lagt til muligheten til å “klarere”/fjerne søketeksten, for å starte på et nytt søk
5. Gjort søkefeltet “sticky”, slik at det forblir på toppen mens du scroller nedover kildene

## Bugs, eller rom for forbedring


> [!warning] **Søket oppleves som tregere nå enn tidligere. Hva kan være årsaken til det?**
> 
> Dagens implementasjon av [Designsystemet](https://designsystemet.no/) har noen begrensninger som går utover mulighetene til å gjøre mer tidkrevende analyser eller beregninger, slik som "søk i kildene"-funksjonaliteten. Disse utfordringene blir borte når vi oppgraderer til Electric v3

Når du har gjort et søk, og deretter søke på noe annet så burde søket endre seg. Ikke henge igjen på det forrige søket. Som i praksis betyr vel at søket gjerne skal skje fortløpende mens du skriver, ikke at der nødvendig å trykke på Enter.

Se skjermopptaket for å forstå hva jeg mener:

![kildesøk](kildesøk.mp4)

Opptaket viser også behovet for to ulike “states” – treff, og aktivt treff, som har hver sin farge. For å tydeligere indikere når man hopper mellom ulike treff, spesielt som er innenfor samme chunk eller "visning".

Dette påvirkes også av samme utfordring som på ytelse. Det vil oppleves like tregt å trykke på "neste" som det er nå når man trykker "enter".
