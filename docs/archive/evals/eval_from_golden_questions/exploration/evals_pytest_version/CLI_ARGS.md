# Command Line Arguments Reference

DeepEval tests support custom command line arguments through pytest. Use `--` to separate DeepEval options from pytest options.

## Quick Examples

```bash
# Basic usage with defaults and caching (recommended)
deepeval test run evals/test_rag_eval.py --use-cache

# Custom input file and limit with caching
deepeval test run evals/test_rag_eval.py --use-cache -- --input-file output/test.jsonl --limit 10

# Adjust metric thresholds with caching
deepeval test run evals/test_rag_eval.py --use-cache -- --faithfulness-threshold 0.8

# Combine multiple options with caching
deepeval test run evals/test_rag_eval.py --use-cache -- --limit 20 --faithfulness-threshold 0.75 --contextual-relevancy-threshold 0.7

# Run specific test with custom args and caching
deepeval test run evals/test_rag_eval.py::test_all_metrics --use-cache -- --limit 5
```

**💡 Pro Tip**: Always use `--use-cache` flag to cache metric evaluation results and avoid redundant LLM API calls.

## Available Arguments

### Data Configuration

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--input-file` | string | `output/test.jsonl` | Path to golden questions JSONL file |
| `--limit` | int | `5` | Number of questions to evaluate |

### Metric Thresholds

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--faithfulness-threshold` | float | `0.7` | Threshold for faithfulness metric (0.0 to 1.0) |
| `--answer-relevancy-threshold` | float | `0.8` | Threshold for answer relevancy metric (0.0 to 1.0) |
| `--contextual-relevancy-threshold` | float | `0.6` | Threshold for contextual relevancy metric (0.0 to 1.0) |

## Priority Order

When the same setting is specified in multiple places, the priority is:

1. **Command line arguments** (highest priority)
2. **Environment variables** (`.env` file or shell exports)
3. **Default values** (lowest priority)

Example:
```bash
# Environment variable sets limit to 10
export EVAL_LIMIT=10

# CLI argument overrides to 5
deepeval test run evals/test_rag_eval.py -- --limit 5
# Result: Uses limit of 5
```

## Understanding Thresholds

Metrics return a score between 0.0 and 1.0. The threshold determines when a test passes:
- **Score >= Threshold**: Test passes ✅
- **Score < Threshold**: Test fails ❌

### Choosing Thresholds

- **Stricter (higher threshold)**: Fewer false positives, but may flag acceptable responses
  - Example: `--faithfulness-threshold 0.9`
- **Lenient (lower threshold)**: More permissive, but may miss issues
  - Example: `--faithfulness-threshold 0.5`

### Default Thresholds Explanation

- **Faithfulness (0.7)**: Moderate threshold - answer should be reasonably grounded in context
- **Answer Relevancy (0.8)**: Higher threshold - answer must be clearly relevant to question
- **Contextual Relevancy (0.6)**: Lower threshold - at least some retrieved chunks should be relevant

## Common Use Cases

### Quick smoke test with caching
```bash
deepeval test run evals/test_rag_eval.py --use-cache -- --limit 3
```

### Full evaluation with custom input and caching
```bash
deepeval test run evals/test_rag_eval.py --use-cache -- --input-file output/production_questions.jsonl --limit 100
```

### Stricter quality standards with caching
```bash
deepeval test run evals/test_rag_eval.py --use-cache -- \
  --faithfulness-threshold 0.85 \
  --answer-relevancy-threshold 0.9 \
  --contextual-relevancy-threshold 0.75
```

### Run with pytest options and caching
```bash
# Show test output with -v, stop on first failure with -x
deepeval test run evals/test_rag_eval.py -x --use-cache -- --limit 10
```

### Clear cache and re-run
```bash
# Remove cache directory to force fresh evaluation
rm -rf .deepeval
deepeval test run evals/test_rag_eval.py --use-cache -- --limit 10
```

## Help

To see all available options:
```bash
deepeval test run evals/test_rag_eval.py -- --help
```
