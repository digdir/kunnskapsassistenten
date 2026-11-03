"""Main script to orchestrate golden questions extraction pipeline."""

import json
import logging
from pathlib import Path
from typing import List, Union

from openai import AzureOpenAI, OpenAI
from tqdm import tqdm

from .categorizer_llm import categorize_questions_llm
from .deduplicator import deduplicate_questions
from .extractor import _save_failed_reformulations, extract_golden_questions
from .filter import filter_conversations
from .llm_provider import (
    LLMConfig,
    create_llm_client,
    get_chat_model_name,
    get_embedding_model_name,
)
from .loader import load_conversations
from .models import GoldenQuestion
from .subject_categorizer_llm import categorize_subject_topics

# Configure logging
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)
log_file = log_dir / "golden_questions.log"

# Create formatters
formatter = logging.Formatter("%(asctime)s - %(name)-20s - %(levelname)-8s - %(message)s")

# Console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)

# File handler
file_handler = logging.FileHandler(log_file, mode="w", encoding="utf-8")
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(formatter)

# Configure root logger
root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
root_logger.addHandler(console_handler)
root_logger.addHandler(file_handler)

logger = logging.getLogger(__name__)
logger.info(f"Logging to file: {log_file}")

# Disable httpx and openai INFO logs (too verbose)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)


def process_conversations(
    input_file: str,
    output_file: str,
    llm_config: LLMConfig,
    batch_size: int = 10,
    limit: int | None = None,
    show_cache_stats: bool = False,
) -> None:
    """
    Process conversations and extract golden questions.

    Pipeline:
    1. Load conversations from JSONL
    2. Filter for quality
    3. Extract questions (with unique IDs and document types)
    4. Categorize by usage mode (using LLM)
    5. Categorize by subject topics (using LLM)
    6. Deduplicate
    7. Save to output JSONL

    Args:
        input_file: Path to input JSONL file
        output_file: Path to output JSONL file
        llm_config: LLM provider configuration
        batch_size: Number of concurrent LLM requests (default: 10)
        limit: Optional limit on number of conversations to process
        show_cache_stats: Whether to show cache statistics at end (default: False)
    """
    logger.info("Starting golden questions extraction pipeline")
    logger.info(f"Input: {input_file}")
    logger.info(f"Output: {output_file}")
    logger.info(f"Batch Size: {batch_size}")
    if limit:
        logger.info(f"Limit: {limit} conversations")

    # Create LLM clients and get model names
    chat_client = create_llm_client(llm_config)
    embedding_client = create_llm_client(llm_config)
    chat_model = get_chat_model_name(llm_config)
    embedding_model = get_embedding_model_name(llm_config)

    # Prepare transparency output paths
    output_path = Path(output_file)
    dropped_conversations_file = (
        output_path.parent / f"{output_path.stem}_dropped_conversations.jsonl"
    )
    dropped_duplicates_file = output_path.parent / f"{output_path.stem}_dropped_duplicates.jsonl"
    failed_reformulations_file = (
        output_path.parent / f"{output_path.stem}_failed_reformulations.json"
    )
    failed_usage_mode_file = output_path.parent / f"{output_path.stem}_failed_usage_mode.jsonl"
    failed_subject_topics_file = (
        output_path.parent / f"{output_path.stem}_failed_subject_topics.jsonl"
    )

    logger.info(f"Dropped conversations: {dropped_conversations_file}")
    logger.info(f"Dropped duplicates: {dropped_duplicates_file}")
    logger.info(f"Failed reformulations: {failed_reformulations_file}")
    logger.info(f"Failed usage mode categorizations: {failed_usage_mode_file}")
    logger.info(f"Failed subject topic categorizations: {failed_subject_topics_file}\n")

    # Step 1: Load conversations
    logger.info("Step 1: Loading conversations...")
    conversations = load_conversations(input_file, limit=limit)
    logger.info(f"Loaded {len(conversations)} conversations")

    # Step 2: Filter conversations (saves dropped to file)
    logger.info("Step 2: Filtering conversations...")
    filtered_conversations = filter_conversations(
        conversations, output_dropped_file=str(dropped_conversations_file)
    )
    user_message_count = sum(
        1 for conv in filtered_conversations for msg in conv.messages if msg.role == "user"
    )
    logger.info(
        f"Filtered to {len(filtered_conversations)} conversations and {user_message_count} user messages"
    )

    # Step 3: Extract questions with LLM reformulation
    logger.info("Step 3: Extracting questions with LLM reformulation...")
    logger.info(f"Using model '{chat_model}' for question extraction")
    all_questions: List[GoldenQuestion] = []
    all_failed_reformulations: list = []
    for conv in tqdm(filtered_conversations, desc="Extracting questions"):
        questions, failed_reformulations = extract_golden_questions(
            conv,
            llm_client=chat_client,
            model=chat_model,
        )
        all_questions.extend(questions)
        all_failed_reformulations.extend(failed_reformulations)
    logger.info(f"Extracted {len(all_questions)} total questions")

    # Save failed reformulations if any occurred
    _save_failed_reformulations(all_failed_reformulations, failed_reformulations_file)
    logger.info(
        f"Saved {len(all_failed_reformulations)} failed reformulations to {failed_reformulations_file}"
    )

    # Step 4: Categorize questions using LLM
    logger.info("Step 4: Categorizing questions using LLM...")
    categorized_questions, failed_usage_mode = categorize_questions_llm(
        all_questions, chat_client, model=chat_model
    )
    logger.info(f"Categorized {len(categorized_questions)} questions")

    # Step 5: Categorize subject topics using LLM
    logger.info("Step 5: Categorizing subject topics using LLM...")
    subject_categorized_questions, failed_subject_topics = categorize_subject_topics(
        categorized_questions, chat_client, model=chat_model
    )
    logger.info(f"Categorized subject topics for {len(subject_categorized_questions)} questions")

    # Save failed categorizations to separate files (always overwrite)
    _save_failed_categorizations(failed_usage_mode, failed_usage_mode_file)
    logger.info(f"Saved {len(failed_usage_mode)} failed usage mode categorizations")

    _save_failed_categorizations(failed_subject_topics, failed_subject_topics_file)
    logger.info(f"Saved {len(failed_subject_topics)} failed subject topic categorizations")

    # Step 6: Deduplicate (saves duplicates to file)
    logger.info("Step 6: Deduplicating questions...")
    deduplicated_questions = deduplicate_questions(
        subject_categorized_questions,
        output_dropped_file=str(dropped_duplicates_file),
        embedding_client=embedding_client,
        embedding_model=embedding_model,
    )
    num_duplicates = len(subject_categorized_questions) - len(deduplicated_questions)
    logger.info(f"Final count: {len(deduplicated_questions)} unique questions")

    # Step 7: Save output
    logger.info("Step 7: Saving output...")
    save_golden_questions(deduplicated_questions, output_file)
    logger.info(f"Saved {len(deduplicated_questions)} questions to {output_file}")

    # Log statistics
    _log_statistics(deduplicated_questions)

    # Log cache statistics if requested
    if show_cache_stats:
        _log_cache_statistics(chat_client, embedding_client)

    logger.info("\n✅ Pipeline complete!")
    logger.info("\n📂 Output files:")
    logger.info(f"[{len(deduplicated_questions)}] Main output: {output_file}")
    logger.info(
        f"[{len(conversations) - len(filtered_conversations)}] Dropped conversations: {dropped_conversations_file}"
    )
    logger.info(f"[{num_duplicates}] Dropped duplicates: {dropped_duplicates_file}")
    logger.info(
        f"[{len(all_failed_reformulations)}] Failed reformulations: {failed_reformulations_file}"
    )
    logger.info(
        f"[{len(failed_usage_mode)}] Failed usage mode categorizations: {failed_usage_mode_file}"
    )
    logger.info(
        f"[{len(failed_subject_topics)}] Failed subject topic categorizations: {failed_subject_topics_file}"
    )


def save_golden_questions(questions: List[GoldenQuestion], output_file: str) -> None:
    """
    Save golden questions to JSONL file.

    Args:
        questions: List of golden questions
        output_file: Path to output file
    """
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        for question in questions:
            json_line = json.dumps(question.to_dict(), ensure_ascii=False)
            f.write(json_line + "\n")


def _save_failed_categorizations(failed_questions: List[GoldenQuestion], output_file: Path) -> None:
    """
    Save failed categorizations to JSONL file (always overwrites existing file).

    Args:
        failed_questions: List of questions that failed categorization
        output_file: Path to save the failed categorizations
    """
    output_file.parent.mkdir(parents=True, exist_ok=True)
    # Always overwrite the file (mode='w')
    with open(output_file, "w", encoding="utf-8") as f:
        for question in failed_questions:
            json_line = json.dumps(question.to_dict(), ensure_ascii=False)
            f.write(json_line + "\n")


def _log_statistics(questions: List[GoldenQuestion]) -> None:
    """
    Log statistics about extracted questions.

    Args:
        questions: List of golden questions
    """
    logger.info("\n" + "=" * 60)
    logger.info("STATISTICS")
    logger.info("=" * 60)

    # Total count
    logger.info(f"Total questions: {len(questions)}")

    # Handle empty list case
    if len(questions) == 0:
        logger.info("No questions extracted.")
        logger.info("=" * 60 + "\n")
        return

    # Has retrieval stats
    with_retrieval = sum(1 for q in questions if q.has_retrieval)
    logger.info(f"With retrieval: {with_retrieval} ({with_retrieval / len(questions) * 100:.1f}%)")
    logger.info(
        f"Without retrieval: {len(questions) - with_retrieval} "
        f"({(len(questions) - with_retrieval) / len(questions) * 100:.1f}%)"
    )

    # Document scope distribution
    logger.info("\nDocument Scope:")
    scope_counts: dict[str, int] = {}
    for q in questions:
        scope = q.usage_mode.document_scope
        scope_counts[scope] = scope_counts.get(scope, 0) + 1
    for scope, count in sorted(scope_counts.items()):
        logger.info(f"  {scope}: {count} ({count / len(questions) * 100:.1f}%)")

    # Operation type distribution
    logger.info("\nOperation Type:")
    op_counts: dict[str, int] = {}
    for q in questions:
        op = q.usage_mode.operation_type
        op_counts[op] = op_counts.get(op, 0) + 1
    for op, count in sorted(op_counts.items(), key=lambda x: x[1], reverse=True):
        logger.info(f"  {op}: {count} ({count / len(questions) * 100:.1f}%)")

    # Output complexity distribution
    logger.info("\nOutput Complexity:")
    complexity_counts: dict[str, int] = {}
    for q in questions:
        complexity = q.usage_mode.output_complexity
        complexity_counts[complexity] = complexity_counts.get(complexity, 0) + 1
    for complexity, count in sorted(complexity_counts.items()):
        logger.info(f"  {complexity}: {count} ({count / len(questions) * 100:.1f}%)")

    # Filters distribution
    logger.info("\nFilters:")
    questions_with_filters = 0
    filter_field_counts: dict[str, int] = {}
    doc_type_counts: dict[str, int] = {}
    org_counts: dict[str, int] = {}

    for q in questions:
        if q.filters:
            questions_with_filters += 1
            for field_name in q.filters.keys():
                filter_field_counts[field_name] = filter_field_counts.get(field_name, 0) + 1

            # Count document types
            if "type" in q.filters:
                for doc_type in q.filters["type"]:
                    doc_type_counts[doc_type] = doc_type_counts.get(doc_type, 0) + 1

            # Count organizations
            if "orgs_long" in q.filters:
                for org in q.filters["orgs_long"]:
                    org_counts[org] = org_counts.get(org, 0) + 1

    logger.info(
        f"  Questions with filters: {questions_with_filters} ({questions_with_filters / len(questions) * 100:.1f}%)"
    )
    logger.info(
        f"  Questions without filters: {len(questions) - questions_with_filters} ({(len(questions) - questions_with_filters) / len(questions) * 100:.1f}%)"
    )

    if filter_field_counts:
        logger.info("  Filter fields used:")
        for field, count in sorted(filter_field_counts.items(), key=lambda x: x[1], reverse=True):
            logger.info(f"    {field}: {count}")

    if doc_type_counts:
        logger.info("  Top document types:")
        for doc_type, count in sorted(doc_type_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
            logger.info(f"    {doc_type}: {count}")

    if org_counts:
        logger.info("  Top organizations:")
        for org, count in sorted(org_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
            logger.info(f"    {org}: {count}")

    # Subject topics distribution
    logger.info("\nSubject Topics:")
    topic_counts: dict[str, int] = {}
    questions_with_topics = 0
    for q in questions:
        if q.subject_topics:
            questions_with_topics += 1
            for topic in q.subject_topics:
                topic_counts[topic] = topic_counts.get(topic, 0) + 1
    logger.info(
        f"  Questions with subject topics: {questions_with_topics} ({questions_with_topics / len(questions) * 100:.1f}%)"
    )
    logger.info(
        f"  Questions without subject topics: {len(questions) - questions_with_topics} ({(len(questions) - questions_with_topics) / len(questions) * 100:.1f}%)"
    )
    if topic_counts:
        logger.info("  Top subject topics:")
        for topic, count in sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            logger.info(f"    {topic}: {count}")

    logger.info("=" * 60 + "\n")


def _log_cache_statistics(
    chat_client: Union[OpenAI, AzureOpenAI],
    embedding_client: Union[OpenAI, AzureOpenAI],
) -> None:
    """
    Log cache hit/miss statistics.

    Args:
        chat_client: Chat LLM client (potentially wrapped with caching)
        embedding_client: Embedding LLM client (potentially wrapped with caching)
    """
    from .llm_cache import CachedLLMClient

    logger.info("\n" + "=" * 60)
    logger.info("CACHE STATISTICS")
    logger.info("=" * 60)

    for name, client in [("Chat", chat_client), ("Embedding", embedding_client)]:
        if isinstance(client, CachedLLMClient):
            stats = client._stats
            total = stats["hits"] + stats["misses"]
            hit_rate = (stats["hits"] / total * 100) if total > 0 else 0
            logger.info(f"{name} client:")
            logger.info(f"  Hits:   {stats['hits']}")
            logger.info(f"  Misses: {stats['misses']}")
            logger.info(f"  Rate:   {hit_rate:.1f}%")
        else:
            logger.info(f"{name} client: caching disabled")

    logger.info("=" * 60 + "\n")


def main() -> None:
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Extract golden questions from conversation data")
    parser.add_argument("input_file", help="Path to input JSONL file")
    parser.add_argument(
        "--output",
        "-o",
        default="output/golden_questions.jsonl",
        help="Path to output JSONL file (default: output/golden_questions.jsonl)",
    )
    parser.add_argument(
        "--model",
        "-m",
        default="gpt-oss:120b-cloud",
        help="LLM model name (default: gpt-oss:120b-cloud)",
    )
    parser.add_argument(
        "--batch-size",
        "-b",
        type=int,
        default=10,
        help="Number of concurrent LLM requests (default: 10)",
    )
    parser.add_argument(
        "--ollama-url",
        default=None,
        help="Ollama API base URL (default: http://localhost:11434/v1)",
    )
    parser.add_argument(
        "--provider",
        choices=["ollama", "azure"],
        default=None,
        help="LLM provider to use (default: ollama)",
    )
    parser.add_argument(
        "--azure-endpoint",
        default=None,
        help="Azure OpenAI endpoint URL",
    )
    parser.add_argument(
        "--azure-api-key",
        default=None,
        help="Azure OpenAI API key",
    )
    parser.add_argument(
        "--azure-chat-deployment",
        default=None,
        help="Azure OpenAI chat model deployment name",
    )
    parser.add_argument(
        "--azure-embedding-deployment",
        default=None,
        help="Azure OpenAI embedding model deployment name",
    )
    parser.add_argument(
        "--limit",
        "-l",
        type=int,
        default=None,
        help="Limit number of conversations to process (for testing)",
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Disable LLM response caching (default: enabled)",
    )
    parser.add_argument(
        "--clear-cache",
        action="store_true",
        help="Clear LLM cache before running pipeline",
    )
    parser.add_argument(
        "--cache-stats",
        action="store_true",
        help="Print cache hit/miss statistics at end",
    )

    args = parser.parse_args()

    # Handle cache clearing
    if args.clear_cache:
        from .llm_cache import clear_cache

        cache_dir = ".cache/llm_responses"
        clear_cache(cache_dir)
        logger.info(f"Cleared LLM cache at {cache_dir}")

    # Create LLM configuration from environment and arguments
    llm_config = LLMConfig.from_env_and_args(args)

    process_conversations(
        input_file=args.input_file,
        output_file=args.output,
        llm_config=llm_config,
        batch_size=args.batch_size,
        limit=args.limit,
        show_cache_stats=args.cache_stats,
    )


if __name__ == "__main__":
    main()
