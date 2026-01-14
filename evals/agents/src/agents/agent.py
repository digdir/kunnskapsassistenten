# -*- coding: utf-8 -*-
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger(__name__)


@dataclass
class ChunkMetadata:
    """Metadata for a chunk used in RAG response."""

    chunk_id: str
    doc_title: Optional[str]
    doc_num: str
    content_markdown: str


@dataclass
class AgentRequest:
    """Request to send to the agent."""

    query: str
    document_types: List[str]
    organizations: List[str]
    temperature: float = 0


@dataclass
class AgentResponse:
    """Response from the agent."""

    answer: str
    conversation_id: Optional[str] = None
    model: Optional[str] = None
    chunks_used: List[ChunkMetadata] = field(default_factory=list)
    cache_hit: bool = False


class Agent(ABC):
    """Abstract base class for agents that can answer queries."""

    @abstractmethod
    def query(self, request: AgentRequest) -> AgentResponse:
        """Send a query to the agent and get a response."""
        pass
