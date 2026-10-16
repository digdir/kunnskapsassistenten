# -*- coding: utf-8 -*-
"""Tests for blinding module."""

import json
from pathlib import Path

import pytest

from src.blinding import BlindKey


class TestBlindKey:
    """Tests for BlindKey class."""

    def test_blind_id_is_stable_and_unique(self) -> None:
        """Test that ids are stable within a key and differ between repetitions."""
        key = BlindKey()

        first = key.blind_id("modell-a", 1)

        assert first == key.blind_id("modell-a", 1)
        assert (
            len({first, key.blind_id("modell-a", 2), key.blind_id("modell-b", 1)}) == 3
        )

    def test_blind_id_does_not_contain_model_name(self) -> None:
        """Test that the id does not reveal the model."""
        blind_id = BlindKey().blind_id("modell-a", 1)

        assert "modell" not in blind_id
        assert len(blind_id) == 12

    def test_blind_id_depends_on_secret_salt(self) -> None:
        """Test that two runs give different ids for the same model."""
        assert BlindKey().blind_id("modell-a", 1) != BlindKey().blind_id("modell-a", 1)

    def test_reveal_raises_before_scoring(self) -> None:
        """Test that the key cannot be revealed before scoring is finished."""
        key = BlindKey()
        key.blind_id("modell-a", 1)

        with pytest.raises(RuntimeError, match="before scoring"):
            key.reveal()

    def test_write_raises_before_scoring_and_writes_nothing(
        self, tmp_path: Path
    ) -> None:
        """Test that no key file exists until scoring is finished."""
        key = BlindKey()
        key.blind_id("modell-a", 1)
        path = tmp_path / "blind_key.json"

        with pytest.raises(RuntimeError):
            key.write(path)

        assert not path.exists()

    def test_write_after_scoring_links_ids_to_models(self, tmp_path: Path) -> None:
        """Test that the key file links each blind id to model and repetition."""
        key = BlindKey(salt="fast-salt")
        blind_id = key.blind_id("modell-a", 2)
        path = tmp_path / "blind_key.json"

        key.mark_scored()
        key.write(path)

        assert json.loads(path.read_text(encoding="utf-8")) == {
            blind_id: {"model": "modell-a", "repetition": 2}
        }
