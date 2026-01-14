"""LLM response caching using diskcache for production pipeline."""

import hashlib
import json
import logging
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import diskcache
from openai import AzureOpenAI, OpenAI
from openai.types.chat import ChatCompletion
from openai.types.create_embedding_response import CreateEmbeddingResponse

logger = logging.getLogger(__name__)


def _generate_chat_key(
    model: str,
    messages: List[Dict[str, str]],
    temperature: float,
    max_tokens: Optional[int] = None,
    response_format: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generate cache key for chat completion request.

    Args:
        model: Model name or deployment identifier
        messages: Conversation messages
        temperature: Temperature parameter
        max_tokens: Optional token limit
        response_format: Optional response format specification

    Returns:
        Cache key string in format "chat_{hash}"
    """
    key_data = {
        "type": "chat_completion",
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": response_format,
    }
    # Canonical JSON serialization (sorted keys, no whitespace)
    key_json = json.dumps(key_data, sort_keys=True, ensure_ascii=False)
    # SHA256 hash for compact, collision-resistant key
    key_hash = hashlib.sha256(key_json.encode("utf-8")).hexdigest()
    return f"chat_{key_hash}"


def _generate_embedding_key(model: str, input_text: str) -> str:
    """
    Generate cache key for embedding request.

    Args:
        model: Embedding model name or deployment identifier
        input_text: Input text to embed

    Returns:
        Cache key string in format "embed_{hash}"
    """
    key_data = {
        "type": "embedding",
        "model": model,
        "input": input_text,
    }
    key_json = json.dumps(key_data, sort_keys=True, ensure_ascii=False)
    key_hash = hashlib.sha256(key_json.encode("utf-8")).hexdigest()
    return f"embed_{key_hash}"


def _serialize_chat_completion(response: ChatCompletion) -> Dict[str, Any]:
    """
    Serialize ChatCompletion to dict for caching.

    Args:
        response: ChatCompletion response from OpenAI

    Returns:
        Serialized dict representation

    Raises:
        ValueError: If serialization fails due to unexpected schema
    """
    try:
        return {
            "id": response.id,
            "choices": [
                {
                    "finish_reason": choice.finish_reason,
                    "index": choice.index,
                    "message": {
                        "content": choice.message.content,
                        "role": choice.message.role,
                    },
                }
                for choice in response.choices
            ],
            "created": response.created,
            "model": response.model,
            "usage": {
                "completion_tokens": response.usage.completion_tokens,
                "prompt_tokens": response.usage.prompt_tokens,
                "total_tokens": response.usage.total_tokens,
            }
            if response.usage
            else None,
        }
    except AttributeError as e:
        raise ValueError(f"Failed to serialize ChatCompletion: {e}") from e


def _deserialize_chat_completion(data: Dict[str, Any]) -> ChatCompletion:
    """
    Deserialize dict back to ChatCompletion.

    Args:
        data: Serialized ChatCompletion dict

    Returns:
        ChatCompletion instance
    """
    # Use model_construct for direct instantiation without validation
    return ChatCompletion.model_construct(**data)


def _serialize_embedding_response(
    response: CreateEmbeddingResponse,
) -> Dict[str, Any]:
    """
    Serialize CreateEmbeddingResponse to dict for caching.

    Args:
        response: CreateEmbeddingResponse from OpenAI

    Returns:
        Serialized dict representation

    Raises:
        ValueError: If serialization fails due to unexpected schema
    """
    try:
        return {
            "data": [
                {
                    "embedding": item.embedding,
                    "index": item.index,
                    "object": item.object,
                }
                for item in response.data
            ],
            "model": response.model,
            "object": response.object,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "total_tokens": response.usage.total_tokens,
            },
        }
    except AttributeError as e:
        raise ValueError(f"Failed to serialize CreateEmbeddingResponse: {e}") from e


def _deserialize_embedding_response(data: Dict[str, Any]) -> CreateEmbeddingResponse:
    """
    Deserialize dict back to CreateEmbeddingResponse.

    Args:
        data: Serialized CreateEmbeddingResponse dict

    Returns:
        CreateEmbeddingResponse instance
    """
    return CreateEmbeddingResponse.model_construct(**data)


class _CompletionsNamespace:
    """Wraps chat.completions.create method with caching."""

    def __init__(self, cached_client: "CachedLLMClient"):
        """
        Initialize completions namespace.

        Args:
            cached_client: Parent CachedLLMClient instance
        """
        self._cached_client = cached_client

    def create(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.0,
        max_tokens: Optional[int] = None,
        response_format: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> ChatCompletion:
        """
        Create chat completion with caching.

        Args:
            model: Model name or deployment identifier
            messages: Conversation messages
            temperature: Temperature parameter (default: 0.0)
            max_tokens: Optional token limit
            response_format: Optional response format specification
            **kwargs: Additional arguments passed to underlying client

        Returns:
            ChatCompletion response (from cache or API)
        """
        cache_key = _generate_chat_key(
            model, messages, temperature, max_tokens, response_format
        )

        # Try cache first
        if self._cached_client._enabled:
            try:
                cached_response = self._cached_client._cache.get(cache_key)
                if cached_response is not None:
                    self._cached_client._stats["hits"] += 1
                    logger.debug(f"Cache HIT for chat completion (key: {cache_key[:16]}...)")
                    return _deserialize_chat_completion(cached_response)
            except Exception as e:
                # Log but continue to API call
                logger.warning(f"Cache read error (falling back to API): {e}")

        # Cache miss - call underlying client
        self._cached_client._stats["misses"] += 1
        logger.debug(f"Cache MISS for chat completion (key: {cache_key[:16]}...)")

        response = self._cached_client._client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
            **kwargs,
        )

        # Store in cache (fire-and-forget on errors)
        if self._cached_client._enabled:
            try:
                serialized = _serialize_chat_completion(response)
                self._cached_client._cache.set(cache_key, serialized)
            except Exception as e:
                logger.warning(f"Failed to cache response (continuing): {e}")

        return response


class _ChatNamespace:
    """Wraps chat namespace with cached completions."""

    def __init__(self, cached_client: "CachedLLMClient"):
        """
        Initialize chat namespace.

        Args:
            cached_client: Parent CachedLLMClient instance
        """
        self._cached_client = cached_client

    @property
    def completions(self) -> _CompletionsNamespace:
        """
        Return completions namespace with caching.

        Returns:
            Completions namespace wrapper
        """
        return _CompletionsNamespace(self._cached_client)


class _EmbeddingsNamespace:
    """Wraps embeddings namespace with caching."""

    def __init__(self, cached_client: "CachedLLMClient"):
        """
        Initialize embeddings namespace.

        Args:
            cached_client: Parent CachedLLMClient instance
        """
        self._cached_client = cached_client

    def create(
        self,
        input: str,
        model: str,
        **kwargs: Any,
    ) -> CreateEmbeddingResponse:
        """
        Create embedding with caching.

        Args:
            input: Input text to embed
            model: Embedding model name or deployment identifier
            **kwargs: Additional arguments passed to underlying client

        Returns:
            CreateEmbeddingResponse (from cache or API)
        """
        cache_key = _generate_embedding_key(model, input)

        # Try cache first
        if self._cached_client._enabled:
            try:
                cached_response = self._cached_client._cache.get(cache_key)
                if cached_response is not None:
                    self._cached_client._stats["hits"] += 1
                    logger.debug(f"Cache HIT for embedding (key: {cache_key[:16]}...)")
                    return _deserialize_embedding_response(cached_response)
            except Exception as e:
                logger.warning(f"Cache read error (falling back to API): {e}")

        # Cache miss - call underlying client
        self._cached_client._stats["misses"] += 1
        logger.debug(f"Cache MISS for embedding (key: {cache_key[:16]}...)")

        response = self._cached_client._client.embeddings.create(
            input=input,
            model=model,
            **kwargs,
        )

        # Store in cache
        if self._cached_client._enabled:
            try:
                serialized = _serialize_embedding_response(response)
                self._cached_client._cache.set(cache_key, serialized)
            except Exception as e:
                logger.warning(f"Failed to cache embedding (continuing): {e}")

        return response


class CachedLLMClient:
    """Wrapper around OpenAI/AzureOpenAI client with disk caching."""

    def __init__(
        self,
        client: Union[OpenAI, AzureOpenAI],
        cache_dir: str = ".cache/llm_responses",
        enabled: bool = True,
    ):
        """
        Initialize cached client wrapper.

        Args:
            client: OpenAI or AzureOpenAI client instance
            cache_dir: Directory for cache storage
            enabled: Whether caching is enabled (False = passthrough)
        """
        self._client = client
        self._enabled = enabled
        self._stats = {"hits": 0, "misses": 0}

        if enabled:
            Path(cache_dir).mkdir(parents=True, exist_ok=True)
            self._cache = diskcache.Cache(
                cache_dir,
                size_limit=10 * 1024**3,  # 10 GB limit
                eviction_policy="least-recently-used",
            )
            logger.info(f"LLM cache initialized at {cache_dir}")
        else:
            self._cache = None
            logger.info("LLM cache disabled (passthrough mode)")

    @property
    def chat(self) -> _ChatNamespace:
        """
        Return chat namespace with cached completions.

        Returns:
            Chat namespace wrapper
        """
        return _ChatNamespace(self)

    @property
    def embeddings(self) -> _EmbeddingsNamespace:
        """
        Return embeddings namespace with cached create method.

        Returns:
            Embeddings namespace wrapper
        """
        return _EmbeddingsNamespace(self)

    def __getattr__(self, name: str) -> Any:
        """
        Delegate all other attributes to underlying client.

        Args:
            name: Attribute name

        Returns:
            Attribute from underlying client
        """
        return getattr(self._client, name)


def clear_cache(cache_dir: str) -> None:
    """
    Clear all cached LLM responses.

    Args:
        cache_dir: Cache directory path to clear
    """
    cache_path = Path(cache_dir)
    if cache_path.exists():
        shutil.rmtree(cache_path)
        logger.info(f"Cleared cache at {cache_dir}")
    else:
        logger.info(f"Cache directory does not exist: {cache_dir}")
