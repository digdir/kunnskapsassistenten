"""Test the LLM caching layer."""

from unittest.mock import Mock, patch

import pytest
from openai import OpenAI

from src.llm_cache import (
    CachedLLMClient,
    _generate_chat_key,
    _generate_embedding_key,
    clear_cache,
)


def test_cache_initialization(tmp_path):
    """Test cache initializes correctly."""
    cache_dir = tmp_path / "cache"
    client = OpenAI(base_url="http://localhost:11434/v1", api_key="test")
    cached_client = CachedLLMClient(client, cache_dir=str(cache_dir), enabled=True)

    assert cached_client._enabled is True
    assert cache_dir.exists()


def test_cache_disabled_passthrough(tmp_path):
    """Test cache can be disabled for passthrough."""
    client = OpenAI(base_url="http://localhost:11434/v1", api_key="test")
    cached_client = CachedLLMClient(client, enabled=False)

    assert cached_client._enabled is False
    assert cached_client._cache is None


def test_chat_completion_caching(tmp_path):
    """Test chat completion responses are cached correctly."""
    cache_dir = tmp_path / "cache"
    client = OpenAI(base_url="http://localhost:11434/v1", api_key="test")
    cached_client = CachedLLMClient(client, cache_dir=str(cache_dir))

    messages = [{"role": "user", "content": "Hello"}]

    # Mock the underlying client response
    mock_response = Mock()
    mock_response.id = "test-id"
    mock_response.created = 1234567890
    mock_response.model = "test-model"
    mock_response.choices = [Mock()]
    mock_response.choices[0].index = 0
    mock_response.choices[0].finish_reason = "stop"
    mock_response.choices[0].message = Mock()
    mock_response.choices[0].message.role = "assistant"
    mock_response.choices[0].message.content = "Hello there!"
    mock_response.usage = Mock()
    mock_response.usage.prompt_tokens = 10
    mock_response.usage.completion_tokens = 5
    mock_response.usage.total_tokens = 15

    with patch.object(client.chat.completions, "create", return_value=mock_response):
        # First call - cache miss
        response1 = cached_client.chat.completions.create(
            model="test-model",
            messages=messages,
            temperature=0.0,
        )
        assert cached_client._stats["misses"] == 1
        assert cached_client._stats["hits"] == 0

        # Second call - cache hit
        response2 = cached_client.chat.completions.create(
            model="test-model",
            messages=messages,
            temperature=0.0,
        )
        assert cached_client._stats["misses"] == 1
        assert cached_client._stats["hits"] == 1

        # Verify responses are identical
        assert response1.choices[0].message.content == response2.choices[0].message.content


def test_embedding_caching(tmp_path):
    """Test embedding responses are cached correctly."""
    cache_dir = tmp_path / "cache"
    client = OpenAI(base_url="http://localhost:11434/v1", api_key="test")
    cached_client = CachedLLMClient(client, cache_dir=str(cache_dir))

    # Mock the underlying client response
    mock_response = Mock()
    mock_response.model = "test-embedding-model"
    mock_response.object = "list"
    mock_response.data = [Mock()]
    mock_response.data[0].object = "embedding"
    mock_response.data[0].index = 0
    mock_response.data[0].embedding = [0.1, 0.2, 0.3, 0.4, 0.5]
    mock_response.usage = Mock()
    mock_response.usage.prompt_tokens = 5
    mock_response.usage.total_tokens = 5

    with patch.object(client.embeddings, "create", return_value=mock_response):
        # First call - cache miss
        response1 = cached_client.embeddings.create(
            input="test text",
            model="test-embedding-model",
        )
        assert cached_client._stats["misses"] == 1

        # Second call - cache hit
        response2 = cached_client.embeddings.create(
            input="test text",
            model="test-embedding-model",
        )
        assert cached_client._stats["hits"] == 1

        # Verify embeddings are identical
        assert response1.data[0].embedding == response2.data[0].embedding


def test_cache_key_generation_chat():
    """Test chat cache keys are deterministic and unique."""
    # Same inputs → same key
    key1 = _generate_chat_key("model", [{"role": "user", "content": "test"}], 0.0)
    key2 = _generate_chat_key("model", [{"role": "user", "content": "test"}], 0.0)
    assert key1 == key2

    # Different inputs → different keys
    key3 = _generate_chat_key("model", [{"role": "user", "content": "other"}], 0.0)
    assert key1 != key3

    # Different temperature → different keys
    key4 = _generate_chat_key("model", [{"role": "user", "content": "test"}], 0.5)
    assert key1 != key4

    # Different model → different keys
    key5 = _generate_chat_key("other-model", [{"role": "user", "content": "test"}], 0.0)
    assert key1 != key5


def test_cache_key_generation_embedding():
    """Test embedding cache keys are deterministic and unique."""
    # Same inputs → same key
    embed1 = _generate_embedding_key("model", "text")
    embed2 = _generate_embedding_key("model", "text")
    assert embed1 == embed2

    # Different inputs → different keys
    embed3 = _generate_embedding_key("model", "other")
    assert embed1 != embed3

    # Different model → different keys
    embed4 = _generate_embedding_key("other-model", "text")
    assert embed1 != embed4


def test_cache_statistics_tracking(tmp_path):
    """Test hit/miss statistics are tracked correctly."""
    cache_dir = tmp_path / "cache"
    client = OpenAI(base_url="http://localhost:11434/v1", api_key="test")
    cached_client = CachedLLMClient(client, cache_dir=str(cache_dir))

    assert cached_client._stats["hits"] == 0
    assert cached_client._stats["misses"] == 0


def test_clear_cache(tmp_path):
    """Test cache clearing functionality."""
    cache_dir = tmp_path / "cache"
    cache_dir.mkdir()
    test_file = cache_dir / "test.txt"
    test_file.write_text("test")

    assert cache_dir.exists()
    assert test_file.exists()

    clear_cache(str(cache_dir))

    assert not cache_dir.exists()


def test_clear_cache_nonexistent(tmp_path):
    """Test clearing nonexistent cache doesn't raise error."""
    cache_dir = tmp_path / "nonexistent"
    assert not cache_dir.exists()

    # Should not raise
    clear_cache(str(cache_dir))


def test_cache_key_includes_response_format():
    """Test that response_format is included in cache key."""
    key1 = _generate_chat_key(
        "model",
        [{"role": "user", "content": "test"}],
        0.0,
        response_format={"type": "json_object"},
    )
    key2 = _generate_chat_key(
        "model",
        [{"role": "user", "content": "test"}],
        0.0,
        response_format=None,
    )
    assert key1 != key2


def test_cache_key_includes_max_tokens():
    """Test that max_tokens is included in cache key."""
    key1 = _generate_chat_key(
        "model",
        [{"role": "user", "content": "test"}],
        0.0,
        max_tokens=100,
    )
    key2 = _generate_chat_key(
        "model",
        [{"role": "user", "content": "test"}],
        0.0,
        max_tokens=None,
    )
    assert key1 != key2


def test_different_params_different_cache_entries(tmp_path):
    """Test that different parameters create different cache entries."""
    cache_dir = tmp_path / "cache"
    client = OpenAI(base_url="http://localhost:11434/v1", api_key="test")
    cached_client = CachedLLMClient(client, cache_dir=str(cache_dir))

    messages = [{"role": "user", "content": "Hello"}]

    # Mock the underlying client response
    mock_response = Mock()
    mock_response.id = "test-id"
    mock_response.created = 1234567890
    mock_response.model = "test-model"
    mock_response.choices = [Mock()]
    mock_response.choices[0].index = 0
    mock_response.choices[0].finish_reason = "stop"
    mock_response.choices[0].message = Mock()
    mock_response.choices[0].message.role = "assistant"
    mock_response.choices[0].message.content = "Hello there!"
    mock_response.usage = Mock()
    mock_response.usage.prompt_tokens = 10
    mock_response.usage.completion_tokens = 5
    mock_response.usage.total_tokens = 15

    with patch.object(client.chat.completions, "create", return_value=mock_response):
        # First call with temperature 0.0
        response1 = cached_client.chat.completions.create(
            model="test-model",
            messages=messages,
            temperature=0.0,
        )
        assert cached_client._stats["misses"] == 1

        # Second call with different temperature - should be cache miss
        response2 = cached_client.chat.completions.create(
            model="test-model",
            messages=messages,
            temperature=0.5,
        )
        assert cached_client._stats["misses"] == 2
        assert cached_client._stats["hits"] == 0


def test_client_attribute_delegation():
    """Test that non-cached attributes are delegated to underlying client."""
    client = OpenAI(base_url="http://localhost:11434/v1", api_key="test")
    cached_client = CachedLLMClient(client, enabled=False)

    # Test that base_url is accessible through delegation
    assert hasattr(cached_client, "base_url")
