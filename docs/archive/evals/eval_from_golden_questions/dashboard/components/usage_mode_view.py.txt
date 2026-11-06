"""Usage mode comparison view component for the dashboard."""

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from dashboard.metrics_calc import calculate_global_averages, get_color_for_score


def render_usage_mode_comparison(df: pd.DataFrame) -> None:
    """Render a comparison view of scores across different usage modes.

    Shows metrics broken down by document_scope, operation_type, and output_complexity
    so users can quickly identify which usage modes need improvement.

    Args:
        df: DataFrame containing evaluation results
    """
    st.header("Usage Mode Comparison")
    st.markdown(
        "Compare metric scores across different usage modes to identify areas needing improvement."
    )

    if df.empty:
        st.warning("No evaluation data available.")
        return

    # Let user select which dimension to compare
    dimension = st.radio(
        "Select Usage Mode Dimension",
        ["document_scope", "operation_type", "output_complexity"],
        horizontal=True,
        help="Choose which aspect of usage mode to compare",
    )

    # Group by the selected dimension
    _render_dimension_comparison(df, dimension)


def _render_dimension_comparison(df: pd.DataFrame, dimension: str) -> None:
    """Render comparison for a specific usage mode dimension.

    Args:
        df: DataFrame containing evaluation results
        dimension: The usage mode dimension to compare (document_scope, operation_type, or output_complexity)
    """
    # Extract unique values for this dimension
    dimension_values = df["usage_mode"].apply(
        lambda x: getattr(x, dimension)
    ).unique()

    # Filter out 'unknown' if there are other values
    if len(dimension_values) > 1 and "unknown" in dimension_values:
        dimension_values = [v for v in dimension_values if v != "unknown"]

    if len(dimension_values) == 0:
        st.warning(f"No {dimension} data available.")
        return

    # Calculate metrics for each dimension value
    comparison_data = {}
    for value in sorted(dimension_values):
        # Filter data for this dimension value
        filtered_df = df[df["usage_mode"].apply(lambda x: getattr(x, dimension) == value)]

        if not filtered_df.empty:
            # Calculate averages for this subset
            averages = calculate_global_averages(filtered_df)
            comparison_data[value] = {
                "averages": averages,
                "count": len(filtered_df),
            }

    if not comparison_data:
        st.warning(f"No data available for {dimension}.")
        return

    # Display comparison table
    _render_comparison_table(comparison_data, dimension)

    # Display comparison chart
    _render_comparison_chart(comparison_data, dimension)

    # Display detailed breakdown
    _render_detailed_breakdown(comparison_data, dimension)


def _render_comparison_table(
    comparison_data: dict[str, dict], dimension: str
) -> None:
    """Render a comparison table showing scores for each dimension value.

    Args:
        comparison_data: Dictionary mapping dimension values to their metrics
        dimension: The dimension being compared
    """
    st.subheader(f"Scores by {dimension.replace('_', ' ').title()}")

    # Collect all unique metric types
    all_metrics = set()
    for data in comparison_data.values():
        all_metrics.update(data["averages"].keys())

    if not all_metrics:
        st.warning("No metrics found in the data.")
        return

    # Build table data
    rows = []
    for value, data in sorted(comparison_data.items()):
        row = {
            dimension.replace("_", " ").title(): value,
            "Count": data["count"],
        }

        # Add individual metric scores
        metric_scores = []
        for metric in sorted(all_metrics):
            score = data["averages"].get(metric, None)
            if score is not None:
                row[metric] = score
                metric_scores.append(score)
            else:
                row[metric] = None

        # Calculate total average score across all metrics
        if metric_scores:
            row["Total Avg"] = sum(metric_scores) / len(metric_scores)
        else:
            row["Total Avg"] = None

        rows.append(row)

    # Create DataFrame
    table_df = pd.DataFrame(rows)

    # Display table with color coding
    column_config = {
        metric: st.column_config.NumberColumn(
            metric,
            format="%.3f",
            help=f"Average {metric} score",
        )
        for metric in all_metrics
    }
    # Add Total Avg column config
    column_config["Total Avg"] = st.column_config.NumberColumn(
        "Total Avg",
        format="%.3f",
        help="Average score across all metrics",
    )

    st.dataframe(
        table_df,
        width="stretch",
        hide_index=True,
        column_config=column_config,
    )


def _render_comparison_chart(
    comparison_data: dict[str, dict], dimension: str
) -> None:
    """Render a grouped bar chart comparing metrics across dimension values.

    Args:
        comparison_data: Dictionary mapping dimension values to their metrics
        dimension: The dimension being compared
    """
    st.subheader("Visual Comparison")

    # Collect all unique metric types
    all_metrics = set()
    for data in comparison_data.values():
        all_metrics.update(data["averages"].keys())

    if not all_metrics:
        return

    # Create traces for each metric type
    fig = go.Figure()

    for metric in sorted(all_metrics):
        values = []
        dimension_labels = []

        for dim_value in sorted(comparison_data.keys()):
            score = comparison_data[dim_value]["averages"].get(metric)
            if score is not None:
                values.append(score)
                dimension_labels.append(dim_value)

        if values:
            fig.add_trace(
                go.Bar(
                    name=metric,
                    x=dimension_labels,
                    y=values,
                    text=[f"{v:.2f}" for v in values],
                    textposition="outside",
                )
            )

    fig.update_layout(
        title=f"Metric Scores by {dimension.replace('_', ' ').title()}",
        xaxis_title=dimension.replace("_", " ").title(),
        yaxis_title="Average Score",
        yaxis=dict(range=[0, 1.0]),
        barmode="group",
        height=500,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )

    st.plotly_chart(fig, width="stretch")


def _render_detailed_breakdown(
    comparison_data: dict[str, dict], dimension: str
) -> None:
    """Render detailed breakdown with color-coded metric cards.

    Args:
        comparison_data: Dictionary mapping dimension values to their metrics
        dimension: The dimension being compared
    """
    st.subheader("Detailed Breakdown")

    # Create expandable sections for each dimension value
    for dim_value in sorted(comparison_data.keys()):
        data = comparison_data[dim_value]
        averages = data["averages"]
        count = data["count"]

        with st.expander(f"📊 {dim_value} ({count} records)", expanded=False):
            if not averages:
                st.info("No metrics available for this usage mode.")
                continue

            # Create columns for metrics
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
                            <h5 style="margin: 0; color: white;">{metric_name}</h5>
                            <h3 style="margin: 10px 0; color: white;">{avg_score:.3f}</h3>
                        </div>
                        """,
                        unsafe_allow_html=True,
                    )
