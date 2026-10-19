# -*- coding: utf-8 -*-
"""Model resolution module for creating chat clients based on provider configuration.

Follows the provider pattern in eval_from_golden_questions/src/model_resolver.py
(ollama, openai, azure_openai), without the dependency on the RAG API and Langfuse.
"""

import logging
import os
from typing import Union

from openai import AzureOpenAI, OpenAI

from src.config import ModelConfig

logger = logging.getLogger(__name__)

DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1"


def resolve_client(
    model: ModelConfig, timeout: float = 120.0
) -> Union[OpenAI, AzureOpenAI]:
    """
    Create a chat client based on the configured provider.

    Supports:
    - Ollama (local models) through the OpenAI-compatible endpoint
    - OpenAI, or any OpenAI-compatible API when base_url is set
    - Azure OpenAI (model is used as the deployment name)

    Args:
        model: Model configuration.
        timeout: Request timeout in seconds.

    Returns:
        Client with a chat.completions interface.

    Raises:
        ValueError: If provider is unsupported or required config is missing.
    """
    if model.provider == "azure_openai":
        return _resolve_azure_openai_client(model, timeout)
    elif model.provider == "openai":
        return _resolve_openai_client(model, timeout)
    elif model.provider == "ollama":
        return _resolve_ollama_client(model, timeout)
    else:
        raise ValueError(
            f"Unsupported provider: {model.provider}. "
            "Must be 'ollama', 'openai', or 'azure_openai'"
        )


def _resolve_ollama_client(model: ModelConfig, timeout: float) -> OpenAI:
    """
    Create a client for a local Ollama server.

    Args:
        model: Model configuration.
        timeout: Request timeout in seconds.

    Returns:
        OpenAI client pointing to Ollama.
    """
    base_url = (
        model.base_url or os.getenv("EVAL_OLLAMA_BASE_URL") or DEFAULT_OLLAMA_BASE_URL
    )
    logger.info(f"Using Ollama model: {model.model} at {base_url}")
    return OpenAI(
        base_url=base_url,
        api_key="ollama",  # Dummy key for ollama
        timeout=timeout,
    )


def _resolve_openai_client(model: ModelConfig, timeout: float) -> OpenAI:
    """
    Create a client for OpenAI or an OpenAI-compatible API.

    Args:
        model: Model configuration.
        timeout: Request timeout in seconds.

    Returns:
        OpenAI client.

    Raises:
        ValueError: If the API key environment variable is not set.
    """
    key_env = model.api_key_env or "OPENAI_API_KEY"
    api_key = os.getenv(key_env)
    if not api_key:
        raise ValueError(f"{key_env} environment variable is not set")

    logger.info(f"Using OpenAI-compatible model: {model.model}")
    return OpenAI(base_url=model.base_url, api_key=api_key, timeout=timeout)


def _resolve_azure_openai_client(model: ModelConfig, timeout: float) -> AzureOpenAI:
    """
    Create a client for Azure OpenAI.

    Args:
        model: Model configuration.
        timeout: Request timeout in seconds.

    Returns:
        AzureOpenAI client.

    Raises:
        ValueError: If required Azure OpenAI configuration is missing.
    """
    api_key = os.getenv(model.api_key_env or "AZURE_OPENAI_API_KEY")
    api_version = os.getenv("OPENAI_API_VERSION")
    endpoint = model.base_url or os.getenv("AZURE_OPENAI_ENDPOINT")

    if not all([api_key, api_version, endpoint]):
        raise ValueError(
            "Azure OpenAI requires: AZURE_OPENAI_API_KEY, OPENAI_API_VERSION, "
            "and AZURE_OPENAI_ENDPOINT environment variables"
        )

    assert endpoint is not None

    logger.info(f"Using Azure OpenAI deployment: {model.model}")
    return AzureOpenAI(
        api_key=api_key,
        api_version=api_version,
        azure_endpoint=endpoint,
        timeout=timeout,
    )
