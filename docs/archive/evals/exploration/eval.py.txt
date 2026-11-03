# -*- coding: utf-8 -*-
import csv
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional


@dataclass
class Eval:
    """Represents a single evaluation test case for the knowledge base system."""

    test_id: str
    query: str
    document_types: List[str]
    organizations: List[str]
    expected_behavior: str
    reference_url: str
    notes: str
    known_issue_comment: str


def load_evals_from_csv(csv_path: Path) -> List[Eval]:
    """Load evaluations from a CSV file."""
    evals: List[Eval] = []

    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    with open(csv_path, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            # Parse document_types and organizations (comma-separated or empty)
            doc_types: List[str] = [dt.strip() for dt in row['document_types'].split(',') if dt.strip()]
            orgs: List[str] = [org.strip() for org in row['organizations'].split(',') if org.strip()]

            eval_case = Eval(
                test_id=row['test_id'],
                query=row['query'],
                document_types=doc_types,
                organizations=orgs,
                expected_behavior=row['expected_behavior'],
                reference_url=row['reference_url'],
                notes=row['notes'],
                known_issue_comment=row['known_issue_comment']
            )
            evals.append(eval_case)

    return evals


# Load all evals from CSV
CSV_PATH: Path = Path(__file__).parent / 'evals.csv'
ALL_EVALS: List[Eval] = load_evals_from_csv(CSV_PATH)


def get_all_evals() -> List[Eval]:
    """Get all available evals."""
    return ALL_EVALS


def get_eval_by_id(test_id: str) -> Optional[Eval]:
    """Get an eval by its test ID."""
    for eval_case in ALL_EVALS:
        if eval_case.test_id == test_id:
            return eval_case
    return None


def list_evals() -> None:
    """Print all available evals."""
    print("Available Evals:")
    print("-" * 80)
    for eval_case in ALL_EVALS:
        known_issue: str = f" [Known Issue: {eval_case.known_issue_comment}]" if eval_case.known_issue_comment else ""
        print(f"{eval_case.test_id}: {eval_case.query}{known_issue}")
        doc_types_str: str = ', '.join(eval_case.document_types) if eval_case.document_types else ''
        orgs_str: str = ', '.join(eval_case.organizations) if eval_case.organizations else ''
        print(f"  Filters: {doc_types_str} | {orgs_str}")
        print()


if __name__ == "__main__":
    list_evals()
