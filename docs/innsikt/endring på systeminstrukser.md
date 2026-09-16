## Bakgrunnen for arbeidet

Vi har lært at det å innta rollen som en sparringspartner er det mest fornuftige i arbeidsflyten til kunnskapsarbeidere. For å oppnå det er det flere grep vi må utforske, deriblant en [agentisk flyt](agentisk%20flyt.md), men også systeminstruksene vi har definert. Siden de i stor grad påvirker måten språkmodellen svarer på spørsmålene til brukeren.

Vi har gjort omfattende tester på ulike systeminstrukser, og anser oss ikke som ferdig med det arbeidet. Samtidig er det viktig å konkludere underveis.

I testene våre fokuserte vi hovedsakelig på to språkmodeller fra OpenAI, nemlig gpt4o som vi veit er stabilt god på norsk, men også gpt5, som var den nyeste modellen tilgjengelig i øyeblikket.

## Konklusjoner

- GPT4o er mer stabil
    - Gjør det den får beskjed om
    - Litt dårligere på formatering av tabeller enn gpt5
- GPT 5 er for kreativ
    - Kan hende den er bedre på agentisk RAG, men for øyeblikket foreslår den bare mye greier som vi veit at den ikke får til (som å lage en visuell framstilling av infoen, eller analysere alle statlige virksomheter selv om vi har sagt at det ikke går)
    - Bedre på formatering av tabeller i markdown

## Veien videre

1. Teste den siste instruksen på ulike spørsmål i sandkassemiljøet, for å se om den er bedre enn systeminstruksen vi har i produksjonsmiljøet
    1. Kan teste den på spørsmål vi allerede har i produksjonsmiljøet
2. Om vi konkluderer med at det blir en bedre sparringspartner så pusher vi det til produksjonsmiljøet