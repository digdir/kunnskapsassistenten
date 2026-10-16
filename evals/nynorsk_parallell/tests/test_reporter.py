# -*- coding: utf-8 -*-
"""Unit tests for reporter module."""

from src.reporter import format_table, unblind
from src.scoring import COPY_BASELINE, RepetitionScore


def _score(corpus: float, exact: float = 0.0) -> RepetitionScore:
    return RepetitionScore(
        corpus_chrf=corpus,
        mean_sentence_chrf=corpus,
        sentence_chrf={},
        exact_match_rate=exact,
        empty_outputs=0,
    )


class TestUnblind:
    """Tests for unblind function."""

    def test_unblind_groups_repetitions_per_model_in_order(self) -> None:
        """Test that blind ids are joined with the key and ordered by repetition."""
        scores = {"x1": _score(72.0), "x2": _score(70.0), "y1": _score(50.0)}
        links = {"x1": ("modell-a", 2), "x2": ("modell-a", 1), "y1": ("modell-b", 1)}

        summaries = unblind(scores, links)

        assert summaries["modell-a"].corpus_chrf_per_repetition == [70.0, 72.0]
        assert summaries["modell-b"].repetitions == 1


class TestFormatTable:
    """Tests for format_table function."""

    def _results(self) -> dict:
        summaries = unblind(
            {"x1": _score(60.0, 0.1), "y1": _score(80.0, 0.485)},
            {"x1": ("svak", 1), "y1": ("sterk", 1)},
        )
        return {
            "models": {
                name: {"model": f"id-{name}", "summary": summary.model_dump()}
                for name, summary in summaries.items()
            },
            "baseline": {COPY_BASELINE: {"corpus_chrf": 55.0, "exact_match_rate": 0.0}},
        }

    def test_format_table_sorts_models_and_adds_baseline(self) -> None:
        """Test that the table is sorted by chrF and ends with the copy baseline."""
        lines = format_table(self._results()).splitlines()

        assert lines[0].endswith("| Ordrett treff (snitt) |")
        assert lines[2] == "| sterk | 80.00 | 0.00 | 80.00 | 48.5% |"
        assert lines[3].startswith("| svak |")
        assert lines[4] == "| Kopi av bokmål (ingen oversettelse) | 55.00 | | | 0.0% |"

    def test_format_table_can_exclude_models(self) -> None:
        """Test that excluded models are left out of the table."""
        table = format_table(self._results(), exclude=["svak"])

        assert "svak" not in table
        assert "sterk" in table
