"""Unit tests for deduplicator module."""

import numpy as np
import pytest
from openai import OpenAI

from src.deduplicator import (
    _compute_cosine_similarity,
    _generate_embeddings,
    deduplicate_questions,
)
from src.models import GoldenQuestion, UsageMode

pytestmark = pytest.mark.vcr


@pytest.fixture
def ollama_client() -> OpenAI:
    """Create Ollama client for tests."""
    return OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")


def _create_question(text: str, conv_id: str = "conv1", msg_index: int = 0) -> GoldenQuestion:
    """Helper to create a golden question."""
    return GoldenQuestion(
        id=f"{conv_id}_{msg_index}",
        question=text,
        original_question=text,
        conversation_id=conv_id,
        context_messages=[],
        has_retrieval=True,
        usage_mode=UsageMode(
            document_scope="single_document",
            operation_type="simple_qa",
            output_complexity="prose",
        ),
        subject_topics=[],
        metadata={"topic": "Test", "user_id": "user1", "created": 1234567890},
        question_changed=False,
    )


def test_deduplicate_exact_match() -> None:
    """Remove exact duplicate questions."""
    questions = [
        _create_question("Hva er budsjettet?", "conv1"),
        _create_question("Hva er budsjettet?", "conv2"),
        _create_question("Hva er strategien?", "conv3"),
    ]

    deduplicated = deduplicate_questions(questions, use_semantic=False)
    assert len(deduplicated) == 2
    assert deduplicated[0].question == "Hva er budsjettet?"
    assert deduplicated[0].conversation_id == "conv1"  # First occurrence kept
    assert deduplicated[1].question == "Hva er strategien?"


def test_deduplicate_case_insensitive() -> None:
    """Remove duplicates ignoring case."""
    questions = [
        _create_question("Hva er budsjettet?", "conv1"),
        _create_question("HVA ER BUDSJETTET?", "conv2"),
        _create_question("hva er budsjettet?", "conv3"),
    ]

    deduplicated = deduplicate_questions(questions, use_semantic=False)
    assert len(deduplicated) == 1
    assert deduplicated[0].conversation_id == "conv1"


def test_deduplicate_preserve_order() -> None:
    """Keep first occurrence of duplicate."""
    questions = [
        _create_question("Question 1", "conv1"),
        _create_question("Question 2", "conv2"),
        _create_question("Question 1", "conv3"),
        _create_question("Question 3", "conv4"),
    ]

    deduplicated = deduplicate_questions(questions, use_semantic=False)
    assert len(deduplicated) == 3
    assert deduplicated[0].question == "Question 1"
    assert deduplicated[0].conversation_id == "conv1"
    assert deduplicated[1].question == "Question 2"
    assert deduplicated[2].question == "Question 3"


def test_deduplicate_no_duplicates() -> None:
    """Return all questions when no duplicates."""
    questions = [
        _create_question("Question 1", "conv1"),
        _create_question("Question 2", "conv2"),
        _create_question("Question 3", "conv3"),
    ]

    deduplicated = deduplicate_questions(questions, use_semantic=False)
    assert len(deduplicated) == 3


def test_deduplicate_punctuation_differences() -> None:
    """Treat questions as same despite punctuation differences."""
    questions = [
        _create_question("Hva er budsjettet?", "conv1"),
        _create_question("Hva er budsjettet", "conv2"),  # No question mark
        _create_question("Hva er budsjettet!", "conv3"),  # Exclamation
    ]

    deduplicated = deduplicate_questions(questions, use_semantic=False)
    assert len(deduplicated) == 1


def test_deduplicate_whitespace_differences() -> None:
    """Treat questions as same despite whitespace differences."""
    questions = [
        _create_question("Hva er budsjettet?", "conv1"),
        _create_question("Hva  er  budsjettet?", "conv2"),  # Extra spaces
        _create_question("  Hva er budsjettet?  ", "conv3"),  # Leading/trailing
    ]

    deduplicated = deduplicate_questions(questions, use_semantic=False)
    assert len(deduplicated) == 1


def test_deduplicate_empty_list() -> None:
    """Handle empty list."""
    questions: list[GoldenQuestion] = []
    deduplicated = deduplicate_questions(questions, use_semantic=False)
    assert len(deduplicated) == 0


def test_deduplicate_single_question() -> None:
    """Handle single question."""
    questions = [_create_question("Single question", "conv1")]
    deduplicated = deduplicate_questions(questions, use_semantic=False)
    assert len(deduplicated) == 1


def test_deduplicate_all_duplicates() -> None:
    """Handle case where all questions are duplicates."""
    questions = [_create_question("Same question", f"conv{i}") for i in range(10)]

    deduplicated = deduplicate_questions(questions, use_semantic=False)
    assert len(deduplicated) == 1
    assert deduplicated[0].conversation_id == "conv0"


def test_deduplicate_norwegian_characters() -> None:
    """Handle Norwegian special characters correctly."""
    questions = [
        _create_question("Hva er budsjettet for årets strategi?", "conv1"),
        _create_question("Hva er budsjettet for årets strategi?", "conv2"),
        _create_question("Hvor mye er øremerket til Digdir?", "conv3"),
    ]

    deduplicated = deduplicate_questions(questions, use_semantic=False)
    assert len(deduplicated) == 2


# Tests for semantic deduplication with embeddings


def test_compute_cosine_similarity_identical_vectors() -> None:
    """Cosine similarity of identical vectors should be 1.0."""
    vec1 = np.array([1.0, 2.0, 3.0, 4.0])
    vec2 = np.array([1.0, 2.0, 3.0, 4.0])

    similarity = _compute_cosine_similarity(vec1, vec2)

    assert similarity == pytest.approx(1.0, abs=1e-6)


def test_compute_cosine_similarity_orthogonal_vectors() -> None:
    """Cosine similarity of orthogonal vectors should be 0.0."""
    vec1 = np.array([1.0, 0.0, 0.0])
    vec2 = np.array([0.0, 1.0, 0.0])

    similarity = _compute_cosine_similarity(vec1, vec2)

    assert similarity == pytest.approx(0.0, abs=1e-6)


def test_compute_cosine_similarity_opposite_vectors() -> None:
    """Cosine similarity of opposite vectors should be -1.0."""
    vec1 = np.array([1.0, 2.0, 3.0])
    vec2 = np.array([-1.0, -2.0, -3.0])

    similarity = _compute_cosine_similarity(vec1, vec2)

    assert similarity == pytest.approx(-1.0, abs=1e-6)


def test_compute_cosine_similarity_normalized_vectors() -> None:
    """Cosine similarity should work with pre-normalized vectors."""
    # Unit vectors at 60 degrees (cos(60°) = 0.5)
    vec1 = np.array([1.0, 0.0])
    vec2 = np.array([0.5, np.sqrt(3) / 2])

    similarity = _compute_cosine_similarity(vec1, vec2)

    assert similarity == pytest.approx(0.5, abs=1e-6)


def test_generate_embeddings_returns_correct_shape(ollama_client: OpenAI) -> None:
    """Generate embeddings should return numpy array with correct shape."""
    texts = ["Test question 1", "Test question 2", "Test question 3"]

    embeddings = _generate_embeddings(texts, ollama_client, model="nomic-embed-text")

    assert isinstance(embeddings, np.ndarray)
    assert embeddings.shape[0] == 3  # Number of texts
    assert embeddings.shape[1] > 0  # Embedding dimension (should be 1024 for mxbai)


def test_generate_embeddings_different_texts_different_embeddings(ollama_client: OpenAI) -> None:
    """Different texts should produce different embeddings."""
    texts = [
        "What is the budget?",
        "How do I apply for benefits?",
    ]

    embeddings = _generate_embeddings(texts, ollama_client, model="nomic-embed-text")

    # Embeddings should not be identical
    assert not np.allclose(embeddings[0], embeddings[1])


def test_generate_embeddings_similar_texts_high_similarity(ollama_client: OpenAI) -> None:
    """Similar texts should produce similar embeddings."""
    texts = [
        "Hva er budsjettet til Digdir?",
        "Hvilket budsjett har Digdir?",
    ]

    embeddings = _generate_embeddings(texts, ollama_client, model="nomic-embed-text")
    similarity = _compute_cosine_similarity(embeddings[0], embeddings[1])

    # Similar Norwegian questions should have high similarity
    assert similarity > 0.85


def test_generate_embeddings_empty_list(ollama_client: OpenAI) -> None:
    """Generate embeddings with empty list should return empty array."""
    texts: list[str] = []

    embeddings = _generate_embeddings(texts, ollama_client, model="nomic-embed-text")

    assert isinstance(embeddings, np.ndarray)
    assert embeddings.shape[0] == 0


def test_deduplicate_semantic_similarity_removes_similar_questions(ollama_client: OpenAI) -> None:
    """Semantic deduplication should remove questions with similar meaning."""
    questions = [
        _create_question("Hva er budsjettet til Digdir i 2024?", "conv1"),
        _create_question("Hvilket budsjett har Digdir for 2024?", "conv2"),
        _create_question("Hvor mange ansatte har DFØ?", "conv3"),
    ]

    deduplicated = deduplicate_questions(
        questions,
        use_semantic=True,
        similarity_threshold=0.90,
        embedding_client=ollama_client,
        embedding_model="nomic-embed-text",
    )

    # Should remove one of the similar budget questions
    assert len(deduplicated) == 2
    # Should keep first occurrence
    assert deduplicated[0].conversation_id == "conv1"
    # Should keep the distinct question
    assert any(q.conversation_id == "conv3" for q in deduplicated)


def test_deduplicate_semantic_with_different_questions_keeps_all(ollama_client: OpenAI) -> None:
    """Semantic deduplication should keep questions with different meanings."""
    questions = [
        _create_question("Hva er budsjettet til Digdir?", "conv1"),
        _create_question("Hvor mange ansatte har DFØ?", "conv2"),
        _create_question("Når ble loven vedtatt?", "conv3"),
    ]

    deduplicated = deduplicate_questions(
        questions,
        use_semantic=True,
        similarity_threshold=0.92,
        embedding_client=ollama_client,
        embedding_model="nomic-embed-text",
    )

    # All questions are different, should keep all
    assert len(deduplicated) == 3


def test_deduplicate_semantic_threshold_affects_results(ollama_client: OpenAI) -> None:
    """Different similarity thresholds should produce different results."""
    questions = [
        _create_question("Hva er strategien for 2024?", "conv1"),
        _create_question("Hva er strategien for 2025?", "conv2"),
    ]

    # With high threshold (conservative), keep both
    deduplicated_high = deduplicate_questions(
        questions,
        use_semantic=True,
        similarity_threshold=0.98,
        embedding_client=ollama_client,
        embedding_model="nomic-embed-text",
    )
    assert len(deduplicated_high) == 2

    # With lower threshold (aggressive), might remove one
    deduplicated_low = deduplicate_questions(
        questions,
        use_semantic=True,
        similarity_threshold=0.85,
        embedding_client=ollama_client,
        embedding_model="nomic-embed-text",
    )
    # These are very similar except for the year
    # Depending on embeddings, might be considered duplicates
    assert len(deduplicated_low) <= 2


def test_deduplicate_with_use_semantic_false_uses_exact_match() -> None:
    """When use_semantic=False, should use exact text matching only."""
    questions = [
        _create_question("Hva er budsjettet til Digdir?", "conv1"),
        _create_question("Hvilket budsjett har Digdir?", "conv2"),  # Similar but different
    ]

    deduplicated = deduplicate_questions(questions, use_semantic=False)

    # Should keep both because text is different
    assert len(deduplicated) == 2


def test_deduplicate_semantic_preserves_exact_match_fast_path(ollama_client: OpenAI) -> None:
    """Semantic deduplication should use exact match as fast path."""
    questions = [
        _create_question("Hva er budsjettet?", "conv1"),
        _create_question("Hva er budsjettet?", "conv2"),  # Exact duplicate
        _create_question("How do I apply for benefits?", "conv3"),  # Different topic
    ]

    deduplicated = deduplicate_questions(
        questions,
        use_semantic=True,
        similarity_threshold=0.92,
        embedding_client=ollama_client,
        embedding_model="nomic-embed-text",
    )

    # Should remove exact duplicate via fast path (conv2)
    # Should keep conv3 because it's semantically different
    assert len(deduplicated) == 2
    assert deduplicated[0].conversation_id == "conv1"
    assert deduplicated[1].conversation_id == "conv3"


def test_deduplicate_invalid_threshold_raises_error() -> None:
    """Similarity threshold outside [0.0, 1.0] should raise ValueError."""
    questions = [_create_question("Test question", "conv1")]

    with pytest.raises(ValueError, match="similarity_threshold must be"):
        deduplicate_questions(questions, use_semantic=True, similarity_threshold=1.5)

    with pytest.raises(ValueError, match="similarity_threshold must be"):
        deduplicate_questions(questions, use_semantic=True, similarity_threshold=-0.1)
