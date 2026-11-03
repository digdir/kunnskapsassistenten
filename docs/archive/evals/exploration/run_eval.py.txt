# -*- coding: utf-8 -*-
"""
Script to run evaluations.
"""

import argparse
import logging
from pathlib import Path
from typing import List, Optional

from diskcache import Cache

from eval import get_all_evals
from llm_judge import LLMJudge
from mock_responses import get_agent  # Change this import to swap response source
from runner import EvalResult, EvalRunner


def main() -> None:
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Run evaluations")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    parser.add_argument(
        "--no-cache", action="store_true", help="Disable caching of LLM responses"
    )
    args = parser.parse_args()

    # Configure logging
    log_level = logging.DEBUG if args.debug else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    # Suppress verbose HTTP debug messages
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("openai._base_client").setLevel(logging.WARNING)

    # Get all evals
    all_evals = get_all_evals()
    if not all_evals:
        raise ValueError("No evals found")

    # Get agent with responses
    agent = get_agent()

    # Initialize cache if not disabled
    cache: Optional[Cache] = None
    if not args.no_cache:
        cache_dir: Path = Path(__file__).parent / ".cache"
        # Set size limit to 2GB and enable eviction policy
        cache = Cache(str(cache_dir), size_limit=2 * 1024**3)  # 2GB in bytes
        print(f"Cache enabled: {cache_dir} (max size: 2GB)")
    else:
        print("Cache disabled")

    # Create LLM judge
    judge = LLMJudge(cache=cache)

    # Create runner
    runner = EvalRunner(agent, judge)

    # Run all evals
    print(f"Running {len(all_evals)} evaluations...")
    print("=" * 80)

    results: List[EvalResult] = []
    for eval_case in all_evals:
        print(f"\nRunning eval: {eval_case.test_id}")
        result = runner.run_eval(eval_case)
        runner.print_result(result)
        results.append(result)
        print("-" * 80)

    # Print summary
    print("\n" + "=" * 80)
    print("FINAL SUMMARY")
    print("=" * 80)

    passed_results: List[EvalResult] = [r for r in results if r.passed]
    failed_results: List[EvalResult] = [r for r in results if not r.passed]

    print(f"\nTotal: {len(results)} evaluations")
    print(f"Passed: {len(passed_results)}")
    print(f"Failed: {len(failed_results)}")

    if passed_results:
        print("\nPASSED CASES:")
        for result in passed_results:
            comment: str = f" ({result.eval.known_issue_comment})" if result.eval.known_issue_comment else ""
            print(f"  ✓ {result.eval.test_id}: {result.eval.query[:60]}...{comment}")

    if failed_results:
        print("\nFAILED CASES:")
        for result in failed_results:
            comment: str = (
                f" (Known issue: {result.eval.known_issue_comment})"
                if result.eval.known_issue_comment
                else ""
            )
            print(f"  ✗ {result.eval.test_id}: {result.eval.query[:60]}...{comment}")

    print("\n" + "=" * 80)


if __name__ == "__main__":
    main()
