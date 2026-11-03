# -*- coding: utf-8 -*-
"""Main CLI entry point for RAG evaluation system."""

import argparse
import logging
import sys
from pathlib import Path

from agents import AgentResponse
from dotenv import load_dotenv
from langfuse import observe

from src.config import load_config
from src.evaluate_wrapper import RateLimitError
from src.evaluator import Evaluator
from src.models import GoldenQuestion
from src.rag_querier import RAGQuerier, load_golden_questions
from src.reporter import print_summary, save_jsonl, save_rag_answers

logger = logging.getLogger(__name__)


@observe(name="eval_runner")
def main(*args, **kwargs) -> int:
    """
    Main entry point for RAG evaluation.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    # Load environment variables from .env file
    load_dotenv(".")

    try:
        args = parse_args()
        setup_logger(args)

        # Load configuration
        logger.info("Loading configuration...")
        config = load_config(input_file_path=Path(args.input))
        config.skip_deepeval_cache = args.skip_cache
        if args.metrics:
            config.selected_metrics = args.metrics
        limit = int(args.limit) if args.limit else None
        skip = int(args.skip) if args.skip else 0
        # Load golden questions
        logger.info(f"Loading golden questions from {config.input_file}...")

        questions = load_golden_questions(config.input_file, limit, skip)

        if not questions:
            logger.error("No questions loaded. Exiting.")
            return 1

        logger.info(f"Loaded {len(questions)} questions")

        rag_answers = fetch_rag_answers(config, questions)

        logger.info(
            f"Fetched {len([a for a in rag_answers if a])} RAG answers (Cache hits: {sum(1 for a in rag_answers if a.cache_hit)})"
        )

        # Save RAG answers
        rag_answers_file = config.output_dir / "rag_answers.jsonl"
        logger.info(f"Saving RAG answers to {rag_answers_file}...")
        save_rag_answers(questions, rag_answers, rag_answers_file)
        logger.debug(f"questions: {list(map(lambda i: i.id, questions))}")
        # Initialize evaluator with configuration
        logger.info("Initializing evaluator...")
        evaluator = Evaluator(config=config)

        # Run evaluation with pre-fetched RAG answers
        logger.info("Starting evaluation...")
        results = evaluator.evaluate_rag_responses(questions, rag_answers)

        # print(f"questions: {list(map(lambda i: i.conversation_id, results))}")
        # exit(0)
        # Print summary
        print_summary(results)

        # Save results
        output_file = config.output_dir / "evaluation_results.jsonl"
        logger.info(f"Saving results to {output_file}...")
        save_jsonl(results, output_file)

        logger.info("Evaluation complete!")
        return 0

    except RateLimitError as e:
        logger.error("=" * 80)
        logger.error("RATE LIMIT ERROR - Evaluation stopped")
        logger.error("=" * 80)
        logger.error(f"{e}")
        logger.error(
            "The evaluation was stopped because a rate limit was hit. "
            "Cached results have been preserved. "
            "You can resume by re-running with the same input file."
        )
        return 1
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        raise e
    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        raise e
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        raise e


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate RAG system using golden questions"
    )
    parser.add_argument(
        "input",
        type=str,
        help="Path to input JSONL file (overrides default)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging",
    )

    parser.add_argument("-l", "--limit", help="Process first n rows")
    parser.add_argument("-s", "--skip", help="Skip first n rows")
    parser.add_argument(
        "--skip-cache",
        action="store_true",
        default=False,
        help="Skip DeepEval cache (prevents returning cached failed evaluations from rate limits)",
    )
    parser.add_argument(
        "-m",
        "--metric",
        action="append",
        dest="metrics",
        help="Metric to use (can be specified multiple times). Available: faithfulness, answer_relevancy, contextual_relevancy, contextual_precision, contextual_recall",
    )

    args = parser.parse_args()
    return args


@observe(capture_input=False, capture_output=False)
def fetch_rag_answers(config, questions: list[GoldenQuestion]) -> list[AgentResponse]:
    # Initialize RAG querier
    logger.info("Initializing RAG querier...")
    rag_querier = RAGQuerier(
        api_key=config.rag_api_key,
        api_url=config.rag_api_url,
        user_email=config.rag_api_email,
        cache_dir=config.cache_dir,
    )

    # Fetch RAG answers for all questions
    logger.info("Fetching RAG answers...")
    from tqdm import tqdm

    rag_answers = list[AgentResponse]()
    for question in tqdm(questions, desc="Fetching RAG answers"):
        try:
            # Extract filters if present
            document_types = None
            organizations = None
            if question.filters:
                document_types = question.filters.get("type")
                organizations = question.filters.get("org_long")

            response = rag_querier.query_question(
                question.question,
                document_types=document_types,
                organizations=organizations,
            )
            rag_answers.append(response)
        except Exception as e:
            logger.error(
                f"Error fetching RAG answer for question '{question.question[:50]}...': {e}"
            )
            raise e

    return rag_answers


def setup_logger(args):
    # Configure logging
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / "run.log"

    # Create formatters
    formatter = logging.Formatter(
        "%(asctime)s - %(levelname)-8s - %(message)s [%(filename)s:%(lineno)d-20s]"
    )

    # Determine log level based on debug flag
    log_level = logging.DEBUG if args.debug else logging.INFO

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)

    # File handler
    file_handler = logging.FileHandler(log_file, mode="w", encoding="utf-8")
    file_handler.setLevel(log_level)
    file_handler.setFormatter(formatter)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)

    logger.info(f"Logging to file: {log_file}")
    if args.debug:
        logger.info("Debug logging enabled")

    # Disable httpx and openai INFO logs (too verbose)
    # logging.getLogger("httpx").setLevel(logging.WARNING)
    # logging.getLogger("openai").setLevel(logging.WARNING)


if __name__ == "__main__":
    raw_args = sys.argv[1:]

    parsed_args = [a for a in raw_args if "=" not in a]
    parsed_kwargs = dict(a.split("=", 1) for a in raw_args if "=" in a)

    # Pass them to main using unpacking operators
    main(*parsed_args, **parsed_kwargs)
