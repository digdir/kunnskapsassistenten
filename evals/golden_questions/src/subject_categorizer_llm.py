"""Subject topic categorization using LLM.

This module provides LLM-based categorization of questions into Norwegian
public sector subject domain topics. Uses a separate LLM call from usage mode
categorization for better quality through focused prompts.
"""

import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List

from openai import OpenAI
from tqdm import tqdm

from .models import GoldenQuestion

logger = logging.getLogger(__name__)

# Subject domain categories derived from production data analysis
SUBJECT_TOPICS_TIER1 = [
    "Forvaltning og etatsstyring",
    "Digitalisering og kunstig intelligens",
    "Innovasjon og fornyelse",
    "Økonomi og budsjett",
    "Likestilling og mangfold",
]

SUBJECT_TOPICS_TIER2 = [
    "Arbeidsliv og HR",
    "Barnevern",
    "Statistikk og data",
    "Justis og rettsvesen",
    "Miljø og bærekraft",
    "Forsvar og sikkerhet",
    "Helse og omsorg",
    "Utdanning og forskning",
]

SUBJECT_TOPICS_TIER3 = [
    "Språk og kultur",
    "Internasjonale forhold",
    "Innvandring og integrering",
    "Annet",
]

ALL_SUBJECT_TOPICS = SUBJECT_TOPICS_TIER1 + SUBJECT_TOPICS_TIER2 + SUBJECT_TOPICS_TIER3

# LLM prompt for subject topic categorization
SUBJECT_TOPIC_SYSTEM_PROMPT = f"""Du er en ekspert på å kategorisere spørsmål fra norsk offentlig sektor inn i fagområder.

Din oppgave er å analysere spørsmålet og identifisere hvilke fagområder det handler om. Du skal velge 0 eller flere kategorier fra den predefinerte listen nedenfor.

**Kategorier (gruppert etter bruksfrekvens):**

TIER 1 - Høy bruk (100+ forekomster):
{", ".join(SUBJECT_TOPICS_TIER1)}

TIER 2 - Middels bruk (30-99 forekomster):
{", ".join(SUBJECT_TOPICS_TIER2)}

TIER 3 - Lavere bruk (18-29 forekomster):
{", ".join(SUBJECT_TOPICS_TIER3)}

**Retningslinjer:**
1. Et spørsmål kan ha 0 eller flere emneområder
2. Velg kun kategorier som er klart relevante for spørsmålet
3. Hvis spørsmålet ikke passer noen kategori, returner tom liste
4. Foretrekk spesifikke kategorier fremfor generisk "Annet"
5. Multi-label: et spørsmål kan tilhøre flere kategorier samtidig

**Returner JSON:**
{{"subject_topics": ["Kategori 1", "Kategori 2", ...]}}

**Eksempler:**

Spørsmål: "Hva er budsjettet til Digdir i 2024?"
→ {{"subject_topics": ["Økonomi og budsjett"]}}

Spørsmål: "Hvordan påvirker digitalisering mangfoldet i offentlig sektor?"
→ {{"subject_topics": ["Digitalisering og kunstig intelligens", "Likestilling og mangfold"]}}

Spørsmål: "Kan du gi et sammendrag?"
→ {{"subject_topics": []}}

Spørsmål: "Hvilke forbedringer er gjort i barnevernet etter 2023?"
→ {{"subject_topics": ["Barnevern"]}}

Spørsmål: "Hvordan kan innovasjon forbedre forvaltningen i offentlig sektor?"
→ {{"subject_topics": ["Forvaltning og etatsstyring", "Innovasjon og fornyelse"]}}
"""


def categorize_subject_topics_llm(
    question: GoldenQuestion,
    client: OpenAI,
    model: str = "gpt-oss:120b-cloud",
    max_retries: int = 0,
) -> List[str]:
    """
    Use LLM to categorize question into subject domain topics.

    This is a SEPARATE LLM call from usage mode categorization,
    allowing focused prompts for better quality.

    Args:
        question: Question to categorize
        client: OpenAI client configured for Ollama
        model: Model name to use
        max_retries: Number of retry attempts on failure

    Returns:
        List of subject topic strings (empty if no relevant topics)

    Raises:
        ValueError: If LLM returns invalid response after all retries
    """
    user_prompt = f"""Kategoriser dette norske spørsmålet:

Spørsmål: "{question.question}"

Returner JSON med subject_topics liste."""

    for attempt in range(max_retries + 1):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SUBJECT_TOPIC_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.0,
            )

            # Parse JSON response
            content = response.choices[0].message.content.strip()
            try:
                result = json.loads(content)
                topics = result.get("subject_topics", [])

                # Validate topics are in allowed list
                if not isinstance(topics, list):
                    raise ValueError(f"subject_topics must be a list, got {type(topics)}")

                # Validate each topic is a known category
                for topic in topics:
                    if topic not in ALL_SUBJECT_TOPICS:
                        logger.warning(
                            f"LLM returned unknown topic '{topic}' for question '{question.question[:50]}...'. "
                            f"Preserving topic for analysis."
                        )

                return topics

            except json.JSONDecodeError as e:
                logger.warning(
                    f"Invalid JSON response from LLM (attempt {attempt + 1}/{max_retries + 1}): {content[:100]}..."
                )
                if attempt == max_retries:
                    raise ValueError(f"Invalid JSON response after {max_retries + 1} attempts: {e}")
                time.sleep(2**attempt)  # Exponential backoff
                continue

        except Exception as e:
            logger.warning(
                f"Failed to categorize subject topics for question '{question.question[:50]}...' "
                f"(attempt {attempt + 1}/{max_retries + 1}): {e}"
            )
            if attempt == max_retries:
                raise ValueError(
                    f"Failed to categorize subject topics after {max_retries + 1} attempts: {e}"
                )
            time.sleep(2**attempt)  # Exponential backoff

    # Should not reach here, but just in case
    return []


def categorize_subject_topics(
    questions: List[GoldenQuestion],
    client: OpenAI,
    model: str = "gpt-oss:120b-cloud",
    max_workers: int = 10,
) -> tuple[List[GoldenQuestion], List[GoldenQuestion]]:
    """
    Categorize subject topics for multiple questions in parallel.

    Args:
        questions: List of questions to categorize
        client: OpenAI client configured for Ollama
        model: Model name to use
        max_workers: Maximum number of concurrent workers (default: 10)

    Returns:
        Tuple of (successfully categorized questions, failed questions)
    """
    def categorize_single_question(question: GoldenQuestion) -> tuple[GoldenQuestion, bool]:
        """Categorize a single question and return (question, success)."""
        try:
            topics = categorize_subject_topics_llm(question, client, model)
            question.subject_topics = topics
            return question, True
        except Exception as e:
            logger.error(
                f"Failed to categorize subject topics for question '{question.question[:50]}...': {e}"
            )
            return question, False

    successfully_categorized: List[GoldenQuestion] = []
    failed_categorizations: List[GoldenQuestion] = []

    # Process questions in parallel with progress bar
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_question = {
            executor.submit(categorize_single_question, question): question
            for question in questions
        }

        # Process completed tasks with progress bar
        with tqdm(total=len(questions), desc="Categorizing subject topics") as pbar:
            for future in as_completed(future_to_question):
                question, success = future.result()
                if success:
                    successfully_categorized.append(question)
                else:
                    failed_categorizations.append(question)
                pbar.update(1)

    logger.info(
        f"Subject topic categorization complete: {len(successfully_categorized)} successful, "
        f"{len(failed_categorizations)} failed"
    )
    return successfully_categorized, failed_categorizations
