# -*- coding: utf-8 -*-
"""Metrics module for initializing DeepEval metrics with custom LLM."""

import logging
from typing import List, cast

from deepeval import evaluate
from deepeval.evaluate.configs import CacheConfig, DisplayConfig
from deepeval.metrics import (
    AnswerRelevancyMetric,
    ContextualPrecisionMetric,
    ContextualRecallMetric,
    ContextualRelevancyMetric,
    FaithfulnessMetric,
)
from deepeval.metrics.base_metric import BaseMetric
from deepeval.test_case import LLMTestCase
from langfuse import get_client

from src.config import Config
from src.model_resolver import resolve_model
from src.models import MetricResult, MetricScores

logger = logging.getLogger(__name__)


def initialize_metrics(config: Config) -> list[BaseMetric]:
    """
    Initialize DeepEval metrics with configured LLM provider.

    Supports:
    - Ollama (local models)
    - OpenAI (gpt-4o-mini, gpt-4o, etc.)
    - Azure OpenAI (with deployment configuration)

    Note: Hallucination and Contextual Precision are excluded (Hallucination removed,
    Contextual Precision requires expected_output ground truth).

    Args:
        config: Configuration object with LLM provider settings.

    Returns:
        List of initialized metrics filtered by config.selected_metrics if specified.
    """
    # Resolve model based on provider configuration
    model = resolve_model(config)

    # Define all available metrics
    all_metrics = {
        # are the facts grounded in the context?
        "faithfulness": FaithfulnessMetric(
            model=model,
            threshold=0.7,
            include_reason=True,
        ),
        # is the answer relevant to the question?
        "answer_relevancy": AnswerRelevancyMetric(
            model=model,
            threshold=0.8,
            include_reason=True,
        ),
        # is the retrieved context relevant to the question?
        "contextual_relevancy": ContextualRelevancyMetric(
            model=model,
            threshold=0.6,
            include_reason=True,
        ),
        # are relevant documents ranked higher?
        # needs reference
        # "contextual_precision": ContextualPrecisionMetric(
        #     model=model,
        #     threshold=0.6,
        #     include_reason=True,
        # ),
        # is the retrieved context relevant to the expected output
        # needs reference
        # "contextual_recall": ContextualRecallMetric(
        #     model=model,
        #     threshold=0.6,
        #     include_reason=True,
        # ),
    }

    # Filter metrics based on selected_metrics
    if config.selected_metrics:
        # Validate that all selected metrics are available
        invalid_metrics = set(config.selected_metrics) - set(all_metrics.keys())
        if invalid_metrics:
            raise ValueError(
                f"Invalid metrics specified: {invalid_metrics}. "
                f"Available metrics: {list(all_metrics.keys())}"
            )

        selected = [all_metrics[name] for name in config.selected_metrics]
        logger.info(
            f"Initialized {len(selected)} selected DeepEval metrics: {config.selected_metrics}"
        )
        return selected
    else:
        return list(all_metrics.values())


def create_test_case(
    name: str,
    question: str,
    answer: str,
    chunks: List[str],
    additional_metadata: dict | None = None,
) -> LLMTestCase:
    """
    Create DeepEval test case from question, answer, and chunks.

    Args:
        question: The input question.
        answer: The RAG-generated answer.
        chunks: List of retrieved chunk contents.

    Returns:
        LLMTestCase for metric evaluation.
    """
    test_case = LLMTestCase(
        name=name,
        input=question,
        actual_output=answer,
        retrieval_context=chunks,
        context=chunks,  # Required for Hallucination and Faithfulness metrics
        additional_metadata=additional_metadata,
    )
    return test_case


# def calculate_metrics_batch(
#     test_cases: List[LLMTestCase], metrics: list[BaseMetric]
# ) -> List[MetricScores]:
#     """
#     Calculate all metrics for multiple test cases using DeepEval's evaluate() with caching enabled.

#     This function calls evaluate() once with all test cases to utilize DeepEval's parallelization
#     capabilities for better performance.

#     Caching is enabled via CacheConfig(use_cache=True, write_cache=True) to cache
#     LLM evaluation responses and avoid redundant API calls.

#     Note: Hallucination and Contextual Precision are excluded (Hallucination removed,
#     Contextual Precision requires expected_output ground truth).

#     Args:
#         test_cases: List of test cases to evaluate.
#         metrics: List of metric instances (FaithfulnessMetric, AnswerRelevancyMetric,
#                  ContextualRelevancyMetric).

#     Returns:
#         List of MetricScores with all calculated scores, one per test case.

#     Raises:
#         Exception: If metric calculation fails.
#     """
#     logger.info(
#         f"Calculating metrics for {len(test_cases)} test cases using evaluate() with caching enabled"
#     )

#     # Call evaluate() once with all test cases to utilize parallelization
#     result = evaluate(
#         test_cases=test_cases,
#         metrics=metrics,
#         cache_config=CacheConfig(use_cache=True, write_cache=True),
#         display_config=DisplayConfig(print_results=False, show_indicator=True),
#     )

#     # Extract scores from result
#     if result is None or not result.test_results:
#         raise ValueError("evaluate() returned no results")

#     if len(result.test_results) != len(test_cases):
#         raise ValueError(
#             f"Mismatch between test cases ({len(test_cases)}) and results ({len(result.test_results)})"
#         )

#     # Convert each test result to MetricScores
#     all_scores: List[MetricScores] = []
#     for i, test_result in enumerate(result.test_results):
#         # Extract metrics data
#         if not test_result.metrics_data:
#             logger.warning(f"No metrics data in test result {i}")
#             all_scores.append(MetricScores())
#             continue

#         # Build MetricScores dynamically from all available metrics
#         metric_results = {}
#         for metric_data in test_result.metrics_data:
#             # Log failures with details
#             if not metric_data.success:
#                 logger.warning(
#                     f"Test case {i}: Metric '{metric_data.name}' failed: score={metric_data.score}, "
#                     f"error={getattr(metric_data, 'error', None)}, "
#                     f"reason={getattr(metric_data, 'reason', None)}"
#                 )

#             metric_results[metric_data.name] = MetricResult(
#                 score=metric_data.score,
#                 success=metric_data.success,
#                 error=getattr(metric_data, "error", None),
#                 reason=getattr(metric_data, "reason", None),
#                 threshold=getattr(metric_data, "threshold", None),
#             )

#         scores = MetricScores(metrics=metric_results)
#         all_scores.append(scores)

#         # Summary for this test case
#         success_count = sum(1 for m in test_result.metrics_data if m.success)
#         logger.debug(
#             f"Test case {i}: {success_count}/{len(test_result.metrics_data)} metrics succeeded"
#         )

#     logger.info(f"Batch evaluation complete for {len(test_cases)} test cases")
#     return all_scores
