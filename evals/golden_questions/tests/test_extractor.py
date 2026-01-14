"""Unit tests for extractor module."""

from src.extractor import extract_golden_questions
from src.models import Conversation, Message


def test_extract_standalone_question() -> None:
    """Extract question that needs no context."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="Hva er budsjettet til Digdir i 2024?",
                role="user",
                created=1234567890,
                chunks=[],
            )
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 1
    assert questions[0].question == "Hva er budsjettet til Digdir i 2024?"
    assert questions[0].original_question == "Hva er budsjettet til Digdir i 2024?"
    assert questions[0].context_messages == []


def test_extract_with_pronoun() -> None:
    """Extract question with pronoun (without LLM, uses original)."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="Regjeringen har lansert en dataspillstrategi for 2024-2026",
                role="assistant",
                created=1234567890,
                chunks=[{"chunkId": "c1"}],
            ),
            Message(
                id="msg2",
                text="Hva innebærer det?",
                role="user",
                created=1234567891,
                chunks=[],
            ),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 1
    # Without LLM client, uses original question
    assert questions[0].original_question == "Hva innebærer det?"
    assert questions[0].question == "Hva innebærer det?"
    assert questions[0].context_messages == []


def test_extract_follow_up() -> None:
    """Extract follow-up question (without LLM, uses original)."""
    conv = Conversation(
        id="conv1",
        topic="Dataspillstrategi",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="Hva er regjeringens dataspillstrategi?",
                role="user",
                created=1234567890,
                chunks=[],
            ),
            Message(
                id="msg2",
                text="Regjeringen lanserte en omfattende strategi",
                role="assistant",
                created=1234567891,
                chunks=[{"chunkId": "c1"}],
            ),
            Message(
                id="msg3", text="Kan du si mer?", role="user", created=1234567892, chunks=[]
            ),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 2
    # Without LLM client, uses original question
    assert questions[1].original_question == "Kan du si mer?"
    assert questions[1].question == "Kan du si mer?"
    assert questions[1].context_messages == []


def test_extract_no_user_messages() -> None:
    """Return empty list for conversation without user messages."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="System message",
                role="system",
                created=1234567890,
                chunks=[],
            ),
            Message(
                id="msg2",
                text="Assistant message",
                role="assistant",
                created=1234567891,
                chunks=[],
            ),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 0


def test_has_retrieval_true() -> None:
    """Set has_retrieval=True when assistant had chunks."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="What is the budget?",
                role="user",
                created=1234567890,
                chunks=[],
            ),
            Message(
                id="msg2",
                text="The budget is...",
                role="assistant",
                created=1234567891,
                chunks=[{"chunkId": "chunk1", "docTitle": "Budget Doc"}],
            ),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 1
    assert questions[0].has_retrieval is True


def test_has_retrieval_false() -> None:
    """Set has_retrieval=False when assistant had no chunks."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="What is the budget?",
                role="user",
                created=1234567890,
                chunks=[],
            ),
            Message(
                id="msg2",
                text="I don't have that information",
                role="assistant",
                created=1234567891,
                chunks=[],
            ),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 1
    assert questions[0].has_retrieval is False


def test_extract_multiple_questions() -> None:
    """Extract multiple questions from conversation."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="Hva er budsjettet?",
                role="user",
                created=1234567890,
                chunks=[],
            ),
            Message(
                id="msg2",
                text="Budsjettet er 100 millioner",
                role="assistant",
                created=1234567891,
                chunks=[{"chunkId": "c1"}],
            ),
            Message(
                id="msg3",
                text="Hva med forrige år?",
                role="user",
                created=1234567892,
                chunks=[],
            ),
            Message(
                id="msg4",
                text="Forrige år var det 90 millioner",
                role="assistant",
                created=1234567893,
                chunks=[{"chunkId": "c2"}],
            ),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 2
    assert questions[0].original_question == "Hva er budsjettet?"
    assert questions[1].original_question == "Hva med forrige år?"


def test_extract_filters() -> None:
    """Extract minimal parsed filters from filterValue."""
    conv = Conversation(
        id="conv1",
        topic="FilterTest",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="Hva er budsjettet?",
                role="user",
                created=1234567890,
                chunks=[],
                filterValue={
                    "type": "typesense",
                    "fields": [
                        {
                            "type": "multiselect",
                            "expanded?": True,
                            "selected-options": ["A", "B"],
                            "field": "type",
                        },
                        {
                            "type": "multiselect",
                            "expanded?": True,
                            "selected-options": ["C"],
                            "field": "orgs_long",
                        },
                    ],
                },
            )
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 1
    assert questions[0].filters == {
        "type": ["A", "B"],
        "orgs_long": ["C"],
    }


# ========================================
# Feature 1: Unique Message IDs
# ========================================


def test_unique_id_first_user_message() -> None:
    """Test unique ID generation for first user message."""
    conv = Conversation(
        id="k1MBbzf_DZsTpLl86odSz",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="System message",
                role="system",
                created=1234567890,
                chunks=[],
            ),
            Message(
                id="msg2",
                text="Hva er budsjettet?",
                role="user",
                created=1234567891,
                chunks=[],
            ),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 1
    assert questions[0].id == "k1MBbzf_DZsTpLl86odSz_0"


def test_unique_id_multiple_user_messages() -> None:
    """Test unique ID generation increments for each user message."""
    conv = Conversation(
        id="abc123xyz",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(id="msg1", text="System", role="system", created=1234567890, chunks=[]),
            Message(id="msg2", text="Question 1", role="user", created=1234567891, chunks=[]),
            Message(
                id="msg3", text="Answer 1", role="assistant", created=1234567892, chunks=[]
            ),
            Message(id="msg4", text="Question 2", role="user", created=1234567893, chunks=[]),
            Message(
                id="msg5", text="Answer 2", role="assistant", created=1234567894, chunks=[]
            ),
            Message(id="msg6", text="Question 3", role="user", created=1234567895, chunks=[]),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 3
    assert questions[0].id == "abc123xyz_0"
    assert questions[1].id == "abc123xyz_1"
    assert questions[2].id == "abc123xyz_2"


def test_unique_id_conversation_id_format() -> None:
    """Test ID preserves conversation_id and message_id relationship."""
    conv = Conversation(
        id="test_conv_id_123",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1", text="First question", role="user", created=1234567890, chunks=[]
            ),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 1
    assert questions[0].id == "test_conv_id_123_0"
    assert questions[0].conversation_id == "test_conv_id_123"


# ========================================
# Feature 2: Document Type Extraction
# ========================================


def test_document_types_single_type() -> None:
    """Test extraction of single document type from filterValue."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="",
                role=None,
                created=1234567890,
                chunks=[],
                filterValue={
                    "type": "typesense",
                    "fields": [
                        {
                            "type": "multiselect",
                            "field": "type",
                            "selected-options": ["Årsrapport"],
                        }
                    ],
                },
            ),
            Message(
                id="msg2",
                text="Hva er budsjettet?",
                role="user",
                created=1234567891,
                chunks=[],
            ),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 1
    assert questions[0].filters == {"type": ["Årsrapport"]}


def test_document_types_multiple_types() -> None:
    """Test extraction of multiple document types from filterValue."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="",
                role=None,
                created=1234567890,
                chunks=[],
                filterValue={
                    "type": "typesense",
                    "fields": [
                        {
                            "type": "multiselect",
                            "field": "type",
                            "selected-options": ["Årsrapport", "Proposisjon til Stortinget"],
                        }
                    ],
                },
            ),
            Message(
                id="msg2",
                text="Hva er budsjettet?",
                role="user",
                created=1234567891,
                chunks=[],
            ),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 1
    assert questions[0].filters == {
        "type": ["Årsrapport", "Proposisjon til Stortinget"],
    }


def test_document_types_empty_when_no_filter() -> None:
    """Test document_types is empty list when no filterValue present."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="Hva er budsjettet?",
                role="user",
                created=1234567890,
                chunks=[],
            ),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 1
    assert questions[0].filters is None


def test_document_types_autocorrect_typo() -> None:
    """Test auto-correction of 'Årsrapprt' to 'Årsrapport'."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="",
                role=None,
                created=1234567890,
                chunks=[],
                filterValue={
                    "type": "typesense",
                    "fields": [
                        {
                            "type": "multiselect",
                            "field": "type",
                            "selected-options": ["Årsrapprt"],
                        }
                    ],
                },
            ),
            Message(
                id="msg2",
                text="Hva er budsjettet?",
                role="user",
                created=1234567891,
                chunks=[],
            ),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 1
    assert questions[0].filters == {"type": ["Årsrapport"]}


def test_document_types_preserves_unknown_types() -> None:
    """Test unknown document types are preserved (not filtered out)."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="",
                role=None,
                created=1234567890,
                chunks=[],
                filterValue={
                    "type": "typesense",
                    "fields": [
                        {
                            "type": "multiselect",
                            "field": "type",
                            "selected-options": ["Unknown Document Type", "Årsrapport"],
                        }
                    ],
                },
            ),
            Message(
                id="msg2",
                text="Hva er budsjettet?",
                role="user",
                created=1234567891,
                chunks=[],
            ),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 1
    assert set(questions[0].filters["type"]) == {"Unknown Document Type", "Årsrapport"}


def test_document_types_from_multiple_messages() -> None:
    """Test document types are collected from all messages in conversation."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="",
                role=None,
                created=1234567890,
                chunks=[],
                filterValue={
                    "type": "typesense",
                    "fields": [
                        {
                            "type": "multiselect",
                            "field": "type",
                            "selected-options": ["Årsrapport"],
                        }
                    ],
                },
            ),
            Message(
                id="msg2",
                text="Question 1",
                role="user",
                created=1234567891,
                chunks=[],
            ),
            Message(
                id="msg3",
                text="",
                role=None,
                created=1234567892,
                chunks=[],
                filterValue={
                    "type": "typesense",
                    "fields": [
                        {
                            "type": "multiselect",
                            "field": "type",
                            "selected-options": ["Proposisjon til Stortinget"],
                        }
                    ],
                },
            ),
            Message(
                id="msg4",
                text="Question 2",
                role="user",
                created=1234567893,
                chunks=[],
            ),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 2
    # Both questions should have all document types from conversation
    assert set(questions[0].filters["type"]) == {"Årsrapport", "Proposisjon til Stortinget"}
    assert set(questions[1].filters["type"]) == {"Årsrapport", "Proposisjon til Stortinget"}


def test_document_types_ignores_other_filter_fields() -> None:
    """Test extraction only gets types from field='type', not other fields."""
    conv = Conversation(
        id="conv1",
        topic="Test",
        entityId="entity1",
        userId="user1",
        created=1234567890,
        messages=[
            Message(
                id="msg1",
                text="",
                role=None,
                created=1234567890,
                chunks=[],
                filterValue={
                    "type": "typesense",
                    "fields": [
                        {
                            "type": "multiselect",
                            "field": "type",
                            "selected-options": ["Årsrapport"],
                        },
                        {
                            "type": "multiselect",
                            "field": "orgs_long",
                            "selected-options": ["Barne- og familiedepartementet"],
                        },
                    ],
                },
            ),
            Message(
                id="msg2",
                text="Hva er budsjettet?",
                role="user",
                created=1234567891,
                chunks=[],
            ),
        ],
    )

    questions, _ = extract_golden_questions(conv)
    assert len(questions) == 1
    assert questions[0].filters["type"] == ["Årsrapport"]
    # Should not include org name
    assert "Barne- og familiedepartementet" not in questions[0].filters["type"]
