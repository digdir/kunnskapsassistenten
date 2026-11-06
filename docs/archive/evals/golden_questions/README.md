# Golden Questions Extraction

Extract high-quality evaluation questions from production RAG conversations using LLM-based categorization.

## Overview

This tool extracts and categorizes questions from conversation logs using an LLM-based approach with few-shot learning. Questions are classified across three dimensions:

1. **Document Scope**: single_document or multi_document
2. **Operation Type**: 13 different types (simple_qa, extraction, summarization, etc.)
3. **Output Complexity**: factoid, prose, list, or table

## Prerequisites

1. **Ollama running locally**:
   ```bash
   # Install Ollama (if not already installed)
   # See: https://ollama.ai/

   # Start Ollama service
   ollama serve

   # Pull the model
   ollama pull gpt-oss:120b-cloud
   ```

2. **Install dependencies**:
   ```bash
   source .venv/bin/activate
   uv pip install -e .
   ```

## Usage

### Extract Golden Questions from Conversations

Run the main pipeline to extract and categorize questions:

```bash
uv run python -m src.main prod_conversations.jsonl \
  --output output/golden_questions.jsonl \
  --model gpt-oss:120b-cloud \
  --batch-size 10
```

**Arguments:**

- `input_file`: Path to input conversation JSONL file (required)
- `--output, -o`: Path to output JSONL file (default: `output/golden_questions.jsonl`)
- `--model, -m`: Model name to use (default: `gpt-oss:120b-cloud`)
- `--batch-size, -b`: Number of concurrent requests (default: 10)
- `--ollama-url`: Ollama API URL (default: `http://localhost:11434/v1`)

### Using in Code

#### Synchronous Usage

```python
from src.categorizer_llm import categorize_question_llm, create_ollama_client
from src.models import GoldenQuestion, UsageMode

# Create client
client = create_ollama_client()

# Categorize a single question
question = GoldenQuestion(...)
usage_mode = categorize_question_llm(question, client, model="gpt-oss")
```

## Features

### Few-Shot Learning

The categorizer uses 7 carefully selected Norwegian examples covering:
- Simple QA questions
- Extraction tasks
- Summarization requests
- Comparison queries
- Aggregation questions
- Temporal analysis
- Inference tasks

### Async & Batch Processing

- Process multiple questions concurrently
- Configurable batch size to control API load
- Progress bars with tqdm for visibility

### Error Handling

- Automatic retry on API failures (configurable, default: 3 attempts)
- Graceful handling of invalid JSON responses
- Detailed logging for debugging
- Validation of required fields in responses

### Model Support

Works with any Ollama model that supports JSON output:
- `gpt-oss:120b-cloud` (default - 12B parameter model optimized for cloud deployment)
- `gpt-oss` (smaller, faster version)
- Any other compatible model

### LLM-Based Question Reformulation

The extractor uses an LLM to intelligently reformulate vague questions into specific, standalone questions:

**Problem it solves:**
- Vague questions like "Hvilke land kommer barna fra?" lack context
- Rule-based approaches miss many ambiguous cases
- Questions with pronouns ("det", "den") need context substitution

**How it works:**
1. Detects questions needing reformulation (pronouns, short messages, context references)
2. Extracts context from previous 3 messages and document titles
3. Uses LLM with few-shot examples to reformulate the question
4. Falls back to original question on errors (production-safe)

**Example transformations:**
| Original (Vague) | Context | Reformulated (Standalone) |
|------------------|---------|---------------------------|
| "Hvilke land kommer barna fra?" | "Barnevernsstatistikk 2023" | "Hvilke land kommer barna i barnevernsstatistikken 2023 fra?" |
| "Hva innebærer det?" | "Regjeringens dataspillstrategi" | "Hva innebærer regjeringens dataspillstrategi?" |
| "Og hvordan søker jeg på det?" | "Skattefradraget for dataspill" | "Hvordan søker jeg på skattefradraget for dataspill?" |

Features:
- Async processing for efficiency
- Conservative (only reformulates when needed)
- Robust error handling with retry logic
- Uses Norwegian few-shot examples
- Maintains conversation context

## Output

The pipeline generates **3 files** for full transparency:

### 1. **Main Output**: `output/golden_questions.jsonl`

Each line contains a golden question with metadata:
```json
{
  "question": "Hva er tiltakene i regjeringens dataspillstrategi 2024-2026?",
  "original_question": "kan du finne strategien...",
  "conversation_id": "6iRdNYynK6RuLCnKo5tRf",
  "context_messages": [],
  "has_retrieval": true,
  "usage_mode": {
    "document_scope": "single_document",
    "operation_type": "simple_qa",
    "output_complexity": "prose"
  },
  "metadata": {
    "topic": "Dataspillstrategi",
    "user_id": "user123",
    "created": 1764159128430
  }
}
```

### 2. **Dropped Conversations**: `output/*_dropped_conversations.jsonl`

Conversations filtered out with reasons:
- "Ny tråd with no user messages"
- "No user messages"
- "Only system messages"

### 3. **Dropped Duplicates**: `output/*_dropped_duplicates.jsonl`

Duplicate questions removed, showing:
- What was dropped vs what was kept
- Normalized form used for matching

**Console statistics** showing distribution across:
- Document scope (single vs multi-document)
- Operation types (simple_qa, extraction, comparison, etc.)
- Output complexity (factoid, prose, list, table)

## Transparency & Trust

The pipeline provides **full transparency** by saving all dropped records. You can inspect:

✅ Every conversation that was filtered out (and why)
✅ Every duplicate question that was removed
✅ Complete audit trail of pipeline decisions

See [TRANSPARENCY.md](TRANSPARENCY.md) for detailed inspection commands and examples.

## Why LLM-Based Categorization?

The project uses LLM-based categorization instead of rule-based regex patterns:

| Aspect | LLM-Based | Rule-Based (deprecated) |
|--------|-----------|------------------------|
| **Accuracy** | Excellent for ambiguous cases | Good for clear patterns only |
| **Maintenance** | Easy (adjust examples) | Hard (complex regex) |
| **Cost** | Free (local Ollama) | Free |
| **Speed** | Fast with batching | Very fast (~instant) |
| **Consistency** | High (temp=0.0) | 100% deterministic |

A deprecated rule-based categorizer is available in `src/categorizer.py` for reference.

## Testing

Run the test suite:

```bash
source .venv/bin/activate
python -m pytest tests/test_categorizer_llm.py -v
```

Current test coverage: 78% for categorizer_llm.py

## Troubleshooting

### Ollama Connection Issues

If you get connection errors:

```bash
# Check if Ollama is running
curl http://localhost:11434/v1/models

# Start Ollama if needed
ollama serve
```

### Model Not Found

```bash
# List available models
ollama list

# Pull the model
ollama pull gpt-oss:120b-cloud
```

### Out of Memory

Reduce the batch size:

```bash
python -m src.recategorize_llm --batch-size 5
```

### Invalid JSON Responses

Some models may struggle with JSON output. Try:
1. Using a different model
2. Reducing max_tokens (currently 200)
3. Checking the logs for the actual response

## Project Structure

```
golden_q/
├── README.md                    # This file
├── specs/                       # Feature specifications
│   └── golden_questions_spec.md
├── src/                         # Source code
│   ├── main.py                  # Main pipeline (uses LLM)
│   ├── loader.py                # Load conversations from JSONL
│   ├── filter.py                # Filter quality conversations
│   ├── extractor.py             # Extract questions from messages
│   ├── reformulator_llm.py      # LLM-based question reformulation
│   ├── categorizer_llm.py       # LLM-based categorization
│   ├── categorizer.py           # Rule-based (deprecated)
│   ├── deduplicator.py          # Remove duplicate questions
│   └── models.py                # Data models
├── tests/                       # Unit tests
│   ├── test_reformulator_llm.py # Reformulator tests
│   └── test_categorizer_llm.py  # Categorizer tests
└── output/                      # Generated output (gitignored)
    └── golden_questions.jsonl
```

### Semantic Deduplication with Embeddings

The deduplicator uses a sophisticated two-stage approach to remove duplicate questions:

**Stage 1: Exact Match (Fast Path)**
- Normalizes text (lowercase, remove punctuation/whitespace)
- Performs exact match comparison
- O(n) complexity - very fast

**Stage 2: Semantic Similarity (Embedding-Based)**
- Generates embeddings using Ollama (`nomic-embed-text` model)
- Computes pairwise cosine similarity
- Removes questions above similarity threshold (default: 0.92)
- Preserves first occurrence of duplicates

**Example semantic duplicates detected:**
- "Hva er budsjettet til Digdir?" ≈ "Hvilket budsjett har Digdir?" (similarity: 0.94)
- "Gi et sammendrag" ≈ "Kan du oppsummere?" (similarity: 0.93)
- "Hvordan søker jeg?" ≈ "Hvordan kan jeg søke?" (similarity: 0.96)

**Configuration:**
```python
from src.deduplicator import deduplicate_questions

deduplicated = deduplicate_questions(
    questions,
    use_semantic=True,          # Enable semantic deduplication
    similarity_threshold=0.92,   # Adjust threshold (0.0-1.0)
)
```

**Requirements:**
- Ollama running locally: `ollama serve`
- Pull embedding model: `ollama pull nomic-embed-text`

**Transparency:**
- All duplicates saved to `*_dropped_duplicates.jsonl`
- Includes similarity scores for each duplicate
- Distinguishes exact matches from semantic duplicates

## Future Enhancements

- [x] LLM-based question reformulation for better context ✅ (implemented in `src/reformulator_llm.py`)
- [x] Semantic deduplication using embeddings ✅ (implemented in `src/deduplicator.py`)
- [ ] Question quality scoring with confidence thresholds
- [ ] Support for multiple LLM providers (OpenAI, Anthropic)
- [ ] Custom few-shot examples via config file
- [ ] Answer validation against retrieval chunks
- [ ] Alternative embedding models (OpenAI, nomic-embed-text, etc.)

## Related Files

- `src/categorizer_llm.py`: LLM categorization implementation (src/categorizer_llm.py:1)
- `src/reformulator_llm.py`: LLM question reformulation implementation (src/reformulator_llm.py:1)
- `src/main.py`: Main pipeline orchestration (src/main.py:1)
- `tests/test_categorizer_llm.py`: Categorizer test suite (tests/test_categorizer_llm.py:1)
- `tests/test_reformulator_llm.py`: Reformulator test suite (tests/test_reformulator_llm.py:1)
- `specs/golden_questions_spec.md`: Full specification (specs/golden_questions_spec.md:1)
- `TRANSPARENCY.md`: Transparency and inspection guide (TRANSPARENCY.md:1)
