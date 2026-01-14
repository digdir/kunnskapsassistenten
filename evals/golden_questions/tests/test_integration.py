"""Integration tests for full pipeline."""

import json
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from src.llm_provider import LLMConfig, LLMProvider
from src.main import process_conversations

pytestmark = pytest.mark.vcr

def test_end_to_end_pipeline() -> None:
    """Test complete pipeline with sample data."""
    # Create sample input data
    conversations = [
        {
            "conversation": {
                "id": "conv1",
                "topic": "Digdir budsjett",
                "entityId": "entity1",
                "userId": "user1",
                "created": 1234567890,
            },
            "messages": [
                {
                    "id": "msg1",
                    "text": "Hva er budsjettet til Digdir i 2024?",
                    "role": "user",
                    "created": 1234567890,
                },
                {
                    "id": "msg2",
                    "text": "Budsjettet er 500 millioner kroner",
                    "role": "assistant",
                    "created": 1234567891,
                    "chunks": [{"chunkId": "chunk1", "docTitle": "Budget"}],
                },
                {
                    "id": "msg3",
                    "text": "Og hvordan fordeles det?",
                    "role": "user",
                    "created": 1234567892,
                },
                {
                    "id": "msg4",
                    "text": "Det fordeles på flere områder...",
                    "role": "assistant",
                    "created": 1234567893,
                    "chunks": [{"chunkId": "chunk2", "docTitle": "Budget"}],
                },
            ],
        },
        {
            "conversation": {
                "id": "conv2",
                "topic": "Dataspillstrategi",
                "entityId": "entity2",
                "userId": "user2",
                "created": 1234567894,
            },
            "messages": [
                {
                    "id": "msg5",
                    "text": "Sammenlign strategiene til Digdir og DFØ",
                    "role": "user",
                    "created": 1234567895,
                },
                {
                    "id": "msg6",
                    "text": "Begge strategiene fokuserer på...",
                    "role": "assistant",
                    "created": 1234567896,
                    "chunks": [
                        {"chunkId": "chunk3", "docTitle": "Digdir Strategy"},
                        {"chunkId": "chunk4", "docTitle": "DFØ Strategy"},
                    ],
                },
            ],
        },
        {
            "conversation": {
                "id": "conv3",
                "topic": "Ny tråd",
                "entityId": "entity3",
                "userId": "user3",
                "created": 1234567897,
            },
            "messages": [
                {
                    "id": "msg7",
                    "text": "System prompt",
                    "role": "system",
                    "created": 1234567898,
                }
            ],
        },
        {
            "conversation": {
                "id": "conv4",
                "topic": "Duplicate question",
                "entityId": "entity4",
                "userId": "user4",
                "created": 1234567899,
            },
            "messages": [
                {
                    "id": "msg8",
                    "text": "Hva er budsjettet til Digdir i 2024?",  # Duplicate
                    "role": "user",
                    "created": 1234567900,
                },
                {
                    "id": "msg9",
                    "text": "Same answer",
                    "role": "assistant",
                    "created": 1234567901,
                    "chunks": [],
                },
            ],
        },
    ]

    # Create temporary input file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        for conv in conversations:
            f.write(json.dumps(conv) + "\n")
        input_path = f.name

    # Create temporary output file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        output_path = f.name

    try:
        # Mock the LLM client creation
        with patch("src.main.create_llm_client") as mock_client_factory:
            with patch("src.main.get_chat_model_name") as mock_chat_model:
                with patch("src.main.get_embedding_model_name") as mock_embedding_model:
                    # Create mock client
                    mock_client = Mock()
                    mock_client_factory.return_value = mock_client
                    mock_chat_model.return_value = "gpt-oss:120b-cloud"
                    mock_embedding_model.return_value = "nomic-embed-text"

                    # Mock the reformulation to return original question
                    def mock_reformulate(question, previous_messages, client, model="gpt-oss:120b-cloud", max_retries=3):
                        # Just return the original question for tests
                        return question

                    # Mock the categorization to return simple categorizations
                    def mock_categorize(questions, client, model="gpt-oss:120b-cloud"):
                        # Just assign default categorizations
                        from src.models import UsageMode
                        for q in questions:
                            if "sammenlign" in q.question.lower():
                                q.usage_mode = UsageMode("multi_document", "comparison", "prose")
                            else:
                                q.usage_mode = UsageMode("single_document", "simple_qa", "factoid")
                        return questions, []  # Return tuple of (successful, failed)

                    # Mock subject categorization
                    def mock_subject_categorize(questions, client, model="gpt-oss:120b-cloud", max_workers=10):
                        # Just assign default subject topics
                        for q in questions:
                            q.subject_topics = ["Økonomi og budsjett"]
                        return questions, []  # Return tuple of (successful, failed)

                    with patch("src.extractor.reformulate_question_llm", side_effect=mock_reformulate):
                        with patch("src.main.categorize_questions_llm", side_effect=mock_categorize):
                            with patch(
                                "src.main.categorize_subject_topics", side_effect=mock_subject_categorize
                            ):
                                # Create test LLM config
                                llm_config = LLMConfig(
                                    provider=LLMProvider.OLLAMA,
                                    ollama_base_url="http://localhost:11434/v1",
                                    ollama_chat_model="gpt-oss:120b-cloud",
                                    ollama_embedding_model="nomic-embed-text",
                                )
                                # Run pipeline
                                process_conversations(input_path, output_path, llm_config=llm_config)

                # Verify main output
                output_file = Path(output_path)
                assert output_file.exists()

                # Read output
                questions = []
                with open(output_file, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip():
                            questions.append(json.loads(line))

                # Verify results
                # Should have extracted 3 questions from conv1 and conv2, excluded conv3
                # After deduplication, should have 2 unique questions
                # (duplicate "Hva er budsjettet til Digdir i 2024?" removed)
                assert len(questions) >= 2
                assert len(questions) <= 3

                # Verify transparency files exist
                dropped_conversations_file = Path(output_path).parent / f"{Path(output_path).stem}_dropped_conversations.jsonl"
                dropped_duplicates_file = Path(output_path).parent / f"{Path(output_path).stem}_dropped_duplicates.jsonl"

                assert dropped_conversations_file.exists(), "Dropped conversations file should exist"
                assert dropped_duplicates_file.exists(), "Dropped duplicates file should exist"

                # Verify dropped conversations content
                with open(dropped_conversations_file, "r", encoding="utf-8") as f:
                    dropped_convs = [json.loads(line) for line in f if line.strip()]

                # Should have 1 dropped conversation (conv3 - "Ny tråd" with no user messages)
                assert len(dropped_convs) == 1
                assert dropped_convs[0]["conversation_id"] == "conv3"
                assert dropped_convs[0]["drop_reason"] == "Ny tråd with no user messages"
                assert "message_count" in dropped_convs[0]
                assert "messages" in dropped_convs[0]

                # Verify dropped duplicates content
                with open(dropped_duplicates_file, "r", encoding="utf-8") as f:
                    dropped_dups = [json.loads(line) for line in f if line.strip()]

                # Should have 1 duplicate (from conv4)
                assert len(dropped_dups) == 1
                assert dropped_dups[0]["dropped_question"]["conversation_id"] == "conv4"
                assert dropped_dups[0]["kept_original"]["conversation_id"] == "conv1"
                assert dropped_dups[0]["drop_reason"] == "Duplicate of earlier question"
                assert "normalized_form" in dropped_dups[0]

                # Verify question structure
                for q in questions:
                    assert "question" in q
                    assert "original_question" in q
                    assert "conversation_id" in q
                    assert "context_messages" in q
                    assert "has_retrieval" in q
                    assert "usage_mode" in q
                    assert "metadata" in q

                    # Verify usage_mode structure
                    assert "document_scope" in q["usage_mode"]
                    assert "operation_type" in q["usage_mode"]
                    assert "output_complexity" in q["usage_mode"]

                    # Verify metadata structure
                    assert "topic" in q["metadata"]
                    assert "user_id" in q["metadata"]
                    assert "created" in q["metadata"]

                # Verify specific questions
                question_texts = [q["question"] for q in questions]

                # Should include the comparison question (multi-document)
                assert any("sammenlign" in q.lower() for q in question_texts)

                # Check that at least one question has has_retrieval=True
                assert any(q["has_retrieval"] for q in questions)

                # Check that comparison question is categorized as multi_document
                comparison_q = next(
                    q for q in questions if "sammenlign" in q["question"].lower()
                )
                assert comparison_q["usage_mode"]["document_scope"] == "multi_document"

    finally:
        # Cleanup
        Path(input_path).unlink()
        if Path(output_path).exists():
            Path(output_path).unlink()

        # Cleanup transparency files
        dropped_conversations_file = Path(output_path).parent / f"{Path(output_path).stem}_dropped_conversations.jsonl"
        dropped_duplicates_file = Path(output_path).parent / f"{Path(output_path).stem}_dropped_duplicates.jsonl"
        if dropped_conversations_file.exists():
            dropped_conversations_file.unlink()
        if dropped_duplicates_file.exists():
            dropped_duplicates_file.unlink()


def test_pipeline_handles_empty_file() -> None:
    """Test pipeline with empty input file."""
    # Create empty input file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        input_path = f.name

    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        output_path = f.name

    try:
        # Mock the LLM functions
        def mock_categorize(questions, client, model="gpt-oss:120b-cloud"):
            return questions, []  # Return tuple of (successful, failed)

        def mock_subject_categorize(questions, client, model="gpt-oss:120b-cloud", max_workers=10):
            return questions, []  # Return tuple of (successful, failed)

        # Mock client creation
        with patch("src.llm_provider.create_llm_client") as mock_client_factory:
            mock_client = Mock()
            mock_client_factory.return_value = mock_client

            with patch("src.main.categorize_questions_llm", side_effect=mock_categorize):
                with patch(
                    "src.main.categorize_subject_topics", side_effect=mock_subject_categorize
                ):
                    # Create default Ollama config for test
                    llm_config = LLMConfig(
                        provider=LLMProvider.OLLAMA,
                        ollama_base_url="http://localhost:11434/v1",
                        ollama_chat_model="gpt-oss:120b-cloud",
                        ollama_embedding_model="nomic-embed-text",
                    )

                    # Should not crash
                    process_conversations(input_path, output_path, llm_config)

            # Output should be empty
            with open(output_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
                assert len(lines) == 0

    finally:
        Path(input_path).unlink()
        if Path(output_path).exists():
            Path(output_path).unlink()


def test_pipeline_creates_output_directory() -> None:
    """Test that pipeline creates output directory if it doesn't exist."""
    # Create temporary input file
    data = {
        "conversation": {
            "id": "conv1",
            "topic": "Test",
            "entityId": "entity1",
            "userId": "user1",
            "created": 1234567890,
        },
        "messages": [
            {
                "id": "msg1",
                "text": "Test question",
                "role": "user",
                "created": 1234567890,
            }
        ],
    }

    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        f.write(json.dumps(data) + "\n")
        input_path = f.name

    # Use output path in non-existent directory
    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = Path(tmpdir) / "nested" / "output" / "questions.jsonl"

        try:
            # Mock the LLM functions
            def mock_categorize(questions, client, model="gpt-oss:120b-cloud"):
                from src.models import UsageMode
                for q in questions:
                    q.usage_mode = UsageMode("single_document", "simple_qa", "factoid")
                return questions, []  # Return tuple of (successful, failed)

            def mock_subject_categorize(questions, client, model="gpt-oss:120b-cloud", max_workers=10):
                for q in questions:
                    q.subject_topics = []
                return questions, []  # Return tuple of (successful, failed)

            # Mock client creation
            with patch("src.llm_provider.create_llm_client") as mock_client_factory:
                mock_client = Mock()
                mock_client_factory.return_value = mock_client

                with patch("src.main.categorize_questions_llm", side_effect=mock_categorize):
                    with patch(
                        "src.main.categorize_subject_topics", side_effect=mock_subject_categorize
                    ):
                        # Create default Ollama config for test
                        llm_config = LLMConfig(
                            provider=LLMProvider.OLLAMA,
                            ollama_base_url="http://localhost:11434/v1",
                            ollama_chat_model="gpt-oss:120b-cloud",
                            ollama_embedding_model="nomic-embed-text",
                        )

                        # Should create directory structure
                        process_conversations(input_path, str(output_path), llm_config)

                        # Verify output exists
                        assert output_path.exists()
                        assert output_path.parent.exists()

        finally:
            Path(input_path).unlink()
