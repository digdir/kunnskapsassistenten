"""Unit tests for metrics calculation functions."""

import pandas as pd
import pytest

from dashboard.data_loader import EvaluationRecord, MetricResult, UsageMode
from dashboard.metrics_calc import (
    calculate_global_averages,
    filter_by_metric_type,
    filter_by_subject_topics,
    filter_by_usage_mode,
    get_color_for_score,
    get_unique_metric_types,
    get_unique_subject_topics,
    get_unique_usage_modes,
)


def create_test_dataframe() -> pd.DataFrame:
    """Create a test DataFrame with evaluation records."""
    records = [
        EvaluationRecord(
            question_id="q1",
            question="Question 1",
            answer="Answer 1",
            chunks=[],
            metrics={
                "Answer Relevancy": MetricResult(0.85, True, None, "Good", 0.8),
                "Faithfulness": MetricResult(0.92, True, None, "Excellent", 0.8),
            },
            subject_topics=["Barnevern"],
            usage_mode=UsageMode("single_document", "summarization", "prose"),
            error=None,
        ),
        EvaluationRecord(
            question_id="q2",
            question="Question 2",
            answer="Answer 2",
            chunks=[],
            metrics={
                "Answer Relevancy": MetricResult(0.75, True, None, "Acceptable", 0.8),
                "Faithfulness": MetricResult(0.88, True, None, "Good", 0.8),
            },
            subject_topics=["Utdanning og forskning"],
            usage_mode=UsageMode("multi_document", "comparison", "table"),
            error=None,
        ),
        EvaluationRecord(
            question_id="q3",
            question="Question 3",
            answer="Answer 3",
            chunks=[],
            metrics={
                "Answer Relevancy": MetricResult(0.55, False, None, "Poor", 0.8),
                "Contextual Relevancy": MetricResult(0.65, False, None, "Below threshold", 0.8),
            },
            subject_topics=["Barnevern", "Justis og rettsvesen"],
            usage_mode=UsageMode("single_document", "summarization", "prose"),
            error=None,
        ),
    ]

    data = {
        "question_id": [r.question_id for r in records],
        "question": [r.question for r in records],
        "answer": [r.answer for r in records],
        "chunks": [r.chunks for r in records],
        "metrics": [r.metrics for r in records],
        "subject_topics": [r.subject_topics for r in records],
        "usage_mode": [r.usage_mode for r in records],
        "error": [r.error for r in records],
    }

    return pd.DataFrame(data)


def test_get_unique_metric_types() -> None:
    """Test extracting unique metric types from DataFrame."""
    df = create_test_dataframe()

    metric_types: list[str] = get_unique_metric_types(df)

    assert len(metric_types) == 3
    assert "Answer Relevancy" in metric_types
    assert "Faithfulness" in metric_types
    assert "Contextual Relevancy" in metric_types
    assert metric_types == sorted(metric_types)  # Should be sorted


def test_get_unique_metric_types_empty_dataframe() -> None:
    """Test extracting unique metric types from empty DataFrame."""
    df = pd.DataFrame()

    metric_types: list[str] = get_unique_metric_types(df)

    assert metric_types == []


def test_get_unique_subject_topics() -> None:
    """Test extracting unique subject topics from DataFrame."""
    df = create_test_dataframe()

    topics: list[str] = get_unique_subject_topics(df)

    assert len(topics) == 3
    assert "Barnevern" in topics
    assert "Utdanning og forskning" in topics
    assert "Justis og rettsvesen" in topics
    assert topics == sorted(topics)  # Should be sorted


def test_get_unique_usage_modes() -> None:
    """Test extracting unique usage mode values from DataFrame."""
    df = create_test_dataframe()

    usage_modes = get_unique_usage_modes(df)

    assert "document_scope" in usage_modes
    assert "operation_type" in usage_modes
    assert "output_complexity" in usage_modes

    assert usage_modes["document_scope"] == ["multi_document", "single_document"]
    assert usage_modes["operation_type"] == ["comparison", "summarization"]
    assert usage_modes["output_complexity"] == ["prose", "table"]


def test_calculate_global_averages() -> None:
    """Test calculating global average scores per metric type."""
    df = create_test_dataframe()

    averages: dict[str, float] = calculate_global_averages(df)

    # Answer Relevancy: (0.85 + 0.75 + 0.55) / 3 = 0.7166...
    assert "Answer Relevancy" in averages
    assert abs(averages["Answer Relevancy"] - 0.7167) < 0.01

    # Faithfulness: (0.92 + 0.88) / 2 = 0.90
    assert "Faithfulness" in averages
    assert abs(averages["Faithfulness"] - 0.90) < 0.01

    # Contextual Relevancy: 0.65 / 1 = 0.65
    assert "Contextual Relevancy" in averages
    assert abs(averages["Contextual Relevancy"] - 0.65) < 0.01


def test_calculate_global_averages_empty_dataframe() -> None:
    """Test calculating global averages from empty DataFrame."""
    df = pd.DataFrame()

    averages: dict[str, float] = calculate_global_averages(df)

    assert averages == {}


def test_get_color_for_score_green() -> None:
    """Test color coding for scores >= 0.8 (green)."""
    assert get_color_for_score(0.8) == "green"
    assert get_color_for_score(0.85) == "green"
    assert get_color_for_score(1.0) == "green"


def test_get_color_for_score_yellow() -> None:
    """Test color coding for scores 0.6 <= score < 0.8 (yellow)."""
    assert get_color_for_score(0.6) == "yellow"
    assert get_color_for_score(0.7) == "yellow"
    assert get_color_for_score(0.79) == "yellow"


def test_get_color_for_score_red() -> None:
    """Test color coding for scores < 0.6 (red)."""
    assert get_color_for_score(0.0) == "red"
    assert get_color_for_score(0.3) == "red"
    assert get_color_for_score(0.59) == "red"


def test_filter_by_metric_type() -> None:
    """Test filtering DataFrame to only records with specific metric type."""
    df = create_test_dataframe()

    filtered: pd.DataFrame = filter_by_metric_type(df, "Answer Relevancy")

    assert len(filtered) == 3  # All records have Answer Relevancy

    filtered_faith: pd.DataFrame = filter_by_metric_type(df, "Faithfulness")
    assert len(filtered_faith) == 2  # Only q1 and q2 have Faithfulness

    filtered_context: pd.DataFrame = filter_by_metric_type(df, "Contextual Relevancy")
    assert len(filtered_context) == 1  # Only q3 has Contextual Relevancy


def test_filter_by_metric_type_nonexistent() -> None:
    """Test filtering by non-existent metric type returns empty DataFrame."""
    df = create_test_dataframe()

    filtered: pd.DataFrame = filter_by_metric_type(df, "Nonexistent Metric")

    assert len(filtered) == 0
    assert isinstance(filtered, pd.DataFrame)


def test_filter_by_subject_topics_single() -> None:
    """Test filtering by single subject topic."""
    df = create_test_dataframe()

    filtered: pd.DataFrame = filter_by_subject_topics(df, ["Barnevern"])

    assert len(filtered) == 2  # q1 and q3 have Barnevern
    assert filtered["question_id"].tolist() == ["q1", "q3"]


def test_filter_by_subject_topics_multiple() -> None:
    """Test filtering by multiple subject topics (OR logic)."""
    df = create_test_dataframe()

    filtered: pd.DataFrame = filter_by_subject_topics(
        df, ["Barnevern", "Utdanning og forskning"]
    )

    assert len(filtered) == 3  # All records match at least one topic


def test_filter_by_subject_topics_empty_list() -> None:
    """Test that empty subject topics list returns original DataFrame."""
    df = create_test_dataframe()

    filtered: pd.DataFrame = filter_by_subject_topics(df, [])

    assert len(filtered) == len(df)


def test_filter_by_usage_mode_document_scope() -> None:
    """Test filtering by document_scope."""
    df = create_test_dataframe()

    filtered: pd.DataFrame = filter_by_usage_mode(
        df, document_scope="single_document"
    )

    assert len(filtered) == 2  # q1 and q3
    assert filtered["question_id"].tolist() == ["q1", "q3"]


def test_filter_by_usage_mode_operation_type() -> None:
    """Test filtering by operation_type."""
    df = create_test_dataframe()

    filtered: pd.DataFrame = filter_by_usage_mode(df, operation_type="summarization")

    assert len(filtered) == 2  # q1 and q3


def test_filter_by_usage_mode_output_complexity() -> None:
    """Test filtering by output_complexity."""
    df = create_test_dataframe()

    filtered: pd.DataFrame = filter_by_usage_mode(df, output_complexity="table")

    assert len(filtered) == 1  # Only q2
    assert filtered["question_id"].iloc[0] == "q2"


def test_filter_by_usage_mode_multiple_dimensions() -> None:
    """Test filtering by multiple usage mode dimensions (AND logic)."""
    df = create_test_dataframe()

    filtered: pd.DataFrame = filter_by_usage_mode(
        df,
        document_scope="single_document",
        operation_type="summarization",
        output_complexity="prose",
    )

    assert len(filtered) == 2  # q1 and q3 match all criteria


def test_filter_by_usage_mode_no_filters() -> None:
    """Test that no filters returns original DataFrame."""
    df = create_test_dataframe()

    filtered: pd.DataFrame = filter_by_usage_mode(df)

    assert len(filtered) == len(df)
