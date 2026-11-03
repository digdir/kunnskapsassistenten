"""Main Streamlit application for RAG evaluation dashboard.

Run with: streamlit run dashboard/app.py
"""

import json
import sys
from pathlib import Path

import streamlit as st

# Add project root to path for imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dashboard.components.detail_view import (
    render_question_detail,
    render_question_selector,
)
from dashboard.components.filters import apply_filters, render_filters
from dashboard.components.global_view import (
    render_global_metrics_view,
    render_metric_breakdown_table,
)
from dashboard.components.usage_mode_view import render_usage_mode_comparison
from dashboard.data_loader import load_evaluation_results
from dashboard.metrics_calc import get_unique_metric_types

# Page configuration
st.set_page_config(
    page_title="RAG Evaluation Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Title
st.title("📊 RAG Evaluation Dashboard")
st.markdown("Visualize and analyze RAG system evaluation results")

# Data file path
DATA_FILE = project_root / "output" / "all40_evaluation_results.jsonl"


@st.cache_data
def load_data(file_path: Path) -> tuple[object, str | None]:
    """Load evaluation data with error handling.

    Args:
        file_path: Path to the JSONL file

    Returns:
        Tuple of (DataFrame or None, error_message or None)
    """
    try:
        df = load_evaluation_results(str(file_path))
        return df, None
    except FileNotFoundError:
        return None, f"Data file not found: {file_path}"
    except json.JSONDecodeError as e:
        return None, f"Invalid JSON format: {e}"
    except Exception as e:
        return None, f"Error loading data: {e}"


def main() -> None:
    """Main application logic."""
    # Load data
    with st.spinner("Loading evaluation results..."):
        df, error = load_data(DATA_FILE)

    # Handle errors
    if error:
        st.error(error)
        st.info(f"Please ensure the evaluation results file exists at: {DATA_FILE}")
        return

    if df is None or df.empty:
        st.warning("No evaluation data available.")
        return

    # Render filters in sidebar
    filters = render_filters(df)

    # Apply filters
    filtered_df = apply_filters(df, filters)

    # Display filter status
    if len(filtered_df) < len(df):
        st.info(
            f"Showing {len(filtered_df)} of {len(df)} total records "
            f"(filtered by active selections)"
        )

    # Main content area
    if filtered_df.empty:
        st.warning(
            "No records match the selected filters. Try adjusting or clearing filters."
        )
        return

    # Create tabs for different views
    tab1, tab2, tab3, tab4 = st.tabs(
        ["📈 Global Metrics", "🔀 Usage Mode Comparison", "🔍 Metric Breakdown", "📝 Question Details"]
    )

    with tab1:
        render_global_metrics_view(filtered_df)

    with tab2:
        render_usage_mode_comparison(filtered_df)

    with tab3:
        st.header("Metric Type Breakdown")

        # Get available metric types
        metric_types = get_unique_metric_types(filtered_df)

        if metric_types:
            selected_metric = st.selectbox(
                "Select Metric Type for Detailed Breakdown",
                metric_types,
                key="breakdown_metric_selector",
            )

            if selected_metric:
                render_metric_breakdown_table(filtered_df, selected_metric)
        else:
            st.warning("No metrics available in the filtered data.")

    with tab4:
        st.header("Individual Question Details")

        selected_question_id = render_question_selector(filtered_df)

        if selected_question_id:
            render_question_detail(filtered_df, selected_question_id)
        else:
            st.info("Select a question above to view detailed information.")

    # Footer
    st.markdown("---")
    st.markdown(
        f"""
        <div style="text-align: center; color: #666; font-size: 0.9em;">
            Data loaded from: {DATA_FILE}<br>
            Total records: {len(df)} | Filtered records: {len(filtered_df)}
        </div>
        """,
        unsafe_allow_html=True,
    )


if __name__ == "__main__":
    main()
