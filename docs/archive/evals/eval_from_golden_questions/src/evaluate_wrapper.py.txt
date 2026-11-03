import hashlib
import json
from pathlib import Path

from deepeval import evaluate
from deepeval.evaluate.configs import AsyncConfig, CacheConfig, DisplayConfig
from deepeval.metrics.base_metric import BaseMetric
from deepeval.test_case import LLMTestCase
from diskcache import Cache
from langfuse import get_client

from src.metrics import logger
from src.models import MetricResult, MetricScores


class RateLimitError(Exception):
    """Raised when rate limit is hit during metric evaluation."""

    pass


# Initialize cache for metric evaluations
_CACHE_DIR = Path(".cache/metric_evaluations")
_CACHE_DIR.mkdir(parents=True, exist_ok=True)
_CACHE = Cache(str(_CACHE_DIR))


def _get_metric_cache_key(
    test_case: LLMTestCase, metric_name: str, threshold: float | None
) -> str:
    """
    Generate a cache key for a metric evaluation.

    Cache key includes:
    - test_case.input (question)
    - test_case.actual_output (RAG answer)
    - test_case.retrieval_context (chunks used)
    - metric_name (e.g., "Faithfulness")
    - threshold (e.g., 0.7)

    Args:
        test_case: The test case being evaluated.
        metric_name: Name of the metric (e.g., "Faithfulness").
        threshold: Metric threshold value.

    Returns:
        SHA256 hash of the cache key data.
    """
    cache_key_data = {
        "input": test_case.input,
        "actual_output": test_case.actual_output,
        "retrieval_context": test_case.retrieval_context,
        "metric_name": metric_name,
        "threshold": threshold,
    }
    content = json.dumps(cache_key_data, sort_keys=True)
    return hashlib.sha256(content.encode()).hexdigest()


def evaluate_wrapper(
    test_case: LLMTestCase, metrics: list[BaseMetric], skip_cache: bool = False
) -> MetricScores:
    """
    Calculate all metrics for a test case with per-metric disk caching.

    Caching behavior:
    - skip_cache=False (default): Uses diskcache to avoid redundant LLM evaluations
    - skip_cache=True: Bypasses cache and evaluates all metrics fresh

    Cache is stored per-metric based on:
    - Question (test_case.input)
    - RAG answer (test_case.actual_output)
    - Retrieved chunks (test_case.retrieval_context)
    - Metric name and threshold

    Args:
        test_case: The test case to evaluate.
        metrics: List of metric instances (FaithfulnessMetric, AnswerRelevancyMetric,
                 ContextualRelevancyMetric).
        skip_cache: If True, bypasses cache and evaluates all metrics fresh.

    Returns:
        MetricScores with all calculated scores.

    Raises:
        Exception: If metric calculation fails.
    """
    logger.debug(f"Evaluating test case '{test_case.name}' with {len(metrics)} metrics")
    if skip_cache:
        logger.info("Cache disabled - evaluating all metrics fresh")

    langfuse = get_client()
    metric_results = {}

    with langfuse.start_as_current_observation(
        as_type="evaluator", name=f"evaluate {test_case.name}"
    ) as eval:
        # Evaluate each metric individually with caching
        metrics_to_evaluate = []

        for metric in metrics:
            # Get metric name and threshold
            # Use the metric's __name__ property which matches what DeepEval returns
            metric_name = getattr(metric, "__name__", None)
            if metric_name is None:
                # Fallback to class name without "Metric" suffix
                class_name = str(metric.__class__.__name__)
                metric_name = class_name.replace("Metric", "")

            threshold = getattr(metric, "threshold", None)

            # Generate cache key
            cache_key = _get_metric_cache_key(test_case, metric_name, threshold)
            logger.debug(f"Cache key for '{metric_name}': {cache_key}")

            # Try to get from cache (unless skip_cache is True)
            if not skip_cache:
                cached_result = _CACHE.get(cache_key)
                if cached_result is not None:
                    logger.debug(f"Metric '{metric_name}' - using cached result")
                    # Ensure cached_result is a dict before unpacking
                    if isinstance(cached_result, dict):
                        metric_results[metric_name] = MetricResult(**cached_result)
                        continue

            # Need to evaluate this metric
            metrics_to_evaluate.append(metric)

        # Evaluate remaining metrics that weren't in cache
        if metrics_to_evaluate:
            logger.debug(
                f"Evaluating {len(metrics_to_evaluate)} metrics (not in cache)"
            )

            try:
                result = evaluate(
                    test_cases=[test_case],
                    metrics=metrics_to_evaluate,
                    display_config=DisplayConfig(
                        print_results=False, show_indicator=True
                    ),
                    async_config=AsyncConfig(run_async=True, max_concurrent=1),
                )
            except Exception as e:
                # Check if it's a rate limit error
                error_msg = str(e).lower()
                if "rate limit" in error_msg or "429" in error_msg:
                    logger.error(f"Rate limit hit: {e}")
                    raise RateLimitError(
                        f"Rate limit exceeded during evaluation. Stop the run. Original error: {e}"
                    ) from e
                # Re-raise other exceptions
                raise

            if result is None or not result.test_results:
                raise ValueError("evaluate() returned no results")

            test_result = result.test_results[0]

            if not test_result.metrics_data:
                raise ValueError("No metrics data in test result")

            # Process and cache the results
            for metric_data in test_result.metrics_data:
                metric_name = metric_data.name

                # Check if metric failed due to rate limit
                error_text = str(getattr(metric_data, "error", "")).lower()
                if not metric_data.success and (
                    "rate limit" in error_text or "429" in error_text
                ):
                    logger.error(
                        f"Metric '{metric_name}' failed due to rate limit: {error_text}"
                    )
                    raise RateLimitError(
                        f"Rate limit exceeded in metric '{metric_name}'. Stop the run."
                    )

                # Log failures with details
                if not metric_data.success:
                    logger.warning(
                        f"Metric '{metric_name}' failed: score={metric_data.score}, "
                        f"error={getattr(metric_data, 'error', None)}, "
                        f"reason={getattr(metric_data, 'reason', None)}"
                    )

                # Find the corresponding metric object to get the correct threshold
                threshold = None
                for m in metrics_to_evaluate:
                    # Use the metric's __name__ to match with metric_data.name
                    m_name = getattr(m, "__name__", None)
                    if m_name is None:
                        m_name = m.__class__.__name__.replace("Metric", "")
                    if m_name == metric_name:
                        threshold = getattr(m, "threshold", None)
                        break

                result_dict = {
                    "score": metric_data.score,
                    "success": metric_data.success,
                    "error": getattr(metric_data, "error", None),
                    "reason": getattr(metric_data, "reason", None),
                    "threshold": threshold,
                }

                metric_results[metric_name] = MetricResult(**result_dict)

                # Cache the result with metadata tags
                cache_key = _get_metric_cache_key(test_case, metric_name, threshold)
                _CACHE.set(
                    cache_key,
                    result_dict,
                    tag=f"metric:{metric_name},question:{test_case.name}",
                )
                logger.debug(f"Metric '{metric_name}' - cached result")

        eval.update(output={"metrics": metric_results})

    scores = MetricScores(metrics=metric_results)

    # Summary
    success_count = sum(1 for m in metric_results.values() if m.success)
    logger.info(
        f"Metrics summary: {success_count}/{len(metric_results)} succeeded "
        f"({len(metrics) - len(metrics_to_evaluate)} from cache)"
    )

    return scores


# # Claude created this to fix run errors
# def calculate_metrics_measure(
#     test_case: LLMTestCase, metrics: list[BaseMetric]
# ) -> MetricScores:
#     """
#     Calculate all metrics for a test case using DeepEval's evaluate() with caching enabled.

#     Caching is enabled via CacheConfig(use_cache=True, write_cache=True) to cache
#     LLM evaluation responses and avoid redundant API calls.

#     Note: Hallucination and Contextual Precision are excluded (Hallucination removed,
#     Contextual Precision requires expected_output ground truth).

#     Args:
#         test_case: The test case to evaluate.
#         metrics: List of metric instances (FaithfulnessMetric, AnswerRelevancyMetric,
#                  ContextualRelevancyMetric).

#     Returns:
#         MetricScores with all calculated scores.

#     Raises:
#         Exception: If metric calculation fails.
#     """
#     import logging as stdlib_logging
#     import os

#     logger.debug(
#         "Calculating metrics for test case using evaluate() with caching enabled"
#     )

#     # Set timeout to 10 minutes (600 seconds) if not already set
#     if "DEEPEVAL_PER_ATTEMPT_TIMEOUT_SECONDS_OVERRIDE" not in os.environ:
#         os.environ["DEEPEVAL_PER_ATTEMPT_TIMEOUT_SECONDS_OVERRIDE"] = "600"
#         logger.info("Set DeepEval timeout to 600 seconds (10 minutes)")

#     # Enable detailed DeepEval logging
#     deepeval_logger = stdlib_logging.getLogger("deepeval")
#     deepeval_logger.setLevel(stdlib_logging.DEBUG)
#     logger.info("Enabled DeepEval debug logging")

#     # Suppress DeepEval's verbose output
#     langfuse = get_client()

#     # Log test case details for debugging
#     logger.info(
#         f"Test case: input={test_case.input[:100] if test_case.input else None}..."
#     )
#     logger.info(
#         f"Test case: actual_output={test_case.actual_output[:100] if test_case.actual_output else None}..."
#     )
#     logger.info(
#         f"Test case: retrieval_context count={len(test_case.retrieval_context) if test_case.retrieval_context else 0}"
#     )
#     logger.info(
#         f"Test case: context count={len(test_case.context) if test_case.context else 0}"
#     )

#     # Due to DeepEval async bug (https://github.com/confident-ai/deepeval/issues/2298),
#     # the evaluate() function doesn't properly wait for async metrics to complete.
#     # We call measure() directly on each metric with manual caching.
#     logger.info(
#         f"Measuring {len(metrics)} metrics directly (bypassing evaluate() async bug)..."
#     )

#     # Check cache for this test case
#     import hashlib
#     import json

#     from diskcache import Cache

#     cache_dir = ".cache/deepeval_metrics"
#     cache = Cache(cache_dir)

#     # Create cache key from test case
#     cache_key_data = {
#         "input": test_case.input,
#         "actual_output": test_case.actual_output,
#         "retrieval_context": test_case.retrieval_context,
#     }
#     cache_key = hashlib.sha256(
#         json.dumps(cache_key_data, sort_keys=True).encode()
#     ).hexdigest()

#     metric_results = {}
#     with langfuse.start_as_current_observation(
#         as_type="evaluator", name=f"evaluate {test_case.name}"
#     ) as eval:
#         for metric in metrics:
#             # Get metric name from class name
#             class_name = str(metric.__class__.__name__)
#             metric_name = class_name.replace("Metric", "")
#             metric_cache_key = f"{cache_key}:{metric_name}"

#             # Try to get from cache
#             cached_result = cache.get(metric_cache_key)
#             if cached_result is not None:
#                 logger.info(f"Metric '{metric_name}' - using cached result")
#                 # Ensure cached_result is a dict
#                 if isinstance(cached_result, dict):
#                     metric_results[metric_name] = MetricResult(**cached_result)
#                     continue

#             try:
#                 logger.info(f"Measuring metric: {metric_name}")
#                 metric.measure(test_case)

#                 result_dict = {
#                     "score": metric.score,
#                     "success": metric.success if metric.success is not None else False,
#                     "error": getattr(metric, "error", None),
#                     "reason": getattr(metric, "reason", None),
#                     "threshold": metric.threshold,
#                 }

#                 logger.info(
#                     f"Metric '{metric_name}' result: "
#                     f"score={metric.score}, success={metric.success}"
#                 )

#                 metric_results[metric_name] = MetricResult(**result_dict)

#                 # Cache the result
#                 cache.set(metric_cache_key, result_dict)

#             except Exception as e:
#                 logger.error(
#                     f"Metric '{metric_name}' failed with exception: {e}", exc_info=True
#                 )
#                 metric_results[metric_name] = MetricResult(
#                     score=None,
#                     success=False,
#                     error=str(e),
#                     reason=None,
#                     threshold=metric.threshold,
#                 )

#         eval.update(output={"metrics": metric_results})

#     scores = MetricScores(metrics=metric_results)

#     # Summary
#     success_count = sum(1 for m in metric_results.values() if m.success)
#     logger.info(f"Metrics summary: {success_count}/{len(metric_results)} succeeded")

#     return scores
