#!/usr/bin/env python3
"""Analyze conversation topics from JSONL file and categorize them using LLM."""

import json
import logging
from collections import Counter
from typing import Dict, List

from openai import OpenAI
from tqdm import tqdm

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

# Ollama client for LLM operations
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)
model = "gpt-oss:120b-cloud"


def extract_user_queries(file_path: str) -> List[str]:
    """Extract user queries from JSONL conversation file."""
    queries: List[str] = []

    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            try:
                data = json.loads(line)
                # Extract messages from conversation
                if "messages" in data:
                    for msg in data["messages"]:
                        if msg.get("role") == "user":
                            # Use 'text' field instead of 'content'
                            content = msg.get("text", "")
                            if (
                                content and len(content) > 10
                            ):  # Filter out very short queries
                                queries.append(content)
            except json.JSONDecodeError:
                continue

    return queries


def get_categories() -> List[str]:
    """Return the list of available categories."""
    return [
        "Tildelingsbrev og styringsdokumenter",
        "NOU og offentlige utredninger",
        "Statistikk og datainnsikt",
        "Asyl og innvandring",
        "Tilskudd og finansiering",
        "Evalueringer og analyser",
        "Internasjonale forhold",
        "Maktbruk og tvang",
        "Befolkning og demografi",
        "Kultur og språk",
        "Likestilling og mangfold",
        "Årsrapporter og rapportering",
        "Forsvar og sikkerhet",
        "Digitalisering og AI",
        "Barnevern",
        "Fullmakter og myndighet",
        "Høringer og lovverk",
        "Personvern",
        "Offentlige anskaffelser",
        "Helse og omsorg",
        "Utdanning",
        "Arbeidsliv",
        "Økonomi og budsjett",
        "Kommunikasjon og informasjon",
        "Miljø og bærekraft",
        "Organisasjon og styring",
    ]


def categorize_query_with_llm(query: str) -> List[str]:
    """Categorize a query using LLM."""
    categories = get_categories()
    categories_str = "\n".join(f"- {cat}" for cat in categories)

    prompt = f"""Du er en ekspert på å kategorisere spørsmål fra norske offentlige virksomheter.

Gitt følgende spørsmål, velg de mest relevante kategoriene som spørsmålet handler om.
Et spørsmål kan tilhøre flere kategorier hvis det er relevant.
Hvis ingen kategori passer godt, returner en tom liste.

Tilgjengelige kategorier:
{categories_str}

Spørsmål: {query}

Returner BARE en JSON-liste med kategorinavnene, ingen annen tekst.
Eksempel: ["Årsrapporter og rapportering", "Likestilling og mangfold"]"""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.0,
        )

        response_text = response.choices[0].message.content
        if not response_text:
            logging.warning(f"Empty response from LLM for query: {query[:100]}...")
            return ["Annet"]

        response_text = response_text.strip()

        # Remove markdown code blocks if present
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1]
            response_text = response_text.rsplit("\n```", 1)[0]
            response_text = response_text.strip()

        try:
            result = json.loads(response_text)
        except json.JSONDecodeError as e:
            logging.warning(
                f"Failed to parse JSON response for query '{query[:100]}...': {response_text[:200]}"
            )
            return ["Annet"]

        # Validate result is a list
        if not isinstance(result, list):
            logging.warning(
                f"Expected list, got {type(result).__name__} for query '{query[:100]}...': {result}"
            )
            return ["Annet"]

        # Validate categories are in our list
        valid_categories = [cat for cat in result if cat in categories]

        if not valid_categories:
            return ["Annet"]

        return valid_categories

    except Exception as e:
        logging.error(f"Unexpected error categorizing query '{query[:100]}...': {e}")
        return ["Annet"]


def main(file_path: str, max_queries: int | None = None) -> None:
    """Main function to analyze topics.

    Args:
        file_path: Path to the JSONL file containing conversations
        max_queries: Maximum number of queries to process (None = all)
    """

    logging.info("Leser spørsmål fra filen...")
    queries = extract_user_queries(file_path)

    if max_queries:
        queries = queries[:max_queries]
        logging.info(
            f"Begrenset til {len(queries)} bruker-spørsmål (av totalt {len(extract_user_queries(file_path))})"
        )
    else:
        logging.info(f"Fant {len(queries)} bruker-spørsmål")

    # Categorize all queries
    logging.info("Kategoriserer spørsmål med LLM (dette kan ta noen minutter)...")
    category_counter: Counter = Counter()
    query_categories: Dict[str, List[str]] = {}

    for i, query in tqdm(enumerate(queries, 1), total=len(queries)):
        # if i % 10 == 0:
        #     logging.info(f"Kategorisert {i}/{len(queries)} spørsmål...")

        categories = categorize_query_with_llm(query)
        query_categories[query] = categories

        for category in categories:
            category_counter[category] += 1

    # Print results
    print("\n" + "=" * 60)
    print("KATEGORIER OG ANTALL SPØRSMÅL")
    print("=" * 60 + "\n")

    for category, count in category_counter.most_common():
        percentage = (count / len(queries)) * 100
        print(f"{category:.<45} {count:>6} ({percentage:>5.1f}%)")

    print("\n" + "=" * 60)
    print(f"Totalt antall spørsmål analysert: {len(queries)}")
    print("=" * 60)

    # Show some example queries for top categories
    print("\n\nEKSEMPLER PÅ SPØRSMÅL PER KATEGORI")
    print("=" * 60 + "\n")

    for category, _ in category_counter.most_common(10):
        print(f"\n{category}:")
        print("-" * 60)
        examples_shown = 0
        for query, cats in query_categories.items():
            if category in cats and examples_shown < 3:
                # Truncate long queries
                display_query = query[:150] + "..." if len(query) > 150 else query
                print(f"  • {display_query}")
                examples_shown += 1
            if examples_shown >= 3:
                break


if __name__ == "__main__":
    import sys

    # Usage: python analyze_topics.py [file_path] [max_queries]
    # Example: python analyze_topics.py ka_api/prod_conversations.jsonl 100
    default_file = "ka_api/prod_conversations_20251208_094358.jsonl"

    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        max_queries = int(sys.argv[2]) if len(sys.argv) > 2 else None
    else:
        file_path = default_file
        max_queries = None

    main(file_path, max_queries)
