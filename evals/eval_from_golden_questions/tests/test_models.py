# -*- coding: utf-8 -*-
"""Unit tests for data models."""

import pytest
from pydantic import ValidationError

from src.models import (
    AggregateStats,
    EvaluationResults,
    GoldenQuestion,
    MetricResult,
    MetricScores,
    RAGEvaluation,
)


class TestGoldenQuestion:
    """Tests for GoldenQuestion model."""

    def test_golden_question_with_required_fields_only(self) -> None:
        """Test GoldenQuestion creation with only required fields."""
        question = GoldenQuestion(
            question="Hva er barnevern?",
            original_question="Hva er barnevern?",
            conversation_id="abc123",
            id="test_question_1",
        )
        assert question.question == "Hva er barnevern?"
        assert question.original_question == "Hva er barnevern?"
        assert question.conversation_id == "abc123"
        assert question.id == "test_question_1"
        assert question.context_messages == []
        assert question.has_retrieval is True

    def test_golden_question_with_all_fields(self) -> None:
        """Test GoldenQuestion creation with all fields."""
        question = GoldenQuestion(
            question="Hva er barnevern?",
            original_question="Hva er barnevern i Norge?",
            conversation_id="abc123",
            id="test_question_2",
            context_messages=[{"role": "user", "text": "Hello"}],
            has_retrieval=False,
            usage_mode={"document_scope": "single"},
            metadata={"topic": "Barnevern"},
            question_changed=True,
            filters={"org": "test"},
        )
        assert question.id == "test_question_2"
        assert question.has_retrieval is False
        assert question.usage_mode == {"document_scope": "single"}
        assert question.metadata == {"topic": "Barnevern"}
        assert question.question_changed is True

    def test_golden_question_missing_required_field_raises_error(self) -> None:
        """Test that missing required field raises ValidationError."""
        with pytest.raises(ValidationError):
            GoldenQuestion(
                question="Hva er barnevern?",
                original_question="Hva er barnevern?",
            )

    def test_golden_question_empty_string_question_raises_error(self) -> None:
        """Test that empty string for question raises ValidationError."""
        with pytest.raises(ValidationError):
            GoldenQuestion(
                question="",
                original_question="test",
                conversation_id="abc123",
            )


class TestMetricResult:
    """Tests for MetricResult model."""

    def test_metric_result_with_score_and_success(self) -> None:
        """Test MetricResult with score and success."""
        result = MetricResult(score=0.85, success=True)

        assert result.score == 0.85
        assert result.success is True
        assert result.error is None
        assert result.reason is None

    def test_metric_result_with_reason(self) -> None:
        """Test MetricResult with reason field."""
        result = MetricResult(
            score=0.85,
            success=True,
            error=None,
            reason="The answer aligns well with the context provided.",
        )

        assert result.score == 0.85
        assert result.success is True
        assert result.error is None
        assert result.reason == "The answer aligns well with the context provided."

    def test_metric_result_without_reason(self) -> None:
        """Test MetricResult without reason field."""
        result = MetricResult(score=0.75, success=True)

        assert result.score == 0.75
        assert result.success is True
        assert result.error is None
        assert result.reason is None

    def test_metric_result_with_error(self) -> None:
        """Test MetricResult with error and no score."""
        result = MetricResult(
            score=None, success=False, error="Model timeout", reason=None
        )

        assert result.score is None
        assert result.success is False
        assert result.error == "Model timeout"
        assert result.reason is None


class TestMetricScores:
    """Tests for MetricScores model."""

    def test_metric_scores_with_valid_values(self) -> None:
        """Test MetricScores creation with valid float values."""
        scores = MetricScores(
            metrics={
                "Faithfulness": MetricResult(score=0.85, success=True),
                "Answer Relevancy": MetricResult(score=0.92, success=True),
                "Contextual Relevancy": MetricResult(score=0.78, success=True),
            }
        )
        assert scores.metrics["Faithfulness"].score == 0.85
        assert scores.metrics["Answer Relevancy"].score == 0.92
        assert scores.metrics["Contextual Relevancy"].score == 0.78

    def test_metric_scores_with_boundary_values(self) -> None:
        """Test MetricScores with boundary values 0.0 and 1.0."""
        scores = MetricScores(
            metrics={
                "Faithfulness": MetricResult(score=0.0, success=True),
                "Answer Relevancy": MetricResult(score=1.0, success=True),
                "Contextual Relevancy": MetricResult(score=0.5, success=True),
            }
        )
        assert scores.metrics["Faithfulness"].score == 0.0
        assert scores.metrics["Answer Relevancy"].score == 1.0

    def test_metric_scores_missing_field_raises_error(self) -> None:
        """Test that MetricScores can be created with empty metrics dict."""
        # MetricScores with default empty dict is valid
        scores = MetricScores()
        assert scores.metrics == {}


class TestRAGEvaluation:
    """Tests for RAGEvaluation model."""

    def test_rag_evaluation_with_required_fields(self) -> None:
        """Test RAGEvaluation creation with required fields."""
        scores = MetricScores(
            metrics={
                "Faithfulness": MetricResult(score=0.85, success=True),
                "Answer Relevancy": MetricResult(score=0.92, success=True),
                "Contextual Relevancy": MetricResult(score=0.78, success=True),
            }
        )
        evaluation = RAGEvaluation(
            question_id="abc123_0",
            question="Hva er barnevern?",
            answer="Barnevernet er...",
            chunks=[
                {
                    "chunk_id": "chunk1",
                    "doc_title": "Barnevernloven",
                    "content": "Text...",
                }
            ],
            metrics=scores,
        )
        assert evaluation.question_id == "abc123_0"
        assert evaluation.question == "Hva er barnevern?"
        assert evaluation.answer == "Barnevernet er..."
        assert len(evaluation.chunks) == 1
        assert evaluation.metrics.metrics["Faithfulness"].score == 0.85
        assert evaluation.metadata is None
        assert evaluation.error is None

    def test_rag_evaluation_with_error(self) -> None:
        """Test RAGEvaluation with error field."""
        scores = MetricScores()  # Empty metrics for error case
        evaluation = RAGEvaluation(
            question_id="abc123_0",
            question="Hva er barnevern?",
            answer="",
            chunks=[],
            metrics=scores,
            error="RAG API timeout",
        )
        assert evaluation.error == "RAG API timeout"

    def test_rag_evaluation_serialization(self) -> None:
        """Test RAGEvaluation can be serialized to dict."""
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
            question="Hva er barnevern?",
            answer="Barnevernet er...",
            chunks=[],
            metrics=scores,
        )
        data = evaluation.model_dump()
        assert isinstance(data, dict)
        assert data["question_id"] == "abc123_0"
        assert data["metrics"]["metrics"]["Faithfulness"]["score"] == 0.85


class TestAggregateStats:
    """Tests for AggregateStats model."""

    def test_aggregate_stats_creation(self) -> None:
        """Test AggregateStats creation with valid values."""
        stats = AggregateStats(
            mean=0.85,
            std=0.12,
            min=0.60,
            max=0.95,
        )
        assert stats.mean == 0.85
        assert stats.std == 0.12
        assert stats.min == 0.60
        assert stats.max == 0.95


class TestEvaluationResults:
    """Tests for EvaluationResults model."""

    def test_evaluation_results_with_empty_list(self) -> None:
        """Test EvaluationResults with empty evaluations list."""
        results = EvaluationResults(
            evaluations=[],
            aggregate={},
            total_count=0,
            error_count=0,
            success_count=0,
        )
        assert results.evaluations == []
        assert results.total_count == 0
        assert results.error_count == 0
        assert results.success_count == 0

    def test_evaluation_results_with_evaluations(self) -> None:
        """Test EvaluationResults with evaluations and aggregate stats."""
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
            question="Hva er barnevern?",
            answer="Barnevernet er...",
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
        assert len(results.evaluations) == 1
        assert results.total_count == 1
        assert results.error_count == 1
        assert results.aggregate["faithfulness"].mean == 0.85
