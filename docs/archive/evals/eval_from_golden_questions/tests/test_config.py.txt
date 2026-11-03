# -*- coding: utf-8 -*-
"""Unit tests for configuration module."""

import os
from pathlib import Path
from unittest.mock import patch

import pytest

from src.config import Config, load_config


class TestConfig:
    """Tests for Config model."""

    def test_config_with_all_required_env_vars(self) -> None:
        """Test Config creation with all required environment variables."""
        config = Config(
            rag_api_key="test-key",
            rag_api_url="https://api.test.com",
            rag_api_email="test@test.com",
            ollama_base_url="http://localhost:11434",
            langfuse_public_key="pub-key",
            langfuse_secret_key="secret-key",
            cache_dir=Path("./cache"),
            output_dir=Path("./output"),
            input_file=Path("../golden_questions/output/sample_golden_questions.jsonl"),
            ollama_model_name="gpt-oss:120b-cloud",
        )
        assert config.rag_api_key == "test-key"
        assert config.rag_api_url == "https://api.test.com"
        assert config.rag_api_email == "test@test.com"
        assert config.ollama_base_url == "http://localhost:11434"
        assert config.ollama_model_name == "gpt-oss:120b-cloud"
        assert config.langfuse_public_key == "pub-key"
        assert config.langfuse_secret_key == "secret-key"

    def test_config_missing_required_field_raises_error(self) -> None:
        """Test that missing required field raises ValidationError."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            Config(
                rag_api_url="https://api.test.com",
                rag_api_email="test@test.com",
                ollama_base_url="http://localhost:11434",
            )


class TestLoadConfig:
    """Tests for load_config function."""

    @patch.dict(
        os.environ,
        {
            "RAG_API_KEY": "test-key",
            "RAG_API_URL": "https://api.test.com",
            "RAG_API_EMAIL": "test@test.com",
            "EVAL_OLLAMA_BASE_URL": "http://localhost:11434",
            "EVAL_OLLAMA_MODEL": "gpt-oss:120b-cloud",
            "LANGFUSE_PUBLIC_KEY": "pub-key",
            "LANGFUSE_SECRET_KEY": "secret-key",
        },
        clear=True,
    )
    def test_load_config_from_environment_with_required_vars(self) -> None:
        """Test load_config loads required environment variables."""
        config = load_config(input_file_path=Path("test.jsonl"))
        assert config.rag_api_key == "test-key"
        assert config.rag_api_url == "https://api.test.com"
        assert config.rag_api_email == "test@test.com"
        assert config.ollama_base_url == "http://localhost:11434"
        assert config.langfuse_public_key == "pub-key"
        assert config.langfuse_secret_key == "secret-key"

    @patch.dict(
        os.environ,
        {
            "RAG_API_KEY": "test-key",
            "RAG_API_URL": "https://api.test.com",
            "RAG_API_EMAIL": "test@test.com",
            "EVAL_OLLAMA_BASE_URL": "http://localhost:11434",
            "EVAL_OLLAMA_MODEL": "gpt-oss:120b-cloud",
            "LANGFUSE_PUBLIC_KEY": "pub-key",
            "LANGFUSE_SECRET_KEY": "secret-key",
            "CACHE_DIR": "/custom/cache",
            "OUTPUT_DIR": "/custom/output",
        },
        clear=True,
    )
    def test_load_config_with_custom_paths(self) -> None:
        """Test load_config with custom cache and output directories."""
        config = load_config(input_file_path=Path("test.jsonl"))
        assert config.cache_dir == Path("/custom/cache")
        assert config.output_dir == Path("/custom/output")

    @patch.dict(os.environ, {}, clear=True)
    def test_load_config_missing_rag_api_key_raises_error(self) -> None:
        """Test that missing RAG_API_KEY raises ValueError."""
        with pytest.raises(ValueError, match="RAG_API_KEY environment variable"):
            load_config(input_file_path=Path("test.jsonl"))

    @patch.dict(
        os.environ,
        {
            "RAG_API_KEY": "test-key",
        },
        clear=True,
    )
    def test_load_config_missing_rag_api_url_raises_error(self) -> None:
        """Test that missing RAG_API_URL raises ValueError."""
        with pytest.raises(ValueError, match="RAG_API_URL environment variable"):
            load_config(input_file_path=Path("test.jsonl"))

    @patch.dict(
        os.environ,
        {
            "RAG_API_KEY": "test-key",
            "RAG_API_URL": "https://api.test.com",
        },
        clear=True,
    )
    def test_load_config_missing_rag_api_email_raises_error(self) -> None:
        """Test that missing RAG_API_EMAIL raises ValueError."""
        with pytest.raises(ValueError, match="RAG_API_EMAIL environment variable"):
            load_config(input_file_path=Path("test.jsonl"))

    @patch.dict(
        os.environ,
        {
            "RAG_API_KEY": "test-key",
            "RAG_API_URL": "https://api.test.com",
            "RAG_API_EMAIL": "test@test.com",
            "LANGFUSE_PUBLIC_KEY": "pub-key",
            "LANGFUSE_SECRET_KEY": "secret-key",
        },
        clear=True,
    )
    def test_load_config_missing_ollama_model_raises_error(self) -> None:
        """Test that missing EVAL_OLLAMA_MODEL raises ValueError."""
        with pytest.raises(ValueError, match="EVAL_OLLAMA_MODEL environment variable"):
            load_config(input_file_path=Path("test.jsonl"))

    @patch.dict(
        os.environ,
        {
            "RAG_API_KEY": "test-key",
            "RAG_API_URL": "https://api.test.com",
            "RAG_API_EMAIL": "test@test.com",
        },
        clear=True,
    )
    def test_load_config_missing_langfuse_public_key_raises_error(self) -> None:
        """Test that missing LANGFUSE_PUBLIC_KEY raises ValueError."""
        with pytest.raises(ValueError, match="LANGFUSE_PUBLIC_KEY environment variable"):
            load_config(input_file_path=Path("test.jsonl"))

    @patch.dict(
        os.environ,
        {
            "RAG_API_KEY": "test-key",
            "RAG_API_URL": "https://api.test.com",
            "RAG_API_EMAIL": "test@test.com",
            "LANGFUSE_PUBLIC_KEY": "pub-key",
        },
        clear=True,
    )
    def test_load_config_missing_langfuse_secret_key_raises_error(self) -> None:
        """Test that missing LANGFUSE_SECRET_KEY raises ValueError."""
        with pytest.raises(ValueError, match="LANGFUSE_SECRET_KEY environment variable"):
            load_config(input_file_path=Path("test.jsonl"))

    @patch.dict(
        os.environ,
        {
            "RAG_API_KEY": "test-key",
            "RAG_API_URL": "https://api.test.com",
            "RAG_API_EMAIL": "test@test.com",
            "EVAL_OLLAMA_BASE_URL": "http://localhost:11434",
            "EVAL_OLLAMA_MODEL": "gpt-oss:120b-cloud",
            "LANGFUSE_PUBLIC_KEY": "pub-key",
            "LANGFUSE_SECRET_KEY": "secret-key",
        },
        clear=True,
    )
    def test_load_config_uses_default_paths(self) -> None:
        """Test that load_config uses default paths when not specified."""
        config = load_config(input_file_path=Path("test.jsonl"))
        assert config.cache_dir == Path("./.cache")
        assert config.output_dir == Path("./output")

    @patch.dict(
        os.environ,
        {
            "RAG_API_KEY": "test-key",
            "RAG_API_URL": "https://api.test.com",
            "RAG_API_EMAIL": "test@test.com",
            "EVAL_OLLAMA_BASE_URL": "http://localhost:11434",
            "EVAL_OLLAMA_MODEL": "gpt-oss:120b-cloud",
            "LANGFUSE_PUBLIC_KEY": "pub-key",
            "LANGFUSE_SECRET_KEY": "secret-key",
        },
        clear=True,
    )
    def test_load_config_with_custom_input_file(self) -> None:
        """Test load_config with custom input file path."""
        config = load_config(input_file_path=Path("/custom/questions.jsonl"))
        assert config.input_file == Path("/custom/questions.jsonl")
