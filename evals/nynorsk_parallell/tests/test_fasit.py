# -*- coding: utf-8 -*-
"""Tests for fasit module."""

from pathlib import Path

import pytest

from src.fasit import (
    FasitPair,
    filter_pairs,
    load_fasit,
    normalize,
    sample_pairs,
    sha256_of,
    write_fasit,
)

FASIT_PATH = Path(__file__).parent.parent / "data" / "fasit.tsv"
MANIFEST_PATH = Path(__file__).parent.parent / "data" / "fasit.sha256"


def _sentence(words: int, prefix: str = "ord") -> str:
    return " ".join(f"{prefix}{i}" for i in range(words))


class TestNormalize:
    """Tests for normalize function."""

    def test_normalize_removes_zero_width_space_and_whitespace(self) -> None:
        """Test that zero-width spaces and surrounding whitespace are removed."""
        assert normalize("​​ Appen har også \n") == "Appen har også"


class TestFilterPairs:
    """Tests for filter_pairs function."""

    def test_filter_pairs_counts_each_step(self) -> None:
        """Test that each filter step removes what it should."""
        keep = (_sentence(8), _sentence(8, "nn"))
        rows = [
            keep,
            ("", _sentence(8, "nn")),  # empty side
            (_sentence(7), _sentence(7, "nn")),  # too short
            (_sentence(41), _sentence(41, "nn")),  # too long
            (_sentence(9), _sentence(9)),  # identical sides
            (keep[0], "en annen oversettelse"),  # duplicate Bokmål sentence
        ]

        pairs, counts = filter_pairs(rows, 8, 40)

        assert pairs == [keep]
        assert counts == {
            "raw": 6,
            "non_empty": 5,
            "word_range": 3,
            "nb_differs_from_nn": 2,
            "deduplicated": 1,
        }

    def test_filter_pairs_keeps_word_range_boundaries(self) -> None:
        """Test that 8 and 40 words are inside the range."""
        rows = [(_sentence(8), "a"), (_sentence(40), "b")]

        pairs, _ = filter_pairs(rows, 8, 40)

        assert len(pairs) == 2


class TestSamplePairs:
    """Tests for sample_pairs function."""

    def test_sample_pairs_is_deterministic_and_order_independent(self) -> None:
        """Test that the same seed gives the same sample for any input order."""
        pairs = [(_sentence(8, f"a{i}"), f"nn{i}") for i in range(50)]

        first = sample_pairs(pairs, 10, seed=1)
        second = sample_pairs(list(reversed(pairs)), 10, seed=1)

        assert first == second
        assert [pair.id for pair in first][:2] == ["npk-0001", "npk-0002"]

    def test_sample_pairs_differs_between_seeds(self) -> None:
        """Test that another seed gives another sample."""
        pairs = [(_sentence(8, f"a{i}"), f"nn{i}") for i in range(50)]

        assert sample_pairs(pairs, 10, seed=1) != sample_pairs(pairs, 10, seed=2)

    def test_sample_pairs_raises_with_too_few_candidates(self) -> None:
        """Test that sampling more pairs than available raises ValueError."""
        with pytest.raises(ValueError, match="Cannot draw"):
            sample_pairs([("a", "b")], 2, seed=1)


class TestLoadFasit:
    """Tests for load_fasit function."""

    def test_load_fasit_roundtrip(self, tmp_path: Path) -> None:
        """Test that written pairs are read back unchanged."""
        pairs = [
            FasitPair(id="npk-0001", nb='Han sa: "Hei"', nn='Han sa: "Hei"'),
            FasitPair(id="npk-0002", nb="– Ikke nå", nn="– Ikkje no"),
        ]
        path = tmp_path / "fasit.tsv"
        write_fasit(pairs, path)

        assert load_fasit(path) == pairs

    def test_load_fasit_raises_on_checksum_mismatch(self, tmp_path: Path) -> None:
        """Test that a changed fasit is rejected."""
        path = tmp_path / "fasit.tsv"
        write_fasit([FasitPair(id="npk-0001", nb="a", nn="b")], path)
        manifest = tmp_path / "fasit.sha256"
        manifest.write_text(f"{sha256_of(path)}  fasit.tsv\n", encoding="utf-8")
        write_fasit([FasitPair(id="npk-0001", nb="a", nn="endret")], path)

        with pytest.raises(ValueError, match="checksum mismatch"):
            load_fasit(path, manifest)

    def test_load_fasit_raises_on_missing_file(self, tmp_path: Path) -> None:
        """Test that a missing fasit raises FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            load_fasit(tmp_path / "missing.tsv")

    def test_load_fasit_raises_on_wrong_header(self, tmp_path: Path) -> None:
        """Test that an unexpected header is rejected."""
        path = tmp_path / "fasit.tsv"
        path.write_text("id\tbokmål\tnynorsk\n", encoding="utf-8")

        with pytest.raises(ValueError, match="Unexpected fasit header"):
            load_fasit(path)


class TestLockedFasit:
    """Tests for the fasit file in the repository."""

    def test_locked_fasit_matches_manifest_and_filters(self) -> None:
        """Test that data/fasit.tsv is unchanged and follows the filter rules."""
        pairs = load_fasit(FASIT_PATH, MANIFEST_PATH)

        assert len(pairs) == 200
        assert len({pair.nb for pair in pairs}) == 200
        assert all(8 <= len(pair.nb.split()) <= 40 for pair in pairs)
        assert all(pair.nb != pair.nn for pair in pairs)
