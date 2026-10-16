# -*- coding: utf-8 -*-
"""Configuration module for the Bokmål to Nynorsk evaluation."""

import tomllib
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

SUPPORTED_PROVIDERS = ("ollama", "openai", "azure_openai")


class ModelConfig(BaseModel):
    """One model to evaluate."""

    name: str = Field(..., min_length=1)
    provider: str
    model: str = Field(..., min_length=1)
    base_url: Optional[str] = None
    api_key_env: Optional[str] = None
    note: Optional[str] = None

    # Some APIs reject temperature and seed. The model then runs with the
    # sampling settings of the provider.
    omit_sampling_params: bool = False

    # Extra request fields for one provider, for example to turn off thinking.
    extra_body: Optional[Dict[str, Any]] = None

    # Optional cost cap for paid APIs (USD per million tokens)
    usd_per_mtok_input: Optional[float] = None
    usd_per_mtok_output: Optional[float] = None
    max_cost_usd: Optional[float] = None


class RunConfig(BaseModel):
    """Settings shared by all models in a run."""

    repetitions: int = Field(default=3, ge=1)
    temperature: float = Field(default=0.3, ge=0.0)
    base_seed: int = 1
    max_tokens: int = Field(default=128, ge=1)
    request_timeout_seconds: float = Field(default=120.0, gt=0)
    max_consecutive_errors: int = Field(default=3, ge=1)


class Config(BaseModel):
    """Configuration for one evaluation run."""

    run: RunConfig = Field(default_factory=RunConfig)
    models: List[ModelConfig] = Field(..., min_length=1)


def load_config(path: Path) -> Config:
    """
    Load configuration from a TOML file.

    Args:
        path: Path to the TOML file with a [run] table and [[models]] entries.

    Returns:
        Config object with loaded settings.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If a provider is unsupported or a model name is repeated.
    """
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")

    with open(path, "rb") as f:
        data = tomllib.load(f)

    config = Config(**data)

    for model in config.models:
        if model.provider not in SUPPORTED_PROVIDERS:
            raise ValueError(
                f"Unsupported provider for {model.name}: {model.provider}. "
                "Must be 'ollama', 'openai', or 'azure_openai'"
            )

    names = [model.name for model in config.models]
    if len(names) != len(set(names)):
        raise ValueError("Model names in the config must be unique")

    return config
