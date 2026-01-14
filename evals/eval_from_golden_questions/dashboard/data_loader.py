"""JSONL data loader for evaluation results.

This module loads and parses evaluation results from JSONL files
and converts them to structured dataclasses and pandas DataFrames.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd


@dataclass
class MetricResult:
    """Represents a single metric evaluation result."""

    score: float
    success: bool
    error: str | None
    reason: str
    threshold: float


@dataclass
class UsageMode:
    """Represents the usage mode dimensions for a question."""

    document_scope: str  # e.g., "single_document", "multi_document"
    operation_type: str  # e.g., "summarization", "comparison"
    output_complexity: str  # e.g., "prose", "list", "table"


@dataclass
class EvaluationRecord:
    """Represents a complete evaluation record."""

    question_id: str
    question: str
    answer: str
    chunks: list[dict[str, Any]]
    metrics: dict[str, MetricResult]  # Metric name -> MetricResult
    subject_topics: list[str]
    usage_mode: UsageMode
    error: str | None


def parse_jsonl_record(record_dict: dict[str, Any]) -> EvaluationRecord:
    """Parse a single JSONL record dictionary into an EvaluationRecord.

    Args:
        record_dict: Dictionary parsed from JSONL line

    Returns:
        EvaluationRecord with structured data

    Raises:
        ValueError: If required fields are missing
    """
    # Validate required fields
    required_fields = ["question_id", "question", "answer", "chunks", "metrics"]
    for field in required_fields:
        if field not in record_dict:
            raise ValueError(f"Missing required field: {field}")

    # Parse metrics
    metrics: dict[str, MetricResult] = {}
    metrics_data = record_dict["metrics"].get("metrics", {})
    for metric_name, metric_data in metrics_data.items():
        metrics[metric_name] = MetricResult(
            score=metric_data["score"],
            success=metric_data["success"],
            error=metric_data.get("error"),
            reason=metric_data["reason"],
            threshold=metric_data["threshold"],
        )

    # Parse usage mode (handle null metadata)
    metadata = record_dict.get("metadata")
    if metadata and metadata.get("usage_mode"):
        usage_mode_data = metadata["usage_mode"]
        usage_mode = UsageMode(
            document_scope=usage_mode_data["document_scope"],
            operation_type=usage_mode_data["operation_type"],
            output_complexity=usage_mode_data["output_complexity"],
        )
    else:
        # Use default values for missing metadata
        usage_mode = UsageMode(
            document_scope="unknown",
            operation_type="unknown",
            output_complexity="unknown",
        )

    # Get subject topics (handle null metadata)
    subject_topics = []
    if metadata and metadata.get("subject_topics"):
        subject_topics = metadata["subject_topics"]

    # Create evaluation record
    return EvaluationRecord(
        question_id=record_dict["question_id"],
        question=record_dict["question"],
        answer=record_dict["answer"],
        chunks=record_dict["chunks"],
        metrics=metrics,
        subject_topics=subject_topics,
        usage_mode=usage_mode,
        error=record_dict.get("error"),
    )


def load_evaluation_results(file_path: str) -> pd.DataFrame:
    """Load evaluation results from JSONL file into pandas DataFrame.

    The JSONL file is expected to contain pretty-printed JSON (multi-line format),
    where each complete JSON object represents one evaluation record.

    Args:
        file_path: Path to the JSONL file

    Returns:
        DataFrame with columns: question_id, question, answer, chunks, metrics,
        subject_topics, usage_mode, error

    Raises:
        FileNotFoundError: If file does not exist
        json.JSONDecodeError: If JSON is malformed
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    records: list[EvaluationRecord] = []

    # Read the entire file content
    with open(path) as f:
        content = f.read().strip()

    # Handle empty file
    if not content:
        return pd.DataFrame()

    # Parse pretty-printed JSONL (multi-line JSON objects)
    # We need to find complete JSON objects by tracking brace count
    lines = content.split("\n")
    current_json_lines: list[str] = []
    brace_count = 0

    for line in lines:
        current_json_lines.append(line)
        brace_count += line.count("{") - line.count("}")

        # Complete JSON object found
        if brace_count == 0 and len(current_json_lines) > 0:
            json_str = "\n".join(current_json_lines)
            if json_str.strip():  # Skip empty strings
                record_dict = json.loads(json_str)
                record = parse_jsonl_record(record_dict)
                records.append(record)
            current_json_lines = []

    # If we have leftover lines, it means malformed JSON (unclosed braces)
    if current_json_lines:
        json_str = "\n".join(current_json_lines)
        if json_str.strip():
            # Try to parse it - will raise JSONDecodeError if malformed
            json.loads(json_str)

    # Convert records to DataFrame
    if not records:
        return pd.DataFrame()

    data = {
        "question_id": [r.question_id for r in records],
        "question": [r.question for r in records],
        "answer": [r.answer for r in records],
        "chunks": [r.chunks for r in records],
        "metrics": [r.metrics for r in records],
        "subject_topics": [r.subject_topics for r in records],
        "usage_mode": [r.usage_mode for r in records],
        "error": [r.error for r in records],
    }

    return pd.DataFrame(data)
