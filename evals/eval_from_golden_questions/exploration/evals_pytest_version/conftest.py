# -*- coding: utf-8 -*-
"""Pytest configuration for DeepEval tests with custom command line arguments.

This allows passing custom arguments to the test suite:
    deepeval test run evals/test_rag_eval.py -- --input-file output/test.jsonl --limit 10
"""

import pytest


def pytest_addoption(parser: pytest.Parser) -> None:
    """Add custom command line options."""
    parser.addoption(
        "--input-file",
        action="store",
        default=None,
        help="Path to golden questions JSONL file (overrides INPUT_FILE env var)",
    )
    parser.addoption(
        "--limit",
        action="store",
        type=int,
        default=None,
        help="Number of questions to evaluate (overrides EVAL_LIMIT env var)",
    )
    parser.addoption(
        "--faithfulness-threshold",
        action="store",
        type=float,
        default=None,
        help="Threshold for faithfulness metric (default: 0.7)",
    )
    parser.addoption(
        "--answer-relevancy-threshold",
        action="store",
        type=float,
        default=None,
        help="Threshold for answer relevancy metric (default: 0.8)",
    )
    parser.addoption(
        "--contextual-relevancy-threshold",
        action="store",
        type=float,
        default=None,
        help="Threshold for contextual relevancy metric (default: 0.6)",
    )


@pytest.fixture(scope="session")
def input_file(request: pytest.FixtureRequest) -> str | None:
    """Get input file from command line or None."""
    return request.config.getoption("--input-file")


@pytest.fixture(scope="session")
def limit(request: pytest.FixtureRequest) -> int | None:
    """Get limit from command line or None."""
    return request.config.getoption("--limit")


@pytest.fixture(scope="session")
def faithfulness_threshold(request: pytest.FixtureRequest) -> float:
    """Get faithfulness threshold from command line or default."""
    threshold = request.config.getoption("--faithfulness-threshold")
    return threshold if threshold is not None else 0.7


@pytest.fixture(scope="session")
def answer_relevancy_threshold(request: pytest.FixtureRequest) -> float:
    """Get answer relevancy threshold from command line or default."""
    threshold = request.config.getoption("--answer-relevancy-threshold")
    return threshold if threshold is not None else 0.8


@pytest.fixture(scope="session")
def contextual_relevancy_threshold(request: pytest.FixtureRequest) -> float:
    """Get contextual relevancy threshold from command line or default."""
    threshold = request.config.getoption("--contextual-relevancy-threshold")
    return threshold if threshold is not None else 0.6
