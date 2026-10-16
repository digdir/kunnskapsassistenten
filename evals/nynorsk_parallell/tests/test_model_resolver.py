# -*- coding: utf-8 -*-
"""Tests for model_resolver module."""

import pytest
from openai import AzureOpenAI, OpenAI

from src.config import ModelConfig
from src.model_resolver import resolve_client


class TestResolveClient:
    """Tests for resolve_client function."""

    def test_resolve_client_ollama(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test resolve_client returns a client pointing to Ollama."""
        monkeypatch.delenv("EVAL_OLLAMA_BASE_URL", raising=False)
        model = ModelConfig(name="a", provider="ollama", model="mistral:latest")

        client = resolve_client(model)

        assert isinstance(client, OpenAI)
        assert str(client.base_url) == "http://localhost:11434/v1/"

    def test_resolve_client_openai_reads_key_from_configured_env(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test resolve_client uses api_key_env and base_url for OpenAI-compatible APIs."""
        monkeypatch.setenv("MY_KEY", "test_key")
        model = ModelConfig(
            name="a",
            provider="openai",
            model="m",
            base_url="https://example.com/v1/",
            api_key_env="MY_KEY",
        )

        client = resolve_client(model)

        assert client.api_key == "test_key"
        assert str(client.base_url) == "https://example.com/v1/"

    def test_resolve_client_openai_raises_without_key(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test resolve_client raises when the API key is missing."""
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        model = ModelConfig(name="a", provider="openai", model="gpt-4o-mini")

        with pytest.raises(ValueError, match="OPENAI_API_KEY"):
            resolve_client(model)

    def test_resolve_client_azure_openai(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test resolve_client returns AzureOpenAI for Azure OpenAI provider."""
        monkeypatch.setenv("AZURE_OPENAI_API_KEY", "test_key")
        monkeypatch.setenv("OPENAI_API_VERSION", "2024-08-01-preview")
        monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com/")
        model = ModelConfig(name="a", provider="azure_openai", model="deployment")

        assert isinstance(resolve_client(model), AzureOpenAI)

    def test_resolve_client_azure_openai_raises_without_config(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test resolve_client raises when Azure OpenAI config is incomplete."""
        for name in (
            "AZURE_OPENAI_API_KEY",
            "OPENAI_API_VERSION",
            "AZURE_OPENAI_ENDPOINT",
        ):
            monkeypatch.delenv(name, raising=False)
        model = ModelConfig(name="a", provider="azure_openai", model="deployment")

        with pytest.raises(ValueError, match="Azure OpenAI requires"):
            resolve_client(model)

    def test_resolve_client_unsupported_provider(self) -> None:
        """Test resolve_client raises for an unsupported provider."""
        model = ModelConfig(name="a", provider="ukjent", model="m")

        with pytest.raises(ValueError, match="Unsupported provider"):
            resolve_client(model)
