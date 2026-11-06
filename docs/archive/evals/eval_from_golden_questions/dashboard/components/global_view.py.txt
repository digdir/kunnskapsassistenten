"""Global metrics view component for the dashboard."""

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from dashboard.metrics_calc import calculate_global_averages, get_color_for_score


def render_global_metrics_view(df: pd.DataFrame) -> None:
    """Render the global metrics overview.

    Displays:
    - Total number of test cases
    - Global average scores for each metric type with color coding
    - Bar chart visualization

    Args:
        df: DataFrame containing evaluation results
    """
    st.header("Global Metrics Overview")

    # Display total test cases
    total_cases = len(df)
    st.metric(label="Total Test Cases", value=total_cases)

    if df.empty:
        st.warning("No evaluation data available.")
        return

    # Calculate global averages
    averages = calculate_global_averages(df)

    if not averages:
        st.warning("No metrics found in the data.")
        return

    # Display metrics in columns with color coding
    st.subheader("Average Scores by Metric Type")

    # Create columns for metric display
    cols = st.columns(min(3, len(averages)))

    for idx, (metric_name, avg_score) in enumerate(sorted(averages.items())):
        col = cols[idx % len(cols)]
        color = get_color_for_score(avg_score)

        with col:
            # Use color-coded background
            color_hex = {
                "green": "#28a745",
                "yellow": "#ffc107",
                "red": "#dc3545",
            }
            st.markdown(
                f"""
                <div style="padding: 15px; border-radius: 5px;
                     background-color: {color_hex[color]}; color: white;
                     text-align: center; margin-bottom: 10px;">
                    <h4 style="margin: 0; color: white;">{metric_name}</h4>
                    <h2 style="margin: 10px 0; color: white;">{avg_score:.2f}</h2>
                </div>
                """,
                unsafe_allow_html=True,
            )

    # Create bar chart
    st.subheader("Visual Comparison")
    _render_metrics_bar_chart(averages)

    # Show color legend
    st.markdown(
        """
        **Score Interpretation:**
        - 🟢 Green: ≥ 0.8 (Excellent)
        - 🟡 Yellow: 0.6 - 0.8 (Acceptable)
        - 🔴 Red: < 0.6 (Needs Improvement)
        """
    )


def _render_metrics_bar_chart(averages: dict[str, float]) -> None:
    """Render a bar chart of metric averages.

    Args:
        averages: Dictionary mapping metric names to average scores
    """
    # Sort metrics by score for better visualization
    sorted_metrics = sorted(averages.items(), key=lambda x: x[1], reverse=True)
    metric_names = [m[0] for m in sorted_metrics]
    scores = [m[1] for m in sorted_metrics]

    # Assign colors based on score
    colors = [get_color_for_score(score) for score in scores]
    color_map = {
        "green": "#28a745",
        "yellow": "#ffc107",
        "red": "#dc3545",
    }
    bar_colors = [color_map[c] for c in colors]

    # Create bar chart
    fig = go.Figure(
        data=[
            go.Bar(
                x=metric_names,
                y=scores,
                marker_color=bar_colors,
                text=[f"{s:.2f}" for s in scores],
                textposition="outside",
            )
        ]
    )

    fig.update_layout(
        title="Average Scores by Metric Type",
        xaxis_title="Metric Type",
        yaxis_title="Average Score",
        yaxis=dict(range=[0, 1.0]),
        height=400,
        showlegend=False,
    )

    st.plotly_chart(fig, width="stretch")


def render_metric_breakdown_table(df: pd.DataFrame, metric_type: str) -> None:
    """Render a detailed breakdown table for a specific metric type.

    Shows all questions with that metric, their scores, and success status.

    Args:
        df: DataFrame containing evaluation results
        metric_type: The metric type to display
    """
    st.subheader(f"Breakdown: {metric_type}")

    # Extract metric data for all questions
    rows = []
    for _, row in df.iterrows():
        if metric_type in row["metrics"]:
            metric = row["metrics"][metric_type]
            rows.append(
                {
                    "Question ID": row["question_id"],
                    "Score": metric.score,
                    "Success": "✅" if metric.success else "❌",
                    "Threshold": metric.threshold,
                    "Reason": metric.reason,
                }
            )

    if not rows:
        st.warning(f"No data found for metric type: {metric_type}")
        return

    breakdown_df = pd.DataFrame(rows)

    # Display summary
    success_rate = (
        breakdown_df["Success"].str.contains("✅").sum() / len(breakdown_df) * 100
    )
    st.metric(
        label=f"{metric_type} Success Rate",
        value=f"{success_rate:.1f}%",
    )

    # Display table with expandable reasons
    st.dataframe(
        breakdown_df,
        width="stretch",
        hide_index=True,
        column_config={
            "Score": st.column_config.NumberColumn(
                "Score",
                format="%.3f",
            ),
            "Reason": st.column_config.TextColumn(
                "Reason",
                width="large",
            ),
        },
    )
