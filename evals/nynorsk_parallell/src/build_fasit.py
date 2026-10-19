# -*- coding: utf-8 -*-
"""Build the locked reference set from the NPK/NTB translation memory."""

import argparse
import csv
import json
import logging
import sys
from pathlib import Path
from typing import List, Tuple

from src.fasit import filter_pairs, sample_pairs, sha256_of, write_fasit

logger = logging.getLogger(__name__)

DEFAULT_SEED = 20261013
DEFAULT_N = 200
MIN_WORDS = 8
MAX_WORDS = 40


def read_translation_memory(path: Path) -> List[Tuple[str, str]]:
    """
    Read the two-column TSV translation memory (Bokmål, Nynorsk).

    Args:
        path: Path to the TSV file from Språkbanken.

    Returns:
        Raw (nb, nn) pairs. Lines without exactly two columns are skipped.
    """
    rows: List[Tuple[str, str]] = []
    with open(path, "r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE)
        for row in reader:
            if len(row) == 2:
                rows.append((row[0], row[1]))
    return rows


def main() -> int:
    """
    Build data/fasit.tsv and data/fasit.sha256.

    Returns:
        Exit code.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "input_file", type=Path, help="NPK/NTB translation memory (TSV)"
    )
    parser.add_argument("--output", "-o", type=Path, default=Path("data/fasit.tsv"))
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--n", type=int, default=DEFAULT_N)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    if args.output.exists():
        logger.error(f"{args.output} already exists. The fasit is locked.")
        return 1

    rows = read_translation_memory(args.input_file)
    pairs, counts = filter_pairs(rows, MIN_WORDS, MAX_WORDS)
    sample = sample_pairs(pairs, args.n, args.seed)
    write_fasit(sample, args.output)

    digest = sha256_of(args.output)
    manifest = args.output.with_suffix(".sha256")
    manifest.write_text(f"{digest}  {args.output.name}\n", encoding="utf-8")

    summary = {
        "source_file": args.input_file.name,
        "source_sha256": sha256_of(args.input_file),
        "seed": args.seed,
        "min_words": MIN_WORDS,
        "max_words": MAX_WORDS,
        "counts": counts,
        "sampled": len(sample),
        "fasit_sha256": digest,
    }
    logger.info(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
