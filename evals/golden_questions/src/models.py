"""Data models for golden questions extraction."""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class Message:
    """Single message in a conversation."""

    id: str
    text: str
    role: Optional[str]  # "system", "user", "assistant", or None
    created: int
    chunks: List[Dict[str, Any]]
    filterValue: Optional[Dict[str, Any]] = None


@dataclass
class Conversation:
    """Complete conversation thread."""

    id: str
    topic: str
    entityId: str
    userId: str
    created: int
    messages: List[Message]


@dataclass
class UsageMode:
    """RAG system usage mode categorization."""

    document_scope: str  # "single_document" or "multi_document"
    operation_type: str  # E.g., "simple_qa", "aggregation", "inference"
    output_complexity: str  # "factoid", "prose", "list", or "table"

    def to_dict(self) -> Dict[str, str]:
        """Convert to dictionary for JSON serialization."""
        return {
            "document_scope": self.document_scope,
            "operation_type": self.operation_type,
            "output_complexity": self.output_complexity,
        }


@dataclass
class GoldenQuestion:
    """Extracted question with metadata."""

    id: str  # Unique identifier: "{conversation_id}_{user_message_index}"
    question: str  # Standalone question text
    original_question: str  # Original user message
    conversation_id: str  # Source conversation ID
    context_messages: List[Dict[str, str]]  # Previous messages with role and text
    has_retrieval: bool  # Whether assistant had retrieval chunks
    usage_mode: UsageMode  # RAG usage mode categorization
    subject_topics: List[str]  # LLM-categorized subject domain topics
    metadata: Dict[str, Any]  # Additional metadata (topic, userId, etc)
    question_changed: bool  # Whether question was reformulated vs original
    filters: Optional[Dict[str, List[str]]] = None  # Extracted filters (type, orgs_long, etc)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "question": self.question,
            "original_question": self.original_question,
            "conversation_id": self.conversation_id,
            "context_messages": self.context_messages,
            "has_retrieval": self.has_retrieval,
            "usage_mode": self.usage_mode.to_dict(),
            "subject_topics": self.subject_topics,
            "metadata": self.metadata,
            "question_changed": self.question_changed,
            "filters": self.filters,
        }
