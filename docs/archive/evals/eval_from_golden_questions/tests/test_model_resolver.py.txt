# -*- coding: utf-8 -*-
"""Tests for model_resolver module."""

from pathlib import Path
from unittest.mock import patch

import pytest
from deepeval.models import AzureOpenAIModel

from src.config import Config
from src.CustomOllamaModel import CustomOllamaModel
from src.model_resolver import resolve_model


class TestResolveModel:
    """Tests for resolve_model function."""

    def test_resolve_model_ollama(self) -> None:
        """Test resolve_model returns CustomOllamaModel for Ollama provider."""
        config = Config(
            rag_api_url="http://test.com",
            rag_api_key="test_key",
            rag_api_email="test@example.com",
            eval_llm_provider="ollama",
            ollama_base_url="http://localhost:11434/v1",
            ollama_model_name="llama2",
            langfuse_public_key="test_public",
            langfuse_secret_key="test_secret",
            cache_dir=Path("/tmp/cache"),
            output_dir=Path("/tmp/output"),
            input_file=Path("/tmp/input.jsonl"),
        )

        model = resolve_model(config)

        assert isinstance(model, CustomOllamaModel)
        assert model.model_name == "llama2"
        assert model.base_url == "http://localhost:11434/v1"

    def test_resolve_model_openai(self) -> None:
        """Test resolve_model returns string model name for OpenAI provider."""
        config = Config(
            rag_api_url="http://test.com",
            rag_api_key="test_key",
            rag_api_email="test@example.com",
            eval_llm_provider="openai",
            ollama_base_url="http://localhost:11434/v1",
            ollama_model_name="gpt-4o-mini",
            langfuse_public_key="test_public",
            langfuse_secret_key="test_secret",
            cache_dir=Path("/tmp/cache"),
            output_dir=Path("/tmp/output"),
            input_file=Path("/tmp/input.jsonl"),
        )

        model = resolve_model(config)

        assert isinstance(model, str)
        assert model == "gpt-4o-mini"

    def test_resolve_model_azure_openai(self) -> None:
        """Test resolve_model returns AzureOpenAIModel for Azure OpenAI provider."""
        config = Config(
            rag_api_url="http://test.com",
            rag_api_key="test_key",
            rag_api_email="test@example.com",
            eval_llm_provider="azure_openai",
            ollama_base_url="http://localhost:11434/v1",
            azure_openai_api_key="azure_key",
            azure_openai_deployment_name="gpt-4o",
            azure_openai_api_version="2024-02-15-preview",
            azure_openai_endpoint="https://test.openai.azure.com",
            azure_openai_temperature=0.0,
            langfuse_public_key="test_public",
            langfuse_secret_key="test_secret",
            cache_dir=Path("/tmp/cache"),
            output_dir=Path("/tmp/output"),
            input_file=Path("/tmp/input.jsonl"),
        )

        model = resolve_model(config)

        assert isinstance(model, AzureOpenAIModel)

    def test_resolve_model_azure_openai_missing_config_raises_error(self) -> None:
        """Test resolve_model raises ValueError when Azure OpenAI config is incomplete."""
        config = Config(
            rag_api_url="http://test.com",
            rag_api_key="test_key",
            rag_api_email="test@example.com",
            eval_llm_provider="azure_openai",
            ollama_base_url="http://localhost:11434/v1",
            azure_openai_api_key="azure_key",
            # Missing deployment_name, api_version, endpoint
            langfuse_public_key="test_public",
            langfuse_secret_key="test_secret",
            cache_dir=Path("/tmp/cache"),
            output_dir=Path("/tmp/output"),
            input_file=Path("/tmp/input.jsonl"),
        )

        with pytest.raises(ValueError, match="Azure OpenAI requires"):
            resolve_model(config)

    def test_resolve_model_unsupported_provider_raises_error(self) -> None:
        """Test resolve_model raises ValueError for unsupported provider."""
        config = Config(
            rag_api_url="http://test.com",
            rag_api_key="test_key",
            rag_api_email="test@example.com",
            eval_llm_provider="unsupported_provider",  # type: ignore
            ollama_base_url="http://localhost:11434/v1",
            langfuse_public_key="test_public",
            langfuse_secret_key="test_secret",
            cache_dir=Path("/tmp/cache"),
            output_dir=Path("/tmp/output"),
            input_file=Path("/tmp/input.jsonl"),
        )

        with pytest.raises(ValueError, match="Unsupported eval_llm_provider"):
            resolve_model(config)

    def test_resolve_model_azure_openai_url_encodes_deployment_name(self) -> None:
        """Test resolve_model handles deployment names with special characters."""
        config = Config(
            rag_api_url="http://test.com",
            rag_api_key="test_key",
            rag_api_email="test@example.com",
            eval_llm_provider="azure_openai",
            ollama_base_url="http://localhost:11434/v1",
            azure_openai_api_key="azure_key",
            azure_openai_deployment_name="gpt-4o#special",
            azure_openai_api_version="2024-02-15-preview",
            azure_openai_endpoint="https://test.openai.azure.com",
            azure_openai_temperature=0.0,
            langfuse_public_key="test_public",
            langfuse_secret_key="test_secret",
            cache_dir=Path("/tmp/cache"),
            output_dir=Path("/tmp/output"),
            input_file=Path("/tmp/input.jsonl"),
        )

        # Should not raise an error and should return AzureOpenAIModel
        model = resolve_model(config)
        assert isinstance(model, AzureOpenAIModel)
