# KuA_evals

Evaluation system for **Kunnskapsassistenten**, a RAG system for the Norwegian public sector.

## Overview

This project creates evaluation metrics for RAG system performance using production conversation data. It consists of three main components in a pipeline:

```
Production RAG System (Kunnskapsassistenten)
          ↓
[1. ka_api]  ← Fetch conversation threads
          ↓
[2. golden_questions]  ← Extract & categorize questions
          ↓
[3. select_representative_questions]  ← Select balanced subset
          ↓
[4. eval_from_golden_questions]  ← Run evaluations
```

---

## Components

### 1. ka_api - Fetch Conversation Threads

Fetches and analyzes conversation threads from the Kunnskapsassistenten API.

**Usage:**

```bash
cd ka_api
python fetch_conversations.py
```

**Requirements:**
- Environment variables: `KA_BASE_URL` and `KA_API_KEY`

**Output:**
- JSONL file with paginated conversation threads and metadata

**Key files:**
- [fetch_conversations.py](ka_api/fetch_conversations.py) - Main script to fetch conversation data
- [analyze_topics_llm.py](ka_api/analyze_topics_llm.py) - LLM-based topic analysis
- [analyze_sentiment.py](ka_api/analyze_sentiment.py) - Sentiment analysis
- [conversation_statistics.py](ka_api/conversation_statistics.py) - Statistical analysis

**Documentation:** [ka_api/README.md](ka_api/README.md)

---

### 2. golden_questions - Extract Golden Questions

Extracts high-quality evaluation questions from production conversations using LLM-based categorization.

**Usage:**

```bash
cd golden_questions
source .venv/bin/activate

# Extract questions from conversations
uv run python -m src.main input/prod_conversations.jsonl \
  --output output/golden_questions.jsonl \
  --model gpt-oss:120b-cloud \
  --batch-size 10
```

**Pipeline stages:**

1. **Load conversations** - Parse JSONL from ka_api
2. **Filter quality** - Remove invalid/empty threads
3. **Extract questions** - Identify user questions from messages
4. **Reformulate** - Make vague questions standalone using LLM
5. **Categorize usage mode** - Classify by document scope, operation type, output complexity
6. **Categorize subject** - Extract subject/topic
7. **Deduplicate** - Remove exact and semantic duplicates using embeddings

**Categorization dimensions:**
- **Document scope**: `single_document` or `multi_document`
- **Operation type**: `simple_qa`, `extraction`, `summarization`, `comparison`, etc. (13 types)
- **Output complexity**: `factoid`, `prose`, `list`, or `table`

**Output files:**
- `output/golden_questions.jsonl` - Final golden questions
- `output/*_dropped_conversations.jsonl` - Filtered conversations (transparency)
- `output/*_dropped_duplicates.jsonl` - Removed duplicates (transparency)

**Prerequisites:**
- Ollama running locally: `ollama serve`
- Pull models: `ollama pull gpt-oss:120b-cloud` and `ollama pull nomic-embed-text`

**Documentation:** [golden_questions/README.md](golden_questions/README.md)

---

### 3. select_representative_questions - Select Balanced Subset

Selects a balanced subset of golden questions for evaluation by sampling across usage modes and subject topics.

**Usage:**

```bash
cd eval_from_golden_questions

# Select representative questions (10 per usage mode combination)
python select_representative_questions.py \
  ../golden_questions/output/golden_questions.jsonl \
  input/representative_questions.jsonl
```

**What it does:**

Groups questions by:
- **Usage mode combination**: (document_scope, operation_type, output_complexity)
- **Subject topics**: Categorized subject areas

Then selects up to 10 questions from each group to ensure:
- Balanced coverage across all usage patterns
- Representative distribution of subject topics
- Manageable evaluation set size

**Arguments:**
- `input_path`: Path to golden questions JSONL file (required)
- `output_path`: Path to output file (default: `input/golden_questions.jsonl`)
- `--max-per-group`: Maximum questions per group (default: 10)

**Output:**
- `input/representative_questions.jsonl` - Balanced subset ready for evaluation
- Console statistics showing distribution across usage modes and subject topics

**Why this step?**

Evaluating thousands of questions is slow and expensive. This step ensures you get comprehensive coverage while keeping the evaluation set manageable.

**Key file:**
- [select_representative_questions.py](eval_from_golden_questions/select_representative_questions.py) - Selection logic

---

### 4. eval_from_golden_questions - Run Evaluations

Evaluates RAG system performance using offline metrics based on golden questions (no golden answers required).

**Usage:**

```bash
cd eval_from_golden_questions
source .venv/bin/activate

# Run evaluations
uv run python -m src.main input/representative_questions.jsonl

# View results in dashboard
streamlit run dashboard/app.py
```

**Evaluation process:**

1. **Load golden questions** - Read JSONL from golden_questions
2. **Query RAG system** - Send questions to Kunnskapsassistenten API
3. **Run metrics** - Evaluate responses using DeepEval
4. **Generate reports** - Save results and statistics

**Evaluation metrics** (reference-free):
- **ContextualPrecisionMetric** - Evaluates reranker quality
- **ContextualRecallMetric** - Evaluates embedding retrieval accuracy
- **ContextualRelevancyMetric** - Evaluates chunk size & top-K optimization

**Framework:**
- Uses [DeepEval](https://docs.confident-ai.com/) for metric computation and LLM-based evaluation judges

**Visualization:**
- Interactive Streamlit dashboard for exploring results
- Global metrics view with color-coded scores
- Multi-dimensional filtering (usage mode, subject topics)
- Drill-down to individual questions

**Documentation:** [eval_from_golden_questions/README.md](eval_from_golden_questions/README.md)

---

## Quick Start

### Prerequisites

1. **Python 3.13** with uv for dependency management
2. **Ollama** running locally for LLM operations
3. **Environment variables** configured (see `.env.example` if available)

### Installation

Each component has its own virtual environment:

```bash
# Install dependencies for each component
cd ka_api && uv pip install -e . && cd ..
cd golden_questions && uv pip install -e . && cd ..
cd eval_from_golden_questions && uv pip install -e . && cd ..
```

### Running the Full Pipeline

```bash
# 1. Fetch conversations from API
cd ka_api
python fetch_conversations.py
# Output: conversations.jsonl

# 2. Extract golden questions
cd ../golden_questions
uv run python -m src.main ../ka_api/conversations.jsonl \
  --output output/golden_questions.jsonl

# 3. Select representative subset
cd ../eval_from_golden_questions
python select_representative_questions.py \
  ../golden_questions/output/golden_questions.jsonl \
  input/representative_questions.jsonl

# 4. Run evaluations
uv run python -m src.main input/representative_questions.jsonl

# 5. View results in dashboard
streamlit run dashboard/app.py
```

---

## Key Technologies

- **Language**: Python 3.13
- **Dependency management**: uv
- **LLM provider**: Ollama (local, open-source models)
- **Evaluation framework**: DeepEval
- **Embeddings**: nomic-embed-text (via Ollama)
- **Testing**: pytest

---

## Data Flow

```
Kunnskapsassistenten API
       ↓ (fetch_conversations.py)
conversations.jsonl
       ↓ (golden_questions/src/main.py)
golden_questions.jsonl
       ↓ (select_representative_questions.py)
representative_questions.jsonl
       ↓ (eval_from_golden_questions/src/main.py)
evaluation_results.jsonl + metrics
```

---

## Project Structure

```
KuA_evals/
├── ka_api/                          # Fetch conversation threads from API
│   ├── fetch_conversations.py       # Main fetch script
│   ├── analyze_topics_llm.py        # Topic analysis
│   └── README.md
├── golden_questions/                # Extract and categorize questions
│   ├── src/
│   │   ├── main.py                  # Pipeline orchestration
│   │   ├── loader.py                # Load conversations
│   │   ├── filter.py                # Filter quality conversations
│   │   ├── extractor.py             # Extract questions
│   │   ├── reformulator_llm.py      # Reformulate vague questions
│   │   ├── categorizer_llm.py       # Categorize usage mode
│   │   ├── subject_categorizer_llm.py  # Categorize subject/topic
│   │   └── deduplicator.py          # Remove duplicates
│   └── README.md
└── eval_from_golden_questions/      # Run RAG evaluations
    ├── select_representative_questions.py  # Select balanced subset
    ├── src/
    │   ├── main.py                  # CLI entry point
    │   ├── rag_querier.py           # Query RAG system
    │   ├── evaluator.py             # Run metrics
    │   ├── metrics.py               # Metric definitions
    │   └── reporter.py              # Generate reports
    ├── dashboard/                   # Streamlit dashboard
    │   ├── app.py                   # Dashboard application
    │   ├── data_loader.py           # Load evaluation results
    │   ├── metrics_calc.py          # Metric calculations
    │   └── components/              # UI components
    └── README.md
```

---

## Development

This project follows spec-driven TDD development. See [CLAUDE.md](CLAUDE.md) for development guidelines.

### Running Tests

```bash
# Test golden_questions
cd golden_questions
uv run pytest tests/ -v

# Test eval_from_golden_questions
cd eval_from_golden_questions
uv run pytest tests/ -v
```

---

## Documentation

- [ka_api/README.md](ka_api/README.md) - API fetching and analysis
- [golden_questions/README.md](golden_questions/README.md) - Question extraction pipeline
- [eval_from_golden_questions/README.md](eval_from_golden_questions/README.md) - Evaluation system
- [docs/usage_modes.md](docs/usage_modes.md) - Usage mode categorization reference

---

## License

[Add license information here]
