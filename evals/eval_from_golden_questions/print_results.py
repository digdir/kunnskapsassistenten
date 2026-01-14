# -*- coding: utf-8 -*-
"""Script to read and print evaluation results from JSONL file."""

import argparse
import json
import logging
from pathlib import Path

from src.models import EvaluationResults, RAGEvaluation
from src.reporter import print_summary

logger = logging.getLogger(__name__)


def load_evaluation_results(results_file: Path) -> EvaluationResults:
    """
    Load evaluation results from JSONL file.

    Args:
        results_file: Path to evaluation_results.jsonl file.

    Returns:
        EvaluationResults object.

    Raises:
        FileNotFoundError: If results file doesn't exist.
        ValueError: If results file is empty or invalid.
    """
    if not results_file.exists():
        raise FileNotFoundError(f"Results file not found: {results_file}")

    evaluations = []
    with open(results_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            evaluations.append(RAGEvaluation(**data))

    if not evaluations:
        raise ValueError(f"No evaluations found in {results_file}")

    # Since EvaluationResults requires aggregate stats, we need to compute them
    # We'll reconstruct the full EvaluationResults object by computing aggregate stats
    results = compute_evaluation_results(evaluations)
    return results


def compute_evaluation_results(evaluations: list[RAGEvaluation]) -> EvaluationResults:
    """
    Compute aggregate statistics from evaluations.

    Args:
        evaluations: List of RAGEvaluation objects.

    Returns:
        EvaluationResults with computed aggregate stats.
    """
    import statistics

    # Count totals
    total_count = len(evaluations)
    error_count = sum(1 for e in evaluations if e.error)
    success_count = sum(
        1
        for e in evaluations
        if not e.error and all(m.success for m in e.metrics.metrics.values())
    )

    # Compute aggregate stats for each metric
    aggregate = {}
    metric_names = set()
    for evaluation in evaluations:
        if not evaluation.error:
            metric_names.update(evaluation.metrics.metrics.keys())

    for metric_name in metric_names:
        scores = []
        threshold = None
        for evaluation in evaluations:
            if evaluation.error:
                continue
            metric_result = evaluation.metrics.metrics.get(metric_name)
            if metric_result and metric_result.score is not None:
                scores.append(metric_result.score)
                if threshold is None and metric_result.threshold is not None:
                    threshold = metric_result.threshold

        if scores:
            from src.models import AggregateStats

            aggregate[metric_name] = AggregateStats(
                mean=statistics.mean(scores),
                std=statistics.stdev(scores) if len(scores) > 1 else 0.0,
                min=min(scores),
                max=max(scores),
                threshold=threshold,
            )

    return EvaluationResults(
        evaluations=evaluations,
        aggregate=aggregate,
        total_count=total_count,
        error_count=error_count,
        success_count=success_count,
    )


def main() -> int:
    """
    Main entry point for printing evaluation results.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    parser = argparse.ArgumentParser(
        description="Read and print evaluation results from JSONL file"
    )
    parser.add_argument(
        "results_file",
        type=str,
        nargs="?",
        default="output/evaluation_results.jsonl",
        help="Path to evaluation_results.jsonl file (default: output/evaluation_results.jsonl)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging",
    )

    args = parser.parse_args()

    # Configure logging
    log_level = logging.DEBUG if args.debug else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(levelname)-8s - %(message)s [%(filename)s:%(lineno)d]",
    )

    try:
        results_file = Path(args.results_file)
        logger.info(f"Loading evaluation results from {results_file}...")

        results = load_evaluation_results(results_file)

        logger.info(f"Loaded {len(results.evaluations)} evaluations")

        # Print summary using the existing function
        print_summary(results)

        return 0

    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        return 1
    except ValueError as e:
        logger.error(f"Error loading results: {e}")
        return 1
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())
