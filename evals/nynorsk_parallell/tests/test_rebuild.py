# -*- coding: utf-8 -*-
"""Tests for rebuild module."""

import json
from pathlib import Path

import pytest

from src.blinding import BlindKey
from src.config import Config, ModelConfig, RunConfig
from src.fasit import FasitPair
from src.rebuild import (
    check_against_stored_scores,
    read_blind_key,
    read_stored_statuses,
)
from src.reporter import build_results, unblind
from src.scoring import score_blinded_dir

FASIT = [
    FasitPair(id="npk-0001", nb="Jeg kommer ikke", nn="Eg kjem ikkje"),
    FasitPair(id="npk-0002", nb="Hun fikk en bok", nn="Ho fekk ei bok"),
]


def _write_run(run_dir: Path, repetitions: int) -> BlindKey:
    """Write blinded files, stored scores and blind key as a finished run would."""
    key = BlindKey()
    blinded = run_dir / "blinded"
    blinded.mkdir(parents=True)
    for repetition in range(1, repetitions + 1):
        path = blinded / f"{key.blind_id('modell-a', repetition)}.jsonl"
        with open(path, "w", encoding="utf-8") as f:
            for pair in FASIT:
                f.write(json.dumps({"id": pair.id, "translation": pair.nn}) + "\n")
    scores = score_blinded_dir(FASIT, blinded)
    (run_dir / "blinded_scores.json").write_text(
        json.dumps({k: v.model_dump() for k, v in scores.items()}), encoding="utf-8"
    )
    key.mark_scored()
    key.write(run_dir / "blind_key.json")
    return key


class TestRebuild:
    """Tests for rebuilding results from stored translations."""

    def test_read_blind_key_matches_written_key(self, tmp_path: Path) -> None:
        """Test that a written key is read back as the same links."""
        key = _write_run(tmp_path, repetitions=2)

        assert read_blind_key(tmp_path / "blind_key.json") == key.reveal()

    def test_check_against_stored_scores_accepts_same_scores(
        self, tmp_path: Path
    ) -> None:
        """Test that rescoring unchanged files matches the stored scores."""
        _write_run(tmp_path, repetitions=1)
        scores = score_blinded_dir(FASIT, tmp_path / "blinded")

        check_against_stored_scores(scores, tmp_path / "blinded_scores.json")

    def test_check_against_stored_scores_rejects_changed_translations(
        self, tmp_path: Path
    ) -> None:
        """Test that a changed translation file is detected."""
        _write_run(tmp_path, repetitions=1)
        path = next((tmp_path / "blinded").glob("*.jsonl"))
        path.write_text(
            json.dumps({"id": "npk-0001", "translation": "noko anna"}) + "\n",
            encoding="utf-8",
        )
        scores = score_blinded_dir(FASIT, tmp_path / "blinded")

        with pytest.raises(ValueError, match="differs from the stored score"):
            check_against_stored_scores(scores, tmp_path / "blinded_scores.json")


class TestBuildResults:
    """Tests for build_results function."""

    def test_build_results_lists_models_with_missing_repetitions(
        self, tmp_path: Path
    ) -> None:
        """Test that incomplete and unstarted models are listed as not completed."""
        _write_run(tmp_path, repetitions=2)
        config = Config(
            run=RunConfig(repetitions=3),
            models=[
                ModelConfig(name="modell-a", provider="ollama", model="a:latest"),
                ModelConfig(name="modell-b", provider="ollama", model="b:latest"),
            ],
        )
        summaries = unblind(
            score_blinded_dir(FASIT, tmp_path / "blinded"),
            read_blind_key(tmp_path / "blind_key.json"),
        )

        results = build_results("run", config, FASIT, "abc", "instruks", summaries)

        assert results["models"]["modell-a"]["summary"]["repetitions"] == 2
        assert results["models"]["modell-a"]["model"] == "a:latest"
        assert results["not_completed"] == {
            "modell-a": "2 of 3 repetitions",
            "modell-b": "0 of 3 repetitions",
        }
        assert results["metric"].startswith("nrefs:1")


class TestReadStoredStatuses:
    """Tests for read_stored_statuses function."""

    def test_read_stored_statuses_keeps_status_from_earlier_results(
        self, tmp_path: Path
    ) -> None:
        """Test that statuses are read back and models without status are skipped."""
        path = tmp_path / "results.json"
        path.write_text(
            json.dumps(
                {
                    "models": {
                        "modell-a": {
                            "status": {"completed_repetitions": 3, "errors": 2}
                        },
                        "modell-b": {"status": None},
                    }
                }
            ),
            encoding="utf-8",
        )

        statuses = read_stored_statuses(path)

        assert set(statuses) == {"modell-a"}
        assert statuses["modell-a"].errors == 2

    def test_read_stored_statuses_is_empty_without_file(self, tmp_path: Path) -> None:
        """Test that a missing results.json gives no statuses."""
        assert read_stored_statuses(tmp_path / "results.json") == {}
