"""Unit tests for dashboard data loader."""

import json
import tempfile
from pathlib import Path
from typing import Any

import pandas as pd
import pytest

from dashboard.data_loader import (
    EvaluationRecord,
    MetricResult,
    UsageMode,
    load_evaluation_results,
    parse_jsonl_record,
)


def create_test_record(
    question_id: str = "test_001",
    question: str = "Test question?",
    answer: str = "Test answer",
    metric_name: str = "Answer Relevancy",
    score: float = 0.85,
    success: bool = True,
    subject_topics: list[str] | None = None,
    document_scope: str = "single_document",
    operation_type: str = "summarization",
    output_complexity: str = "prose",
) -> dict[str, Any]:
    """Create a test evaluation record."""
    if subject_topics is None:
        subject_topics = ["Barnevern"]

    return {
        "question_id": question_id,
        "question": question,
        "answer": answer,
        "chunks": [
            {
                "chunk_id": "chunk_001",
                "doc_title": "Test Document",
                "content": "Test content",
            }
        ],
        "metrics": {
            "metrics": {
                metric_name: {
                    "score": score,
                    "success": success,
                    "error": None,
                    "reason": "Test reason",
                    "threshold": 0.8,
                }
            }
        },
        "metadata": {
            "topic": "Test topic",
            "user_id": "",
            "created": 1765181006830,
            "subject_topics": subject_topics,
            "usage_mode": {
                "document_scope": document_scope,
                "operation_type": operation_type,
                "output_complexity": output_complexity,
            },
        },
        "error": None,
    }


def test_parse_jsonl_record_with_valid_data() -> None:
    """Test parsing a valid JSONL record returns correct EvaluationRecord."""
    record_dict = create_test_record()

    result: EvaluationRecord = parse_jsonl_record(record_dict)

    assert result.question_id == "test_001"
    assert result.question == "Test question?"
    assert result.answer == "Test answer"
    assert len(result.metrics) == 1
    assert "Answer Relevancy" in result.metrics
    assert result.metrics["Answer Relevancy"].score == 0.85
    assert result.metrics["Answer Relevancy"].success is True
    assert result.subject_topics == ["Barnevern"]
    assert result.usage_mode.document_scope == "single_document"


def test_parse_jsonl_record_with_multiple_metrics() -> None:
    """Test parsing record with multiple metric types."""
    record_dict = create_test_record()
    record_dict["metrics"]["metrics"]["Faithfulness"] = {
        "score": 0.92,
        "success": True,
        "error": None,
        "reason": "High faithfulness",
        "threshold": 0.8,
    }

    result: EvaluationRecord = parse_jsonl_record(record_dict)

    assert len(result.metrics) == 2
    assert "Answer Relevancy" in result.metrics
    assert "Faithfulness" in result.metrics
    assert result.metrics["Faithfulness"].score == 0.92


def test_parse_jsonl_record_with_failed_metric() -> None:
    """Test parsing record where metric failed (success=False)."""
    record_dict = create_test_record(score=0.5, success=False)

    result: EvaluationRecord = parse_jsonl_record(record_dict)

    assert result.metrics["Answer Relevancy"].success is False
    assert result.metrics["Answer Relevancy"].score == 0.5


def test_parse_jsonl_record_with_metric_error() -> None:
    """Test parsing record where metric has an error."""
    record_dict = create_test_record()
    record_dict["metrics"]["metrics"]["Answer Relevancy"]["error"] = "API timeout"

    result: EvaluationRecord = parse_jsonl_record(record_dict)

    assert result.metrics["Answer Relevancy"].error == "API timeout"


def test_parse_jsonl_record_with_missing_metrics_raises_error() -> None:
    """Test that record without metrics raises ValueError."""
    record_dict = create_test_record()
    del record_dict["metrics"]

    with pytest.raises(ValueError, match="Missing required field: metrics"):
        parse_jsonl_record(record_dict)


def test_parse_jsonl_record_with_missing_metadata_raises_error() -> None:
    """Test that record with null metadata uses default values."""
    record_dict = create_test_record()
    record_dict["metadata"] = None

    # Should not raise an error, but use defaults
    result = parse_jsonl_record(record_dict)

    # Check that default values are used
    assert result.usage_mode.document_scope == "unknown"
    assert result.usage_mode.operation_type == "unknown"
    assert result.usage_mode.output_complexity == "unknown"
    assert result.subject_topics == []


def test_load_evaluation_results_with_valid_file() -> None:
    """Test loading evaluation results from valid JSONL file."""
    # Create temporary JSONL file with multiple records
    with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".jsonl") as f:
        # Write pretty-printed JSON (multi-line format like real file)
        record1 = create_test_record(question_id="q1", score=0.85)
        record2 = create_test_record(question_id="q2", score=0.92, metric_name="Faithfulness")
        f.write(json.dumps(record1, indent=2))
        f.write("\n")
        f.write(json.dumps(record2, indent=2))
        temp_path = f.name

    try:
        df: pd.DataFrame = load_evaluation_results(temp_path)

        assert len(df) == 2
        assert "question_id" in df.columns
        assert "question" in df.columns
        assert "metrics" in df.columns
        assert df["question_id"].tolist() == ["q1", "q2"]
    finally:
        Path(temp_path).unlink()


def test_load_evaluation_results_file_not_found() -> None:
    """Test that loading non-existent file raises FileNotFoundError."""
    with pytest.raises(FileNotFoundError):
        load_evaluation_results("/nonexistent/path/to/file.jsonl")


def test_load_evaluation_results_with_malformed_json() -> None:
    """Test that malformed JSON raises JSONDecodeError."""
    with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".jsonl") as f:
        f.write("{ invalid json content\n")
        temp_path = f.name

    try:
        with pytest.raises(json.JSONDecodeError):
            load_evaluation_results(temp_path)
    finally:
        Path(temp_path).unlink()


def test_load_evaluation_results_with_empty_file() -> None:
    """Test loading empty file returns empty DataFrame."""
    with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".jsonl") as f:
        temp_path = f.name

    try:
        df: pd.DataFrame = load_evaluation_results(temp_path)
        assert len(df) == 0
        assert isinstance(df, pd.DataFrame)
    finally:
        Path(temp_path).unlink()


def test_metric_result_dataclass() -> None:
    """Test MetricResult dataclass creation and attributes."""
    metric = MetricResult(
        score=0.85,
        success=True,
        error=None,
        reason="Test reason",
        threshold=0.8,
    )

    assert metric.score == 0.85
    assert metric.success is True
    assert metric.error is None
    assert metric.reason == "Test reason"
    assert metric.threshold == 0.8


def test_usage_mode_dataclass() -> None:
    """Test UsageMode dataclass creation and attributes."""
    usage_mode = UsageMode(
        document_scope="multi_document",
        operation_type="comparison",
        output_complexity="table",
    )

    assert usage_mode.document_scope == "multi_document"
    assert usage_mode.operation_type == "comparison"
    assert usage_mode.output_complexity == "table"


def test_evaluation_record_dataclass() -> None:
    """Test EvaluationRecord dataclass creation and attributes."""
    metrics = {
        "Answer Relevancy": MetricResult(
            score=0.85,
            success=True,
            error=None,
            reason="Good",
            threshold=0.8,
        )
    }
    usage_mode = UsageMode(
        document_scope="single_document",
        operation_type="summarization",
        output_complexity="prose",
    )

    record = EvaluationRecord(
        question_id="test_001",
        question="Test?",
        answer="Answer",
        chunks=[{"chunk_id": "c1", "doc_title": "Doc", "content": "Content"}],
        metrics=metrics,
        subject_topics=["Topic1"],
        usage_mode=usage_mode,
        error=None,
    )

    assert record.question_id == "test_001"
    assert record.question == "Test?"
    assert len(record.metrics) == 1
    assert record.subject_topics == ["Topic1"]
    assert record.usage_mode.document_scope == "single_document"
