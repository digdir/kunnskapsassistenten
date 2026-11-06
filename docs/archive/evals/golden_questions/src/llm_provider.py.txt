"""LLM provider abstraction for Ollama and Azure OpenAI."""

import logging
import os
from dataclasses import dataclass
from enum import Enum
from typing import Union

from openai import AzureOpenAI, OpenAI

logger = logging.getLogger(__name__)


class LLMProvider(Enum):
    """Supported LLM providers."""

    OLLAMA = "ollama"
    AZURE = "azure"


@dataclass
class LLMConfig:
    """Unified LLM configuration for all providers."""

    provider: LLMProvider

    # Ollama configuration
    ollama_base_url: str | None = None
    ollama_chat_model: str | None = None
    ollama_embedding_model: str | None = None

    # Azure configuration
    azure_endpoint: str | None = None
    azure_api_key: str | None = None
    azure_api_version: str | None = None
    azure_chat_deployment: str | None = None
    azure_embedding_deployment: str | None = None

    # Cache configuration
    enable_cache: bool = True
    cache_dir: str = ".cache/llm_responses"

    @classmethod
    def from_env_and_args(cls, args) -> "LLMConfig":
        """
        Create LLM configuration from environment variables and CLI arguments.

        Priority order: CLI args > Environment variables > Defaults

        Args:
            args: Parsed command-line arguments (argparse.Namespace)

        Returns:
            LLMConfig instance

        Raises:
            ValueError: If Azure provider selected but required config is missing
        """
        # Determine provider (CLI > env > default)
        provider_str = args.provider or os.getenv("LLM_PROVIDER", "ollama")
        provider = LLMProvider(provider_str.lower())

        if provider == LLMProvider.OLLAMA:
            config = cls._from_env_and_args_ollama(args)
        elif provider == LLMProvider.AZURE:
            config = cls._from_env_and_args_azure(args)
        else:
            raise ValueError(f"Unknown provider: {provider_str}")

        # Add cache configuration
        config.enable_cache = not getattr(args, "no_cache", False)
        config.cache_dir = os.getenv("LLM_CACHE_DIR", ".cache/llm_responses")

        return config

    @classmethod
    def _from_env_and_args_ollama(cls, args) -> "LLMConfig":
        """
        Create Ollama configuration from environment and args.

        Args:
            args: Parsed command-line arguments

        Returns:
            LLMConfig for Ollama
        """
        base_url = args.ollama_url or os.getenv(
            "OLLAMA_BASE_URL", "http://localhost:11434/v1"
        )
        chat_model = args.model or os.getenv("OLLAMA_MODEL", "gpt-oss:120b-cloud")
        embedding_model = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")

        return cls(
            provider=LLMProvider.OLLAMA,
            ollama_base_url=base_url,
            ollama_chat_model=chat_model,
            ollama_embedding_model=embedding_model,
        )

    @classmethod
    def _from_env_and_args_azure(cls, args) -> "LLMConfig":
        """
        Create Azure configuration from environment and args.

        Args:
            args: Parsed command-line arguments

        Returns:
            LLMConfig for Azure

        Raises:
            ValueError: If required Azure configuration is missing
        """
        # Get Azure configuration (CLI > env)
        endpoint = args.azure_endpoint or os.getenv("AZURE_OPENAI_ENDPOINT")
        api_key = args.azure_api_key or os.getenv("AZURE_OPENAI_API_KEY")
        api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
        chat_deployment = args.azure_chat_deployment or os.getenv(
            "AZURE_OPENAI_CHAT_DEPLOYMENT"
        )
        embedding_deployment = args.azure_embedding_deployment or os.getenv(
            "AZURE_OPENAI_EMBEDDING_DEPLOYMENT"
        )

        # Validate required fields
        if not endpoint:
            raise ValueError(
                "Azure provider requires AZURE_OPENAI_ENDPOINT. "
                "Set via --azure-endpoint or AZURE_OPENAI_ENDPOINT env var."
            )

        if not api_key:
            raise ValueError(
                "Azure provider requires AZURE_OPENAI_API_KEY. "
                "Set via --azure-api-key or AZURE_OPENAI_API_KEY env var."
            )

        if not chat_deployment:
            raise ValueError(
                "Azure provider requires AZURE_OPENAI_CHAT_DEPLOYMENT. "
                "Set via --azure-chat-deployment or AZURE_OPENAI_CHAT_DEPLOYMENT env var."
            )

        if not embedding_deployment:
            raise ValueError(
                "Azure provider requires AZURE_OPENAI_EMBEDDING_DEPLOYMENT. "
                "Set via --azure-embedding-deployment or AZURE_OPENAI_EMBEDDING_DEPLOYMENT env var."
            )

        return cls(
            provider=LLMProvider.AZURE,
            azure_endpoint=endpoint,
            azure_api_key=api_key,
            azure_api_version=api_version,
            azure_chat_deployment=chat_deployment,
            azure_embedding_deployment=embedding_deployment,
        )


def create_llm_client(config: LLMConfig) -> Union[OpenAI, AzureOpenAI]:
    """
    Create LLM client based on provider configuration.

    Args:
        config: LLM configuration

    Returns:
        OpenAI client for Ollama or AzureOpenAI client for Azure (wrapped with caching if enabled)

    Raises:
        ValueError: If provider is unknown or configuration is invalid
    """
    if config.provider == LLMProvider.OLLAMA:
        logger.info(f"Using {config.provider.value} provider")
        logger.info(f"Ollama URL: {config.ollama_base_url}")
        logger.info(f"Chat model: {config.ollama_chat_model}")
        logger.info(f"Embedding model: {config.ollama_embedding_model}")

        base_client = OpenAI(
            base_url=config.ollama_base_url,
            api_key="ollama",  # Ollama doesn't require a real API key
        )

    elif config.provider == LLMProvider.AZURE:
        logger.info(f"Using {config.provider.value} provider")
        logger.info(f"Azure endpoint: {config.azure_endpoint}")
        logger.info(f"Chat deployment: {config.azure_chat_deployment}")
        logger.info(f"Embedding deployment: {config.azure_embedding_deployment}")

        base_client = AzureOpenAI(
            azure_endpoint=config.azure_endpoint,
            api_key=config.azure_api_key,
            api_version=config.azure_api_version,
        )

    else:
        raise ValueError(f"Unknown provider: {config.provider}")

    # Wrap with caching layer
    if config.enable_cache:
        from .llm_cache import CachedLLMClient

        return CachedLLMClient(base_client, cache_dir=config.cache_dir)
    else:
        return base_client


def get_chat_model_name(config: LLMConfig) -> str:
    """
    Get chat model name/deployment for the provider.

    Args:
        config: LLM configuration

    Returns:
        Model name for Ollama or deployment name for Azure

    Raises:
        ValueError: If provider is unknown or model is not configured
    """
    if config.provider == LLMProvider.OLLAMA:
        if not config.ollama_chat_model:
            raise ValueError("Ollama chat model not configured")
        return config.ollama_chat_model

    elif config.provider == LLMProvider.AZURE:
        if not config.azure_chat_deployment:
            raise ValueError("Azure chat deployment not configured")
        return config.azure_chat_deployment

    else:
        raise ValueError(f"Unknown provider: {config.provider}")


def get_embedding_model_name(config: LLMConfig) -> str:
    """
    Get embedding model name/deployment for the provider.

    Args:
        config: LLM configuration

    Returns:
        Model name for Ollama or deployment name for Azure

    Raises:
        ValueError: If provider is unknown or model is not configured
    """
    if config.provider == LLMProvider.OLLAMA:
        if not config.ollama_embedding_model:
            raise ValueError("Ollama embedding model not configured")
        return config.ollama_embedding_model

    elif config.provider == LLMProvider.AZURE:
        if not config.azure_embedding_deployment:
            raise ValueError("Azure embedding deployment not configured")
        return config.azure_embedding_deployment

    else:
        raise ValueError(f"Unknown provider: {config.provider}")
