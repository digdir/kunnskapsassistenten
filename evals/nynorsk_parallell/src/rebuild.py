# -*- coding: utf-8 -*-
"""Rebuild results.json for a run from its stored, blinded translations.

Use this when a run was interrupted after the blind key was written. The
blinded files are scored again. The stored scores and the stored blind key
are read, not overwritten. Statuses from an earlier results.json are kept.
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Tuple

from src.config import load_config
from src.fasit import load_fasit, read_manifest
from src.reporter import build_results, print_summary, save_results, unblind
from src.scoring import RepetitionScore, score_blinded_dir
from src.translator import INSTRUCTION, ModelStatus

logger = logging.getLogger(__name__)


def read_blind_key(path: Path) -> Dict[str, Tuple[str, int]]:
    """
    Read a blind key written by a finished scoring step.

    Args:
        path: Path to blind_key.json.

    Returns:
        Mapping from blind id to model name and repetition.
    """
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {
        blind_id: (entry["model"], entry["repetition"])
        for blind_id, entry in payload.items()
    }


def check_against_stored_scores(
    scores: Dict[str, RepetitionScore], stored_path: Path
) -> None:
    """
    Check that the new scores are the same as the ones stored by the run.

    Args:
        scores: Scores computed now.
        stored_path: Path to blinded_scores.json from the run.

    Raises:
        ValueError: If a blind id is missing or a score differs.
    """
    stored = json.loads(stored_path.read_text(encoding="utf-8"))
    if set(stored) != set(scores):
        raise ValueError("Stored scores and blinded files have different blind ids")
    for blind_id, score in scores.items():
        if abs(stored[blind_id]["corpus_chrf"] - score.corpus_chrf) > 1e-9:
            raise ValueError(f"Score for {blind_id} differs from the stored score")


def read_stored_statuses(results_path: Path) -> Dict[str, ModelStatus]:
    """
    Read the translation statuses from an earlier results.json, if there is one.

    Args:
        results_path: Path to results.json in the run directory.

    Returns:
        Status per model name. Empty if the file or the statuses are missing.
    """
    if not results_path.exists():
        return {}
    stored = json.loads(results_path.read_text(encoding="utf-8"))
    return {
        name: ModelStatus(**entry["status"])
        for name, entry in stored.get("models", {}).items()
        if entry.get("status")
    }


def main() -> int:
    """
    Score the stored translations again and write results.json.

    Returns:
        Exit code.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_dir", type=Path, help="Run directory with blinded/")
    parser.add_argument("config_file", type=Path, help="TOML file the run used")
    parser.add_argument("--fasit", type=Path, default=Path("data/fasit.tsv"))
    parser.add_argument("--manifest", type=Path, default=Path("data/fasit.sha256"))
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    config = load_config(args.config_file)
    fasit = load_fasit(args.fasit, args.manifest)

    scores = score_blinded_dir(fasit, args.run_dir / "blinded")
    check_against_stored_scores(scores, args.run_dir / "blinded_scores.json")
    summaries = unblind(scores, read_blind_key(args.run_dir / "blind_key.json"))

    results = build_results(
        run_id=args.run_dir.name,
        config=config,
        fasit=fasit,
        fasit_sha256=read_manifest(args.manifest),
        instruction=INSTRUCTION,
        summaries=summaries,
        statuses=read_stored_statuses(args.run_dir / "results.json"),
    )
    save_results(results, args.run_dir / "results.json")
    print_summary(results)
    return 0


if __name__ == "__main__":
    sys.exit(main())
