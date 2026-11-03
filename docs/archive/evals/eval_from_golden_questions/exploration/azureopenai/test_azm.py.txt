#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Test script for Azure OpenAI Model with DeepEval evaluation."""

import logging
import os
from pathlib import Path

from deepeval import evaluate
from deepeval.evaluate.configs import CacheConfig
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric
from deepeval.models import AzureOpenAIModel
from deepeval.test_case import LLMTestCase

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def test_azure_openai_evaluation() -> None:
    """Test Azure OpenAI model with DeepEval metrics."""
    # Load required environment variables
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
    api_version = os.getenv("OPENAI_API_VERSION")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")

    if not all([api_key, deployment_name, api_version, azure_endpoint]):
        raise ValueError(
            "Missing required environment variables: "
            "AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT_NAME, "
            "OPENAI_API_VERSION, AZURE_OPENAI_ENDPOINT"
        )

    # Type assertions for type checker
    assert api_key is not None
    assert deployment_name is not None
    assert api_version is not None
    assert azure_endpoint is not None

    logger.info("=== Azure OpenAI Configuration ===")
    logger.info(f"Deployment Name (original): {deployment_name}")

    # URL-encode the deployment name to handle special characters like #
    from urllib.parse import quote

    deployment_name_encoded = quote(deployment_name, safe="")
    logger.info(f"Deployment Name (URL-encoded): {deployment_name_encoded}")

    logger.info(f"Endpoint: {azure_endpoint}")
    logger.info(f"API Version: {api_version}")
    logger.info(f"API Key: {api_key[:10]}...")

    # Construct the expected URL
    expected_url = f"{azure_endpoint}/openai/deployments/{deployment_name_encoded}/chat/completions?api-version={api_version}"
    logger.info(f"Expected API URL: {expected_url}")
    logger.info("=================================\n")

    # Validate base_url format
    if not azure_endpoint.startswith("https://"):
        logger.warning(f"Base URL should start with https://. Got: {azure_endpoint}")

    if azure_endpoint.endswith("/"):
        logger.warning("Base URL should NOT end with /. Removing trailing slash.")
        azure_endpoint = azure_endpoint.rstrip("/")

    # DeepEval's AzureOpenAI client needs the base_url to include /openai
    # NOTE: The docs are incorrect - they show base_url without /openai, but it doesn't work
    # The correct URL format is: {base_url}/openai/deployments/{deployment}/chat/completions
    base_url_with_openai = f"{azure_endpoint}/openai"
    logger.info(f"Base URL for DeepEval (with /openai): {base_url_with_openai}")

    # Initialize Azure OpenAI model
    # Note: Use URL-encoded deployment name to handle special characters like #
    model = AzureOpenAIModel(
        model=deployment_name_encoded,
        deployment_name=deployment_name_encoded,
        api_key=api_key,
        openai_api_version=api_version,
        base_url=base_url_with_openai,  # Must include /openai!
        temperature=0.0,
    )

    logger.info("Azure OpenAI model initialized successfully")

    # Create test metrics
    faithfulness = FaithfulnessMetric(
        model=model,
        threshold=0.7,
        include_reason=True,
    )

    answer_relevancy = AnswerRelevancyMetric(
        model=model,
        threshold=0.8,
        include_reason=True,
    )

    logger.info("Metrics initialized")

    # Create a simple test case
    test_case = LLMTestCase(
        input="What is the capital of Norway?",
        actual_output="The capital of Norway is Oslo, which is the largest city in the country.",
        retrieval_context=[
            "Oslo is the capital and largest city of Norway.",
            "Norway is a Scandinavian country in Northern Europe.",
        ],
        context=[
            "Oslo is the capital and largest city of Norway.",
            "Norway is a Scandinavian country in Northern Europe.",
        ],
    )

    logger.info("Test case created")

    # Run evaluation
    logger.info("Starting evaluation...")
    result = evaluate(
        test_cases=[test_case],
        metrics=[faithfulness, answer_relevancy],
        cache_config=CacheConfig(
            use_cache=True, write_cache=True
        ),  # Disable cache to see actual requests
    )

    logger.info("Evaluation completed")

    # Display results
    if result and result.test_results:
        test_result = result.test_results[0]
        logger.info("\n=== Evaluation Results ===")
        logger.info(f"Test case passed: {test_result.success}")

        for metric_data in test_result.metrics_data:
            logger.info(f"Metric: {metric_data.name}")
            logger.info(f"  Score: {metric_data.score}")
            logger.info(f"  Success: {metric_data.success}")
            logger.info(f"  Threshold: {metric_data.threshold}")
            if hasattr(metric_data, "reason") and metric_data.reason:
                logger.info(f"  Reason: {metric_data.reason}")
    else:
        logger.error("No results returned from evaluation")


if __name__ == "__main__":
    try:
        test_azure_openai_evaluation()
        logger.info(" Test completed successfully")
    except Exception as e:
        logger.error(f"\nL Test failed: {e}", exc_info=True)
        raise
