"""Tests for LLM-based categorizer."""

import json
from unittest.mock import Mock, patch

import pytest
from openai import OpenAI

from src.categorizer_llm import (
    _build_user_prompt,
    categorize_question_llm,
    categorize_questions_llm,
)
from src.models import GoldenQuestion, UsageMode


@pytest.fixture
def sample_question() -> GoldenQuestion:
    """Create a sample question for testing."""
    return GoldenQuestion(
        id="test-123_0",
        question="Hva er budsjettet til Digdir i 2024?",
        original_question="Hva er budsjettet til Digdir i 2024?",
        conversation_id="test-123",
        context_messages=[],
        has_retrieval=True,
        usage_mode=UsageMode(
            document_scope="single_document",
            operation_type="simple_qa",
            output_complexity="factoid",
        ),
        subject_topics=[],
        metadata={"topic": "Test", "user_id": "test-user"},
        question_changed=False,
    )


def test_build_user_prompt() -> None:
    """Test user prompt building with few-shot examples."""
    question = "Hva er budsjettet til Digdir i 2024?"
    prompt = _build_user_prompt(question)

    # Check that prompt contains the question
    assert question in prompt

    # Check that prompt contains few-shot examples
    assert "Example" in prompt
    assert "document_scope" in prompt
    assert "operation_type" in prompt
    assert "output_complexity" in prompt

    # Check that prompt asks for JSON output
    assert "JSON" in prompt


def test_categorize_question_llm_success(sample_question: GoldenQuestion) -> None:
    """Test successful LLM categorization."""
    # Mock the OpenAI client
    mock_client = Mock()
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message.content = json.dumps(
        {
            "document_scope": "single_document",
            "operation_type": "simple_qa",
            "output_complexity": "factoid",
        }
    )
    mock_client.chat.completions.create.return_value = mock_response

    # Call the function
    usage_mode = categorize_question_llm(sample_question, mock_client, "test-model")

    # Verify the result
    assert usage_mode.document_scope == "single_document"
    assert usage_mode.operation_type == "simple_qa"
    assert usage_mode.output_complexity == "factoid"

    # Verify the API was called
    mock_client.chat.completions.create.assert_called_once()


def test_categorize_question_llm_invalid_json(sample_question: GoldenQuestion) -> None:
    """Test LLM categorization with invalid JSON response."""
    # Mock the OpenAI client to return invalid JSON
    mock_client = Mock()
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message.content = "This is not valid JSON"
    mock_client.chat.completions.create.return_value = mock_response

    # Should raise ValueError after retries
    with pytest.raises(ValueError, match="Failed to get valid JSON"):
        categorize_question_llm(sample_question, mock_client, "test-model", max_retries=2)


def test_categorize_question_llm_missing_fields(sample_question: GoldenQuestion) -> None:
    """Test LLM categorization with missing required fields."""
    # Mock the OpenAI client to return incomplete response
    mock_client = Mock()
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message.content = json.dumps(
        {
            "document_scope": "single_document",
            # Missing operation_type and output_complexity
        }
    )
    mock_client.chat.completions.create.return_value = mock_response

    # Should raise ValueError
    with pytest.raises(ValueError, match="Missing required fields"):
        categorize_question_llm(sample_question, mock_client, "test-model", max_retries=1)


def test_categorize_question_llm_empty_response(sample_question: GoldenQuestion) -> None:
    """Test LLM categorization with empty response."""
    # Mock the OpenAI client to return empty content
    mock_client = Mock()
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message.content = None
    mock_client.chat.completions.create.return_value = mock_response

    # Should raise ValueError
    with pytest.raises(ValueError, match="Empty response"):
        categorize_question_llm(sample_question, mock_client, "test-model", max_retries=1)


def test_categorize_questions_llm_batch(sample_question: GoldenQuestion) -> None:
    """Test batch categorization."""
    # Create multiple test questions
    questions = [sample_question, sample_question, sample_question]

    # Mock the OpenAI client
    mock_client = Mock()
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message.content = json.dumps(
        {
            "document_scope": "single_document",
            "operation_type": "simple_qa",
            "output_complexity": "factoid",
        }
    )
    mock_client.chat.completions.create.return_value = mock_response

    # Call the batch function
    successful, failed = categorize_questions_llm(questions, mock_client, "test-model")

    # Verify all questions were processed successfully
    assert len(successful) == 3
    assert len(failed) == 0

    # Verify API was called for each question
    assert mock_client.chat.completions.create.call_count == 3


def test_categorize_question_llm_retry(sample_question: GoldenQuestion) -> None:
    """Test retry logic in categorization."""
    # Mock the OpenAI client to fail first, then succeed
    mock_client = Mock()

    # First call returns invalid JSON, second call succeeds
    mock_response_fail = Mock()
    mock_response_fail.choices = [Mock()]
    mock_response_fail.choices[0].message.content = "Invalid JSON"

    mock_response_success = Mock()
    mock_response_success.choices = [Mock()]
    mock_response_success.choices[0].message.content = json.dumps(
        {
            "document_scope": "single_document",
            "operation_type": "simple_qa",
            "output_complexity": "factoid",
        }
    )

    mock_client.chat.completions.create.side_effect = [
        mock_response_fail,
        mock_response_success,
    ]

    # Call should succeed on retry
    usage_mode = categorize_question_llm(
        sample_question, mock_client, "test-model", max_retries=3
    )

    # Verify the result
    assert usage_mode.document_scope == "single_document"

    # Verify retry happened
    assert mock_client.chat.completions.create.call_count == 2


def test_categorization_prompt_includes_norwegian_instructions() -> None:
    """Test that prompt includes Norwegian instructions."""
    from src.categorizer_llm import SYSTEM_PROMPT

    # Check that system prompt is in Norwegian
    assert "norske spørsmål" in SYSTEM_PROMPT.lower()
    assert "document_scope" in SYSTEM_PROMPT
    assert "operation_type" in SYSTEM_PROMPT
    assert "output_complexity" in SYSTEM_PROMPT


def test_few_shot_examples_are_valid() -> None:
    """Test that few-shot examples have valid structure."""
    from src.categorizer_llm import FEW_SHOT_EXAMPLES

    assert len(FEW_SHOT_EXAMPLES) > 0

    for example in FEW_SHOT_EXAMPLES:
        # Each example should have required fields
        assert "question" in example
        assert "classification" in example
        assert "reasoning" in example

        # Classification should have all three dimensions
        classification = example["classification"]
        assert "document_scope" in classification
        assert "operation_type" in classification
        assert "output_complexity" in classification

        # Values should be valid
        assert classification["document_scope"] in ["single_document", "multi_document"]
        assert classification["output_complexity"] in ["factoid", "prose", "list", "table"]
