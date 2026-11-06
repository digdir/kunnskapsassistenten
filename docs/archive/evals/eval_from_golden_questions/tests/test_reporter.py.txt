# -*- coding: utf-8 -*-
"""Unit tests for reporter module."""

import json
from pathlib import Path

import pytest

from src.models import (
    AggregateStats,
    EvaluationResults,
    MetricResult,
    MetricScores,
    RAGEvaluation,
)
from src.reporter import (
    get_metric_failure_counts,
    print_metric_failure_matrix,
    print_summary,
    save_jsonl,
)


class TestSaveJsonl:
    """Tests for save_jsonl function."""

    def test_save_jsonl_creates_file_with_evaluations(self, tmp_path: Path) -> None:
        """Test that save_jsonl creates JSONL file with evaluations."""
        scores = MetricScores(
            metrics={
                "Faithfulness": MetricResult(score=0.85, success=True),
                "Answer Relevancy": MetricResult(score=0.92, success=True),
                "Contextual Relevancy": MetricResult(score=0.78, success=True),
                "Hallucination": MetricResult(score=0.15, success=True),
                "Contextual Precision": MetricResult(score=0.80, success=True),
            }
        )
        evaluation = RAGEvaluation(
            question_id="abc123_0",
            question="Test question",
            answer="Test answer",
            chunks=[],
            metrics=scores,
        )
        results = EvaluationResults(
            evaluations=[evaluation],
            aggregate={},
            total_count=1,
            error_count=1,
            success_count=0,
        )

        output_file = tmp_path / "results.jsonl"
        save_jsonl(results, output_file)

        assert output_file.exists()
        with open(output_file, "r", encoding="utf-8") as f:
            content = f.read()
            # The output is pretty-printed JSON with a trailing newline
            # Parse the entire content as one JSON object
            data = json.loads(content.strip())
            assert data["question_id"] == "abc123_0"
            assert data["question"] == "Test question"

    def test_save_jsonl_creates_parent_directory(self, tmp_path: Path) -> None:
        """Test that save_jsonl creates parent directories if needed."""
        output_file = tmp_path / "subdir" / "nested" / "results.jsonl"
        scores = MetricScores(
            metrics={
                "Faithfulness": MetricResult(score=0.85, success=True),
                "Answer Relevancy": MetricResult(score=0.92, success=True),
                "Contextual Relevancy": MetricResult(score=0.78, success=True),
                "Hallucination": MetricResult(score=0.15, success=True),
                "Contextual Precision": MetricResult(score=0.80, success=True),
            }
        )
        evaluation = RAGEvaluation(
            question_id="abc123_0",
            question="Test",
            answer="Test",
            chunks=[],
            metrics=scores,
        )
        results = EvaluationResults(
            evaluations=[evaluation],
            aggregate={},
            total_count=1,
            error_count=1,
            success_count=0,
        )

        save_jsonl(results, output_file)

        assert output_file.exists()
        assert output_file.parent.exists()

    def test_save_jsonl_with_empty_evaluations(self, tmp_path: Path) -> None:
        """Test save_jsonl with empty evaluations list."""
        results = EvaluationResults(
            evaluations=[],
            aggregate={},
            total_count=0,
            error_count=0,
            success_count=0,
        )

        output_file = tmp_path / "empty_results.jsonl"
        save_jsonl(results, output_file)

        assert output_file.exists()
        with open(output_file, "r", encoding="utf-8") as f:
            content = f.read()
            assert content == ""


class TestPrintSummary:
    """Tests for print_summary function."""

    def test_print_summary_with_successful_evaluations(
        self, capsys: pytest.CaptureFixture
    ) -> None:
        """Test print_summary with successful evaluations."""
        scores = MetricScores(
            metrics={
                "Faithfulness": MetricResult(score=0.85, success=True),
                "Answer Relevancy": MetricResult(score=0.92, success=True),
                "Contextual Relevancy": MetricResult(score=0.78, success=True),
                "Hallucination": MetricResult(score=0.15, success=True),
                "Contextual Precision": MetricResult(score=0.80, success=True),
            }
        )
        evaluation = RAGEvaluation(
            question_id="abc123_0",
            question="Test",
            answer="Test",
            chunks=[],
            metrics=scores,
        )
        stats = AggregateStats(mean=0.85, std=0.12, min=0.60, max=0.95)
        results = EvaluationResults(
            evaluations=[evaluation],
            aggregate={"faithfulness": stats},
            total_count=1,
            error_count=1,
            success_count=0,
        )

        print_summary(results)

        captured = capsys.readouterr()
        assert "Evaluation Results (1 questions)" in captured.out
        assert "Faithfulness" in captured.out
        assert "0.85" in captured.out

    def test_print_summary_with_no_successful_evaluations(
        self, capsys: pytest.CaptureFixture
    ) -> None:
        """Test print_summary with no successful evaluations."""
        results = EvaluationResults(
            evaluations=[],
            aggregate={},
            total_count=0,
            error_count=0,
            success_count=0,
        )

        print_summary(results)

        captured = capsys.readouterr()
        assert "No successful evaluations" in captured.out

    def test_print_summary_with_failures(
        self, capsys: pytest.CaptureFixture
    ) -> None:
        """Test print_summary includes failure count."""
        results = EvaluationResults(
            evaluations=[],
            aggregate={},
            total_count=5,
            error_count=3,
            success_count=2,
        )

        print_summary(results)

        captured = capsys.readouterr()
        assert "TestCase run errors: 3" in captured.out
        assert "TestCase succeeded (all metrics): 2" in captured.out

    def test_print_summary_with_thresholds(
        self, capsys: pytest.CaptureFixture
    ) -> None:
        """Test print_summary displays thresholds when available."""
        scores = MetricScores(
            metrics={
                "Faithfulness": MetricResult(score=0.85, success=True),
            }
        )
        evaluation = RAGEvaluation(
            question_id="abc123_0",
            question="Test",
            answer="Test",
            chunks=[],
            metrics=scores,
        )
        stats_with_threshold = AggregateStats(
            mean=0.85, std=0.12, min=0.60, max=0.95, threshold=0.7
        )
        stats_without_threshold = AggregateStats(
            mean=0.75, std=0.10, min=0.50, max=0.90, threshold=None
        )
        results = EvaluationResults(
            evaluations=[evaluation],
            aggregate={
                "faithfulness": stats_with_threshold,
                "custom_metric": stats_without_threshold,
            },
            total_count=1,
            error_count=0,
            success_count=1,
        )

        print_summary(results)

        captured = capsys.readouterr()
        assert "threshold: 0.70" in captured.out
        # Check that metric without threshold doesn't show threshold
        assert captured.out.count("threshold") == 1


class TestMetricFailureAnalysis:
    """Tests for metric failure analysis functions."""

    def test_get_metric_failure_counts_with_mixed_results(self) -> None:
        """Test get_metric_failure_counts with mix of successes and failures."""
        evaluations = [
            RAGEvaluation(
                question_id="q1",
                question="Test 1",
                answer="Answer 1",
                chunks=[],
                metrics=MetricScores(
                    metrics={
                        "Faithfulness": MetricResult(score=0.85, success=True),
                        "Answer Relevancy": MetricResult(score=0.92, success=True),
                        "Contextual Relevancy": MetricResult(score=0.50, success=False),
                    }
                ),
            ),
            RAGEvaluation(
                question_id="q2",
                question="Test 2",
                answer="Answer 2",
                chunks=[],
                metrics=MetricScores(
                    metrics={
                        "Faithfulness": MetricResult(score=0.45, success=False),
                        "Answer Relevancy": MetricResult(score=0.88, success=True),
                        "Contextual Relevancy": MetricResult(score=0.75, success=True),
                    }
                ),
            ),
        ]

        results = EvaluationResults(
            evaluations=evaluations,
            aggregate={},
            total_count=2,
            error_count=0,
            success_count=2,
        )

        counts = get_metric_failure_counts(results)

        assert counts["Faithfulness"]["total"] == 2
        assert counts["Faithfulness"]["successes"] == 1
        assert counts["Faithfulness"]["failures"] == 1

        assert counts["Answer Relevancy"]["total"] == 2
        assert counts["Answer Relevancy"]["successes"] == 2
        assert counts["Answer Relevancy"]["failures"] == 0

        assert counts["Contextual Relevancy"]["total"] == 2
        assert counts["Contextual Relevancy"]["successes"] == 1
        assert counts["Contextual Relevancy"]["failures"] == 1

    def test_get_metric_failure_counts_skips_errored_evaluations(self) -> None:
        """Test that get_metric_failure_counts skips evaluations with errors."""
        evaluations = [
            RAGEvaluation(
                question_id="q1",
                question="Test 1",
                answer="Answer 1",
                chunks=[],
                metrics=MetricScores(
                    metrics={
                        "Faithfulness": MetricResult(score=0.85, success=True),
                    }
                ),
            ),
            RAGEvaluation(
                question_id="q2",
                question="Test 2",
                answer="",
                chunks=[],
                metrics=MetricScores(metrics={}),
                error="RAG fetch failed",
            ),
        ]

        results = EvaluationResults(
            evaluations=evaluations,
            aggregate={},
            total_count=2,
            error_count=1,
            success_count=1,
        )

        counts = get_metric_failure_counts(results)

        # Only one evaluation should be counted (the one without error)
        assert counts["Faithfulness"]["total"] == 1
        assert counts["Faithfulness"]["successes"] == 1
        assert counts["Faithfulness"]["failures"] == 0

    def test_print_metric_failure_matrix_displays_correctly(
        self, capsys: pytest.CaptureFixture
    ) -> None:
        """Test print_metric_failure_matrix outputs formatted table."""
        evaluations = [
            RAGEvaluation(
                question_id="q1",
                question="Test 1",
                answer="Answer 1",
                chunks=[],
                metrics=MetricScores(
                    metrics={
                        "Faithfulness": MetricResult(score=0.85, success=True),
                        "Answer Relevancy": MetricResult(score=0.92, success=True),
                    }
                ),
            ),
            RAGEvaluation(
                question_id="q2",
                question="Test 2",
                answer="Answer 2",
                chunks=[],
                metrics=MetricScores(
                    metrics={
                        "Faithfulness": MetricResult(score=0.45, success=False),
                        "Answer Relevancy": MetricResult(score=0.88, success=True),
                    }
                ),
            ),
        ]

        results = EvaluationResults(
            evaluations=evaluations,
            aggregate={},
            total_count=2,
            error_count=0,
            success_count=2,
        )

        print_metric_failure_matrix(results)

        captured = capsys.readouterr()
        assert "Metric Failure Analysis" in captured.out
        assert "Answer Relevancy" in captured.out
        assert "Faithfulness" in captured.out
        assert "Successes" in captured.out
        assert "Failures" in captured.out
        assert "Total" in captured.out

    def test_print_metric_failure_matrix_with_no_data(
        self, capsys: pytest.CaptureFixture
    ) -> None:
        """Test print_metric_failure_matrix with no metric data."""
        results = EvaluationResults(
            evaluations=[],
            aggregate={},
            total_count=0,
            error_count=0,
            success_count=0,
        )

        print_metric_failure_matrix(results)

        captured = capsys.readouterr()
        assert "No metric data available" in captured.out
