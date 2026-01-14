# -*- coding: utf-8 -*-
"""Mock responses for testing evaluations."""

import locale
from datetime import datetime

from agents.agent import AgentResponse
from agents.MockAgent import MockAgent


def get_agent() -> MockAgent:
    """Get a mock agent with predefined responses."""
    agent = MockAgent()

    # Get current date with Norwegian formatting
    try:
        locale.setlocale(locale.LC_TIME, "nb_NO.UTF-8")
    except locale.Error:
        try:
            locale.setlocale(locale.LC_TIME, "no_NO.UTF-8")
        except locale.Error:
            locale.setlocale(locale.LC_TIME, "")

    # P1
    agent.add_mock_response(
        query="Hvilke forbedringspunkter nevnes i årsrapportene?",
        response=AgentResponse(
            answer="""Her er noen av forbedringspunktene som nevnes i årsrapportene:

1. **Foreldreveiledning og ICDP-programmet**:
   - Behov for bedre tilrettelegging og gjennomføring av ICDP-programmet i kommunene, til tross for høy aktivitet og positive resultater blant foreldre. (Årsrapport Bufdir 2023)

2. **Kjønnsbalanse i utdannings- og yrkesvalg**:
   - Formålet med å fremme kjønnsutradisjonelle valg i skolen oppfattes som uklart og kan stå i kontrast til andre mål. Det er behov for bedre koordinering og samordning mellom aktører for å oppnå større endringer. (Årsrapport Bufdir 2024)

3. **Sikkerhet og beredskap**:
   - Behov for å systematisere arbeidet med sikkerhet og beredskap, inkludert bedre varslingsrutiner og etablering av vedlegg for håndtering av IKT-sikkerhetshendelser. (Årsrapport Bufdir 2023)

4. **Forebygging av vold og trusler mot ansatte**:
   - Omfanget av trening i trygghet og sikkerhet er lavere enn målene som er satt. Det er behov for økt oppmerksomhet på opplæring og forebygging av vold og trusler mot ansatte i barnevernsinstitusjoner. (Årsrapport Bufdir 2022)

5. **Kommunalt barnevern**:
   - Regionale forskjeller i barnevernstjenester, særlig i region nord, med høyere andel fristbrudd og omsorgsovertakelser. Det er behov for bedre samhandling og informasjonsutveksling i interkommunale samarbeid. (Årsrapport Bufdir 2023)

6. **Hjelpetiltak i barnevernet**:
   - Stigende etterspørsel etter opplæring og implementeringsstøtte for tiltak som TIBIR og PMTO. Det er behov for flere utdannede terapeuter for å møte etterspørselen og redusere ventetid. (Årsrapport Bufdir 2023)

7. **Likestilling og ikke-diskriminering**:
   - Behov for mer informasjon og støtte til kommuner og fylker for å oppfylle aktivitets- og redegjørelsespliktene. Videreutvikling av veiledning og verktøy for arbeidsgivere og offentlige myndigheter er nødvendig. (Årsrapport Bufdir 2022)

8. **Adopsjonsfeltet**:
   - Digitalisering av kompetansemoduler for adopsjonsarbeid er utsatt, og det er behov for å prioritere dette arbeidet fremover. (Årsrapport Bufdir 2023)

Disse punktene viser områder hvor det er identifisert forbedringspotensial for å styrke kvaliteten og effektiviteten i tjenestene.
"""
        ),
    )

    # P2: Date question response
    now: datetime = datetime.now()
    day_name: str = now.strftime("%A").lower()
    month_name: str = now.strftime("%B").lower()
    current_date_str: str = (
        f"I dag er det {day_name} {now.day}. {month_name} {now.year}.\n\n"
    )

    agent.add_mock_response(
        query="Hvilken dag er det i dag?",
        response=AgentResponse(
            answer=(
                current_date_str
                + "Nøkkelord: dagens dato, hvilken dag er det, dag i dag, "
                "dato i dag, dagens dato på norsk, hvilken ukedag er det, "
                "dagens dato og tid"
            )
        ),
    )

    # P3
    agent.add_mock_response(
        query="Fortell meg hva digdir skriver om Fellesføring 1: Systematisk og helhetlig arbeid for å redusere klimagassuslipp, naturfotavtrykk og energibruk",
        response=AgentResponse(
            answer="""Beklager, jeg kunne ikke finne spesifikk informasjon om "Fellesføring 1: Systematisk og helhetlig arbeid for å redusere klimagassutslipp, naturfotavtrykk og energibruk" i dokumentene fra Digitaliseringsdirektoratet (Digdir) som er tilgjengelige i konteksten.

Hvis du har flere detaljer eller ønsker å stille et annet spørsmål, kan jeg gjerne hjelpe!
"""
        ),
    )

    # P4
    agent.add_mock_response(
        query="Hvor mange prosent kvinner var ansatt i Digdir i 2024?",
        response=AgentResponse(
            answer="""41 prosent av de ansatte i Digdir i 2024 var kvinner. (Kilde: Årsrapport Digitaliseringsdirektoratet 2024)

Nøkkelord: Fellesføring 1 Digdir klimagassutslipp naturfotavtrykk energibruk, Digdir Fellesføring 1 systematisk helhetlig arbeid, Digdir klimagassutslipp naturfotavtrykk energibruk, Digdir ansatte kvinner 2024, Digdir kvinneandel ansatte 2024, Digdir ansattstatistikk 2024, Digdir kjønnsfordeling ansatte 2024
"""
        ),
    )

    # P5
    agent.add_mock_response(
        query="Hvor mange prosent kvinner er ansatt i Digdir i 2025?",
        response=AgentResponse(
            answer="""I år, 2025, er det dessverre ingen spesifikke data tilgjengelig i konteksten som angir prosentandelen kvinner ansatt i Digdir. Hvis du ønsker informasjon om tidligere år, kan jeg hjelpe med det.

Nøkkelord: Digdir ansatte kvinner 2025, Digdir ansatte kvinner 2024, Digdir ansatte kvinner 2023, Digdir årsrapport 2025, Digdir årsrapport 2024, Digdir årsrapport 2023, Digdir kjønnsfordeling ansatte
"""
        ),
    )
    return agent
