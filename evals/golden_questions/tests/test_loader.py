"""Unit tests for loader module."""

import json
import tempfile
from pathlib import Path

import pytest

from src.loader import load_conversations
from src.models import Conversation, Message


def test_load_valid_jsonl() -> None:
    """Load valid JSONL file successfully."""
    data = {
        "conversation": {
            "id": "test123",
            "topic": "Test Topic",
            "entityId": "entity1",
            "userId": "user1",
            "created": 1234567890,
        },
        "messages": [
            {
                "id": "msg1",
                "text": "Hello",
                "role": "user",
                "created": 1234567890,
                "chunks": [],
            }
        ],
    }

    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        f.write(json.dumps(data) + "\n")
        temp_path = f.name

    try:
        conversations = load_conversations(temp_path)
        assert len(conversations) == 1
        assert conversations[0].id == "test123"
        assert conversations[0].topic == "Test Topic"
        assert len(conversations[0].messages) == 1
        assert conversations[0].messages[0].text == "Hello"
    finally:
        Path(temp_path).unlink()


def test_load_multiple_conversations() -> None:
    """Load multiple conversations from JSONL."""
    data1 = {
        "conversation": {
            "id": "conv1",
            "topic": "Topic 1",
            "entityId": "entity1",
            "userId": "user1",
            "created": 1234567890,
        },
        "messages": [
            {"id": "msg1", "text": "Message 1", "role": "user", "created": 1234567890}
        ],
    }
    data2 = {
        "conversation": {
            "id": "conv2",
            "topic": "Topic 2",
            "entityId": "entity2",
            "userId": "user2",
            "created": 1234567891,
        },
        "messages": [
            {"id": "msg2", "text": "Message 2", "role": "user", "created": 1234567891}
        ],
    }

    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        f.write(json.dumps(data1) + "\n")
        f.write(json.dumps(data2) + "\n")
        temp_path = f.name

    try:
        conversations = load_conversations(temp_path)
        assert len(conversations) == 2
        assert conversations[0].id == "conv1"
        assert conversations[1].id == "conv2"
    finally:
        Path(temp_path).unlink()


def test_load_malformed_json() -> None:
    """Handle malformed JSON gracefully."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        f.write("not valid json\n")
        f.write('{"conversation": {"id": "valid"}}\n')  # Invalid but different reason
        temp_path = f.name

    try:
        # Should log warning but not raise exception
        conversations = load_conversations(temp_path)
        # Both lines should be skipped (first malformed, second missing fields)
        assert len(conversations) == 0
    finally:
        Path(temp_path).unlink()


def test_load_missing_conversation_field() -> None:
    """Skip conversations with missing conversation field."""
    data = {
        "messages": [
            {"id": "msg1", "text": "Hello", "role": "user", "created": 1234567890}
        ]
    }

    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        f.write(json.dumps(data) + "\n")
        temp_path = f.name

    try:
        conversations = load_conversations(temp_path)
        assert len(conversations) == 0
    finally:
        Path(temp_path).unlink()


def test_load_missing_messages_field() -> None:
    """Skip conversations with missing messages field."""
    data = {
        "conversation": {
            "id": "test123",
            "topic": "Test",
            "entityId": "entity1",
            "userId": "user1",
            "created": 1234567890,
        }
    }

    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        f.write(json.dumps(data) + "\n")
        temp_path = f.name

    try:
        conversations = load_conversations(temp_path)
        assert len(conversations) == 0
    finally:
        Path(temp_path).unlink()


def test_load_missing_required_conversation_field() -> None:
    """Skip conversations with missing required conversation fields."""
    data = {
        "conversation": {
            "id": "test123",
            "topic": "Test",
            # Missing entityId, userId, created
        },
        "messages": [],
    }

    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        f.write(json.dumps(data) + "\n")
        temp_path = f.name

    try:
        conversations = load_conversations(temp_path)
        assert len(conversations) == 0
    finally:
        Path(temp_path).unlink()


def test_load_empty_file() -> None:
    """Handle empty file."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        temp_path = f.name

    try:
        conversations = load_conversations(temp_path)
        assert len(conversations) == 0
    finally:
        Path(temp_path).unlink()


def test_load_file_not_found() -> None:
    """Raise error for non-existent file."""
    with pytest.raises(FileNotFoundError):
        load_conversations("/nonexistent/file.jsonl")


def test_load_message_with_optional_fields() -> None:
    """Load message with optional fields (role can be None, chunks can be missing)."""
    data = {
        "conversation": {
            "id": "test123",
            "topic": "Test",
            "entityId": "entity1",
            "userId": "user1",
            "created": 1234567890,
        },
        "messages": [
            {
                "id": "msg1",
                "text": "Message without role",
                "created": 1234567890,
                # No role field
                # No chunks field
            }
        ],
    }

    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        f.write(json.dumps(data) + "\n")
        temp_path = f.name

    try:
        conversations = load_conversations(temp_path)
        assert len(conversations) == 1
        assert len(conversations[0].messages) == 1
        assert conversations[0].messages[0].role is None
        assert conversations[0].messages[0].chunks == []
    finally:
        Path(temp_path).unlink()


def test_load_message_with_chunks() -> None:
    """Load message with retrieval chunks."""
    data = {
        "conversation": {
            "id": "test123",
            "topic": "Test",
            "entityId": "entity1",
            "userId": "user1",
            "created": 1234567890,
        },
        "messages": [
            {
                "id": "msg1",
                "text": "Message with chunks",
                "role": "assistant",
                "created": 1234567890,
                "chunks": [
                    {
                        "chunkId": "chunk1",
                        "docTitle": "Document Title",
                        "docNum": "123",
                        "contentMarkdown": "Content here",
                    }
                ],
            }
        ],
    }

    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
        f.write(json.dumps(data) + "\n")
        temp_path = f.name

    try:
        conversations = load_conversations(temp_path)
        assert len(conversations) == 1
        assert len(conversations[0].messages) == 1
        assert len(conversations[0].messages[0].chunks) == 1
        assert conversations[0].messages[0].chunks[0]["chunkId"] == "chunk1"
    finally:
        Path(temp_path).unlink()
