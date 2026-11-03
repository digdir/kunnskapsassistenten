# -*- coding: utf-8 -*-
import hashlib
import logging
import os
from typing import Optional

import httpx
from diskcache import Cache
from langfuse import observe

from agents.agent import Agent, AgentRequest, AgentResponse, ChunkMetadata

logger = logging.getLogger(__name__)


class RagAgent(Agent):
    """Agent that queries the RAG API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        user_email: Optional[str] = None,
        cache: Optional[Cache] = None,
    ) -> None:
        """
        Initialize the RAG agent.

        Args:
            api_key: API key for authentication. If not provided, uses RAG_API_KEY from environment.
            base_url: Base URL for the API. If not provided, uses RAG_API_URL from environment.
            user_email: User email for requests. If not provided, uses RAG_API_EMAIL from environment.
            cache: Optional diskcache.Cache instance for caching responses.

        Raises:
            ValueError: If required environment variables are missing.
        """
        self.api_key = api_key or os.getenv("RAG_API_KEY")
        self.base_url = base_url or os.getenv("RAG_API_URL")
        self.user_email = user_email or os.getenv("RAG_API_EMAIL")
        self.cache: Optional[Cache] = cache

        if not self.api_key:
            raise ValueError("RAG_API_KEY environment variable is not set")
        if not self.base_url:
            raise ValueError("RAG_API_URL environment variable is not set")
        if not self.user_email:
            raise ValueError("RAG_API_EMAIL environment variable is not set")

        # Remove trailing slash from base_url if present
        self.base_url = self.base_url.rstrip("/")

    def _get_cache_key(self, request: AgentRequest) -> str:
        """Generate a cache key from the request parameters and base URL."""
        content: str = (
            f"{request.query}|{self.base_url}|{self.user_email}|"
            f"{','.join(sorted(request.document_types))}|{','.join(sorted(request.organizations))}"
        )
        return hashlib.sha256(content.encode()).hexdigest()

    def query(self, request: AgentRequest) -> AgentResponse:
        """
        Send a query to the RAG API and get a response.

        Args:
            request: The agent request containing the query and parameters.

        Returns:
            AgentResponse containing the answer and metadata.

        Raises:
            httpx.HTTPError: If the API request fails.
        """
        logger.debug(f"RagAgent querying API with: {request.query}")


        # Check cache if enabled
        if self.cache is not None:
            cache_key: str = self._get_cache_key(request)
            cached_result = self.cache.get(cache_key)
            if cached_result is not None and isinstance(cached_result, AgentResponse):
                logger.debug("RagAgent: Cache hit")
                cached_result.cache_hit = True
                return cached_result
            logger.debug("RagAgent: Cache miss")

        response = self._fetch(request)
        response.cache_hit = False
        return response

    @observe(capture_input=False, capture_output=False)
    def _fetch(self, request):
        url = f"{self.base_url}/api/rag"
        headers = {
            "X-API-Key": self.api_key,
            "X-User-Email": self.user_email,
            "Content-Type": "application/json",
        }
        payload = {
            "query": request.query,
            "type": request.document_types,  # TODO verify query params
            "org": request.organizations,  # TODO verify query params
        }

        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.post(url, headers=headers, json=payload)
                response.raise_for_status()

                data = response.json()
                logger.debug(
                    f"RagAgent received response: conversation_id={data.get('conversation-id')}"
                )

                # Extract and parse chunks metadata
                chunks_data = data.get("chunks-used", [])
                chunks_used = [
                    ChunkMetadata(
                        chunk_id=chunk.get("chunk-id", ""),
                        doc_title=chunk.get("doc-title"),
                        doc_num=chunk.get("doc-num", ""),
                        content_markdown=chunk.get("content-markdown", ""),
                    )
                    for chunk in chunks_data
                ]

                # Create the agent response
                agent_response = AgentResponse(
                    answer=data["answer"],
                    conversation_id=data.get("conversation-id"),
                    model=data.get("model"),
                    chunks_used=chunks_used,
                )

                # Store result in cache if enabled
                if self.cache is not None:
                    cache_key: str = self._get_cache_key(request)
                    # Store query as tag for easier viewing
                    self.cache.set(cache_key, agent_response, tag=request.query)
                    logger.debug(f"RagAgent: Cached result with key {cache_key[:8]}...")

                return agent_response

        except httpx.HTTPStatusError as e:
            logger.error(
                f"HTTP error occurred: {e.response.status_code} - {e.response.text}"
            )
            raise
        except httpx.RequestError as e:
            logger.error(f"Request error occurred: {e}")
            raise
        except KeyError as e:
            logger.error(f"Missing expected field in API response: {e}")
            raise
