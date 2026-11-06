"""LLM-based categorization using Ollama."""

import json
import logging
import time
from typing import List

from openai import APIError, OpenAI, RateLimitError

from .models import GoldenQuestion, UsageMode

logger = logging.getLogger(__name__)


# Few-shot examples for the LLM prompt
FEW_SHOT_EXAMPLES = [
    {
        "question": "Hva er budsjettet til Digdir i 2024?",
        "classification": {
            "document_scope": "single_document",
            "operation_type": "simple_qa",
            "output_complexity": "factoid",
        },
        "reasoning": "Simple question asking for one specific fact from one document",
    },
    {
        "question": "Hva er styringsparameterne i tildelingsbrevet?",
        "classification": {
            "document_scope": "single_document",
            "operation_type": "extraction",
            "output_complexity": "list",
        },
        "reasoning": "Asks to extract multiple items (parameters) from a single document",
    },
    {
        "question": "Gi et sammendrag av denne evalueringen",
        "classification": {
            "document_scope": "single_document",
            "operation_type": "summarization",
            "output_complexity": "prose",
        },
        "reasoning": "Explicitly asks for a summary of one document",
    },
    {
        "question": "Sammenlign prioriteringene til Digdir og DFØ",
        "classification": {
            "document_scope": "multi_document",
            "operation_type": "comparison",
            "output_complexity": "prose",
        },
        "reasoning": "Requires comparing information from two different organizations/documents",
    },
    {
        "question": "Hvor mange etater har fått merknad om internkontroll?",
        "classification": {
            "document_scope": "multi_document",
            "operation_type": "aggregation",
            "output_complexity": "factoid",
        },
        "reasoning": "Counting across multiple entities requires aggregation",
    },
    {
        "question": "Hvordan har målene endret seg fra 2022 til 2024?",
        "classification": {
            "document_scope": "multi_document",
            "operation_type": "temporal",
            "output_complexity": "prose",
        },
        "reasoning": "Analyzing changes over time requires comparing multiple documents",
    },
    {
        "question": "Tyder funnene på at reformen har virket?",
        "classification": {
            "document_scope": "single_document",
            "operation_type": "inference",
            "output_complexity": "prose",
        },
        "reasoning": "Requires drawing conclusions from findings, not just extracting facts",
    },
]


SYSTEM_PROMPT = """Du er en ekspert på å kategorisere spørsmål til et RAG (Retrieval-Augmented Generation) system.

Din oppgave er å klassifisere norske spørsmål i tre dimensjoner:

1. **document_scope**: Krever spørsmålet informasjon fra ett eller flere dokumenter?
   - "single_document": Kan besvares fra ett dokument
   - "multi_document": Krever informasjon fra flere dokumenter

2. **operation_type**: Hva slags operasjon kreves?

   Single-document operations:
   - "simple_qa": Finn ett faktum i ett dokument
   - "extraction": Hent ut spesifikk informasjon/liste
   - "summarization": Oppsummer ett dokument
   - "locate": Finn hvor noe står oppgitt

   Multi-document operations:
   - "aggregation": Tell/summer på tvers av dokumenter
   - "comparison": Sammenlign to eller flere dokumenter
   - "synthesis": Kombiner informasjon til helhet
   - "temporal": Endring over tid
   - "cross_reference": Koble relatert informasjon

   Reasoning operations:
   - "inference": Trekk konklusjoner fra fakta
   - "classification": Kategoriser funn
   - "gap_analysis": Identifiser hull/mangler

3. **output_complexity**: Hva slags svar forventes?
   - "factoid": Ett ord/tall/setning
   - "prose": Sammenhengende tekst
   - "list": Punktliste
   - "table": Strukturert tabell

Returner alltid et gyldig JSON-objekt med disse tre feltene."""


def _build_user_prompt(question: str) -> str:
    """
    Build user prompt with few-shot examples.

    Args:
        question: Question to categorize

    Returns:
        Formatted prompt string
    """
    examples_text = "\n\n".join(
        [
            f"Example {i+1}:\n"
            f"Question: {ex['question']}\n"
            f"Classification: {json.dumps(ex['classification'], ensure_ascii=False)}\n"
            f"Reasoning: {ex['reasoning']}"
            for i, ex in enumerate(FEW_SHOT_EXAMPLES)
        ]
    )

    return f"""{examples_text}

Now categorize this question:

Question: {question}

Return ONLY a JSON object with this structure:
{{
  "document_scope": "single_document" or "multi_document",
  "operation_type": "...",
  "output_complexity": "..."
}}"""


def categorize_question_llm(
    question: GoldenQuestion,
    client: OpenAI,
    model: str = "gpt-oss:120b-cloud",
    max_retries: int = 0,
) -> UsageMode:
    """
    Use LLM to categorize question.

    Args:
        question: Question to categorize
        client: OpenAI client configured for Ollama
        model: Model name to use
        max_retries: Number of retry attempts on failure

    Returns:
        UsageMode classification

    Raises:
        ValueError: If LLM returns invalid JSON after all retries
    """
    user_prompt = _build_user_prompt(question.question)

    for attempt in range(max_retries + 1):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.0,  # Deterministic for consistency
            )

            content = response.choices[0].message.content
            if not content:
                raise ValueError("Empty response from LLM")

            # Strip whitespace and try to find JSON object
            content = content.strip()

            # If response is truncated, try to extract what we have
            if not content.endswith("}"):
                # Try to find a complete JSON object in the response
                start = content.find("{")
                if start != -1:
                    # Find the last complete field
                    content_part = content[start:]
                    # Try to close the JSON object properly
                    if '"output_complexity"' in content_part:
                        # We have all three fields, try to close it
                        if not content_part.rstrip().endswith("}"):
                            content = content.rstrip().rstrip(",") + "}"
                    else:
                        # Incomplete response, let JSON parsing fail and retry
                        pass

            # Parse JSON response
            result = json.loads(content)

            # Validate required fields
            required_fields = ["document_scope", "operation_type", "output_complexity"]
            if not all(field in result for field in required_fields):
                raise ValueError(f"Missing required fields in response: {result}")

            return UsageMode(
                document_scope=result["document_scope"],
                operation_type=result["operation_type"],
                output_complexity=result["output_complexity"],
            )

        except json.JSONDecodeError as e:
            logger.warning(
                f"Attempt {attempt + 1}/{max_retries + 1}: Invalid JSON from LLM: {e}. "
                f"Response: {content[:200] if content else 'None'}"
            )
            if attempt == max_retries:
                raise ValueError(
                    f"Failed to get valid JSON after {max_retries + 1} attempts"
                ) from e

        except RateLimitError as e:
            wait_time = 2 ** (attempt + 1)  # Exponential backoff: 2, 4, 8 seconds
            logger.warning(
                f"Attempt {attempt + 1}/{max_retries + 1}: Rate limit hit. "
                f"Waiting {wait_time}s before retry..."
            )
            if attempt < max_retries:
                time.sleep(wait_time)  # Use time.sleep for sync function
            else:
                raise

        except Exception as e:
            logger.warning(f"Attempt {attempt + 1}/{max_retries}: LLM categorization failed: {e}")
            if attempt == max_retries - 1:
                raise

    # This should never be reached due to the raise in the loop
    raise ValueError(f"Failed to categorize after {max_retries} attempts")


def categorize_questions_llm(
    questions: List[GoldenQuestion],
    client: OpenAI,
    model: str = "gpt-oss:120b-cloud",
) -> tuple[List[GoldenQuestion], List[GoldenQuestion]]:
    """
    Categorize all questions using LLM.

    Args:
        questions: List of questions to categorize
        client: OpenAI client configured for Ollama
        model: Model name to use

    Returns:
        Tuple of (successfully categorized questions, failed questions)
    """
    from tqdm import tqdm

    logger.info(f"Categorizing {len(questions)} questions using LLM ({model})")

    successfully_categorized: List[GoldenQuestion] = []
    failed_categorizations: List[GoldenQuestion] = []

    for question in tqdm(questions, desc="Categorizing questions"):
        try:
            question.usage_mode = categorize_question_llm(question, client, model)
            successfully_categorized.append(question)
        except Exception as e:
            logger.error(
                f"Failed to categorize question {question.id}: {e}. "
                f"Removing from results."
            )
            failed_categorizations.append(question)

    logger.info(
        f"Completed LLM categorization: {len(successfully_categorized)} successful, "
        f"{len(failed_categorizations)} failed"
    )
    return successfully_categorized, failed_categorizations


