"""
Script to select representative golden questions for evaluation.

Picks 10 questions within each combination of:
- usage_mode (document_scope, operation_type, output_complexity)
- subject_topics

Usage:
    python select_representative_questions.py <input_path> [output_path]

Arguments:
    input_path: Path to input JSONL file with golden questions
    output_path: Path to output JSONL file (default: output/representative_questions.jsonl)
"""

import json
import logging
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def load_golden_questions(file_path: Path) -> list[dict[str, Any]]:
    """Load golden questions from JSONL file."""
    questions = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            try:
                questions.append(json.loads(line))
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing line {line_num}: {e}")
                raise
    logger.info(f"Loaded {len(questions)} questions from {file_path}")
    return questions


def get_usage_mode_key(question: dict[str, Any]) -> tuple[str, str, str]:
    """Extract usage_mode as a tuple key."""
    usage_mode = question.get("usage_mode", {})
    return (
        usage_mode.get("document_scope", "unknown"),
        usage_mode.get("operation_type", "unknown"),
        usage_mode.get("output_complexity", "unknown"),
    )


def get_subject_topics_key(question: dict[str, Any]) -> tuple[str, ...]:
    """Extract subject_topics as a sorted tuple key."""
    topics = question.get("subject_topics", [])
    return tuple(sorted(topics))


def group_questions_by_usage_mode(
    questions: list[dict[str, Any]],
) -> dict[tuple[str, str, str], list[dict[str, Any]]]:
    """Group questions by usage_mode combination."""
    groups: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for question in questions:
        key = get_usage_mode_key(question)
        groups[key].append(question)
    return groups


def group_questions_by_subject_topics(
    questions: list[dict[str, Any]],
) -> dict[tuple[str, ...], list[dict[str, Any]]]:
    """Group questions by subject_topics combination."""
    groups: dict[tuple[str, ...], list[dict[str, Any]]] = defaultdict(list)
    for question in questions:
        key = get_subject_topics_key(question)
        groups[key].append(question)
    return groups


def select_representative_questions(
    questions: list[dict[str, Any]], max_per_group: int = 10
) -> list[dict[str, Any]]:
    """
    Select representative questions from each group.

    Picks up to max_per_group questions from each combination of:
    - usage_mode (document_scope, operation_type, output_complexity)
    - subject_topics
    """
    selected_questions = []
    selected_ids = set()

    # Group by usage_mode
    usage_mode_groups = group_questions_by_usage_mode(questions)
    logger.info(f"Found {len(usage_mode_groups)} unique usage_mode combinations")

    for usage_mode_key, group_questions in usage_mode_groups.items():
        # Select up to max_per_group questions
        count = min(max_per_group, len(group_questions))
        selected = group_questions[:count]

        for q in selected:
            if q["id"] not in selected_ids:
                selected_questions.append(q)
                selected_ids.add(q["id"])

        logger.info(
            f"Usage mode {usage_mode_key}: "
            f"selected {count} out of {len(group_questions)} questions"
        )

    logger.info(f"Selected {len(selected_questions)} questions from usage_mode groups")
    return selected_questions
    # Group by subject_topics
    # subject_topics_groups = group_questions_by_subject_topics(questions)
    # logger.info(
    #     f"Found {len(subject_topics_groups)} unique subject_topics combinations"
    # )

    # for topics_key, group_questions in subject_topics_groups.items():
    #     # Select up to max_per_group questions that haven't been selected yet
    #     remaining_count = max_per_group
    #     for q in group_questions:
    #         if remaining_count <= 0:
    #             break
    #         if q["id"] not in selected_ids:
    #             selected_questions.append(q)
    #             selected_ids.add(q["id"])
    #             remaining_count -= 1

    #     selected_count = max_per_group - remaining_count
    #     logger.info(
    #         f"Subject topics {topics_key}: "
    #         f"selected {selected_count} new out of {len(group_questions)} questions"
    #     )

    # logger.info(f"Total selected questions: {len(selected_questions)}")
    # return selected_questions


def save_representative_questions(
    questions: list[dict[str, Any]], output_path: Path
) -> None:
    """Save representative questions to JSONL file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        for question in questions:
            f.write(json.dumps(question, ensure_ascii=False) + "\n")

    logger.info(f"Saved {len(questions)} questions to {output_path}")


def print_statistics(questions: list[dict[str, Any]]) -> None:
    """Print statistics about the selected questions."""
    usage_mode_groups = group_questions_by_usage_mode(questions)

    print("\n=== Usage Mode Distribution ===")
    for key, group in sorted(
        usage_mode_groups.items(), key=lambda x: len(x[1]), reverse=True
    ):
        count = len(group)
        # Get first question from the group
        first_question = group[0].get("question", "")[:80]
        if len(group[0].get("question", "")) > 80:
            first_question += "..."
        print(f"{str(key):80} {count:3} questions")
        print(f"  → {first_question}")
        print()

    print("\n=== Subject Topics Distribution (by individual category) ===")
    # Count each individual topic across all questions
    topic_counts: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for question in questions:
        topics = question.get("subject_topics", [])
        for topic in topics:
            topic_counts[topic].append(question)

    # Sort by count descending
    for topic, group in sorted(
        topic_counts.items(), key=lambda x: len(x[1]), reverse=True
    ):
        count = len(group)
        # Get first question from the group
        first_question = group[0].get("question", "")[:80]
        if len(group[0].get("question", "")) > 80:
            first_question += "..."
        print(f"{topic:80} {count:3} questions")
        print(f"  → {first_question}")
        print()


def main() -> None:
    """Main execution function."""
    # Parse command line arguments
    if len(sys.argv) < 2:
        print(
            "Usage: python select_representative_questions.py <input_path> [output_path]"
        )
        print("Arguments:")
        print("  input_path: Path to input JSONL file with golden questions")
        print(
            "  output_path: Path to output JSONL file (default: output/representative_questions.jsonl)"
        )
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = (
        Path(sys.argv[2]) if len(sys.argv) > 2 else Path("input/golden_questions.jsonl")
    )

    # Load questions
    questions = load_golden_questions(input_path)

    # Select representative questions
    representative_questions = select_representative_questions(
        questions, max_per_group=1
    )

    # Print statistics
    print_statistics(representative_questions)

    # Save results
    save_representative_questions(representative_questions, output_path)

    logger.info("Done!")


if __name__ == "__main__":
    main()
