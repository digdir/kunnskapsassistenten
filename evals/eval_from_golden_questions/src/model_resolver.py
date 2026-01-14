# -*- coding: utf-8 -*-
"""Model resolution module for creating LLM instances based on provider configuration."""

import logging
from typing import Union
from urllib.parse import quote

from deepeval.models import AzureOpenAIModel
from deepeval.models.base_model import DeepEvalBaseLLM

from src.config import Config
from src.CustomOllamaModel import CustomOllamaModel, create_llm_client

logger = logging.getLogger(__name__)


def resolve_model(config: Config) -> Union[AzureOpenAIModel, CustomOllamaModel, str]:
    """
    Create LLM model instance based on configured provider.

    Supports:
    - Ollama (local models) - returns custom Ollama client
    - OpenAI (gpt-4o-mini, gpt-4o, etc.) - returns model name string
    - Azure OpenAI (with deployment configuration) - returns AzureOpenAIModel instance

    Args:
        config: Configuration object with LLM provider settings.

    Returns:
        Model instance appropriate for the configured provider:
        - AzureOpenAIModel for Azure OpenAI
        - str (model name) for OpenAI
        - Custom Ollama client for Ollama

    Raises:
        ValueError: If provider is unsupported or required config is missing.
    """
    if config.eval_llm_provider == "azure_openai":
        return _resolve_azure_openai_model(config)
    elif config.eval_llm_provider == "openai":
        return _resolve_openai_model(config)
    elif config.eval_llm_provider == "ollama":
        return _resolve_ollama_model(config)
    else:
        raise ValueError(
            f"Unsupported eval_llm_provider: {config.eval_llm_provider}. "
            "Must be 'ollama', 'openai', or 'azure_openai'"
        )


def _resolve_azure_openai_model(config: Config) -> AzureOpenAIModel:
    """
    Create Azure OpenAI model instance.

    Args:
        config: Configuration object with Azure OpenAI settings.

    Returns:
        Configured AzureOpenAIModel instance.

    Raises:
        ValueError: If required Azure OpenAI configuration is missing.
    """
    if not all(
        [
            config.azure_openai_api_key,
            config.azure_openai_deployment_name,
            config.azure_openai_api_version,
            config.azure_openai_endpoint,
        ]
    ):
        raise ValueError(
            "Azure OpenAI requires: AZURE_OPENAI_API_KEY, "
            "AZURE_OPENAI_DEPLOYMENT_NAME, OPENAI_API_VERSION, "
            "and AZURE_OPENAI_ENDPOINT environment variables"
        )

    # Type assertion for type checker
    assert config.azure_openai_deployment_name is not None
    assert config.azure_openai_endpoint is not None

    # URL-encode deployment name to handle special characters like #
    deployment_name_encoded = quote(config.azure_openai_deployment_name, safe="")
    logger.info(
        f"Azure OpenAI deployment name: {config.azure_openai_deployment_name} "
        f"(URL-encoded: {deployment_name_encoded})"
    )

    # DeepEval's AzureOpenAI client needs the base_url to include /openai
    # Unlike the standard Azure OpenAI client which adds it automatically
    azure_endpoint = config.azure_openai_endpoint.rstrip("/")
    base_url_with_openai = f"{azure_endpoint}/openai"

    model = AzureOpenAIModel(
        model=config.azure_openai_model_name
        if config.azure_openai_model_name
        else deployment_name_encoded,
        deployment_name=deployment_name_encoded,
        api_key=config.azure_openai_api_key,
        openai_api_version=config.azure_openai_api_version,
        base_url=base_url_with_openai,
        temperature=config.azure_openai_temperature,
    )
    logger.info(
        f"Initialized Azure OpenAI model: {deployment_name_encoded} "
        f"(base_url: {base_url_with_openai})"
    )

    return model


def _resolve_openai_model(config: Config) -> str:
    """
    Create OpenAI model reference.

    For OpenAI, DeepEval can use the model name directly as a string.

    Args:
        config: Configuration object with OpenAI settings.

    Returns:
        Model name string (e.g., "gpt-4o-mini").
    """
    model_name = config.ollama_model_name
    logger.info(f"Using OpenAI model: {model_name}")
    return model_name


def _resolve_ollama_model(config: Config) -> CustomOllamaModel:
    """
    Create Ollama model client.

    Args:
        config: Configuration object with Ollama settings.

    Returns:
        Custom Ollama client instance.
    """
    model = create_llm_client(config.ollama_base_url, config.ollama_model_name)
    logger.info(
        f"Using Ollama model: {config.ollama_model_name} at {config.ollama_base_url}"
    )
    return model
