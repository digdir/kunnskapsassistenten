# -*- coding: utf-8 -*-
"""Loading and building of the locked Bokmål/Nynorsk reference set (fasit)."""

import csv
import hashlib
import logging
import random
from pathlib import Path
from typing import Dict, List, Tuple

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

ZERO_WIDTH_SPACE = "​"
FASIT_COLUMNS = ["id", "nb", "nn"]


class FasitPair(BaseModel):
    """One sentence pair in the reference set."""

    id: str = Field(..., min_length=1)
    nb: str = Field(..., min_length=1)
    nn: str = Field(..., min_length=1)


def normalize(text: str) -> str:
    """
    Remove zero-width spaces and surrounding whitespace.

    Args:
        text: Raw segment from the translation memory.

    Returns:
        Cleaned segment.
    """
    return text.replace(ZERO_WIDTH_SPACE, "").strip()


def filter_pairs(
    rows: List[Tuple[str, str]], min_words: int, max_words: int
) -> Tuple[List[Tuple[str, str]], Dict[str, int]]:
    """
    Filter raw sentence pairs and count what is left after each step.

    Steps, in order: drop pairs with an empty side, drop pairs where the
    Bokmål side is outside the word range, drop pairs where both sides are
    identical, and keep only the first pair for each Bokmål sentence.

    Args:
        rows: Raw (nb, nn) pairs.
        min_words: Minimum number of words on the Bokmål side.
        max_words: Maximum number of words on the Bokmål side.

    Returns:
        The filtered pairs and the number of pairs left after each step.
    """
    counts: Dict[str, int] = {"raw": len(rows)}

    pairs = [(normalize(nb), normalize(nn)) for nb, nn in rows]
    pairs = [(nb, nn) for nb, nn in pairs if nb and nn]
    counts["non_empty"] = len(pairs)

    pairs = [(nb, nn) for nb, nn in pairs if min_words <= len(nb.split()) <= max_words]
    counts["word_range"] = len(pairs)

    pairs = [(nb, nn) for nb, nn in pairs if nb != nn]
    counts["nb_differs_from_nn"] = len(pairs)

    seen: set[str] = set()
    unique: List[Tuple[str, str]] = []
    for nb, nn in pairs:
        if nb in seen:
            continue
        seen.add(nb)
        unique.append((nb, nn))
    counts["deduplicated"] = len(unique)

    return unique, counts


def sample_pairs(pairs: List[Tuple[str, str]], n: int, seed: int) -> List[FasitPair]:
    """
    Draw a fixed-seed sample of sentence pairs.

    The pairs are sorted before sampling, so the draw does not depend on the
    order of the input file.

    Args:
        pairs: Filtered (nb, nn) pairs.
        n: Number of pairs to draw.
        seed: Seed for the random draw.

    Returns:
        Sampled pairs with ids npk-0001, npk-0002 and so on.

    Raises:
        ValueError: If there are fewer than n pairs to draw from.
    """
    if len(pairs) < n:
        raise ValueError(f"Cannot draw {n} pairs from {len(pairs)} candidates")

    drawn = random.Random(seed).sample(sorted(pairs), n)
    return [
        FasitPair(id=f"npk-{i:04d}", nb=nb, nn=nn)
        for i, (nb, nn) in enumerate(drawn, start=1)
    ]


def write_fasit(pairs: List[FasitPair], path: Path) -> None:
    """
    Write the reference set as a TSV file with the columns id, nb and nn.

    Args:
        pairs: Sentence pairs to write.
        path: Output path.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t", quoting=csv.QUOTE_NONE, quotechar=None)
        writer.writerow(FASIT_COLUMNS)
        for pair in pairs:
            writer.writerow([pair.id, pair.nb, pair.nn])


def sha256_of(path: Path) -> str:
    """
    Compute the sha256 checksum of a file.

    Args:
        path: File to hash.

    Returns:
        Hex digest.
    """
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_manifest(manifest_path: Path) -> str:
    """
    Read the expected checksum from a manifest in sha256sum format.

    Args:
        manifest_path: Path to the manifest file.

    Returns:
        Expected hex digest.

    Raises:
        ValueError: If the manifest is empty.
    """
    content = manifest_path.read_text(encoding="utf-8").split()
    if not content:
        raise ValueError(f"Empty manifest: {manifest_path}")
    return content[0]


def load_fasit(path: Path, manifest_path: Path | None = None) -> List[FasitPair]:
    """
    Load the reference set and verify it against the manifest.

    Args:
        path: Path to the TSV file.
        manifest_path: Optional manifest with the expected sha256. When given,
            a mismatch stops the run.

    Returns:
        List of sentence pairs.

    Raises:
        FileNotFoundError: If the TSV file does not exist.
        ValueError: If the checksum, the header or the ids are wrong.
    """
    if not path.exists():
        raise FileNotFoundError(f"Fasit file not found: {path}")

    if manifest_path is not None:
        expected = read_manifest(manifest_path)
        actual = sha256_of(path)
        if actual != expected:
            raise ValueError(
                f"Fasit checksum mismatch: expected {expected}, got {actual}. "
                "The reference set is locked and must not be changed."
            )

    with open(path, "r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE)
        header = next(reader, None)
        if header != FASIT_COLUMNS:
            raise ValueError(f"Unexpected fasit header: {header}")
        pairs = [FasitPair(id=row[0], nb=row[1], nn=row[2]) for row in reader]

    ids = [pair.id for pair in pairs]
    if len(ids) != len(set(ids)):
        raise ValueError("Fasit ids are not unique")

    logger.info(f"Loaded {len(pairs)} fasit pairs from {path}")
    return pairs
