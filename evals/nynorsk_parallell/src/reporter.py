# -*- coding: utf-8 -*-
"""Reporter module for saving and printing evaluation results."""

import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from src.config import Config
from src.fasit import FasitPair
from src.scoring import (
    COPY_BASELINE,
    ModelSummary,
    RepetitionScore,
    chrf_signature,
    score_copy_baseline,
    summarize,
)
from src.translator import ModelStatus

logger = logging.getLogger(__name__)


def unblind(
    scores: Dict[str, RepetitionScore], links: Dict[str, Tuple[str, int]]
) -> Dict[str, ModelSummary]:
    """
    Join blinded scores with the revealed key and summarize per model.

    Args:
        scores: Scores per blind id.
        links: Mapping from blind id to model name and repetition.

    Returns:
        Summary per model name, with repetitions in order.
    """
    per_model: Dict[str, List[Tuple[int, RepetitionScore]]] = {}
    for blind_id, score in scores.items():
        model_name, repetition = links[blind_id]
        per_model.setdefault(model_name, []).append((repetition, score))

    return {
        model_name: summarize([score for _, score in sorted(items, key=lambda x: x[0])])
        for model_name, items in per_model.items()
    }


def build_results(
    run_id: str,
    config: Config,
    fasit: List[FasitPair],
    fasit_sha256: str,
    instruction: str,
    summaries: Dict[str, ModelSummary],
    statuses: Optional[Dict[str, ModelStatus]] = None,
) -> Dict[str, Any]:
    """
    Build the result dictionary for one run.

    Args:
        run_id: Id of the run.
        config: Configuration the run was started with.
        fasit: Reference pairs.
        fasit_sha256: Checksum of the reference file.
        instruction: The fixed instruction sent to the models.
        summaries: Unblinded summary per model name.
        statuses: Status per model from the translation step. Not available
            when results are rebuilt from stored translations.

    Returns:
        Result dictionary. Models with fewer repetitions than configured are
        listed under not_completed.
    """
    statuses = statuses or {}
    models_by_name = {model.name: model for model in config.models}

    not_completed: Dict[str, str] = {}
    for model in config.models:
        done = summaries[model.name].repetitions if model.name in summaries else 0
        if done < config.run.repetitions:
            status = statuses.get(model.name)
            reason = status.skipped_reason if status else None
            not_completed[model.name] = (
                f"{done} of {config.run.repetitions} repetitions"
                + (f": {reason}" if reason else "")
            )

    return {
        "run_id": run_id,
        "date": datetime.now().date().isoformat(),
        "fasit_sha256": fasit_sha256,
        "fasit_pairs": len(fasit),
        "instruction": instruction,
        "metric": chrf_signature(),
        "run": config.run.model_dump(),
        "baseline": {
            COPY_BASELINE: score_copy_baseline(fasit).model_dump(
                exclude={"sentence_chrf"}
            )
        },
        "models": {
            name: {
                "provider": models_by_name[name].provider,
                "model": models_by_name[name].model,
                "note": models_by_name[name].note,
                "summary": summary.model_dump(),
                "status": (statuses[name].model_dump() if name in statuses else None),
            }
            for name, summary in summaries.items()
        },
        "not_completed": not_completed,
    }


def save_results(results: Dict[str, Any], path: Path) -> None:
    """
    Save the result file as JSON.

    Args:
        results: Result dictionary.
        path: Output path.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    logger.info(f"Saved results to {path}")


def format_table(results: Dict[str, Any], exclude: Optional[List[str]] = None) -> str:
    """
    Format the results as a Markdown table, read from the result dictionary.

    Args:
        results: Result dictionary as written by save_results.
        exclude: Model names to leave out of the table.

    Returns:
        Markdown table sorted by mean corpus chrF, with the copy baseline last.
    """
    lines = [
        "| Modell | chrF (snitt) | Std.avvik | Per gjentak | Ordrett treff (snitt) |",
        "|---|---|---|---|---|",
    ]
    rows = sorted(
        (
            (name, entry)
            for name, entry in results["models"].items()
            if name not in (exclude or [])
        ),
        key=lambda item: item[1]["summary"]["corpus_chrf_mean"],
        reverse=True,
    )
    for name, entry in rows:
        summary = entry["summary"]
        per_repetition = ", ".join(
            f"{score:.2f}" for score in summary["corpus_chrf_per_repetition"]
        )
        lines.append(
            f"| {name} | {summary['corpus_chrf_mean']:.2f} "
            f"| {summary['corpus_chrf_std']:.2f} | {per_repetition} "
            f"| {summary['exact_match_rate_mean']:.1%} |"
        )

    baseline = results["baseline"][COPY_BASELINE]
    lines.append(
        f"| Kopi av bokmål (ingen oversettelse) | {baseline['corpus_chrf']:.2f} "
        f"| | | {baseline['exact_match_rate']:.1%} |"
    )
    return "\n".join(lines)


def print_summary(results: Dict[str, Any]) -> None:
    """
    Print the result table and the models that were not completed.

    Args:
        results: Result dictionary as written by save_results.
    """
    print(format_table(results))
    for name, status in results["not_completed"].items():
        print(f"Ikke fullført: {name} ({status})")
