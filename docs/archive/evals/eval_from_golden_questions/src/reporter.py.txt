# -*- coding: utf-8 -*-
"""Reporter module for outputting evaluation results."""

import json
import logging
from pathlib import Path
from typing import List

from agents import AgentResponse

from src.models import EvaluationResults, GoldenQuestion

logger = logging.getLogger(__name__)


def save_jsonl(results: EvaluationResults, output_file: Path) -> None:
    """
    Save evaluation results to JSONL file with pretty printing.

    Args:
        results: Evaluation results to save.
        output_file: Path to output JSONL file.
    """
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        for evaluation in results.evaluations:
            data = evaluation.model_dump()
            # Pretty print each JSON object with indentation
            f.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

    logger.info(f"Saved {len(results.evaluations)} evaluations to {output_file}")


def save_rag_answers(
    questions: List[GoldenQuestion],
    rag_responses: List[AgentResponse],
    output_file: Path,
) -> None:
    """
    Save RAG answers to JSONL file with pretty printing.

    Args:
        questions: List of golden questions.
        rag_responses: List of RAG responses (AgentResponse or None).
        output_file: Path to output JSONL file.
    """
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        for i, (question, response) in enumerate(zip(questions, rag_responses)):
            data = {
                "question_id": f"{question.conversation_id}_{i}",
                "question": question.question,
                "conversation_id": question.conversation_id,
                "success": response is not None,
            }

            if response is not None:
                data["answer"] = response.answer
                data["chunks"] = [
                    {
                        "chunk_id": chunk.chunk_id,
                        "doc_title": chunk.doc_title or "",
                        "content": chunk.content_markdown,
                    }
                    for chunk in response.chunks_used
                ]
            else:
                data["answer"] = None
                data["chunks"] = []

            # Pretty print each JSON object with indentation
            f.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

    success_count = sum(1 for r in rag_responses if r is not None)
    logger.info(
        f"Saved {success_count}/{len(rag_responses)} RAG answers to {output_file}"
    )


def get_metric_failure_counts(results: EvaluationResults) -> dict[str, dict[str, int]]:
    """
    Calculate failure counts for each metric.

    Args:
        results: Evaluation results to analyze.

    Returns:
        Dictionary with metric names as keys and failure stats as values.
        Each value contains 'failures', 'successes', and 'total' counts.
    """
    metric_stats: dict[str, dict[str, int]] = {}

    for evaluation in results.evaluations:
        # Skip evaluations that had errors at the test case level
        if evaluation.error:
            continue

        for metric_name, metric_result in evaluation.metrics.metrics.items():
            if metric_name not in metric_stats:
                metric_stats[metric_name] = {
                    "failures": 0,
                    "successes": 0,
                    "total": 0,
                }

            metric_stats[metric_name]["total"] += 1
            if metric_result.success:
                metric_stats[metric_name]["successes"] += 1
            else:
                metric_stats[metric_name]["failures"] += 1

    return metric_stats


def print_metric_failure_matrix(results: EvaluationResults) -> None:
    """
    Print a matrix showing failure counts for each metric.

    Args:
        results: Evaluation results to analyze.
    """
    metric_stats = get_metric_failure_counts(results)

    if not metric_stats:
        print("No metric data available.")
        return

    print()
    print("Metric Failure Analysis")
    print("=" * 70)
    print(f"{'Metric':<30} {'Successes':>12} {'Failures':>12} {'Total':>12}")
    print("-" * 70)

    for metric_name in sorted(metric_stats.keys()):
        stats = metric_stats[metric_name]
        print(
            f"{metric_name:<30} {stats['successes']:>12} "
            f"{stats['failures']:>12} {stats['total']:>12}"
        )

    print("-" * 70)
    total_tests = sum(s["total"] for s in metric_stats.values())
    total_successes = sum(s["successes"] for s in metric_stats.values())
    total_failures = sum(s["failures"] for s in metric_stats.values())

    print(f"{'Total':<30} {total_successes:>12} {total_failures:>12} {total_tests:>12}")
    print()


def print_summary(results: EvaluationResults) -> None:
    """
    Print console summary of evaluation results.

    Args:
        results: Evaluation results to summarize.
    """
    print()
    print(f"Evaluation Results ({results.total_count} questions)")
    print("=" * 50)

    print(f"TestCase run errors: {results.error_count}")
    print(f"TestCase succeeded (all metrics): {results.success_count}")
    print()

    if not results.aggregate:
        print("No successful evaluations to report.")
        return

    for metric_name, stats in results.aggregate.items():
        metric_label = metric_name.replace("_", " ").title()
        if stats.threshold is not None:
            print(
                f"{metric_label:25s}: {stats.mean:.2f} ± {stats.std:.2f}\t\t"
                f"(threshold: {stats.threshold:.2f})"
            )
        else:
            print(f"{metric_label:25s}: {stats.mean:.2f} ± {stats.std:.2f}")

    print()

    # Print metric failure matrix
    print_metric_failure_matrix(results)

    logger.info("Printed summary to console")
