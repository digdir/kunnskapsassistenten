"""Individual question detail view component for the dashboard."""

from typing import Any

import pandas as pd
import streamlit as st


def render_question_selector(df: pd.DataFrame) -> str | None:
    """Render a question selector and return the selected question ID.

    Args:
        df: DataFrame containing evaluation results

    Returns:
        Selected question ID or None if no selection
    """
    if df.empty:
        return None

    st.subheader("Select a Question for Details")

    # Create options with question ID and truncated question text
    options = ["None"] + [
        f"{row['question_id']}: {row['question'][:60]}..."
        if len(row["question"]) > 60
        else f"{row['question_id']}: {row['question']}"
        for _, row in df.iterrows()
    ]

    selected = st.selectbox(
        "Choose a question to view details",
        options,
        index=0,
        key="question_selector",
    )

    if selected == "None":
        return None

    # Extract question ID from selection
    question_id = selected.split(":")[0]
    return question_id


def render_question_detail(df: pd.DataFrame, question_id: str) -> None:
    """Render detailed view of a single question.

    Displays:
    - Question text
    - Answer text
    - All metrics with scores, reasons, and thresholds
    - Retrieved chunks (expandable)
    - Metadata

    Args:
        df: DataFrame containing evaluation results
        question_id: ID of the question to display
    """
    # Find the question
    question_row = df[df["question_id"] == question_id]

    if question_row.empty:
        st.error(f"Question not found: {question_id}")
        return

    row = question_row.iloc[0]

    st.header(f"Question Details: {question_id}")

    # Question and Answer
    st.subheader("Question")
    st.write(row["question"])

    st.subheader("Answer")
    st.write(row["answer"])

    # Error (if any)
    if row["error"]:
        st.error(f"Error: {row['error']}")

    # Metrics
    st.subheader("Metrics")
    _render_metrics_table(row["metrics"])

    # Subject Topics
    st.subheader("Subject Topics")
    st.write(", ".join(row["subject_topics"]))

    # Usage Mode
    st.subheader("Usage Mode")
    usage_mode = row["usage_mode"]
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Document Scope", usage_mode.document_scope)
    with col2:
        st.metric("Operation Type", usage_mode.operation_type)
    with col3:
        st.metric("Output Complexity", usage_mode.output_complexity)

    # Retrieved Chunks
    st.subheader("Retrieved Chunks")
    _render_chunks(row["chunks"])


def _render_metrics_table(metrics: dict[str, Any]) -> None:
    """Render a table of all metrics for a question.

    Args:
        metrics: Dictionary mapping metric names to MetricResult objects
    """
    if not metrics:
        st.info("No metrics available.")
        return

    rows = []
    for metric_name, metric_result in metrics.items():
        rows.append(
            {
                "Metric": metric_name,
                "Score": f"{metric_result.score:.3f}",
                "Success": "✅" if metric_result.success else "❌",
                "Threshold": f"{metric_result.threshold:.2f}",
                "Reason": metric_result.reason,
                "Error": metric_result.error if metric_result.error else "None",
            }
        )

    metrics_df = pd.DataFrame(rows)
    st.dataframe(
        metrics_df,
        width="stretch",
        hide_index=True,
        column_config={
            "Reason": st.column_config.TextColumn(
                "Reason",
                width="large",
            ),
        },
    )


def _render_chunks(chunks: list[dict[str, Any]]) -> None:
    """Render retrieved chunks with expandable content.

    Args:
        chunks: List of chunk dictionaries with chunk_id, doc_title, and content
    """
    if not chunks:
        st.info("No chunks available.")
        return

    st.write(f"Total chunks retrieved: {len(chunks)}")

    for idx, chunk in enumerate(chunks, 1):
        with st.expander(f"Chunk {idx}: {chunk.get('chunk_id', 'Unknown ID')}"):
            doc_title = chunk.get("doc_title", "")
            if doc_title:
                st.markdown(f"**Document:** {doc_title}")

            st.markdown(f"**Chunk ID:** {chunk.get('chunk_id', 'Unknown')}")

            content = chunk.get("content", "")
            if content:
                st.text_area(
                    "Content",
                    value=content,
                    height=200,
                    disabled=True,
                    key=f"chunk_content_{idx}_{chunk.get('chunk_id', idx)}",
                )
            else:
                st.info("No content available.")
