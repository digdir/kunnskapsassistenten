# -*- coding: utf-8 -*-
"""Unit tests for RAG querier module."""

import json
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest

from src.models import GoldenQuestion
from src.rag_querier import RAGQuerier, load_golden_questions


class TestLoadGoldenQuestions:
    """Tests for load_golden_questions function."""

    def test_load_golden_questions_from_valid_jsonl(self, tmp_path: Path) -> None:
        """Test loading golden questions from valid JSONL file."""
        jsonl_file = tmp_path / "questions.jsonl"
        questions_data = [
            {
                "question": "Hva er barnevern?",
                "original_question": "Hva er barnevern?",
                "conversation_id": "abc123",
                "id": "test_question_1",
                "context_messages": [],
                "has_retrieval": True,
            },
            {
                "question": "Hva er politiet?",
                "original_question": "Hva er politiet?",
                "conversation_id": "def456",
                "id": "test_question_2",
                "context_messages": [],
                "has_retrieval": True,
            },
        ]
        with open(jsonl_file, "w", encoding="utf-8") as f:
            for q in questions_data:
                f.write(json.dumps(q, ensure_ascii=False) + "\n")

        questions = load_golden_questions(jsonl_file, limit=None)
        assert len(questions) == 2
        assert isinstance(questions[0], GoldenQuestion)
        assert questions[0].question == "Hva er barnevern?"
        assert questions[1].question == "Hva er politiet?"

    def test_load_golden_questions_with_malformed_json_raises_error(
        self, tmp_path: Path
    ) -> None:
        """Test that malformed JSON raises JSONDecodeError."""
        jsonl_file = tmp_path / "bad_questions.jsonl"
        with open(jsonl_file, "w", encoding="utf-8") as f:
            f.write('{"malformed json\n')

        with pytest.raises(json.JSONDecodeError):
            load_golden_questions(jsonl_file, limit=None)

    def test_load_golden_questions_with_missing_required_field_raises_error(
        self, tmp_path: Path
    ) -> None:
        """Test that missing required field raises ValidationError."""
        from pydantic import ValidationError

        jsonl_file = tmp_path / "incomplete_questions.jsonl"
        with open(jsonl_file, "w", encoding="utf-8") as f:
            f.write('{"question": "Test"}\n')

        with pytest.raises(ValidationError):
            load_golden_questions(jsonl_file, limit=None)

    def test_load_golden_questions_with_empty_file(self, tmp_path: Path) -> None:
        """Test loading from empty file returns empty list."""
        jsonl_file = tmp_path / "empty.jsonl"
        jsonl_file.touch()

        questions = load_golden_questions(jsonl_file, limit=None)
        assert questions == []

    def test_load_golden_questions_with_nonexistent_file_raises_error(
        self, tmp_path: Path
    ) -> None:
        """Test that nonexistent file raises FileNotFoundError."""
        jsonl_file = tmp_path / "nonexistent.jsonl"

        with pytest.raises(FileNotFoundError):
            load_golden_questions(jsonl_file, limit=None)


class TestRAGQuerier:
    """Tests for RAGQuerier class."""

    @patch("src.rag_querier.RagAgent")
    @patch("src.rag_querier.Cache")
    def test_rag_querier_initialization(
        self, mock_cache_class: Mock, mock_agent_class: Mock
    ) -> None:
        """Test RAGQuerier initialization with RagAgent and Cache."""
        mock_cache = MagicMock()
        mock_cache_class.return_value = mock_cache
        mock_agent = MagicMock()
        mock_agent_class.return_value = mock_agent

        querier = RAGQuerier(
            api_key="test-key",
            api_url="https://api.test.com",
            user_email="test@test.com",
            cache_dir=Path("./cache"),
        )

        mock_cache_class.assert_called_once()
        mock_agent_class.assert_called_once_with(
            api_key="test-key",
            base_url="https://api.test.com",
            user_email="test@test.com",
            cache=mock_cache,
        )
        assert querier.agent == mock_agent

    @patch("src.rag_querier.RagAgent")
    @patch("src.rag_querier.Cache")
    @patch("src.rag_querier.AgentRequest")
    def test_rag_querier_query_question(
        self,
        mock_request_class: Mock,
        mock_cache_class: Mock,
        mock_agent_class: Mock,
    ) -> None:
        """Test querying RAG with a question."""
        mock_agent = MagicMock()
        mock_agent_class.return_value = mock_agent
        mock_cache = MagicMock()
        mock_cache_class.return_value = mock_cache

        mock_request = MagicMock()
        mock_request_class.return_value = mock_request

        mock_response = MagicMock()
        mock_response.answer = "Test answer"
        mock_response.chunks_used = []
        mock_agent.query.return_value = mock_response

        querier = RAGQuerier(
            api_key="test-key",
            api_url="https://api.test.com",
            user_email="test@test.com",
            cache_dir=Path("./cache"),
        )

        question = "Hva er barnevern?"
        response = querier.query_question(question)

        mock_request_class.assert_called_once_with(
            query="Hva er barnevern?",
            document_types=[],
            organizations=[],
            temperature=0.0,
        )
        mock_agent.query.assert_called_once_with(mock_request)
        assert response == mock_response

    @patch("src.rag_querier.RagAgent")
    @patch("src.rag_querier.Cache")
    def test_rag_querier_query_question_handles_http_error(
        self, mock_cache_class: Mock, mock_agent_class: Mock
    ) -> None:
        """Test that RAGQuerier handles HTTP errors gracefully."""
        import httpx

        mock_agent = MagicMock()
        mock_agent_class.return_value = mock_agent
        mock_cache = MagicMock()
        mock_cache_class.return_value = mock_cache

        mock_agent.query.side_effect = httpx.HTTPStatusError(
            "500 Server Error", request=MagicMock(), response=MagicMock()
        )

        querier = RAGQuerier(
            api_key="test-key",
            api_url="https://api.test.com",
            user_email="test@test.com",
            cache_dir=Path("./cache"),
        )

        with pytest.raises(httpx.HTTPStatusError):
            querier.query_question("Hva er barnevern?")

    @patch("src.rag_querier.RagAgent")
    @patch("src.rag_querier.Cache")
    def test_rag_querier_uses_caching(
        self, mock_cache_class: Mock, mock_agent_class: Mock
    ) -> None:
        """Test that RAGQuerier uses caching via RagAgent."""
        mock_agent = MagicMock()
        mock_agent_class.return_value = mock_agent
        mock_cache = MagicMock()
        mock_cache_class.return_value = mock_cache

        querier = RAGQuerier(
            api_key="test-key",
            api_url="https://api.test.com",
            user_email="test@test.com",
            cache_dir=Path("./cache"),
        )

        # Verify cache was passed to RagAgent
        mock_agent_class.assert_called_once_with(
            api_key="test-key",
            base_url="https://api.test.com",
            user_email="test@test.com",
            cache=mock_cache,
        )
