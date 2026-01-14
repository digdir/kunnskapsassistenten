# -*- coding: utf-8 -*-
"""RAG querier module for loading questions and querying RAG API."""

import json
import logging
from pathlib import Path
from typing import List

from diskcache import Cache
from langfuse import observe

from agents.agent import AgentRequest, AgentResponse
from agents.RagAgent import RagAgent
from src.models import GoldenQuestion

logger = logging.getLogger(__name__)


@observe(capture_output=False)
def load_golden_questions(jsonl_file: Path, limit: int | None, skip: int = 0) -> List[GoldenQuestion]:
    """
    Load golden questions from JSONL file.

    Args:
        jsonl_file: Path to JSONL file containing golden questions.
        limit: Maximum number of questions to load.
        skip: Number of questions to skip from the beginning.

    Returns:
        List of GoldenQuestion objects.

    Raises:
        FileNotFoundError: If JSONL file does not exist.
        json.JSONDecodeError: If JSON is malformed.
        ValidationError: If required fields are missing.
    """
    if not jsonl_file.exists():
        raise FileNotFoundError(f"JSONL file not found: {jsonl_file}")

    questions: List[GoldenQuestion] = []
    skipped_count = 0
    with open(jsonl_file, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue

            try:
                data = json.loads(line)
                question = GoldenQuestion(**data)

                # Skip questions if needed
                if skipped_count < skip:
                    skipped_count += 1
                    continue

                questions.append(question)
                if limit and len(questions) >= limit:
                    break
            except json.JSONDecodeError as e:
                logger.error(f"Malformed JSON on line {line_num}: {e}")
                raise
            except Exception as e:
                logger.error(f"Error parsing question on line {line_num}: {e}")
                raise

    logger.info(f"Loaded {len(questions)} golden questions from {jsonl_file} (skipped {skip})")
    return questions


class RAGQuerier:
    """Queries the RAG API with caching."""

    def __init__(
        self,
        api_key: str,
        api_url: str,
        user_email: str,
        cache_dir: Path,
    ) -> None:
        """
        Initialize RAG querier.

        Args:
            api_key: API key for RAG authentication.
            api_url: Base URL for RAG API.
            user_email: User email for RAG requests.
            cache_dir: Directory for caching RAG responses.
        """
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_path = cache_dir / "rag"
        self.cache: Cache = Cache(str(cache_path))

        self.agent: RagAgent = RagAgent(
            api_key=api_key,
            base_url=api_url,
            user_email=user_email,
            cache=self.cache,
        )

        logger.info(f"RAGQuerier initialized with cache at {cache_path}")

    def query_question(
        self,
        question: str,
        document_types: List[str] | None = None,
        organizations: List[str] | None = None,
    ) -> AgentResponse:
        """
        Query RAG API with a question.

        Args:
            question: The question to send to RAG.
            document_types: Optional list of document types to filter by.
            organizations: Optional list of organizations to filter by.

        Returns:
            AgentResponse with answer and chunks.

        Raises:
            httpx.HTTPError: If RAG API request fails.
        """
        request = AgentRequest(
            query=question,
            document_types=document_types or [],
            organizations=organizations or [],
            temperature=0.0,
        )

        logger.debug(
            f"Querying RAG with question: {question[:100]}... "
            f"(doc_types={document_types}, orgs={organizations})"
        )
        response = self.agent.query(request)
        logger.debug(
            f"Received answer ({len(response.answer)} chars) "
            f"with {len(response.chunks_used)} chunks"
        )

        return response
