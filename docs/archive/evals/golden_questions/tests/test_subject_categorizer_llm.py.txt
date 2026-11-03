"""Unit tests for subject topic categorizer module."""

from unittest.mock import Mock

import pytest

from src.models import GoldenQuestion, UsageMode
from src.subject_categorizer_llm import categorize_subject_topics_llm


def test_categorize_single_topic() -> None:
    """Test categorization of question with single subject topic."""
    # Mock OpenAI client
    mock_client = Mock()
    mock_client.chat = Mock()
    mock_client.chat.completions = Mock()
    mock_client.chat.completions.create = Mock()

    # Mock response with single topic
    mock_response = Mock()
    mock_message = Mock()
    mock_message.content = '{"subject_topics": ["Økonomi og budsjett"]}'
    mock_response.choices = [Mock(message=mock_message)]
    mock_client.chat.completions.create.return_value = mock_response

    question = GoldenQuestion(
        id="conv1_0",
        question="Hva er budsjettet til Digdir i 2024?",
        original_question="Hva er budsjettet til Digdir i 2024?",
        conversation_id="conv1",
        context_messages=[],
        has_retrieval=True,
        usage_mode=UsageMode("single_document", "simple_qa", "factoid"),
        filters={"type": ["Årsrapport"]},
        subject_topics=[],
        metadata={"topic": "Budget"},
        question_changed=False,
    )

    topics = categorize_subject_topics_llm(question, mock_client)
    assert topics == ["Økonomi og budsjett"]


def test_categorize_multiple_topics() -> None:
    """Test categorization of question with multiple subject topics."""
    mock_client = Mock()
    mock_client.chat = Mock()
    mock_client.chat.completions = Mock()
    mock_client.chat.completions.create = Mock()

    # Mock response with multiple topics
    mock_response = Mock()
    mock_message = Mock()
    mock_message.content = (
        '{"subject_topics": ["Digitalisering og kunstig intelligens", "Likestilling og mangfold"]}'
    )
    mock_response.choices = [Mock(message=mock_message)]
    mock_client.chat.completions.create.return_value = mock_response

    question = GoldenQuestion(
        id="conv1_0",
        question="Hvordan påvirker digitalisering mangfoldet i offentlig sektor?",
        original_question="Hvordan påvirker digitalisering mangfoldet i offentlig sektor?",
        conversation_id="conv1",
        context_messages=[],
        has_retrieval=True,
        usage_mode=UsageMode("multi_document", "synthesis", "prose"),
        subject_topics=[],
        metadata={"topic": "Digitalization"},
        question_changed=False,
    )

    topics = categorize_subject_topics_llm(question, mock_client)
    assert set(topics) == {"Digitalisering og kunstig intelligens", "Likestilling og mangfold"}


def test_categorize_no_topics() -> None:
    """Test categorization returns empty list when no topics are relevant."""
    mock_client = Mock()
    mock_client.chat = Mock()
    mock_client.chat.completions = Mock()
    mock_client.chat.completions.create = Mock()

    # Mock response with empty topics
    mock_response = Mock()
    mock_message = Mock()
    mock_message.content = '{"subject_topics": []}'
    mock_response.choices = [Mock(message=mock_message)]
    mock_client.chat.completions.create.return_value = mock_response

    question = GoldenQuestion(
        id="conv1_0",
        question="Kan du gi et sammendrag?",
        original_question="Kan du gi et sammendrag?",
        conversation_id="conv1",
        context_messages=[],
        has_retrieval=True,
        usage_mode=UsageMode("single_document", "summarization", "prose"),
        subject_topics=[],
        metadata={"topic": "Summary"},
        question_changed=False,
    )

    topics = categorize_subject_topics_llm(question, mock_client)
    assert topics == []


def test_categorize_barnevern_topic() -> None:
    """Test categorization of barnevern-related question."""
    mock_client = Mock()
    mock_client.chat = Mock()
    mock_client.chat.completions = Mock()
    mock_client.chat.completions.create = Mock()

    # Mock response with barnevern topic
    mock_response = Mock()
    mock_message = Mock()
    mock_message.content = '{"subject_topics": ["Barnevern"]}'
    mock_response.choices = [Mock(message=mock_message)]
    mock_client.chat.completions.create.return_value = mock_response

    question = GoldenQuestion(
        id="conv1_0",
        question="Hvilke forbedringer er gjort i barnevernet?",
        original_question="Hvilke forbedringer er gjort i barnevernet?",
        conversation_id="conv1",
        context_messages=[],
        has_retrieval=True,
        usage_mode=UsageMode("single_document", "extraction", "list"),
        filters={"type": ["Proposisjon til Stortinget"]},
        subject_topics=[],
        metadata={"topic": "Child Protection"},
        question_changed=False,
    )

    topics = categorize_subject_topics_llm(question, mock_client)
    assert topics == ["Barnevern"]


def test_categorize_handles_invalid_json() -> None:
    """Test graceful handling of invalid JSON response."""
    mock_client = Mock()
    mock_client.chat = Mock()
    mock_client.chat.completions = Mock()
    mock_client.chat.completions.create = Mock()

    # Mock response with invalid JSON
    mock_response = Mock()
    mock_message = Mock()
    mock_message.content = "This is not valid JSON"
    mock_response.choices = [Mock(message=mock_message)]
    mock_client.chat.completions.create.return_value = mock_response

    question = GoldenQuestion(
        id="conv1_0",
        question="Hva er budsjettet?",
        original_question="Hva er budsjettet?",
        conversation_id="conv1",
        context_messages=[],
        has_retrieval=True,
        usage_mode=UsageMode("single_document", "simple_qa", "factoid"),
        subject_topics=[],
        metadata={"topic": "Test"},
        question_changed=False,
    )

    with pytest.raises(ValueError, match="Invalid JSON response after 2 attempts"):
        categorize_subject_topics_llm(question, mock_client, max_retries=1)


def test_categorize_retry_on_failure() -> None:
    """Test retry logic on API failure."""
    mock_client = Mock()
    mock_client.chat = Mock()
    mock_client.chat.completions = Mock()
    mock_client.chat.completions.create = Mock()

    # First call fails, second succeeds
    mock_response_success = Mock()
    mock_message = Mock()
    mock_message.content = '{"subject_topics": ["Økonomi og budsjett"]}'
    mock_response_success.choices = [Mock(message=mock_message)]

    mock_client.chat.completions.create.side_effect = [
        Exception("API error"),
        mock_response_success,
    ]

    question = GoldenQuestion(
        id="conv1_0",
        question="Hva er budsjettet?",
        original_question="Hva er budsjettet?",
        conversation_id="conv1",
        context_messages=[],
        has_retrieval=True,
        usage_mode=UsageMode("single_document", "simple_qa", "factoid"),
        subject_topics=[],
        metadata={"topic": "Test"},
        question_changed=False,
    )

    topics = categorize_subject_topics_llm(question, mock_client, max_retries=2)
    assert topics == ["Økonomi og budsjett"]
    assert mock_client.chat.completions.create.call_count == 2


def test_categorize_tier1_topics() -> None:
    """Test categorization with Tier 1 topics (high usage)."""
    mock_client = Mock()
    mock_client.chat = Mock()
    mock_client.chat.completions = Mock()
    mock_client.chat.completions.create = Mock()

    # Mock response with Tier 1 topics
    mock_response = Mock()
    mock_message = Mock()
    mock_message.content = (
        '{"subject_topics": ["Forvaltning og etatsstyring", "Innovasjon og fornyelse"]}'
    )
    mock_response.choices = [Mock(message=mock_message)]
    mock_client.chat.completions.create.return_value = mock_response

    question = GoldenQuestion(
        id="conv1_0",
        question="Hvordan kan innovasjon forbedre forvaltningen i offentlig sektor?",
        original_question="Hvordan kan innovasjon forbedre forvaltningen i offentlig sektor?",
        conversation_id="conv1",
        context_messages=[],
        has_retrieval=True,
        usage_mode=UsageMode("multi_document", "synthesis", "prose"),
        subject_topics=[],
        metadata={"topic": "Innovation"},
        question_changed=False,
    )

    topics = categorize_subject_topics_llm(question, mock_client)
    assert set(topics) == {"Forvaltning og etatsstyring", "Innovasjon og fornyelse"}
