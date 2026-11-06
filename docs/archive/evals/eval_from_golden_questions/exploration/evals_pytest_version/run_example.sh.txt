#!/bin/bash
# Example script to run DeepEval tests with caching

echo "=== DeepEval Test Examples ==="
echo ""

# Example 1: Using environment variables with caching
echo "Example 1: Using environment variables with caching"
export EVAL_LIMIT=3
export INPUT_FILE=output/test.jsonl
uv run deepeval test run evals/test_rag_eval.py::test_all_metrics --use-cache
echo ""

# Example 2: Using command line arguments (overrides env vars) with caching
echo "Example 2: Using CLI arguments with caching"
uv run deepeval test run evals/test_rag_eval.py::test_all_metrics --use-cache -- --limit 5 --input-file output/test.jsonl
echo ""

# Example 3: Custom thresholds with caching
echo "Example 3: Custom thresholds with caching"
uv run deepeval test run evals/test_rag_eval.py::test_all_metrics --use-cache -- --limit 3 --faithfulness-threshold 0.8 --answer-relevancy-threshold 0.9
echo ""

# Example 4: Run individual metric tests with caching
echo "Example 4: Individual metrics with caching"
# uv run deepeval test run evals/test_rag_eval.py::test_faithfulness --use-cache -- --limit 2
# uv run deepeval test run evals/test_rag_eval.py::test_answer_relevancy --use-cache -- --limit 2
# uv run deepeval test run evals/test_rag_eval.py::test_contextual_relevancy --use-cache -- --limit 2

echo ""
echo "💡 Tip: Always use --use-cache for faster test iterations!"
echo "Done!"
