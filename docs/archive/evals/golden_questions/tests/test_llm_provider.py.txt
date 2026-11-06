"""Tests for LLM provider abstraction."""

import os
from argparse import Namespace
from unittest.mock import patch

import pytest
from openai import AzureOpenAI, OpenAI

from src.llm_provider import (
    LLMConfig,
    LLMProvider,
    create_llm_client,
    get_chat_model_name,
    get_embedding_model_name,
)


class TestLLMConfig:
    """Tests for LLMConfig dataclass."""

    def test_from_env_and_args_defaults_to_ollama(self) -> None:
        """Test that config defaults to Ollama when no provider specified."""
        args = Namespace(
            provider=None,
            ollama_url=None,
            model=None,
            azure_endpoint=None,
            azure_api_key=None,
            azure_chat_deployment=None,
            azure_embedding_deployment=None,
        )

        with patch.dict(os.environ, {}, clear=True):
            config = LLMConfig.from_env_and_args(args)

        assert config.provider == LLMProvider.OLLAMA
        assert config.ollama_base_url == "http://localhost:11434/v1"
        assert config.ollama_chat_model == "gpt-oss:120b-cloud"
        assert config.ollama_embedding_model == "nomic-embed-text"

    def test_from_env_and_args_ollama_from_env(self) -> None:
        """Test config creation from Ollama environment variables."""
        env_vars = {
            "LLM_PROVIDER": "ollama",
            "OLLAMA_BASE_URL": "http://custom:8000/v1",
            "OLLAMA_MODEL": "custom-model",
            "OLLAMA_EMBEDDING_MODEL": "custom-embed",
        }

        args = Namespace(
            provider=None,
            ollama_url=None,
            model=None,
            azure_endpoint=None,
            azure_api_key=None,
            azure_chat_deployment=None,
            azure_embedding_deployment=None,
        )

        with patch.dict(os.environ, env_vars, clear=True):
            config = LLMConfig.from_env_and_args(args)

        assert config.provider == LLMProvider.OLLAMA
        assert config.ollama_base_url == "http://custom:8000/v1"
        assert config.ollama_chat_model == "custom-model"
        assert config.ollama_embedding_model == "custom-embed"

    def test_from_env_and_args_ollama_cli_overrides_env(self) -> None:
        """Test that CLI arguments override environment variables for Ollama."""
        env_vars = {
            "LLM_PROVIDER": "ollama",
            "OLLAMA_BASE_URL": "http://env:8000/v1",
            "OLLAMA_MODEL": "env-model",
        }

        args = Namespace(
            provider="ollama",
            ollama_url="http://cli:9000/v1",
            model="cli-model",
            azure_endpoint=None,
            azure_api_key=None,
            azure_chat_deployment=None,
            azure_embedding_deployment=None,
        )

        with patch.dict(os.environ, env_vars, clear=True):
            config = LLMConfig.from_env_and_args(args)

        assert config.provider == LLMProvider.OLLAMA
        assert config.ollama_base_url == "http://cli:9000/v1"
        assert config.ollama_chat_model == "cli-model"

    def test_from_env_and_args_azure_from_env(self) -> None:
        """Test config creation from Azure environment variables."""
        env_vars = {
            "LLM_PROVIDER": "azure",
            "AZURE_OPENAI_ENDPOINT": "https://test.openai.azure.com",
            "AZURE_OPENAI_API_KEY": "test-key",
            "AZURE_OPENAI_API_VERSION": "2024-02-15-preview",
            "AZURE_OPENAI_CHAT_DEPLOYMENT": "gpt4-deployment",
            "AZURE_OPENAI_EMBEDDING_DEPLOYMENT": "embed-deployment",
        }

        args = Namespace(
            provider=None,
            ollama_url=None,
            model=None,
            azure_endpoint=None,
            azure_api_key=None,
            azure_chat_deployment=None,
            azure_embedding_deployment=None,
        )

        with patch.dict(os.environ, env_vars, clear=True):
            config = LLMConfig.from_env_and_args(args)

        assert config.provider == LLMProvider.AZURE
        assert config.azure_endpoint == "https://test.openai.azure.com"
        assert config.azure_api_key == "test-key"
        assert config.azure_api_version == "2024-02-15-preview"
        assert config.azure_chat_deployment == "gpt4-deployment"
        assert config.azure_embedding_deployment == "embed-deployment"

    def test_from_env_and_args_azure_cli_overrides_env(self) -> None:
        """Test that CLI arguments override environment variables for Azure."""
        env_vars = {
            "LLM_PROVIDER": "azure",
            "AZURE_OPENAI_ENDPOINT": "https://env.openai.azure.com",
            "AZURE_OPENAI_API_KEY": "env-key",
            "AZURE_OPENAI_CHAT_DEPLOYMENT": "env-chat",
            "AZURE_OPENAI_EMBEDDING_DEPLOYMENT": "env-embed",
        }

        args = Namespace(
            provider="azure",
            ollama_url=None,
            model=None,
            azure_endpoint="https://cli.openai.azure.com",
            azure_api_key="cli-key",
            azure_chat_deployment="cli-chat",
            azure_embedding_deployment="cli-embed",
        )

        with patch.dict(os.environ, env_vars, clear=True):
            config = LLMConfig.from_env_and_args(args)

        assert config.provider == LLMProvider.AZURE
        assert config.azure_endpoint == "https://cli.openai.azure.com"
        assert config.azure_api_key == "cli-key"
        assert config.azure_chat_deployment == "cli-chat"
        assert config.azure_embedding_deployment == "cli-embed"

    def test_from_env_and_args_azure_missing_endpoint(self) -> None:
        """Test validation error when Azure endpoint is missing."""
        args = Namespace(
            provider="azure",
            ollama_url=None,
            model=None,
            azure_endpoint=None,
            azure_api_key="test-key",
            azure_chat_deployment="chat",
            azure_embedding_deployment="embed",
        )

        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError, match="Azure provider requires AZURE_OPENAI_ENDPOINT"):
                LLMConfig.from_env_and_args(args)

    def test_from_env_and_args_azure_missing_api_key(self) -> None:
        """Test validation error when Azure API key is missing."""
        args = Namespace(
            provider="azure",
            ollama_url=None,
            model=None,
            azure_endpoint="https://test.openai.azure.com",
            azure_api_key=None,
            azure_chat_deployment="chat",
            azure_embedding_deployment="embed",
        )

        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError, match="Azure provider requires AZURE_OPENAI_API_KEY"):
                LLMConfig.from_env_and_args(args)

    def test_from_env_and_args_azure_missing_chat_deployment(self) -> None:
        """Test validation error when Azure chat deployment is missing."""
        args = Namespace(
            provider="azure",
            ollama_url=None,
            model=None,
            azure_endpoint="https://test.openai.azure.com",
            azure_api_key="test-key",
            azure_chat_deployment=None,
            azure_embedding_deployment="embed",
        )

        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(
                ValueError, match="Azure provider requires AZURE_OPENAI_CHAT_DEPLOYMENT"
            ):
                LLMConfig.from_env_and_args(args)

    def test_from_env_and_args_azure_missing_embedding_deployment(self) -> None:
        """Test validation error when Azure embedding deployment is missing."""
        args = Namespace(
            provider="azure",
            ollama_url=None,
            model=None,
            azure_endpoint="https://test.openai.azure.com",
            azure_api_key="test-key",
            azure_chat_deployment="chat",
            azure_embedding_deployment=None,
        )

        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(
                ValueError, match="Azure provider requires AZURE_OPENAI_EMBEDDING_DEPLOYMENT"
            ):
                LLMConfig.from_env_and_args(args)


class TestCreateLLMClient:
    """Tests for create_llm_client factory function."""

    def test_create_ollama_client(self) -> None:
        """Test creation of OpenAI client for Ollama."""
        config = LLMConfig(
            provider=LLMProvider.OLLAMA,
            ollama_base_url="http://localhost:11434/v1",
            ollama_chat_model="gpt-oss:120b-cloud",
            ollama_embedding_model="nomic-embed-text",
            enable_cache=False,  # Disable cache for unit test
        )

        client = create_llm_client(config)

        assert isinstance(client, OpenAI)
        assert not isinstance(client, AzureOpenAI)
        assert client.base_url.host == "localhost"

    def test_create_azure_client(self) -> None:
        """Test creation of AzureOpenAI client for Azure."""
        config = LLMConfig(
            provider=LLMProvider.AZURE,
            azure_endpoint="https://test.openai.azure.com",
            azure_api_key="test-key",
            azure_api_version="2024-02-15-preview",
            azure_chat_deployment="gpt4",
            azure_embedding_deployment="embed",
            enable_cache=False,  # Disable cache for unit test
        )

        client = create_llm_client(config)

        assert isinstance(client, AzureOpenAI)


class TestModelNameResolution:
    """Tests for model name resolution helper functions."""

    def test_get_chat_model_name_ollama(self) -> None:
        """Test chat model name resolution for Ollama."""
        config = LLMConfig(
            provider=LLMProvider.OLLAMA,
            ollama_base_url="http://localhost:11434/v1",
            ollama_chat_model="gpt-oss:120b-cloud",
            ollama_embedding_model="nomic-embed-text",
        )

        model_name = get_chat_model_name(config)
        assert model_name == "gpt-oss:120b-cloud"

    def test_get_chat_model_name_azure(self) -> None:
        """Test chat model name resolution for Azure (returns deployment name)."""
        config = LLMConfig(
            provider=LLMProvider.AZURE,
            azure_endpoint="https://test.openai.azure.com",
            azure_api_key="test-key",
            azure_api_version="2024-02-15-preview",
            azure_chat_deployment="gpt4-deployment",
            azure_embedding_deployment="embed-deployment",
        )

        model_name = get_chat_model_name(config)
        assert model_name == "gpt4-deployment"

    def test_get_embedding_model_name_ollama(self) -> None:
        """Test embedding model name resolution for Ollama."""
        config = LLMConfig(
            provider=LLMProvider.OLLAMA,
            ollama_base_url="http://localhost:11434/v1",
            ollama_chat_model="gpt-oss:120b-cloud",
            ollama_embedding_model="nomic-embed-text",
        )

        model_name = get_embedding_model_name(config)
        assert model_name == "nomic-embed-text"

    def test_get_embedding_model_name_azure(self) -> None:
        """Test embedding model name resolution for Azure (returns deployment name)."""
        config = LLMConfig(
            provider=LLMProvider.AZURE,
            azure_endpoint="https://test.openai.azure.com",
            azure_api_key="test-key",
            azure_api_version="2024-02-15-preview",
            azure_chat_deployment="gpt4-deployment",
            azure_embedding_deployment="embed-deployment",
        )

        model_name = get_embedding_model_name(config)
        assert model_name == "embed-deployment"
