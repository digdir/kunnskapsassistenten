#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""DeepEval test file for RAG evaluation using golden questions.

Run with:
    deepeval test run evals/test_rag_eval.py

With custom arguments:
    deepeval test run evals/test_rag_eval.py -- --input-file output/test.jsonl --limit 10
    deepeval test run evals/test_rag_eval.py -- --limit 20 --faithfulness-threshold 0.8
"""

import logging
import os
import sys
from pathlib import Path
from typing import List

# Load .env file FIRST before any imports that depend on env vars
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import pytest
from deepeval import assert_test
from deepeval.metrics import (
    AnswerRelevancyMetric,
    ContextualRelevancyMetric,
    FaithfulnessMetric,
)
from deepeval.test_case import LLMTestCase

# Add parent directories to path to import project modules and agents
sys.path.insert(0, str(Path(__file__).parent.parent))  # For src module
sys.path.insert(0, str(Path(__file__).parent.parent.parent))  # For agents module

from src.config import Config, load_config
from src.model_resolver import resolve_model
from src.rag_querier import RAGQuerier, load_golden_questions

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Global variables for config and querier
_config: Config | None = None
_querier: RAGQuerier | None = None
_model = None
_test_cases: List[LLMTestCase] = []
_cli_input_file: str | None = None
_cli_limit: int | None = None


def pytest_configure(config: pytest.Config) -> None:
    """Store CLI arguments globally when pytest configures."""
    global _cli_input_file, _cli_limit
    _cli_input_file = config.getoption("--input-file", default=None)
    _cli_limit = config.getoption("--limit", default=None)

    print(f"[DEBUG] pytest_configure: input_file={_cli_input_file}, limit={_cli_limit}")
    if _cli_input_file:
        logger.info(f"Using input file from CLI: {_cli_input_file}")
    if _cli_limit:
        logger.info(f"Using limit from CLI: {_cli_limit}")


def get_config() -> Config:
    """Get or create config instance."""
    global _config
    if _config is None:
        # Priority: CLI arg > env var > default
        if _cli_input_file:
            input_file = Path(_cli_input_file)
        else:
            input_file_str = os.getenv("INPUT_FILE", "output/test.jsonl")
            input_file = Path(input_file_str)

        _config = load_config(input_file)
    return _config


def get_querier() -> RAGQuerier:
    """Get or create RAGQuerier instance."""
    global _querier
    if _querier is None:
        config = get_config()
        _querier = RAGQuerier(
            api_key=config.rag_api_key,
            api_url=config.rag_api_url,
            user_email=config.rag_api_email,
            cache_dir=config.cache_dir,
        )
    return _querier


def get_model():
    """Get or create evaluation model instance."""
    global _model
    if _model is None:
        config = get_config()
        _model = resolve_model(config)
    return _model


def load_test_cases() -> List[LLMTestCase]:
    """
    Load golden questions and convert to DeepEval test cases.

    This function loads questions from the configured input file,
    queries the RAG system, and creates test cases for evaluation.
    """
    global _test_cases
    if _test_cases:
        return _test_cases

    config = get_config()
    querier = get_querier()

    # Priority: CLI arg > env var > default
    if _cli_limit is not None:
        limit = _cli_limit
    else:
        limit = int(os.getenv("EVAL_LIMIT", "5"))

    logger.info(f"Loading up to {limit} golden questions from {config.input_file}")
    questions = load_golden_questions(config.input_file, limit=limit)

    # Query RAG for each question and create test cases
    logger.info(f"Querying RAG for {len(questions)} questions...")
    for i, question in enumerate(questions):
        try:
            # Query RAG
            response = querier.query_question(
                question=question.question,
                document_types=question.filters.get("document_types")
                if question.filters
                else None,
                organizations=question.filters.get("organizations")
                if question.filters
                else None,
            )

            # Extract chunk contents
            chunks = [chunk.content_markdown for chunk in response.chunks_used]

            # Create test case
            test_case = LLMTestCase(
                input=question.question,
                actual_output=response.answer,
                retrieval_context=chunks,
                context=chunks,
                additional_metadata={
                    "question_id": f"{question.conversation_id}_{i}",
                    "usage_mode": question.usage_mode,
                    "subject_topics": question.subject_topics,
                },
            )
            _test_cases.append(test_case)

        except Exception as e:
            logger.error(f"Failed to create test case for question {i}: {e}")
            continue

    logger.info(f"Created {len(_test_cases)} test cases")
    return _test_cases


def pytest_generate_tests(metafunc: pytest.Metafunc) -> None:
    """Generate test cases dynamically based on loaded questions."""
    if "test_case" in metafunc.fixturenames:
        # Get CLI arguments directly from config (happens before pytest_configure)
        global _cli_input_file, _cli_limit
        _cli_input_file = metafunc.config.getoption("--input-file", default=None)
        _cli_limit = metafunc.config.getoption("--limit", default=None)

        # Load test cases when pytest generates tests
        try:
            print(f"\n[DEBUG] pytest_generate_tests called for {metafunc.function.__name__}")
            print(f"[DEBUG] CLI args from config: input_file={_cli_input_file}, limit={_cli_limit}")
            test_cases = load_test_cases()
            print(f"[DEBUG] Loaded {len(test_cases)} test cases")
            if test_cases:
                metafunc.parametrize(
                    "test_case",
                    test_cases,
                    ids=[tc.additional_metadata.get("question_id", "unknown") for tc in test_cases],
                )
                print("[DEBUG] Parametrization complete")
            else:
                print("[WARNING] No test cases loaded")
        except Exception as e:
            print(f"[ERROR] Failed to load test cases: {e}")
            import traceback
            traceback.print_exc()
            # Parametrize with empty list to avoid collection errors
            metafunc.parametrize("test_case", [])


def test_faithfulness(
    test_case: LLMTestCase, faithfulness_threshold: float
) -> None:
    """Test faithfulness metric - answer should be grounded in retrieved context."""
    model = get_model()
    metric = FaithfulnessMetric(
        model=model,
        threshold=faithfulness_threshold,
        include_reason=True,
    )
    assert_test(test_case, [metric])


def test_answer_relevancy(
    test_case: LLMTestCase, answer_relevancy_threshold: float
) -> None:
    """Test answer relevancy metric - answer should be relevant to the question."""
    model = get_model()
    metric = AnswerRelevancyMetric(
        model=model,
        threshold=answer_relevancy_threshold,
        include_reason=True,
    )
    assert_test(test_case, [metric])


def test_contextual_relevancy(
    test_case: LLMTestCase, contextual_relevancy_threshold: float
) -> None:
    """Test contextual relevancy metric - retrieved chunks should be relevant to the question."""
    model = get_model()
    metric = ContextualRelevancyMetric(
        model=model,
        threshold=contextual_relevancy_threshold,
        include_reason=True,
    )
    assert_test(test_case, [metric])


def test_all_metrics(
    test_case: LLMTestCase,
    faithfulness_threshold: float,
    answer_relevancy_threshold: float,
    contextual_relevancy_threshold: float,
) -> None:
    """Test all metrics together - comprehensive evaluation."""
    model = get_model()

    faithfulness = FaithfulnessMetric(
        model=model,
        threshold=faithfulness_threshold,
        include_reason=True,
    )

    answer_relevancy = AnswerRelevancyMetric(
        model=model,
        threshold=answer_relevancy_threshold,
        include_reason=True,
    )

    contextual_relevancy = ContextualRelevancyMetric(
        model=model,
        threshold=contextual_relevancy_threshold,
        include_reason=True,
    )

    assert_test(test_case, [faithfulness, answer_relevancy, contextual_relevancy])


if __name__ == "__main__":
    # This allows running the file directly with pytest
    pytest.main([__file__, "-v"])
