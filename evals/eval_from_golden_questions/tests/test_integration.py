# -*- coding: utf-8 -*-
"""Integration tests for the RAG evaluation system."""

from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

from src.evaluator import Evaluator
from src.main import main
from src.models import GoldenQuestion


class TestEndToEndEvaluation:
    """Integration tests for end-to-end evaluation flow."""

    @patch("src.evaluator.initialize_metrics")
    @patch("src.evaluator.calculate_metrics_batch")
    def test_evaluator_evaluates_questions_successfully(
        self,
        mock_calculate_metrics_batch: Mock,
        mock_init_metrics: Mock,
    ) -> None:
        """Test full evaluation flow with pre-fetched RAG responses."""
        from src.config import Config
        from src.models import MetricResult, MetricScores

        # Mock RAG response
        mock_chunk = MagicMock()
        mock_chunk.chunk_id = "chunk1"
        mock_chunk.doc_title = "Test Doc"
        mock_chunk.content_markdown = "Test content"

        mock_response = MagicMock()
        mock_response.answer = "Test answer"
        mock_response.chunks_used = [mock_chunk]

        # Mock metrics
        mock_metrics = []
        for _ in range(5):
            metric = MagicMock()
            metric.score = 0.85
            metric.measure = MagicMock()
            mock_metrics.append(metric)

        mock_init_metrics.return_value = tuple(mock_metrics)

        # Mock calculate_metrics_batch() to return list of MetricScores
        mock_scores = MetricScores(
            metrics={
                "Faithfulness": MetricResult(score=0.85, success=True),
            }
        )
        mock_calculate_metrics_batch.return_value = [mock_scores]

        # Create test question
        questions = [
            GoldenQuestion(
                question="Hva er barnevern?",
                original_question="Hva er barnevern?",
                conversation_id="abc123",
                id="test_question_1",
            )
        ]

        # Pre-fetched RAG responses
        rag_responses = [mock_response]

        # Create test config
        config = Config(
            rag_api_key="test-key",
            rag_api_url="https://api.test.com",
            rag_api_email="test@test.com",
            ollama_base_url="http://localhost:11434",
            langfuse_public_key="test-public-key",
            langfuse_secret_key="test-secret-key",
            cache_dir=Path(".cache"),
            output_dir=Path("output"),
            input_file=Path("test.jsonl"),
        )

        # Initialize evaluator with config
        evaluator = Evaluator(config=config)

        # Run evaluation with pre-fetched RAG responses
        results = evaluator.evaluate_rag_responses(questions, rag_responses)

        # Verify results
        assert results.total_count == 1
        assert results.error_count == 0
        assert results.success_count == 1
        assert len(results.evaluations) == 1
        assert results.evaluations[0].question == "Hva er barnevern?"

    @patch("src.evaluator.initialize_metrics")
    def test_evaluator_handles_rag_errors_gracefully(
        self,
        mock_init_metrics: Mock,
    ) -> None:
        """Test that evaluator handles RAG API errors gracefully (None response)."""
        from src.config import Config

        # Mock metrics
        mock_metrics = []
        for _ in range(5):
            metric = MagicMock()
            metric.score = 0.0
            mock_metrics.append(metric)

        mock_init_metrics.return_value = tuple(mock_metrics)

        # Create test question
        questions = [
            GoldenQuestion(
                question="Test?",
                original_question="Test?",
                conversation_id="abc123",
                id="test_question_1",
            )
        ]

        # Simulate RAG fetch failure with None response
        rag_responses = [None]

        # Create test config
        config = Config(
            rag_api_key="test-key",
            rag_api_url="https://api.test.com",
            rag_api_email="test@test.com",
            ollama_base_url="http://localhost:11434",
            langfuse_public_key="test-public-key",
            langfuse_secret_key="test-secret-key",
            cache_dir=Path(".cache"),
            output_dir=Path("output"),
            input_file=Path("test.jsonl"),
        )

        # Initialize evaluator with config
        evaluator = Evaluator(config=config)

        # Run evaluation
        results = evaluator.evaluate_rag_responses(questions, rag_responses)

        # Verify error handling
        assert results.total_count == 1
        assert results.error_count == 1
        # success_count is 0 because the evaluation failed (empty metrics due to error)
        assert results.success_count == 0
        assert results.evaluations[0].error is not None

    @patch("src.evaluator.initialize_metrics")
    @patch("src.evaluator.calculate_metrics_batch")
    def test_evaluator_reports_batch_evaluation_errors(
        self,
        mock_calculate_metrics_batch: Mock,
        mock_init_metrics: Mock,
    ) -> None:
        """Test that evaluator properly reports batch evaluation errors as run errors."""
        from src.config import Config

        # Mock metrics initialization
        mock_metrics = []
        for _ in range(3):
            metric = MagicMock()
            mock_metrics.append(metric)
        mock_init_metrics.return_value = mock_metrics

        # Mock RAG response
        mock_chunk = MagicMock()
        mock_chunk.chunk_id = "chunk1"
        mock_chunk.doc_title = "Test Doc"
        mock_chunk.content_markdown = "Test content"

        mock_response = MagicMock()
        mock_response.answer = "Test answer"
        mock_response.chunks_used = [mock_chunk]

        # Create test questions
        questions = [
            GoldenQuestion(
                question="Question 1",
                original_question="Question 1",
                conversation_id="abc123",
                id="question_1",
            ),
            GoldenQuestion(
                question="Question 2",
                original_question="Question 2",
                conversation_id="def456",
                id="question_2",
            ),
        ]

        # Pre-fetched RAG responses
        rag_responses = [mock_response, mock_response]

        # Simulate batch evaluation failure (e.g., rate limit error)
        mock_calculate_metrics_batch.side_effect = Exception(
            "RetryError[<Future at 0x10a4c91d0 state=finished raised RateLimitError>]"
        )

        # Create test config
        config = Config(
            rag_api_key="test-key",
            rag_api_url="https://api.test.com",
            rag_api_email="test@test.com",
            ollama_base_url="http://localhost:11434",
            langfuse_public_key="test-public-key",
            langfuse_secret_key="test-secret-key",
            cache_dir=Path(".cache"),
            output_dir=Path("output"),
            input_file=Path("test.jsonl"),
        )

        # Initialize evaluator with config
        evaluator = Evaluator(config=config)

        # Run evaluation
        results = evaluator.evaluate_rag_responses(questions, rag_responses)

        # Verify error handling - both test cases should be reported as errors
        assert results.total_count == 2
        assert results.error_count == 2, f"Expected 2 errors, got {results.error_count}"
        assert results.success_count == 0
        assert all(
            e.error is not None and "Batch evaluation failed" in e.error
            for e in results.evaluations
        ), "All evaluations should have batch evaluation error set"

    @patch.dict(
        "os.environ",
        {
            "RAG_API_KEY": "test-key",
            "RAG_API_URL": "https://api.test.com",
            "RAG_API_EMAIL": "test@test.com",
            "EVAL_OLLAMA_MODEL": "test-model",
            "EVAL_OLLAMA_BASE_URL": "http://localhost:11434",
            "LANGFUSE_PUBLIC_KEY": "test-public-key",
            "LANGFUSE_SECRET_KEY": "test-secret-key",
        },
        clear=True,
    )
    @patch("src.main.RAGQuerier")
    @patch("src.main.load_golden_questions")
    @patch("src.main.Evaluator")
    @patch("src.main.save_jsonl")
    @patch("src.main.save_rag_answers")
    @patch("src.main.print_summary")
    def test_main_cli_runs_successfully(
        self,
        mock_print_summary: Mock,
        mock_save_rag_answers: Mock,
        mock_save_jsonl: Mock,
        mock_evaluator_class: Mock,
        mock_load_questions: Mock,
        mock_rag_querier_class: Mock,
    ) -> None:
        """Test main CLI runs successfully."""
        # Mock loaded questions
        mock_load_questions.return_value = [
            GoldenQuestion(
                question="Test?",
                original_question="Test?",
                conversation_id="abc123",
                id="test_question_1",
            )
        ]

        # Mock RAG querier
        mock_rag_querier = MagicMock()
        mock_rag_querier_class.return_value = mock_rag_querier
        mock_rag_response = MagicMock()
        mock_rag_querier.query_question.return_value = mock_rag_response

        # Mock evaluator
        mock_evaluator = MagicMock()
        mock_evaluator_class.return_value = mock_evaluator

        mock_results = MagicMock()
        mock_evaluator.evaluate_rag_responses.return_value = mock_results

        # Run main
        with patch("sys.argv", ["main.py", "test_input.jsonl"]):
            exit_code = main()

        assert exit_code == 0
        mock_load_questions.assert_called_once()
        mock_rag_querier_class.assert_called_once()
        mock_evaluator_class.assert_called_once()
        mock_save_rag_answers.assert_called_once()
        mock_save_jsonl.assert_called_once()
        mock_print_summary.assert_called_once()

    @patch("src.main.load_dotenv")  # Prevent loading real .env file
    @patch.dict("os.environ", {}, clear=True)
    def test_main_cli_fails_with_missing_env_vars(self, mock_load_dotenv: Mock) -> None:
        """Test main CLI raises ValueError with missing env vars."""
        import pytest

        with patch("sys.argv", ["main.py", "test_input.jsonl"]):
            with pytest.raises(
                ValueError, match="RAG_API_KEY environment variable is not set"
            ):
                main()
