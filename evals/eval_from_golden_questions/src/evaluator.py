# -*- coding: utf-8 -*-
"""Evaluator module for orchestrating RAG evaluation."""

import logging
import sys
from pathlib import Path
from typing import List

from tqdm import tqdm

from src.evaluate_wrapper import RateLimitError, evaluate_wrapper

# Add parent directory to path to import agents module
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from agents.agent import AgentResponse

from src.config import Config
from src.metrics import (
    create_test_case,
    initialize_metrics,
)
from src.models import EvaluationResults, GoldenQuestion, MetricScores, RAGEvaluation

logger = logging.getLogger(__name__)


class Evaluator:
    """Orchestrates the RAG evaluation process."""

    def __init__(self, config: Config) -> None:
        """
        Initialize evaluator with metrics configuration.

        Args:
            config: Configuration object with LLM provider settings.
        """
        self.config = config

        # Initialize metrics with provider configuration
        self.metrics = initialize_metrics(config)

        logger.info("Evaluator initialized with metrics")

    def evaluate_question(
        self,
        question: GoldenQuestion,
        rag_response: AgentResponse | None,
    ) -> RAGEvaluation:
        """
        Evaluate a single golden question with pre-fetched RAG response.

        Args:
            question: The golden question to evaluate.
            question_index: Index of question for ID generation.
            rag_response: Pre-fetched RAG response, or None if fetching failed.

        Returns:
            RAGEvaluation result.
        """

        try:
            # Check if RAG response was successfully fetched
            if rag_response is None:
                raise ValueError("RAG response was not fetched successfully")

            # Extract chunk contents for metrics
            chunks_content = [
                chunk.content_markdown for chunk in rag_response.chunks_used
            ]

            # Create test case
            test_case = create_test_case(
                name=question.id,
                question=question.question,
                answer=rag_response.answer,
                chunks=chunks_content,
                additional_metadata={
                    "usage_mode": question.usage_mode,
                    "subject_topics": question.subject_topics,
                },
            )

            # Calculate metrics
            scores = evaluate_wrapper(
                test_case=test_case,
                metrics=self.metrics,
                skip_cache=self.config.skip_deepeval_cache,
            )

            # Prepare chunks for output
            chunks_data = [
                {
                    "chunk_id": chunk.chunk_id,
                    "doc_title": chunk.doc_title or "",
                    "content": chunk.content_markdown,
                }
                for chunk in rag_response.chunks_used
            ]

            # Build metadata including subject_topics and usage_mode
            metadata = question.metadata.copy() if question.metadata else {}
            metadata["subject_topics"] = question.subject_topics
            metadata["usage_mode"] = question.usage_mode

            evaluation = RAGEvaluation(
                question_id=question.id,
                question=question.question,
                answer=rag_response.answer,
                chunks=chunks_data,
                metrics=scores,
                metadata=metadata,
            )

            logger.info(f"Successfully evaluated question {question.id}")
            return evaluation

        except Exception as e:
            logger.error(f"Error evaluating question {question.id}: {e}")

            # Return evaluation with error (all metrics failed)
            evaluation = RAGEvaluation(
                question_id=question.id,
                question=question.question,
                answer="",
                chunks=[],
                metrics=MetricScores(),  # All fields default to None/False
                error=str(e),
            )

            return evaluation

    def evaluate_rag_responses(
        self, questions: List[GoldenQuestion], rag_responses: List[AgentResponse]
    ) -> EvaluationResults:
        """
        Evaluate pre-fetched RAG responses for golden questions.

        This method evaluates each test case individually using evaluate_question() to ensure:
        - Resilience to rate limits (partial progress is preserved)
        - Better cache behavior (individual test case caching)
        - Error isolation (one failed test case doesn't affect others)

        Args:
            questions: List of golden questions to evaluate.
            rag_responses: List of pre-fetched RAG responses (same length as questions).

        Returns:
            EvaluationResults with all evaluations and aggregates.
        """
        if len(questions) != len(rag_responses):
            raise ValueError(
                f"Mismatch between questions ({len(questions)}) and RAG responses ({len(rag_responses)})"
            )

        logger.info(f"Starting evaluation of {len(questions)} questions")

        # Evaluate each question individually
        evaluations = self.evaluate_by_test_case(questions, rag_responses)

        # Calculate aggregates
        test_case_error_count = sum(1 for e in evaluations if e.error)
        test_case_success_count = sum(
            1
            for e in evaluations
            if not e.error
            and e.metrics.metrics
            and all(m.success for m in e.metrics.metrics.values())
        )

        aggregate = self._calculate_aggregates(evaluations)

        results = EvaluationResults(
            evaluations=evaluations,
            aggregate=aggregate,
            total_count=len(evaluations),
            error_count=test_case_error_count,
            success_count=test_case_success_count,
        )

        logger.info(
            f"Evaluation complete: {test_case_error_count} run errors, {test_case_success_count} succeeded test cases"
        )
        return results

    def evaluate_by_test_case(self, questions, rag_responses):
        evaluations: List[RAGEvaluation] = []

        for i, (question, rag_response) in enumerate(
            tqdm(
                zip(questions, rag_responses),
                total=len(questions),
                desc="Evaluating test cases",
            )
        ):
            try:
                # Evaluate single question
                evaluation = self.evaluate_question(
                    question=question,
                    rag_response=rag_response,
                )
                evaluations.append(evaluation)
            except RateLimitError:
                logger.error(
                    f"Rate limit hit on question {i + 1}/{len(questions)}. Stopping evaluation."
                )
                logger.error(
                    f"Successfully evaluated {len(evaluations)} questions before rate limit."
                )

        return evaluations

    def _calculate_aggregates(self, evaluations: List[RAGEvaluation]) -> dict:
        """Calculate aggregate statistics for metrics."""
        import statistics

        from src.models import AggregateStats

        # Filter out failed evaluations
        successful = [e for e in evaluations if e.error is None]

        if not successful:
            return {}

        # Collect all metric names from successful evaluations
        all_metric_names = set()
        for e in successful:
            all_metric_names.update(e.metrics.metrics.keys())

        aggregate = {}
        for metric_name in all_metric_names:
            # Collect scores and threshold, filtering out None values (failed metrics)
            values: List[float] = []
            threshold = None
            for e in successful:
                if metric_name in e.metrics.metrics:
                    metric_result = e.metrics.metrics[metric_name]
                    score = metric_result.score
                    if score is not None:
                        values.append(score)
                    # Get threshold from first available metric result
                    if threshold is None and metric_result.threshold is not None:
                        threshold = metric_result.threshold

            # Only calculate stats if we have valid values
            if values:
                aggregate[metric_name] = AggregateStats(
                    mean=statistics.mean(values),
                    std=statistics.stdev(values) if len(values) > 1 else 0.0,
                    min=min(values),
                    max=max(values),
                    threshold=threshold,
                )

        return aggregate
