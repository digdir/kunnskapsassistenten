# DeepEval Test Suite

This folder contains DeepEval test files for evaluating the RAG system.

## Running Tests

### Basic Usage

Run all tests:
```bash
deepeval test run evals/test_rag_eval.py
```

Run with caching (recommended for faster re-runs):
```bash
deepeval test run evals/test_rag_eval.py --use-cache
```

Run specific test function:
```bash
deepeval test run evals/test_rag_eval.py::test_faithfulness --use-cache
deepeval test run evals/test_rag_eval.py::test_answer_relevancy --use-cache
deepeval test run evals/test_rag_eval.py::test_contextual_relevancy --use-cache
deepeval test run evals/test_rag_eval.py::test_all_metrics --use-cache
```

### Command Line Arguments

Use `--` to pass custom pytest arguments (combine with `--use-cache` for better performance):

```bash
# Custom input file and limit with caching
deepeval test run evals/test_rag_eval.py --use-cache -- --input-file output/test.jsonl --limit 10

# Adjust metric thresholds
deepeval test run evals/test_rag_eval.py --use-cache -- --faithfulness-threshold 0.8 --answer-relevancy-threshold 0.9

# Combine options
deepeval test run evals/test_rag_eval.py --use-cache -- --limit 20 --faithfulness-threshold 0.75 --contextual-relevancy-threshold 0.7
```

**Available Arguments:**
- `--input-file PATH`: Path to golden questions JSONL file
- `--limit N`: Number of questions to evaluate
- `--faithfulness-threshold FLOAT`: Threshold for faithfulness metric (default: 0.7)
- `--answer-relevancy-threshold FLOAT`: Threshold for answer relevancy metric (default: 0.8)
- `--contextual-relevancy-threshold FLOAT`: Threshold for contextual relevancy metric (default: 0.6)

### Configuration via Environment Variables

Alternative to CLI arguments, use environment variables from `.env` file:

- `INPUT_FILE`: Path to golden questions JSONL file (default: `output/test.jsonl`)
- `EVAL_LIMIT`: Number of questions to evaluate (default: `5`)
- All other config from [config.py](../src/config.py)

**Priority**: CLI arguments override environment variables

Example:
```bash
export INPUT_FILE=output/test.jsonl
export EVAL_LIMIT=10
deepeval test run evals/test_rag_eval.py
```

### Test Functions

1. **test_faithfulness**: Evaluates if answers are grounded in retrieved context
2. **test_answer_relevancy**: Evaluates if answers are relevant to questions
3. **test_contextual_relevancy**: Evaluates if retrieved chunks are relevant to questions
4. **test_all_metrics**: Runs all metrics together for comprehensive evaluation

## Test Structure

Each test is parametrized with all loaded test cases, so each metric is evaluated against every golden question. Test IDs include the conversation ID for easy identification.

## Performance & Caching

DeepEval provides multiple layers of caching for faster test execution:

### 1. DeepEval Metric Cache (`--use-cache`)
- Caches LLM evaluation responses for metrics
- Avoids redundant API calls when re-running tests
- Highly recommended for development and iteration

### 2. RAG Response Cache
- Built into the project's RAG querier
- Caches RAG API responses to disk
- Reuses cached responses across test runs

### 3. Test Case Loading
- Questions are loaded and RAG is queried once per test run
- Test cases are reused across all test functions

**Recommended Usage**: Always use `--use-cache` flag:
```bash
deepeval test run evals/test_rag_eval.py --use-cache -- --limit 10
```
