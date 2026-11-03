"""Deduplicate golden questions."""

import json
import logging
import re
from pathlib import Path
from typing import List, Optional

import numpy as np
from langfuse.openai import OpenAI
from tqdm import tqdm

from .models import GoldenQuestion

logger = logging.getLogger(__name__)


def _compute_cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """
    Compute cosine similarity between two vectors.

    Args:
        vec1: First vector
        vec2: Second vector

    Returns:
        Cosine similarity score between -1.0 and 1.0
    """
    # Compute dot product
    dot_product = np.dot(vec1, vec2)

    # Compute magnitudes
    magnitude1 = np.linalg.norm(vec1)
    magnitude2 = np.linalg.norm(vec2)

    # Avoid division by zero
    if magnitude1 == 0 or magnitude2 == 0:
        return 0.0

    # Return cosine similarity
    return float(dot_product / (magnitude1 * magnitude2))


def _generate_embeddings(
    texts: List[str],
    client: OpenAI,
    model: str,
) -> np.ndarray:
    """
    Generate embeddings for list of texts using LLM provider.

    Args:
        texts: List of text strings to embed
        client: OpenAI or AzureOpenAI client
        model: Model name or deployment name

    Returns:
        Numpy array of shape (len(texts), embedding_dim)

    Raises:
        RuntimeError: If embedding generation fails
    """
    if not texts:
        return np.array([])

    try:
        embeddings = []
        for text in tqdm(texts, desc="Generating embeddings", disable=len(texts) < 10):
            response = client.embeddings.create(input=text, model=model)
            embedding = response.data[0].embedding
            embeddings.append(embedding)

        return np.array(embeddings)

    except Exception as e:
        logger.error(f"Failed to generate embeddings: {e}")
        raise RuntimeError(f"Embedding generation failed: {e}") from e


def deduplicate_questions(
    questions: List[GoldenQuestion],
    output_dropped_file: Optional[str] = None,
    use_semantic: bool = True,
    similarity_threshold: float = 0.92,
    embedding_client: Optional[OpenAI] = None,
    embedding_model: Optional[str] = None,
) -> List[GoldenQuestion]:
    """
    Remove semantically duplicate questions using embedding-based similarity.

    Args:
        questions: List of questions to deduplicate
        output_dropped_file: Optional path to save dropped duplicates
        use_semantic: Whether to use semantic similarity (default: True)
        similarity_threshold: Cosine similarity threshold (default: 0.92)
        embedding_client: OpenAI or AzureOpenAI client for embeddings (required if use_semantic=True)
        embedding_model: Model name or deployment name for embeddings (required if use_semantic=True)

    Returns:
        Deduplicated list (preserves first occurrence)

    Raises:
        ValueError: If similarity_threshold not in range [0.0, 1.0]
        ValueError: If use_semantic=True but embedding_client or embedding_model is None
    """
    if not (0.0 <= similarity_threshold <= 1.0):
        raise ValueError("similarity_threshold must be between 0.0 and 1.0")

    if use_semantic and (embedding_client is None or embedding_model is None):
        raise ValueError(
            "embedding_client and embedding_model are required when use_semantic=True"
        )

    if not questions:
        return []

    # Stage 1: Exact match (fast path)
    seen_normalized: dict[str, GoldenQuestion] = {}
    deduplicated: List[GoldenQuestion] = []
    duplicates: List[tuple[GoldenQuestion, GoldenQuestion, float]] = []  # (dup, orig, score)

    for question in questions:
        normalized = _normalize_text(question.question)

        if normalized not in seen_normalized:
            seen_normalized[normalized] = question
            deduplicated.append(question)
        else:
            # Track exact duplicate
            original = seen_normalized[normalized]
            duplicates.append((question, original, 1.0))  # Exact match = 1.0 similarity

    # Stage 2: Semantic similarity (if enabled and we have remaining questions)
    if use_semantic and len(deduplicated) > 1:
        # Type assertions: we already validated these are not None above
        assert embedding_client is not None
        assert embedding_model is not None

        try:
            # Generate embeddings for remaining deduplicated questions
            texts = [q.question for q in deduplicated]
            embeddings = _generate_embeddings(texts, embedding_client, embedding_model)

            # Find semantic duplicates using pairwise similarity
            semantic_duplicates: List[tuple[GoldenQuestion, GoldenQuestion, float]] = []
            indices_to_remove = set()

            for i in range(len(deduplicated)):
                if i in indices_to_remove:
                    continue

                for j in range(i + 1, len(deduplicated)):
                    if j in indices_to_remove:
                        continue

                    similarity = _compute_cosine_similarity(embeddings[i], embeddings[j])

                    if similarity >= similarity_threshold:
                        # Mark j as duplicate of i (keep first occurrence)
                        semantic_duplicates.append((deduplicated[j], deduplicated[i], similarity))
                        indices_to_remove.add(j)

            # Remove semantic duplicates
            deduplicated = [q for idx, q in enumerate(deduplicated) if idx not in indices_to_remove]
            duplicates.extend(semantic_duplicates)

            logger.info(
                f"Found {len(semantic_duplicates)} semantic duplicates using model {embedding_model} "
                f"(threshold: {similarity_threshold:.2f})"
            )

        except RuntimeError as e:
            logger.warning(f"Semantic deduplication failed, falling back to exact match: {e}")

    duplicates_removed = len(questions) - len(deduplicated)
    logger.info(
        f"Deduplicated {len(questions)} questions to {len(deduplicated)} "
        f"({duplicates_removed} duplicates removed)"
    )

    # Save duplicates to file for transparency
    if output_dropped_file and duplicates:
        save_dropped_duplicates(duplicates, output_dropped_file)

    return deduplicated


def save_dropped_duplicates(
    duplicates: List[tuple[GoldenQuestion, GoldenQuestion, float]],
    output_file: str,
) -> None:
    """
    Save dropped duplicate questions to JSONL file for inspection.

    Args:
        duplicates: List of (duplicate_question, original_question, similarity_score) tuples
        output_file: Path to output file
    """
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        for duplicate, original, similarity_score in duplicates:
            # Determine if this is exact match or semantic duplicate
            match_type = "exact_match" if similarity_score == 1.0 else "semantic_similarity"

            record = {
                "dropped_question": {
                    "text": duplicate.question,
                    "original_text": duplicate.original_question,
                    "conversation_id": duplicate.conversation_id,
                    "has_retrieval": duplicate.has_retrieval,
                },
                "kept_original": {
                    "text": original.question,
                    "original_text": original.original_question,
                    "conversation_id": original.conversation_id,
                    "has_retrieval": original.has_retrieval,
                },
                "similarity_score": round(similarity_score, 4),
                "match_type": match_type,
                "normalized_form": _normalize_text(duplicate.question),
                "drop_reason": "Duplicate of earlier question",
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    logger.info(f"💾 Saved {len(duplicates)} duplicate questions to {output_file}")


def _normalize_text(text: str) -> str:
    """
    Normalize text for comparison.

    - Convert to lowercase
    - Remove extra whitespace
    - Remove punctuation
    - Normalize Norwegian characters

    Args:
        text: Text to normalize

    Returns:
        Normalized text
    """
    # Lowercase
    text = text.lower()

    # Remove punctuation except spaces
    text = re.sub(r"[^\w\s]", "", text)

    # Normalize whitespace
    text = " ".join(text.split())

    return text
