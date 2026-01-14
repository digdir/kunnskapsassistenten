"""Metric aggregation and calculation functions for the dashboard.

This module provides functions to:
- Calculate global metric averages
- Filter data by metric type, subject topics, and usage mode
- Extract unique values for filtering
- Determine color coding for scores
"""

import pandas as pd


def get_unique_metric_types(df: pd.DataFrame) -> list[str]:
    """Extract all unique metric type names from the DataFrame.

    Args:
        df: DataFrame with 'metrics' column containing dict[str, MetricResult]

    Returns:
        Sorted list of unique metric type names
    """
    if df.empty:
        return []

    metric_types: set[str] = set()
    for metrics_dict in df["metrics"]:
        metric_types.update(metrics_dict.keys())

    return sorted(metric_types)


def get_unique_subject_topics(df: pd.DataFrame) -> list[str]:
    """Extract all unique subject topics from the DataFrame.

    Args:
        df: DataFrame with 'subject_topics' column containing list[str]

    Returns:
        Sorted list of unique subject topics
    """
    if df.empty:
        return []

    topics: set[str] = set()
    for topic_list in df["subject_topics"]:
        topics.update(topic_list)

    return sorted(topics)


def get_unique_usage_modes(df: pd.DataFrame) -> dict[str, list[str]]:
    """Extract all unique values for each usage mode dimension.

    Args:
        df: DataFrame with 'usage_mode' column containing UsageMode objects

    Returns:
        Dictionary with keys document_scope, operation_type, output_complexity,
        each containing a sorted list of unique values
    """
    if df.empty:
        return {
            "document_scope": [],
            "operation_type": [],
            "output_complexity": [],
        }

    document_scopes: set[str] = set()
    operation_types: set[str] = set()
    output_complexities: set[str] = set()

    for usage_mode in df["usage_mode"]:
        document_scopes.add(usage_mode.document_scope)
        operation_types.add(usage_mode.operation_type)
        output_complexities.add(usage_mode.output_complexity)

    return {
        "document_scope": sorted(document_scopes),
        "operation_type": sorted(operation_types),
        "output_complexity": sorted(output_complexities),
    }


def calculate_global_averages(df: pd.DataFrame) -> dict[str, float]:
    """Calculate global average score for each metric type.

    Args:
        df: DataFrame with 'metrics' column containing dict[str, MetricResult]

    Returns:
        Dictionary mapping metric type name to average score
    """
    if df.empty:
        return {}

    # Collect all scores per metric type
    metric_scores: dict[str, list[float]] = {}

    for metrics_dict in df["metrics"]:
        for metric_name, metric_result in metrics_dict.items():
            if metric_name not in metric_scores:
                metric_scores[metric_name] = []
            metric_scores[metric_name].append(metric_result.score)

    # Calculate averages
    averages: dict[str, float] = {}
    for metric_name, scores in metric_scores.items():
        averages[metric_name] = sum(scores) / len(scores)

    return averages


def get_color_for_score(score: float) -> str:
    """Determine color coding based on score value.

    Args:
        score: Metric score between 0.0 and 1.0

    Returns:
        Color string: 'green', 'yellow', or 'red'
    """
    if score >= 0.8:
        return "green"
    elif score >= 0.6:
        return "yellow"
    else:
        return "red"


def filter_by_metric_type(df: pd.DataFrame, metric_type: str) -> pd.DataFrame:
    """Filter DataFrame to only records that have the specified metric type.

    Args:
        df: DataFrame with 'metrics' column
        metric_type: Metric type name to filter by

    Returns:
        Filtered DataFrame
    """
    if df.empty:
        return df

    mask = df["metrics"].apply(lambda m: metric_type in m)
    return df[mask].reset_index(drop=True)


def filter_by_subject_topics(
    df: pd.DataFrame, selected_topics: list[str]
) -> pd.DataFrame:
    """Filter DataFrame to records matching any of the selected topics.

    Args:
        df: DataFrame with 'subject_topics' column
        selected_topics: List of topics to filter by (OR logic)

    Returns:
        Filtered DataFrame
    """
    if df.empty or not selected_topics:
        return df

    def has_any_topic(topic_list: list[str]) -> bool:
        return any(topic in selected_topics for topic in topic_list)

    mask = df["subject_topics"].apply(has_any_topic)
    return df[mask].reset_index(drop=True)


def filter_by_usage_mode(
    df: pd.DataFrame,
    document_scope: str | None = None,
    operation_type: str | None = None,
    output_complexity: str | None = None,
) -> pd.DataFrame:
    """Filter DataFrame by usage mode dimensions.

    All provided filters are applied with AND logic.

    Args:
        df: DataFrame with 'usage_mode' column
        document_scope: Filter by document_scope (optional)
        operation_type: Filter by operation_type (optional)
        output_complexity: Filter by output_complexity (optional)

    Returns:
        Filtered DataFrame
    """
    if df.empty:
        return df

    filtered = df.copy()

    if document_scope is not None:
        mask = filtered["usage_mode"].apply(lambda um: um.document_scope == document_scope)
        filtered = filtered[mask]

    if operation_type is not None:
        mask = filtered["usage_mode"].apply(lambda um: um.operation_type == operation_type)
        filtered = filtered[mask]

    if output_complexity is not None:
        mask = filtered["usage_mode"].apply(
            lambda um: um.output_complexity == output_complexity
        )
        filtered = filtered[mask]

    return filtered.reset_index(drop=True)
