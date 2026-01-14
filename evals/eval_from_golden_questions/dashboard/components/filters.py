"""Filter UI components for the dashboard."""

from typing import Any

import pandas as pd
import streamlit as st

from dashboard.metrics_calc import (
    get_unique_metric_types,
    get_unique_subject_topics,
    get_unique_usage_modes,
)


def render_filters(df: pd.DataFrame) -> dict[str, Any]:
    """Render filter UI components and return selected filter values.

    Args:
        df: DataFrame containing evaluation results

    Returns:
        Dictionary with filter selections:
        - metric_type: str | None
        - subject_topics: list[str]
        - document_scope: str | None
        - operation_type: str | None
        - output_complexity: str | None
    """
    st.sidebar.header("Filters")

    filters: dict[str, Any] = {
        "metric_type": None,
        "subject_topics": [],
        "document_scope": None,
        "operation_type": None,
        "output_complexity": None,
    }

    # Metric Type filter
    st.sidebar.subheader("Metric Type")
    metric_types = get_unique_metric_types(df)
    if metric_types:
        selected_metric = st.sidebar.selectbox(
            "Select Metric Type",
            ["All"] + metric_types,
            index=0,
            key="metric_type_filter",
        )
        if selected_metric != "All":
            filters["metric_type"] = selected_metric

    # Subject Topics filter
    st.sidebar.subheader("Subject Topics")
    subject_topics = get_unique_subject_topics(df)
    if subject_topics:
        selected_topics = st.sidebar.multiselect(
            "Select Subject Topics",
            subject_topics,
            default=[],
            key="subject_topics_filter",
        )
        filters["subject_topics"] = selected_topics

    # Usage Mode filters
    st.sidebar.subheader("Usage Mode")
    usage_modes = get_unique_usage_modes(df)

    # Document Scope
    if usage_modes["document_scope"]:
        selected_scope = st.sidebar.selectbox(
            "Document Scope",
            ["All"] + usage_modes["document_scope"],
            index=0,
            key="document_scope_filter",
        )
        if selected_scope != "All":
            filters["document_scope"] = selected_scope

    # Operation Type
    if usage_modes["operation_type"]:
        selected_operation = st.sidebar.selectbox(
            "Operation Type",
            ["All"] + usage_modes["operation_type"],
            index=0,
            key="operation_type_filter",
        )
        if selected_operation != "All":
            filters["operation_type"] = selected_operation

    # Output Complexity
    if usage_modes["output_complexity"]:
        selected_complexity = st.sidebar.selectbox(
            "Output Complexity",
            ["All"] + usage_modes["output_complexity"],
            index=0,
            key="output_complexity_filter",
        )
        if selected_complexity != "All":
            filters["output_complexity"] = selected_complexity

    return filters


def apply_filters(df: pd.DataFrame, filters: dict[str, Any]) -> pd.DataFrame:
    """Apply all selected filters to the DataFrame.

    Args:
        df: Original DataFrame
        filters: Dictionary of filter selections from render_filters()

    Returns:
        Filtered DataFrame
    """
    from dashboard.metrics_calc import (
        filter_by_metric_type,
        filter_by_subject_topics,
        filter_by_usage_mode,
    )

    filtered = df.copy()

    # Apply metric type filter
    if filters.get("metric_type"):
        filtered = filter_by_metric_type(filtered, filters["metric_type"])

    # Apply subject topics filter
    if filters.get("subject_topics"):
        filtered = filter_by_subject_topics(filtered, filters["subject_topics"])

    # Apply usage mode filters
    filtered = filter_by_usage_mode(
        filtered,
        document_scope=filters.get("document_scope"),
        operation_type=filters.get("operation_type"),
        output_complexity=filters.get("output_complexity"),
    )

    return filtered
