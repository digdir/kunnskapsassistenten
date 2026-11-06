#!/usr/bin/env python3
"""Analyze conversation topics from JSONL file and categorize them using embeddings."""

import json
import logging
from collections import Counter
from typing import Dict, List

import numpy as np
from openai import OpenAI
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

# Suppress HTTP request logs from OpenAI/httpx
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)

# Embedding method configuration
EMBEDDING_METHOD = "sentence_transformers"  # Options: "sentence_transformers" or "ollama"


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


# Initialize OpenAI client for Ollama embeddings
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)

# Initialize sentence-transformers model (lazy loading)
_sentence_model = None

def get_sentence_model() -> SentenceTransformer:
    """Get or initialize the sentence transformer model."""
    global _sentence_model
    if _sentence_model is None:
        logging.info("Loading sentence-transformers model...")
        # Using multilingual model for Norwegian text
        _sentence_model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
        logging.info("Model loaded successfully")
    return _sentence_model


def get_categories() -> Dict[str, str]:
    """Return category names with descriptions for embedding."""
    return {
        'Tildelingsbrev og styringsdokumenter': 'Tildelingsbrev, styringsdokumenter, styringsdialog og styringsmål for offentlige virksomheter',
        'NOU og offentlige utredninger': 'Norges offentlige utredninger (NOU), offentlige utredninger og utredningsarbeid',
        'Statistikk og datainnsikt': 'Statistikk, tall, data, nøkkeltall, SSB, Bufdir og datainnsikt',
        'Asyl og innvandring': 'Asylsøkere, enslige mindreårige, flyktninger, innvandring og mottak',
        'Tilskudd og finansiering': 'Tilskuddsordninger, finansiering, bevilgninger og tilskuddsforvaltning',
        'Evalueringer og analyser': 'Evalueringer, analyser, vurderinger og gjennomganger av tiltak og politikk',
        'Internasjonale forhold': 'Internasjonale sammenligninger, andre land, NATO, Ukraina og internasjonalt samarbeid',
        'Maktbruk og tvang': 'Maktbruk, maktmidler, tvang, tvangsmidler og bruk av makt',
        'Befolkning og demografi': 'Befolkningsutvikling, demografi, aldring og perspektivmeldinger',
        'Kultur og språk': 'Kultur, kulturpolitikk, språk, bokmål, nynorsk, oversettelser og kulturtiltak',
        'Likestilling og mangfold': 'Likestilling, kjønnsbalanse, mangfold, diskriminering og lønnsforskjeller',
        'Årsrapporter og rapportering': 'Årsrapporter, rapportering og rapporter fra offentlige virksomheter',
        'Forsvar og sikkerhet': 'Forsvar, forsvarsbudsjett, militært, verneplikt, sikkerhet, beredskap og cybersikkerhet',
        'Digitalisering og AI': 'Digitalisering, digital transformasjon, kunstig intelligens, AI, maskinlæring og automatisering',
        'Barnevern': 'Barnevern, barneombud, barnets rettigheter og barnevernstiltak',
        'Fullmakter og myndighet': 'Fullmakter, beslutningsmyndighet, delegering og myndighetsutøvelse',
        'Høringer og lovverk': 'Høringer, høringsuttalelser, proposisjoner, lovverk, forskrifter og regelverk',
        'Personvern': 'Personvern, GDPR, personopplysninger, persondata og databehandling',
        'Offentlige anskaffelser': 'Offentlige anskaffelser, innkjøp, anbudskonkurranser og anbud',
        'Helse og omsorg': 'Helse, omsorg, helsetjenester, sykehus, pasienter og pleie',
        'Utdanning': 'Skole, utdanning, elever, studenter, lærer, undervisning og universiteter',
        'Arbeidsliv': 'Arbeidsliv, ansatte, arbeidsforhold, rekruttering, lønn, NAV og sysselsetting',
        'Økonomi og budsjett': 'Økonomi, budsjett, regnskap og økonomistyring',
        'Kommunikasjon og informasjon': 'Kommunikasjon, medier, presse, sosiale medier og informasjonsarbeid',
        'Miljø og bærekraft': 'Miljø, klima, bærekraft, utslipp og forurensning',
        'Organisasjon og styring': 'Organisasjon, ledelse, styring, struktur og virksomhetsorganisering',
    }


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Calculate cosine similarity between two vectors."""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


def get_embedding_sentence_transformers(text: str) -> np.ndarray:
    """Get embedding using sentence-transformers (stable, direct Python)."""
    model = get_sentence_model()
    return model.encode(text, convert_to_numpy=True)


def get_embedding_ollama(text: str, model: str = "nomic-embed-text", max_retries: int = 5) -> np.ndarray:
    """Get embedding for text using Ollama with retry logic and rate limiting."""
    import time

    # Add small delay between requests to avoid overwhelming Ollama
    time.sleep(0.05)  # 50ms delay = max 20 requests/second

    for attempt in range(max_retries):
        try:
            response = client.embeddings.create(
                model=model,
                input=text
            )
            return np.array(response.data[0].embedding)
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff
                logging.warning(f"Embedding request failed (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                logging.error(f"Embedding request failed after {max_retries} attempts for text: {text[:100]}...")
                raise RuntimeError(f"Failed to get embedding after {max_retries} attempts") from e

    # This should never be reached due to the raise above, but satisfies type checker
    raise RuntimeError("Failed to get embedding")


def get_embedding(text: str, model: str = "nomic-embed-text") -> np.ndarray:
    """Get embedding using configured method.

    Args:
        text: Text to embed
        model: Model name (only used for Ollama method)

    Returns:
        Embedding vector as numpy array
    """
    if EMBEDDING_METHOD == "sentence_transformers":
        return get_embedding_sentence_transformers(text)
    elif EMBEDDING_METHOD == "ollama":
        return get_embedding_ollama(text, model)
    else:
        raise ValueError(f"Unknown embedding method: {EMBEDDING_METHOD}")


def categorize_query(
    query: str,
    category_embeddings: Dict[str, np.ndarray],
    threshold: float = 0.3,
    top_k: int = 3
) -> List[str]:
    """Categorize a query using embedding similarity.

    Args:
        query: The query text to categorize
        category_embeddings: Pre-computed embeddings for each category
        threshold: Minimum similarity threshold (0-1)
        top_k: Maximum number of categories to return

    Returns:
        List of category names
    """
    query_embedding = get_embedding(query)

    # Calculate similarities
    similarities: List[tuple[str, float]] = []
    for category, cat_embedding in category_embeddings.items():
        similarity = cosine_similarity(query_embedding, cat_embedding)
        similarities.append((category, similarity))

    # Sort by similarity
    similarities.sort(key=lambda x: x[1], reverse=True)

    # Get top categories above threshold
    categories = [cat for cat, sim in similarities[:top_k] if sim >= threshold]

    # If no category found, mark as "Annet"
    if not categories:
        categories.append('Annet')

    return categories


def restart_ollama() -> None:
    """Restart Ollama service to clear memory."""
    import subprocess
    import time

    logging.info("Restarting Ollama service...")
    try:
        # Stop Ollama
        subprocess.run(["pkill", "-9", "ollama"], check=False)
        time.sleep(2)

        # Start Ollama in background
        subprocess.Popen(
            ["ollama", "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        time.sleep(3)  # Wait for Ollama to start
        logging.info("Ollama restarted successfully")
    except Exception as e:
        logging.warning(f"Failed to restart Ollama: {e}")


def main(file_path: str, batch_size: int = 80) -> None:
    """Main function to analyze topics.

    Args:
        file_path: Path to the JSONL file containing conversations
        batch_size: Number of queries to process before restarting Ollama
    """
    print("Leser spørsmål fra filen...")
    queries = extract_user_queries(file_path)
    print(f"Fant {len(queries)} bruker-spørsmål\n")

    # Pre-compute category embeddings once
    print("Beregner embeddings for kategorier...")
    categories_dict = get_categories()
    category_embeddings: Dict[str, np.ndarray] = {}
    for category, description in categories_dict.items():
        category_embeddings[category] = get_embedding(description)
    print(f"Beregnet embeddings for {len(category_embeddings)} kategorier\n")

    # Categorize all queries in batches
    logging.info(f"Kategoriserer {len(queries)} spørsmål i batches på {batch_size}...")
    category_counter: Counter = Counter()
    query_categories: Dict[str, List[str]] = {}

    # Process in batches
    num_batches = (len(queries) + batch_size - 1) // batch_size

    for batch_idx in range(num_batches):
        start_idx = batch_idx * batch_size
        end_idx = min((batch_idx + 1) * batch_size, len(queries))
        batch_queries = queries[start_idx:end_idx]

        logging.info(f"Processing batch {batch_idx + 1}/{num_batches} (queries {start_idx}-{end_idx})")

        for query in tqdm(batch_queries, desc=f"Batch {batch_idx + 1}/{num_batches}"):
            categories = categorize_query(query, category_embeddings)
            query_categories[query] = categories
            for category in categories:
                category_counter[category] += 1

        # Restart Ollama between batches (except after the last batch)
        if batch_idx < num_batches - 1:
            restart_ollama()

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
        for query, cats in query_categories.items():
            if category in cats and examples_shown < 3:
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
