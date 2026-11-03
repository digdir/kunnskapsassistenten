# -*- coding: utf-8 -*-
"""Configuration module for RAG evaluation system."""

import os
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field


class Config(BaseModel):
    """Configuration for RAG evaluation system."""

    rag_api_key: str
    rag_api_url: str
    rag_api_email: str
    langfuse_public_key: str
    langfuse_secret_key: str
    cache_dir: Path
    output_dir: Path
    input_file: Path

    # Ollama specific settings
    ollama_base_url: str
    ollama_model_name: Optional[str] = None

    # Evaluation LLM configuration
    eval_llm_provider: str = "ollama"  # "ollama", "openai", or "azure_openai"

    # Azure OpenAI specific settings (optional)
    azure_openai_api_key: Optional[str] = None
    azure_openai_deployment_name: Optional[str] = None
    azure_openai_api_version: Optional[str] = None
    azure_openai_endpoint: Optional[str] = None
    azure_openai_temperature: float = 0.0
    azure_openai_model_name: Optional[str] = None

    # DeepEval cache settings
    skip_deepeval_cache: bool = False  # Skip cache to avoid cached failed evaluations

    # Metrics selection
    selected_metrics: Optional[list[str]] = None  # If None, use all metrics


def load_config(input_file_path: Path) -> Config:
    """
    Load configuration from environment variables.

    Args:
        input_file_path: Optional custom path to input JSONL file.

    Returns:
        Config object with loaded settings.

    Raises:
        ValueError: If required environment variables are missing.
    """
    rag_api_key = os.getenv("RAG_API_KEY")
    if not rag_api_key:
        raise ValueError("RAG_API_KEY environment variable is not set")

    rag_api_url = os.getenv("RAG_API_URL")
    if not rag_api_url:
        raise ValueError("RAG_API_URL environment variable is not set")

    rag_api_email = os.getenv("RAG_API_EMAIL")
    if not rag_api_email:
        raise ValueError("RAG_API_EMAIL environment variable is not set")

    langfuse_public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
    if not langfuse_public_key:
        raise ValueError("LANGFUSE_PUBLIC_KEY environment variable is not set")

    langfuse_secret_key = os.getenv("LANGFUSE_SECRET_KEY")
    if not langfuse_secret_key:
        raise ValueError("LANGFUSE_SECRET_KEY environment variable is not set")

    cache_dir = Path(os.getenv("CACHE_DIR", "./.cache"))
    output_dir = Path(os.getenv("OUTPUT_DIR", "./output"))

    # Evaluation LLM provider configuration
    eval_llm_provider = os.getenv("EVAL_LLM_PROVIDER", "ollama")
    use_ollama = eval_llm_provider == "ollama"
    use_azureopenai = eval_llm_provider == "azure_openai"

    ollama_model_name = os.getenv("EVAL_OLLAMA_MODEL")

    if use_ollama and not ollama_model_name:
        raise ValueError("EVAL_OLLAMA_MODEL environment variable is not set")

    ollama_endpoint = os.getenv("EVAL_OLLAMA_BASE_URL")

    if use_ollama and not ollama_endpoint:
        raise ValueError("EVAL_OLLAMA_BASE_URL environment variable is not set")

    # Azure OpenAI configuration (optional)
    azure_openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_openai_deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
    azure_openai_model_name = os.getenv("AZURE_OPENAI_MODEL_NAME")
    azure_openai_api_version = os.getenv("OPENAI_API_VERSION")
    azure_openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    azure_openai_temperature = float(os.getenv("AZURE_OPENAI_TEMPERATURE", "0.0"))

    return Config(
        rag_api_key=rag_api_key,
        rag_api_url=rag_api_url,
        rag_api_email=rag_api_email,
        ollama_base_url=ollama_endpoint,
        langfuse_public_key=langfuse_public_key,
        langfuse_secret_key=langfuse_secret_key,
        cache_dir=cache_dir,
        output_dir=output_dir,
        input_file=input_file_path,
        eval_llm_provider=eval_llm_provider,
        ollama_model_name=ollama_model_name,
        azure_openai_api_key=azure_openai_api_key,
        azure_openai_deployment_name=azure_openai_deployment_name,
        azure_openai_model_name=azure_openai_model_name,
        azure_openai_api_version=azure_openai_api_version,
        azure_openai_endpoint=azure_openai_endpoint,
        azure_openai_temperature=azure_openai_temperature,
    )
