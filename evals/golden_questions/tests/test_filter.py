"""Unit tests for filter module."""

from src.filter import filter_conversations, should_process_conversation
from src.models import Conversation, Message


def test_filter_empty_conversation() -> None:
    """Exclude conversation with only empty messages."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(id="msg1", text="", role=None, created=1234567890, chunks=[]),
            Message(id="msg2", text="   ", role=None, created=1234567891, chunks=[]),
        ],
    )
    assert should_process_conversation(conv) is False


def test_filter_ny_traad_no_user_messages() -> None:
    """Exclude 'Ny tråd' with no user messages."""
    conv = Conversation(
        id="conv1",
        topic="Ny tråd",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(id="msg1", text="System message", role="system", created=1234567890, chunks=[])
        ],
    )
    assert should_process_conversation(conv) is False


def test_filter_ny_traad_with_user_message() -> None:
    """Include 'Ny tråd' with user messages."""
    conv = Conversation(
        id="conv1",
        topic="Ny tråd",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1", text="User question", role="user", created=1234567890, chunks=[]
            )
        ],
    )
    assert should_process_conversation(conv) is True


def test_filter_valid_conversation() -> None:
    """Include conversation with user messages."""
    conv = Conversation(
        id="conv1",
        topic="Real Topic",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1", text="User question", role="user", created=1234567890, chunks=[]
            ),
            Message(
                id="msg2",
                text="Assistant answer",
                role="assistant",
                created=1234567891,
                chunks=[],
            ),
        ],
    )
    assert should_process_conversation(conv) is True


def test_filter_system_only() -> None:
    """Exclude conversation with only system messages."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1", text="System message 1", role="system", created=1234567890, chunks=[]
            ),
            Message(
                id="msg2", text="System message 2", role="system", created=1234567891, chunks=[]
            ),
        ],
    )
    assert should_process_conversation(conv) is False


def test_filter_null_role_messages() -> None:
    """Exclude conversation with only null role messages."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(id="msg1", text="Message with no role", role=None, created=1234567890, chunks=[])
        ],
    )
    assert should_process_conversation(conv) is False


def test_filter_mixed_messages() -> None:
    """Include conversation with mixed message types if user message present."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1", text="System message", role="system", created=1234567890, chunks=[]
            ),
            Message(id="msg2", text="Empty", role=None, created=1234567891, chunks=[]),
            Message(
                id="msg3", text="User question", role="user", created=1234567892, chunks=[]
            ),
        ],
    )
    assert should_process_conversation(conv) is True


def test_filter_whitespace_only_user_message() -> None:
    """Exclude conversation where user message is whitespace only."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(id="msg1", text="   \n  \t  ", role="user", created=1234567890, chunks=[])
        ],
    )
    assert should_process_conversation(conv) is False


def test_filter_conversations_list() -> None:
    """Filter list of conversations."""
    conversations = [
        Conversation(
            id="conv1",
            topic="Valid",
            entityId="entity1",
            userId="user1",
            created=1234567890,
            messages=[
                Message(
                    id="msg1", text="User question", role="user", created=1234567890, chunks=[]
                )
            ],
        ),
        Conversation(
            id="conv2",
            topic="Empty",
            entityId="entity2",
            userId="user2",
            created=1234567891,
            messages=[
                Message(
                    id="msg2", text="System only", role="system", created=1234567891, chunks=[]
                )
            ],
        ),
        Conversation(
            id="conv3",
            topic="Also valid",
            entityId="entity3",
            userId="user3",
            created=1234567892,
            messages=[
                Message(
                    id="msg3",
                    text="Another user question",
                    role="user",
                    created=1234567892,
                    chunks=[],
                )
            ],
        ),
    ]

    filtered = filter_conversations(conversations)
    assert len(filtered) == 2
    assert filtered[0].id == "conv1"
    assert filtered[1].id == "conv3"
