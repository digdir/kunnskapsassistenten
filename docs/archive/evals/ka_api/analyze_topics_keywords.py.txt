#!/usr/bin/env python3
"""Analyze conversation topics from JSONL file and categorize them."""

import json
from collections import Counter
from typing import Dict, List
import re


def extract_user_queries(file_path: str) -> List[str]:
    """Extract user queries from JSONL conversation file."""
    queries: List[str] = []

    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                # Extract messages from conversation
                if 'messages' in data:
                    for msg in data['messages']:
                        if msg.get('role') == 'user':
                            # Use 'text' field instead of 'content'
                            content = msg.get('text', '')
                            if content and len(content) > 10:  # Filter out very short queries
                                queries.append(content)
            except json.JSONDecodeError:
                continue

    return queries


def categorize_query(query: str) -> List[str]:
    """Categorize a query based on keywords and patterns."""
    query_lower = query.lower()
    categories: List[str] = []

    # Define category keywords (order matters - more specific categories first)
    category_keywords = {
        'Tildelingsbrev og styringsdokumenter': ['tildelingsbrev', 'tildelingsbrevene', 'tildelingsbrevet', 'styringsdialog', 'styringsdokument'],
        'NOU og offentlige utredninger': ['nou', 'utredning', 'utredninger', 'offentlig utredning'],
        'Statistikk og datainnsikt': ['statistikk', 'statistiske', 'tall', 'data', 'ssb', 'bufdir', 'datainnsikt', 'nøkkeltall'],
        'Asyl og innvandring': ['asylsøker', 'asylsøkere', 'enslige mindreårige', 'flyktning', 'innvandring', 'asyl'],
        'Tilskudd og finansiering': ['tilskudd', 'tilskuddsordning', 'stimulab', 'gevinst', 'gevinstkategori', 'finansiering', 'bevilgning'],
        'Evalueringer og analyser': ['evaluering', 'evaluer', 'analyse', 'vurder', 'gjennomgang'],
        'Internasjonale forhold': ['andre land', 'andre lands', 'internasjonalt', 'sammenlign', 'internasjonal', 'ukraina', 'nato'],
        'Maktbruk og tvang': ['maktbruk', 'maktmiddel', 'maktmidler', 'tvang', 'tvangsmiddel'],
        'Befolkning og demografi': ['befolkning', 'aldring', 'demografisk', 'perspektivmelding', 'demografi'],
        'Kultur og språk': ['kultur', 'kulturtanken', 'kulturell', 'kulturpolitikk', 'bokmål', 'nynorsk', 'språkrådet', 'språk', 'oversettelse', 'oversatt'],
        'Likestilling og mangfold': ['likestilling', 'kjønnsbalanse', 'kvinner', 'menn', 'mangfold', 'diskriminering', 'lønnsforskjeller'],
        'Årsrapporter og rapportering': ['årsrapport', 'rapport', 'rapporterer', 'rapportering'],
        'Forsvar og sikkerhet': ['forsvar', 'forsvarsbudsjett', 'militær', 'verneplikt', 'sikkerhet', 'beredskap', 'krise', 'risiko', 'cybersikkerhet'],
        'Digitalisering og AI': ['digitalisering', 'digital', 'digitalt', 'digitaliser', 'it-system', 'kunstig intelligens', 'ai', 'maskinlæring', 'chatbot', 'chat-bot', 'automatisering', 'ki'],
        'Barnevern': ['barneombud', 'barnets', 'barnevern', 'barns rettigheter', 'barnevernsinstitusjon'],
        'Fullmakter og myndighet': ['fullmakt', 'beslutningsmyndighet', 'delegering', 'myndighet'],
        'Høringer og lovverk': ['høring', 'høringsuttalelse', 'høringsvar', 'innspill', 'prop.', 'stortingsmelding', 'meld. st', 'lov', 'forskrift', 'regelverk', '§', 'paragraf', 'lovgivning', 'juridisk'],
        'Personvern': ['personvern', 'gdpr', 'personopplysninger', 'persondata', 'databehandling', 'samtykke'],
        'Offentlige anskaffelser': ['anskaffelse', 'offentlig innkjøp', 'anbudskonkurranse', 'anbud', 'konkurranse'],
        'Helse og omsorg': ['helse', 'omsorg', 'pasient', 'helsetjeneste', 'sykehus', 'fastlege', 'pleie'],
        'Utdanning': ['skole', 'utdanning', 'elev', 'student', 'lærer', 'undervisning', 'fag', 'universitet', 'uib', 'uio', 'ntnu'],
        'Arbeidsliv': ['arbeidsliv', 'ansatt', 'arbeidsgiver', 'arbeidsforhold', 'rekruttering', 'hr', 'lønn', 'sykemelding', 'permisjon', 'deltid', 'arbeidskraft', 'sysselsetting', 'nav'],
        'Økonomi og budsjett': ['økonomi', 'budsjett', 'regnskap', 'økonomistyring'],
        'Kommunikasjon og informasjon': ['kommunikasjon', 'medier', 'presse', 'sosiale medier', 'informasjon'],
        'Miljø og bærekraft': ['miljø', 'klima', 'bærekraft', 'utslipp', 'forurensning'],
        'Organisasjon og styring': ['organisasjon', 'ledelse', 'styring', 'struktur', 'organisering', 'virksomhet', 'dsb', 'politiet', 'udi', 'digdir', 'nkom', 'statsbygg', 'nim', 'nfi'],
    }

    # Check each category
    for category, keywords in category_keywords.items():
        for keyword in keywords:
            if keyword in query_lower:
                categories.append(category)
                break  # Only count once per category

    # If no category found, mark as "Annet"
    if not categories:
        categories.append('Annet')

    return categories


def main(file_path: str) -> None:
    """Main function to analyze topics.

    Args:
        file_path: Path to the JSONL file containing conversations
    """
    print("Leser spørsmål fra filen...")
    queries = extract_user_queries(file_path)
    print(f"Fant {len(queries)} bruker-spørsmål\n")

    # Categorize all queries
    print("Kategoriserer spørsmål...")
    category_counter: Counter = Counter()

    for query in queries:
        categories = categorize_query(query)
        for category in categories:
            category_counter[category] += 1

    # Print results
    print("\n" + "="*60)
    print("KATEGORIER OG ANTALL SPØRSMÅL")
    print("="*60 + "\n")

    for category, count in category_counter.most_common():
        percentage = (count / len(queries)) * 100
        print(f"{category:.<45} {count:>6} ({percentage:>5.1f}%)")

    print("\n" + "="*60)
    print(f"Totalt antall spørsmål analysert: {len(queries)}")
    print("="*60)

    # Show some example queries for top categories
    print("\n\nEKSEMPLER PÅ SPØRSMÅL PER KATEGORI")
    print("="*60 + "\n")

    for category, _ in category_counter.most_common(10):
        print(f"\n{category}:")
        print("-" * 60)
        examples_shown = 0
        for query in queries:
            if category in categorize_query(query) and examples_shown < 3:
                # Truncate long queries
                display_query = query[:150] + "..." if len(query) > 150 else query
                print(f"  • {display_query}")
                examples_shown += 1
            if examples_shown >= 3:
                break


if __name__ == '__main__':
    import sys

    # Usage: python analyze_topics.py [file_path]
    # Example: python analyze_topics.py ka_api/prod_conversations.jsonl
    default_file = 'ka_api/prod_conversations_20251208_094358.jsonl'

    if len(sys.argv) > 1:
        file_path = sys.argv[1]
    else:
        file_path = default_file

    main(file_path)
