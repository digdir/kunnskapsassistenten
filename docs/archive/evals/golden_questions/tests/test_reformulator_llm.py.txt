"""Tests for LLM-based question reformulation."""

import json
from unittest.mock import MagicMock, Mock

import pytest

from src.models import Message
from src.reformulator_llm import reformulate_question_llm


def test_reformulate_question_llm() -> None:
    """Test LLM-based reformulation of vague question."""
    # Mock client
    mock_client = Mock()
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(
            message=MagicMock(
                content=json.dumps({
                    "reformulated": "Hva innebærer regjeringens dataspillstrategi?",
                    "reasoning": "Test",
                    "is_changed": True
                })
            ),
            finish_reason="stop"
        )
    ]
    mock_client.chat.completions.create.return_value = mock_response

    # Test data
    question = "Hva innebærer det?"
    previous_messages = [
        Message(
            id="1",
            text="Regjeringen har lansert en dataspillstrategi",
            role="assistant",
            created=1234567890,
            chunks=[],
        )
    ]

    # Call function
    result: str = reformulate_question_llm(
        question, previous_messages, mock_client
    )

    # Verify result
    assert result == "Hva innebærer regjeringens dataspillstrategi?"
    assert mock_client.chat.completions.create.called


def test_reformulate_question_with_pronoun() -> None:
    """Replace pronoun with specific reference from context."""
    # Mock client
    mock_client = Mock()
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(
            message=MagicMock(
                content=json.dumps({
                    "reformulated": "Hva er budsjettet til Digdir i 2024?",
                    "reasoning": "Test",
                    "is_changed": True
                })
            ),
            finish_reason="stop"
        )
    ]
    mock_client.chat.completions.create.return_value = mock_response

    # Test data
    question = "Hva er det?"
    previous_messages = [
        Message(
            id="1",
            text="Budsjettet til Digdir i 2024 er 500 millioner.",
            role="assistant",
            created=1234567890,
            chunks=[],
        )
    ]

    # Call function
    result: str = reformulate_question_llm(
        question, previous_messages, mock_client
    )

    # Verify result
    assert "Digdir" in result
    assert "budsjett" in result.lower()


def test_reformulate_question_follow_up() -> None:
    """Convert follow-up question to standalone."""
    # Mock client
    mock_client = Mock()
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(
            message=MagicMock(
                content=json.dumps({
                    "reformulated": "Hvordan søker jeg på skattefradraget for dataspill?",
                    "reasoning": "Test",
                    "is_changed": True
                })
            ),
            finish_reason="stop"
        )
    ]
    mock_client.chat.completions.create.return_value = mock_response

    # Test data
    question = "Og hvordan søker jeg på det?"
    previous_messages = [
        Message(
            id="1",
            text="Hva er skattefradraget for dataspill?",
            role="user",
            created=1234567890,
            chunks=[],
        ),
        Message(
            id="2",
            text="Skattefradraget for dataspill er en ny ordning...",
            role="assistant",
            created=1234567891,
            chunks=[],
        ),
    ]

    # Call function
    result: str = reformulate_question_llm(
        question, previous_messages, mock_client
    )

    # Verify result
    assert "skattefradrag" in result.lower()
    assert "dataspill" in result.lower()


def test_reformulate_question_vague_reference() -> None:
    """Clarify vague references like 'barna' with context."""
    # Mock client
    mock_client = Mock()
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(
            message=MagicMock(
                content=json.dumps({
                    "reformulated": "Hvilke land kommer barna i barnevernsstatistikken fra?",
                    "reasoning": "Test",
                    "is_changed": True
                })
            ),
            finish_reason="stop"
        )
    ]
    mock_client.chat.completions.create.return_value = mock_response

    # Test data
    question = "Hvilke land kommer barna fra?"
    previous_messages = [
        Message(
            id="1",
            text="Barnevernsstatistikk 2023",
            role="system",
            created=1234567890,
            chunks=[{"docTitle": "Barnevernsstatistikk 2023"}],
        )
    ]

    # Call function
    result: str = reformulate_question_llm(
        question, previous_messages, mock_client
    )

    # Verify result
    assert "barnevern" in result.lower()


def test_reformulate_question_preserves_clear() -> None:
    """Clear standalone questions returned unchanged or minimally changed."""
    # Mock client
    mock_client = Mock()
    mock_response = MagicMock()
    # LLM should return same or very similar question
    original_question = "Hva er tiltakene i regjeringens dataspillstrategi?"
    mock_response.choices = [
        MagicMock(
            message=MagicMock(
                content=json.dumps({
                    "reformulated": original_question,
                    "reasoning": "Question is already clear",
                    "is_changed": False
                })
            ),
            finish_reason="stop"
        )
    ]
    mock_client.chat.completions.create.return_value = mock_response

    # Test data
    previous_messages = [
        Message(
            id="1",
            text="Some previous message",
            role="assistant",
            created=1234567890,
            chunks=[],
        )
    ]

    # Call function
    result: str = reformulate_question_llm(
        original_question, previous_messages, mock_client
    )

    # Verify result is same or very similar
    assert result == original_question


@pytest.mark.vcr
def test_reformulate_question_retry_on_failure() -> None:
    """Retry on API failure with exponential backoff."""
    # Mock time.sleep to avoid actual delays
    from unittest.mock import patch

    with patch("src.reformulator_llm.time.sleep") as mock_sleep:
        # Mock client that fails twice then succeeds
        mock_client = Mock()

        # First two calls fail, third succeeds
        mock_client.chat.completions.create.side_effect = [
            Exception("API Error 1"),
            Exception("API Error 2"),
            MagicMock(
                choices=[
                    MagicMock(
                        message=MagicMock(
                            content=json.dumps({
                                "reformulated": "Reformulated question",
                                "reasoning": "Test",
                                "is_changed": True
                            })
                        ),
                        finish_reason="stop"
                    )
                ]
            ),
        ]

        # Test data
        question = "Hva innebærer det?"
        previous_messages = [
            Message(
                id="1",
                text="Context message",
                role="assistant",
                created=1234567890,
                chunks=[],
            )
        ]

        # Call function with retries
        result: str = reformulate_question_llm(
            question, previous_messages, mock_client, max_retries=3
        )

        # Verify result
        assert result == "Reformulated question"
        assert mock_client.chat.completions.create.call_count == 3

        # Verify exponential backoff was attempted (2^1=2s, 2^2=4s)
        assert mock_sleep.call_count == 2
        mock_sleep.assert_any_call(2)  # First retry: 2^(0+1) = 2 seconds
        mock_sleep.assert_any_call(4)  # Second retry: 2^(1+1) = 4 seconds


def test_reformulate_question_invalid_response() -> None:
    """Handle invalid or empty responses gracefully."""
    # Mock client that returns empty response
    mock_client = Mock()
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(
            message=MagicMock(content=""),
            finish_reason="stop"
        )
    ]
    mock_client.chat.completions.create.return_value = mock_response

    # Test data
    question = "Hva innebærer det?"
    previous_messages = [
        Message(
            id="1",
            text="Context message",
            role="assistant",
            created=1234567890,
            chunks=[],
        )
    ]

    # Call function - should raise error after retries
    with pytest.raises(ValueError, match="Failed to reformulate after 2 attempts"):
        reformulate_question_llm(
            question, previous_messages, mock_client, max_retries=1
        )
