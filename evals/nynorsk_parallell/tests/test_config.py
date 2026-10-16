# -*- coding: utf-8 -*-
"""Tests for config module."""

from pathlib import Path

import pytest

from src.config import load_config

VALID = """
[run]
repetitions = 2
temperature = 0.1

[[models]]
name = "lokal"
provider = "ollama"
model = "mistral:latest"

[[models]]
name = "api"
provider = "openai"
model = "gpt-4o-mini"
max_cost_usd = 1.0
"""


class TestLoadConfig:
    """Tests for load_config function."""

    def test_load_config_reads_run_and_models(self, tmp_path: Path) -> None:
        """Test that run settings and models are read from TOML."""
        path = tmp_path / "models.toml"
        path.write_text(VALID, encoding="utf-8")

        config = load_config(path)

        assert config.run.repetitions == 2
        assert config.run.temperature == 0.1
        assert [model.name for model in config.models] == ["lokal", "api"]
        assert config.models[1].max_cost_usd == 1.0

    def test_load_config_defaults_to_three_repetitions(self, tmp_path: Path) -> None:
        """Test that the run table is optional."""
        path = tmp_path / "models.toml"
        path.write_text(
            '[[models]]\nname = "a"\nprovider = "ollama"\nmodel = "m"\n',
            encoding="utf-8",
        )

        assert load_config(path).run.repetitions == 3

    def test_load_config_raises_on_unsupported_provider(self, tmp_path: Path) -> None:
        """Test that an unknown provider raises ValueError."""
        path = tmp_path / "models.toml"
        path.write_text(
            '[[models]]\nname = "a"\nprovider = "ukjent"\nmodel = "m"\n',
            encoding="utf-8",
        )

        with pytest.raises(ValueError, match="Unsupported provider"):
            load_config(path)

    def test_load_config_raises_on_duplicate_names(self, tmp_path: Path) -> None:
        """Test that repeated model names raise ValueError."""
        entry = '[[models]]\nname = "a"\nprovider = "ollama"\nmodel = "m"\n'
        path = tmp_path / "models.toml"
        path.write_text(entry + entry, encoding="utf-8")

        with pytest.raises(ValueError, match="must be unique"):
            load_config(path)

    def test_load_config_raises_on_missing_file(self, tmp_path: Path) -> None:
        """Test that a missing config file raises FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            load_config(tmp_path / "missing.toml")
