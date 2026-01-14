# Golden Questions Extraction Specification

## Overview

Extract high-quality, standalone evaluation questions from production conversation threads in Norwegian. Questions should be complete, unambiguous, and suitable for RAG system evaluation.

## Requirements

### Functional Requirements

1. **Load Conversations**: Parse JSONL file containing conversation records
2. **Filter Quality**: Exclude empty, test, or low-quality conversations
3. **Extract Questions**: Identify user questions from conversation messages
4. **Add Context**: Make questions standalone using conversation history
5. **Deduplicate**: Remove semantically identical questions
6. **Output**: Save as JSONL with metadata

### Non-Functional Requirements

- Handle Norwegian language text
- Process 870+ conversations efficiently
- Maintain data privacy (no PII in logs)
- Type-safe implementation with full annotations
- >80% test coverage
- Idempotent processing

## Data Models

### Input Format (JSONL)

```json
{
  "conversation": {
    "id": "string",
    "topic": "string",
    "entityId": "string",
    "userId": "string",
    "created": number
  },
  "messages": [
    {
      "id": "string",
      "text": "string",
      "role": "system" | "user" | "assistant" | null,
      "created": number,
      "chunks": [
        {
          "chunkId": "string",
          "docTitle": "string",
          "docNum": "string",
          "contentMarkdown": "string"
        }
      ]
    }
  ]
}
```

### Output Format (JSONL)

```json
{
  "id": "6iRdNYynK6RuLCnKo5tRf_0",
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
  "document_types": ["Årsrapport", "Proposisjon til Stortinget"],
  "subject_topics": ["Digitalisering og kunstig intelligens", "Innovasjon og fornyelse"],
  "metadata": {
    "topic": "Riktig sidetallsreferanser i pdf.",
    // "user_id": "00t_4xY_olDg8_s5GaDJN",
    "created": 1764159128430
  }
}
```

### Python Data Models

```python
from dataclasses import dataclass
from typing import List, Optional, Dict, Any

@dataclass
class Message:
    """Single message in a conversation."""
    id: str
    text: str
    role: Optional[str]  # "system", "user", "assistant", or None
    created: int
    chunks: List[Dict[str, Any]]

@dataclass
class Conversation:
    """Complete conversation thread."""
    id: str
    topic: str
    entityId: str
    userId: str
    created: int
    messages: List[Message]

@dataclass
class UsageMode:
    """RAG system usage mode categorization."""
    document_scope: str              # "single_document" or "multi_document"
    operation_type: str              # E.g., "simple_qa", "aggregation", "inference"
    output_complexity: str           # "factoid", "prose", "list", or "table"

@dataclass
class GoldenQuestion:
    """Extracted question with metadata."""
    id: str                         # Unique identifier: "{conversation_id}_{message_number}"
    question: str                    # Standalone question text
    original_question: str           # Original user message
    conversation_id: str            # Source conversation ID
    context_messages: List[str]     # Previous messages used for context
    has_retrieval: bool             # Whether assistant had retrieval chunks
    usage_mode: UsageMode           # RAG usage mode categorization
    document_types: List[str]       # Extracted document types from filterValue
    subject_topics: List[str]       # LLM-categorized subject domain topics
    metadata: Dict[str, Any]        # Additional metadata (topic, userId, etc)
```

## Usage Mode Categorization

Questions should be categorized according to three dimensions: document scope, operation type, and output complexity. This helps evaluate RAG system performance across different use cases.

### Document Scope

| Value             | Description                                           |
| ----------------- | ----------------------------------------------------- |
| `single_document` | Question can be answered from a single document       |
| `multi_document`  | Question requires information from multiple documents |

### Operation Types

#### Single-Document Operations

| Type            | Description                       | Example                                            |
| --------------- | --------------------------------- | -------------------------------------------------- |
| `simple_qa`     | Find one fact in one document     | "Hva er budsjettet til Digdir i 2024?"             |
| `extraction`    | Extract specific information/list | "Hva er styringsparameterne i tildelingsbrevet?"   |
| `summarization` | Summarize one document            | "Gi et sammendrag av denne evalueringen"           |
| `locate`        | Find where something is stated    | "Hvor i instruksen står det om Digdirs myndighet?" |

#### Multi-Document Operations

| Type              | Description                    | Example                                                         |
| ----------------- | ------------------------------ | --------------------------------------------------------------- |
| `aggregation`     | Count/sum across documents     | "Hvor mange etater har fått merknad om internkontroll?"         |
| `comparison`      | Compare two or more documents  | "Sammenlign prioriteringene til Digdir og DFØ"                  |
| `synthesis`       | Combine information into whole | "Hva vet vi om digitalisering i helsesektoren?"                 |
| `temporal`        | Change over time               | "Hvordan har målene endret seg fra 2022 til 2024?"              |
| `cross_reference` | Link related information       | "Hvilke evalueringer finnes om ordninger nevnt i denne NOU-en?" |

#### Reasoning Operations

| Type             | Description                | Example                                                  |
| ---------------- | -------------------------- | -------------------------------------------------------- |
| `inference`      | Draw conclusion from facts | "Tyder funnene på at reformen har virket?"               |
| `classification` | Categorize findings        | "Hvilke utfordringer handler om økonomi vs. kompetanse?" |
| `gap_analysis`   | Identify gaps              | "Hva dekkes ikke av eksisterende veiledere?"             |

### Output Complexity

| Type      | Description              | Example                              |
| --------- | ------------------------ | ------------------------------------ |
| `factoid` | One word/number/sentence | "Når ble instruksen sist oppdatert?" |
| `prose`   | Coherent text            | "Forklar bakgrunnen for reformen"    |
| `list`    | Bullet list              | "List opp hovedanbefalingene"        |
| `table`   | Structured table         | "Lag tabell over mål og resultater"  |

### Categorization Strategy

This project uses an **LLM-based approach** for accurate categorization:
- Uses Ollama with OpenAI-compatible API (local, no cost)
- Few-shot learning with 7 Norwegian examples
- Async/batch processing for efficiency
- Automatic retry logic for robustness

## Processing Pipeline

The pipeline processes conversations through 6 steps and generates 3 output files for full transparency:

1. **Load** conversations from JSONL
2. **Filter** for quality (saves dropped to transparency file)
3. **Extract** questions from messages
4. **Categorize** using LLM (Ollama)
5. **Deduplicate** questions (saves duplicates to transparency file)
6. **Save** output

**Output Files:**
- `golden_questions.jsonl` - Main output with accepted questions
- `golden_questions_dropped_conversations.jsonl` - Filtered conversations with reasons
- `golden_questions_dropped_duplicates.jsonl` - Duplicate questions with comparison

### 1. Load Conversations (`loader.py`)

```python
def load_conversations(file_path: str) -> List[Conversation]:
    """
    Load and parse JSONL conversation file.

    Args:
        file_path: Path to JSONL file

    Returns:
        List of Conversation objects

    Raises:
        FileNotFoundError: If file doesn't exist
        json.JSONDecodeError: If invalid JSON
        ValueError: If required fields missing
    """
```

**Implementation:**
- Read file line by line (memory efficient)
- Parse each line as JSON
- Validate required fields exist
- Convert to Conversation dataclass
- Log statistics (total conversations loaded)

**Error Handling:**
- Skip malformed lines with warning
- Raise exception if file not found
- Validate structure (conversation.id, messages list, etc.)

### 2. Filter Conversations (`filter.py`)

```python
def should_process_conversation(conv: Conversation) -> bool:
    """
    Determine if conversation should be processed.

    Args:
        conv: Conversation to evaluate

    Returns:
        True if conversation should be processed
    """
```

**Filtering Rules:**

Exclude if:
- Topic is "Ny tråd" AND no non-empty user messages
- All messages are system messages or have empty text
- No messages with role="user"

Include if:
- At least one user message with non-empty text

**Edge Cases:**
- Messages with role=null: treat as empty
- Whitespace-only text: treat as empty
- System prompts: always exclude from question extraction

### 3. Extract Questions (`extractor.py`)

```python
def extract_golden_questions(conv: Conversation) -> List[GoldenQuestion]:
    """
    Extract standalone questions from conversation.

    Args:
        conv: Conversation to process

    Returns:
        List of extracted golden questions
    """
```

**LLM-Based Question Reformulation (`reformulator_llm.py`):**

The system uses an LLM-based approach to reformulate vague or context-dependent questions into specific, standalone questions. This replaces the previous rule-based `build_standalone_question()` function.

```python
async def reformulate_question_llm_async(
    question: str,
    previous_messages: List[Message],
    client: AsyncOpenAI,
    model: str = "gpt-oss:120b-cloud",
    max_retries: int = 3,
) -> str:
    """
    Use LLM to reformulate vague question into standalone question.

    Args:
        question: Original user question
        previous_messages: Previous messages for context
        client: Async OpenAI client configured for Ollama
        model: Model name to use
        max_retries: Number of retry attempts on failure

    Returns:
        Reformulated standalone question

    Raises:
        ValueError: If LLM returns invalid response after all retries
    """
```

**LLM Prompt Strategy:**

System prompt guides the LLM to:
1. Analyze the question for vague references (pronouns, indefinite references)
2. Review conversation context to identify what is being referenced
3. Replace vague terms with specific information from context
4. Preserve the original question structure and intent
5. Return a clear, standalone question

Few-shot examples demonstrate:
- Pronoun replacement: "Hva innebærer det?" → "Hva innebærer regjeringens dataspillstrategi?"
- Vague reference clarification: "Hvilke land kommer barna fra?" → "Hvilke land kommer barna i barnevernsstatistikken fra?"
- Follow-up conversion: "Og hvordan søker jeg på det?" → "Hvordan søker jeg på skattefradraget for dataspill?"

**Example Transformations:**

| Original                        | Previous Context                               | Standalone Question                                           |
| ------------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| "Og hvordan søker jeg på det?"  | "Hva er skattefradraget for dataspill?"        | "Hvordan søker jeg på skattefradraget for dataspill?"         |
| "Hva innebærer det?"            | "Regjeringen har lansert en dataspillstrategi" | "Hva innebærer regjeringens dataspillstrategi?"               |
| "Hvilke land kommer barna fra?" | "Barnevernsstatistikk 2023"                    | "Hvilke land kommer barna i barnevernsstatistikken 2023 fra?" |
| "Kan du oppsummere?"            | Topic: "NIM høringssvar barnevern"             | "Kan du oppsummere NIMs høringssvar om barnevern?"            |

**Performance:**
- Batch processing for efficiency
- Only reformulates questions that need it (preserves clear questions)
- Automatic retry on failures
- Progress tracking with tqdm

### 4. Deduplicate Questions (`deduplicator.py`)

```python
def deduplicate_questions(
    questions: List[GoldenQuestion],
    output_dropped_file: Optional[str] = None,
    use_semantic: bool = True,
    similarity_threshold: float = 0.92,
) -> List[GoldenQuestion]:
    """
    Remove semantically duplicate questions using embedding-based similarity.

    Args:
        questions: List of questions to deduplicate
        output_dropped_file: Optional path to save dropped duplicates
        use_semantic: Whether to use semantic similarity (default: True)
        similarity_threshold: Cosine similarity threshold (default: 0.92)

    Returns:
        Deduplicated list (preserves first occurrence)

    Raises:
        ValueError: If similarity_threshold not in range [0.0, 1.0]
    """
```

**Deduplication Strategy (Semantic - Implemented):**

The deduplicator uses a two-stage approach:

**Stage 1: Exact Matching (Fast Path)**
- Normalize text: lowercase, strip whitespace, remove punctuation
- Check for exact matches in normalized form
- Skip expensive embedding computation for obvious duplicates

**Stage 2: Semantic Similarity (Embedding-Based)**
- Generate embeddings using Ollama (`nomic-embed-text` model)
- Compute pairwise cosine similarity between question embeddings
- Cluster similar questions using similarity threshold
- Default threshold: **0.92** (tuned for Norwegian questions)
- Keep first occurrence of each cluster

**Embedding Model:**
- Model: `nomic-embed-text` via Ollama
- Dimensions: 1024
- Language: Multilingual (excellent for Norwegian)
- Provider: Local Ollama instance (no API costs)

**Similarity Threshold Selection:**
- **0.92**: Recommended default (balances precision/recall)
- Higher (0.95+): More conservative, may keep near-duplicates
- Lower (0.85-0.90): More aggressive, may drop distinct questions

**Examples of Semantic Duplicates:**

| Question 1                              | Question 2                                 | Similarity | Action                      |
| --------------------------------------- | ------------------------------------------ | ---------- | --------------------------- |
| "Hva er budsjettet til Digdir i 2024?"  | "Hvilket budsjett har Digdir for 2024?"    | 0.94       | Remove duplicate            |
| "Hvordan søker jeg på skattefradraget?" | "Hvordan kan jeg søke på skattefradraget?" | 0.96       | Remove duplicate            |
| "Gi et sammendrag av strategien"        | "Kan du oppsummere strategien?"            | 0.93       | Remove duplicate            |
| "Hva er målene for 2024?"               | "Hva er målene for 2025?"                  | 0.89       | Keep both (different years) |

**Performance Optimization:**
- Batch embedding generation for efficiency
- Early exact-match detection to skip embedding computation
- Progress bars for long operations
- Async processing where possible

**Error Handling:**
- Fallback to exact matching if Ollama unavailable
- Graceful degradation with warning logs
- Retry logic for transient embedding failures
- Clear error messages for debugging

**Transparency:**
- Dropped duplicates saved to `*_dropped_duplicates.jsonl`
- Includes semantic similarity scores in transparency file
- Shows both exact match and embedding-based duplicates
- Enables audit of deduplication decisions

### 5. Categorize Questions (`categorizer.py`)

### LLM-Based Categorization

Uses Ollama with OpenAI-compatible API:

```python
async def categorize_question_llm_async(
    question: GoldenQuestion,
    client: AsyncOpenAI,
    model: str = "gpt-oss:120b-cloud",
    max_retries: int = 3,
) -> UsageMode:
    """
    Use LLM to categorize question asynchronously.

    Args:
        question: Question to categorize
        client: Async OpenAI client configured for Ollama
        model: Model name to use (default: gpt-oss:120b-cloud)
        max_retries: Number of retry attempts on failure

    Returns:
        UsageMode classification
    """
```

Features:
- **Few-shot learning**: Uses 7 Norwegian examples covering all operation types
- **Async/batch processing**: Processes questions concurrently for efficiency
- **Retry logic**: Automatic retry on API failures or invalid JSON
- **Error handling**: Graceful degradation with detailed logging
- **Ollama integration**: Uses local Ollama instance (http://localhost:11434/v1)

Main pipeline (uses LLM by default):
```bash
python -m src.main prod_conversations.jsonl \
  --output output/golden_questions.jsonl \
  --model gpt-oss:120b-cloud \
  --batch-size 10
```

LLM prompt template:
```
Du er en ekspert på å kategorisere spørsmål til et RAG system.

[7 few-shot examples with Norwegian questions]

Categorize this Norwegian question:
Question: "{question}"

Return JSON: {
  "document_scope": "single_document" or "multi_document",
  "operation_type": "...",
  "output_complexity": "..."
}
```

### 6. Unique Message Identifiers (`extractor.py`)

**Requirement:** Each golden question must have a unique, deterministic identifier that combines conversation ID and message position.

```python
def generate_message_id(conversation_id: str, user_message_index: int) -> str:
    """
    Generate unique identifier for a golden message.

    Format: "{conversation_id}_{user_message_index}"

    Args:
        conversation_id: Unique conversation identifier
        user_message_index: Zero-based index of user message (first user message = 0)

    Returns:
        Unique identifier string

    Examples:
        >>> generate_message_id("k1MBbzf_DZsTpLl86odSz", 0)
        "k1MBbzf_DZsTpLl86odSz_0"
        >>> generate_message_id("k1MBbzf_DZsTpLl86odSz", 1)
        "k1MBbzf_DZsTpLl86odSz_1"
    """
```

**Implementation Details:**
- Track user message count separately from total message count
- System and assistant messages do not increment the user message counter
- Message numbering starts from 0 for the first user message
- ID format: `{conversation_id}_{user_message_index}`
- IDs are deterministic and reproducible across runs

**Examples:**

Conversation with messages:
1. System: "You are a helpful assistant" → Not counted
2. User: "Hva er budsjettet?" → ID: `conv123_0`
3. Assistant: "Budsjettet er..." → Not counted
4. User: "Og for 2025?" → ID: `conv123_1`

### 7. Document Type Extraction (`extractor.py`)

**Requirement:** Extract document types from the `filterValue.fields` structure in conversation messages.

```python
def extract_document_types(messages: List[Message]) -> List[str]:
    """
    Extract document types from filterValue structure in messages.

    Searches for entries where field="type" in filterValue.fields
    and extracts the "selected-options" list.

    Args:
        messages: List of conversation messages

    Returns:
        List of unique document type strings (empty if none found)

    Raises:
        ValueError: If filterValue structure is malformed
    """
```

**FilterValue Structure (from production data):**

```json
{
  "filterValue": {
    "type": "typesense",
    "fields": [
      {
        "type": "multiselect",
        "field": "type",
        "selected-options": ["Årsrapport", "Proposisjon til Stortinget"]
      },
      {
        "type": "multiselect",
        "field": "orgs_long",
        "selected-options": ["Barne- og familiedepartementet"]
      }
    ]
  }
}
```

**Extraction Logic:**
1. Iterate through all messages in conversation
2. For each message with non-null `filterValue`:
   - Check if `filterValue.fields` exists and is a list
   - Find entries where `field == "type"`
   - Extract `selected-options` list
3. Combine all document types across messages
4. Remove duplicates
5. Apply auto-correction rules

**Auto-Correction Rules:**
- `"Årsrapprt"` → `"Årsrapport"` (fix typo)

**Known Valid Document Types (for reference, not filtering):**
- Evaluering
- Instruks
- Melding til Stortinget
- Proposisjon til Stortinget
- Statusrapport
- Strategi/plan
- Tildelingsbrev
- Årsrapport

**Unknown Document Types:**
- Log warning for unknown types
- Preserve the unknown type in output (do not filter out)
- Unknown types will be useful for LLM categorization analysis

**Multi-Label:**
- A question can have 0 or more document types
- Return empty list `[]` if no filterValue with type field found

**Error Handling:**
- Skip malformed filterValue structures with warning
- Continue processing remaining messages
- Raise ValueError only if structure is fundamentally invalid (not just missing)

### 8. Subject Topic Categorization (`subject_categorizer_llm.py`)

**Requirement:** Use separate LLM call to categorize questions into subject domain topics using Norwegian public sector categories derived from production data analysis.

```python
async def categorize_subject_topics_llm_async(
    question: GoldenQuestion,
    client: AsyncOpenAI,
    model: str = "gpt-oss:120b-cloud",
    max_retries: int = 3,
) -> List[str]:
    """
    Use LLM to categorize question into subject domain topics.

    This is a SEPARATE LLM call from usage mode categorization,
    allowing focused prompts for better quality.

    Args:
        question: Question to categorize
        client: Async OpenAI client configured for Ollama
        model: Model name to use
        max_retries: Number of retry attempts on failure

    Returns:
        List of subject topic strings (empty if no relevant topics)

    Raises:
        ValueError: If LLM returns invalid response after all retries
    """
```

**Subject Domain Categories (from production data):**

**TIER 1 - High usage (100+ mentions):**
- Forvaltning og etatsstyring (419 mentions)
- Digitalisering og kunstig intelligens (360 mentions)
- Innovasjon og fornyelse (138 mentions)
- Økonomi og budsjett (123 mentions)
- Likestilling og mangfold (110 mentions)

**TIER 2 - Medium usage (30-99 mentions):**
- Arbeidsliv og HR (94 mentions)
- Barnevern (57 mentions)
- Statistikk og data (52 mentions)
- Justis og rettsvesen (44 mentions)
- Miljø og bærekraft (43 mentions)
- Forsvar og sikkerhet (36 mentions)
- Helse og omsorg (33 mentions)
- Utdanning og forskning (32 mentions)

**TIER 3 - Lower usage (18-29 mentions):**
- Språk og kultur (25 mentions)
- Internasjonale forhold (22 mentions)
- Innvandring og integrering (18 mentions)
- Annet (catch-all for other topics)

**LLM Prompt Strategy:**

System prompt guides the LLM to:
1. Analyze the question content and identify subject domains
2. Match to the predefined Norwegian public sector categories
3. Select 0 or more relevant topics (multi-label)
4. Return empty list if no topics are clearly relevant
5. Prefer specific categories over generic "Annet"

Few-shot examples demonstrate:
- Single topic: "Hva er budsjettet til Digdir i 2024?" → ["Økonomi og budsjett"]
- Multiple topics: "Hvordan påvirker digitalisering mangfoldet i offentlig sektor?" → ["Digitalisering og kunstig intelligens", "Likestilling og mangfold"]
- No topics: "Kan du gi et sammendrag?" → []

**Multi-Label Classification:**
- A question can have 0 or more subject topics
- No minimum or maximum number of topics
- Prefer precision over recall (only assign if clearly relevant)

**Performance:**
- Separate LLM call from usage mode categorization (better quality via focused prompts)
- Batch processing for efficiency
- Async implementation
- Automatic retry on failures

**Integration with Pipeline:**
- New pipeline step: "Step 4b: Categorize subject topics"
- Runs after usage mode categorization (Step 4)
- Before deduplication (Step 5)
- Uses same Ollama client and model

### 9. Transparency & Trust (`filter.py`, `deduplicator.py`)

**Requirement:** The pipeline must provide full transparency by saving all dropped records to separate files for inspection. This builds trust and allows verification of filtering decisions.

#### Output Files

The pipeline generates **3 output files**:

1. **Main Output**: `output/golden_questions.jsonl`
   - Final set of unique, categorized questions that passed all filters

2. **Dropped Conversations**: `output/golden_questions_dropped_conversations.jsonl`
   - Conversations filtered out during Step 2 (filtering)

3. **Dropped Duplicates**: `output/golden_questions_dropped_duplicates.jsonl`
   - Questions removed during Step 5 (deduplication)

#### Dropped Conversations Format

```python
def save_dropped_conversations(
    dropped: list[Conversation],
    reasons: list[str],
    output_file: str,
) -> None:
    """
    Save dropped conversations to JSONL file for inspection.

    Each record contains:
    - conversation_id: Unique identifier
    - topic: Conversation topic
    - created: Timestamp
    - message_count: Total number of messages
    - drop_reason: Human-readable explanation (e.g., "Ny tråd with no user messages")
    - messages: First 5 messages for context (truncated to 200 chars)
    """
```

Example record:
```json
{
  "conversation_id": "abc123",
  "topic": "Ny tråd",
//   "user_id": "user456",
  "created": 1234567890,
  "message_count": 2,
  "drop_reason": "Ny tråd with no user messages",
  "messages": [
    {
      "id": "msg1",
      "role": "system",
      "text": "Hei! Hvordan kan jeg hjelpe deg?",
      "created": 1234567890
    }
  ]
}
```

**Drop Reasons:**
- `"Ny tråd with no user messages"` - Topic is "Ny tråd" and no user questions
- `"No user messages"` - Conversation has no messages from users
- `"Only system messages"` - All messages are system-generated
- `"All messages empty"` - All messages have empty text

#### Dropped Duplicates Format

```python
def save_dropped_duplicates(
    duplicates: List[tuple[GoldenQuestion, GoldenQuestion]],
    output_file: str,
) -> None:
    """
    Save dropped duplicate questions to JSONL file for inspection.

    Each record contains:
    - dropped_question: The duplicate that was removed
    - kept_original: The first occurrence that was kept
    - normalized_form: The normalized text used for matching
    - drop_reason: Always "Duplicate of earlier question"
    """
```

Example record:
```json
{
  "dropped_question": {
    "text": "Hva er budsjettet til Digdir i 2024?",
    "original_text": "Hva er budsjettet til Digdir i 2024?",
    "conversation_id": "conv456",
    "has_retrieval": false
  },
  "kept_original": {
    "text": "Hva er budsjettet til Digdir i 2024?",
    "original_text": "Kan du finne budsjettet til Digdir i 2024?",
    "conversation_id": "conv123",
    "has_retrieval": true
  },
  "normalized_form": "hva er budsjettet til digdir i 2024",
  "drop_reason": "Duplicate of earlier question"
}
```

#### Pipeline Integration

The main pipeline automatically creates transparency files:

```python
# Prepare transparency output paths
output_path = Path(output_file)
dropped_conversations_file = (
    output_path.parent / f"{output_path.stem}_dropped_conversations.jsonl"
)
dropped_duplicates_file = output_path.parent / f"{output_path.stem}_dropped_duplicates.jsonl"

# Pass to filter and deduplicator
filtered_conversations = filter_conversations(
    conversations, output_dropped_file=str(dropped_conversations_file)
)
deduplicated_questions = deduplicate_questions(
    categorized_questions, output_dropped_file=str(dropped_duplicates_file)
)
```

Console output shows transparency file locations:
```
📋 Transparency files:
  Dropped conversations: output/golden_questions_dropped_conversations.jsonl
  Dropped duplicates: output/golden_questions_dropped_duplicates.jsonl

✅ Pipeline complete!

📂 Output files:
  Main output: output/golden_questions.jsonl
  Dropped conversations: output/golden_questions_dropped_conversations.jsonl
  Dropped duplicates: output/golden_questions_dropped_duplicates.jsonl
```

#### Inspection Examples

**View drop reasons:**
```bash
cat output/golden_questions_dropped_conversations.jsonl | jq '.drop_reason' | sort | uniq -c
```

**Find conversations with many messages that were dropped:**
```bash
cat output/golden_questions_dropped_conversations.jsonl | jq 'select(.message_count > 5)'
```

**Compare duplicates:**
```bash
cat output/golden_questions_dropped_duplicates.jsonl | \
  jq '{kept: .kept_original.original_text, dropped: .dropped_question.original_text}'
```

See `TRANSPARENCY.md` for comprehensive inspection guide.

## Test Scenarios

### Unit Tests

#### `test_loader.py`

```python
def test_load_valid_jsonl():
    """Load valid JSONL file successfully."""

def test_load_malformed_json():
    """Handle malformed JSON gracefully."""

def test_load_missing_fields():
    """Raise error for missing required fields."""

def test_load_empty_file():
    """Handle empty file."""
```

#### `test_filter.py`

```python
def test_filter_empty_conversation():
    """Exclude conversation with only empty messages."""

def test_filter_ny_traad_no_messages():
    """Exclude 'Ny tråd' with no user messages."""

def test_filter_valid_conversation():
    """Include conversation with user messages."""

def test_filter_system_only():
    """Exclude conversation with only system messages."""
```

#### `test_extractor.py`

```python
def test_extract_standalone_question():
    """Extract question that needs no reformulation."""

def test_extract_with_pronoun():
    """Build context for question with pronoun using LLM."""

def test_extract_follow_up():
    """Build context for follow-up question using LLM."""

def test_extract_no_user_messages():
    """Return empty list for conversation without user messages."""

def test_has_retrieval_true():
    """Set has_retrieval=True when assistant had chunks."""

def test_has_retrieval_false():
    """Set has_retrieval=False when assistant had no chunks."""
```

#### `test_reformulator_llm.py`

```python
def test_needs_reformulation_first_message():
    """First message never needs reformulation."""

def test_needs_reformulation_with_pronoun():
    """Detect pronouns requiring reformulation."""

def test_needs_reformulation_very_short():
    """Very short messages need reformulation."""

def test_needs_reformulation_context_reference():
    """Detect context references like 'også', 'videre'."""

def test_needs_reformulation_long_clear_question():
    """Long clear questions don't need reformulation."""

def test_reformulate_question_llm_async():
    """Test LLM-based reformulation of vague question."""

def test_reformulate_question_with_pronoun():
    """Replace pronoun with specific reference from context."""

def test_reformulate_question_follow_up():
    """Convert follow-up question to standalone."""

def test_reformulate_question_vague_reference():
    """Clarify vague references like 'barna' with context."""

def test_reformulate_question_preserves_clear():
    """Clear standalone questions returned unchanged."""

def test_reformulate_question_retry_on_failure():
    """Retry on API failure with exponential backoff."""

def test_reformulate_question_invalid_json():
    """Handle invalid JSON responses gracefully."""
```

#### `test_deduplicator.py`

```python
def test_deduplicate_exact_match():
    """Remove exact duplicate questions."""

def test_deduplicate_case_insensitive():
    """Remove duplicates ignoring case."""

def test_deduplicate_preserve_order():
    """Keep first occurrence of duplicate."""

def test_deduplicate_no_duplicates():
    """Return all questions when no duplicates."""
```

#### `test_transparency.py` (Integration Tests)

```python
def test_dropped_conversations_file_created():
    """Verify dropped conversations file is created with correct format."""
    # Run pipeline with test data
    # Verify dropped_conversations.jsonl exists
    # Verify each record has: conversation_id, drop_reason, message_count, messages

def test_dropped_duplicates_file_created():
    """Verify dropped duplicates file is created with correct format."""
    # Run pipeline with test data including duplicates
    # Verify dropped_duplicates.jsonl exists
    # Verify each record has: dropped_question, kept_original, normalized_form

def test_drop_reasons_are_correct():
    """Verify drop reasons match the actual filtering logic."""
    # Create conversation with "Ny tråd" and no user messages
    # Verify drop_reason is "Ny tråd with no user messages"
    # Create conversation with only system messages
    # Verify drop_reason is "Only system messages"

def test_duplicate_tracking_shows_both_versions():
    """Verify dropped duplicates show both versions for comparison."""
    # Create two identical questions from different conversations
    # Verify dropped_duplicates.jsonl shows:
    #   - Which was dropped (second occurrence)
    #   - Which was kept (first occurrence)
    #   - Normalized form used for matching
```

#### `test_categorizer.py`

```python
def test_categorize_simple_qa():
    """Categorize simple QA question correctly."""
    # "Hva er budsjettet til Digdir i 2024?"
    # Expected: single_document, simple_qa, factoid

def test_categorize_extraction():
    """Categorize extraction question correctly."""
    # "Hva er styringsparameterne i tildelingsbrevet?"
    # Expected: single_document, extraction, list

def test_categorize_summarization():
    """Categorize summarization request correctly."""
    # "Gi et sammendrag av denne evalueringen"
    # Expected: single_document, summarization, prose

def test_categorize_comparison():
    """Categorize comparison question correctly."""
    # "Sammenlign prioriteringene til Digdir og DFØ"
    # Expected: multi_document, comparison, prose

def test_categorize_aggregation():
    """Categorize aggregation question correctly."""
    # "Hvor mange etater har fått merknad om internkontroll?"
    # Expected: multi_document, aggregation, factoid

def test_categorize_temporal():
    """Categorize temporal question correctly."""
    # "Hvordan har målene endret seg fra 2022 til 2024?"
    # Expected: multi_document, temporal, prose

def test_categorize_inference():
    """Categorize inference question correctly."""
    # "Tyder funnene på at reformen har virket?"
    # Expected: single_document, inference, prose

def test_categorize_table_output():
    """Detect table output complexity."""
    # "Lag tabell over mål og resultater"
    # Expected: output_complexity = table
```

### Integration Tests

```python
def test_end_to_end_pipeline():
    """Test complete pipeline with sample data."""
    # Load test fixture
    # Filter conversations
    # Extract questions
    # Deduplicate
    # Verify output format
    # Verify question quality
```

## Edge Cases & Error Handling

### Edge Cases

1. **Empty conversations**: No messages → Skip
2. **Single message**: System prompt only → Skip
3. **Role=null messages**: Treat as empty → Skip
4. **Very long messages**: Accept as-is → Process normally
5. **Multiple questions in one message**: Extract as single question
6. **Non-question statements**: Include if user message (may be request)
7. **Mixed language**: Accept as-is (primarily Norwegian)

### Error Handling

1. **File not found**: Raise FileNotFoundError with clear message
2. **Invalid JSON**: Log warning, skip line, continue
3. **Missing fields**: Raise ValueError with field name
4. **Encoding errors**: Use UTF-8, raise error if fails
5. **Memory issues**: Use streaming/line-by-line processing

## Performance Considerations

- **Streaming**: Read JSONL line by line (not all into memory)
- **Progress bars**: Use tqdm for user feedback
- **Batch processing**: Process in chunks if needed
- **Expected runtime**: <5 minutes for 870 conversations

## Implementation Status

- [x] Data models defined (including UsageMode)
- [x] Loader implemented
- [x] Filter implemented (with transparency support)
- [x] Extractor implemented
- [x] Deduplicator implemented (exact + semantic with embeddings)
- [x] LLM-based categorizer
- [x] LLM-based question reformulator
- [x] Semantic deduplication using embeddings (2025-12-10)
- [x] **Unique message identifiers** (NEW - 2025-12-11)
- [x] **Document type extraction from filterValue** (NEW - 2025-12-11)
- [x] **Subject topic categorization with separate LLM** (NEW - 2025-12-11)
- [x] Main script with LLM integration (updated with 7-step pipeline)
- [x] Transparency feature (dropped conversations and duplicates tracking)
- [x] Statistics logging for document types and subject topics
- [x] Unit tests for LLM categorizer (12 tests passing)
- [x] Unit tests for LLM reformulator (12 tests passing)
- [x] Unit tests for semantic deduplicator (TBD tests passing)
- [x] Unit tests for unique IDs and document types (11 tests passing)
- [x] Unit tests for subject topic categorizer (7 tests passing)
- [x] Integration tests passing (including transparency verification)
- [x] Full test suite: 88 tests total, 25 new feature tests passing, >88% coverage on new modules
- [x] Async/batch processing for reformulation, embeddings, and subject topics
- [x] Error handling with fallback to exact matching
- [ ] Process full dataset with LLM and semantic deduplication
- [ ] Usage mode distribution analysis

### Semantic Deduplication Using Embeddings (Implemented)

**Status**: Fully implemented and tested (2025-12-10)

**Implementation Details**:
- Module: `src/deduplicator.py` (enhanced with semantic similarity)
- Tests: `tests/test_deduplicator.py` (includes semantic similarity tests)
- Embedding Model: `nomic-embed-text` via Ollama
- Default Threshold: 0.92 (configurable)

**Features**:
- Two-stage deduplication (exact match + semantic similarity)
- Batch embedding generation for efficiency
- Cosine similarity computation for pairwise comparison
- Configurable similarity threshold
- Fallback to exact matching on errors
- Enhanced transparency with similarity scores

**Test Coverage**:
- ✅ Embedding generation with Ollama
- ✅ Cosine similarity calculation
- ✅ Semantic duplicate detection with various thresholds
- ✅ Exact match fast path
- ✅ Error handling and fallback
- ✅ Transparency file format with similarity scores

**Performance Characteristics**:
- Fast path: O(n) for exact duplicates
- Semantic path: O(n²) for pairwise similarity (optimized with early termination)
- Embedding generation: Batched for efficiency
- Memory usage: O(n) for embeddings storage

**Configuration Options**:
```python
deduplicate_questions(
    questions,
    output_dropped_file="output/dropped.jsonl",
    use_semantic=True,          # Enable semantic deduplication
    similarity_threshold=0.92,   # Cosine similarity threshold
)
```

### New Features: IDs, Document Types, Subject Topics (Implemented)

**Status**: Fully implemented and tested (2025-12-11)

#### Feature 1: Unique Message Identifiers

**Implementation Details**:
- Module: `src/extractor.py` (function `generate_message_id`)
- Tests: `tests/test_extractor.py` (3 tests for unique ID generation)
- Format: `{conversation_id}_{user_message_index}`
- Tracking: User messages numbered starting from 0

**Features**:
- Deterministic ID generation (reproducible across runs)
- User message index tracked separately from total message index
- System and assistant messages do not increment counter
- IDs preserved in output JSONL format

**Test Coverage**:
- ✅ First user message gets _0 suffix
- ✅ Multiple user messages get sequential indices (_0, _1, _2, etc.)
- ✅ ID format matches conversation_id prefix
- ✅ All 3 tests passing

#### Feature 2: Document Type Extraction

**Implementation Details**:
- Module: `src/extractor.py` (function `extract_document_types`)
- Tests: `tests/test_extractor.py` (8 tests for document type extraction)
- Extraction Source: `filterValue.fields` where `field="type"`
- Auto-correction: "Årsrapprt" → "Årsrapport"

**Features**:
- Extracts from all messages in conversation
- Removes duplicates while preserving order
- Logs warnings for unknown document types but preserves them
- Handles malformed filterValue structures gracefully
- Multi-label: 0 or more document types per question

**Known Document Types**:
- Evaluering, Instruks, Melding til Stortinget
- Proposisjon til Stortinget, Statusrapport
- Strategi/plan, Tildelingsbrev, Årsrapport

**Test Coverage**:
- ✅ Single document type extraction
- ✅ Multiple document types extraction
- ✅ Empty list when no filterValue
- ✅ Auto-correction of typos
- ✅ Preservation of unknown types
- ✅ Collection from multiple messages
- ✅ Ignoring non-type filter fields
- ✅ All 8 tests passing

#### Feature 3: Subject Topic Categorization

**Implementation Details**:
- Module: `src/subject_categorizer_llm.py` (new file)
- Tests: `tests/test_subject_categorizer_llm.py` (7 tests)
- LLM Call: Separate from usage mode (focused prompt for better quality)
- Model: Ollama with OpenAI-compatible API
- Topics: 19 predefined Norwegian public sector categories

**Subject Domain Categories**:
- **Tier 1** (100+ mentions): Forvaltning og etatsstyring, Digitalisering og kunstig intelligens, Innovasjon og fornyelse, Økonomi og budsjett, Likestilling og mangfold
- **Tier 2** (30-99 mentions): Arbeidsliv og HR, Barnevern, Statistikk og data, Justis og rettsvesen, Miljø og bærekraft, Forsvar og sikkerhet, Helse og omsorg, Utdanning og forskning
- **Tier 3** (18-29 mentions): Språk og kultur, Internasjonale forhold, Innvandring og integrering, Annet

**Features**:
- Separate LLM call for focused prompts (better quality)
- Multi-label classification (0 or more topics)
- Async/batch processing for efficiency
- Retry logic with exponential backoff
- Graceful error handling
- Empty list returned if no relevant topics
- Warnings logged for unknown topics but preserved

**Integration**:
- New Step 5 in 7-step pipeline (between usage categorization and deduplication)
- Statistics logging shows topic distribution
- Top 10 topics displayed in output summary

**Test Coverage**:
- ✅ Single topic categorization
- ✅ Multiple topics categorization
- ✅ No topics (empty list)
- ✅ Barnevern-specific topic
- ✅ Invalid JSON handling
- ✅ Retry on failure
- ✅ Tier 1 topics (high usage)
- ✅ All 7 tests passing

**Performance**:
- Async batch processing for speed
- Focused prompts improve categorization quality
- Separate from usage mode allows parallel development

### LLM-Based Question Reformulation (Implemented)

**Status**: Fully implemented and tested (2025-12-09)

**Implementation Details**:
- Module: `src/reformulator_llm.py` (72 lines, 86% test coverage)
- Tests: `tests/test_reformulator_llm.py` (12 tests, all passing)
- Integration: `src/extractor.py` updated to use async reformulation
- Pipeline: `src/main.py` updated to handle LLM reformulation

**Features**:
- Detection of vague/context-dependent questions (`needs_reformulation`)
- Async reformulation with retry and exponential backoff
- Fallback to original question on failures
- Few-shot learning with 4 Norwegian examples
- Context extraction from previous messages (max 3)
- Document title integration for better context

**Test Coverage**:
- ✅ Detection logic (pronouns, short messages, context references)
- ✅ LLM reformulation with various question types
- ✅ Retry on API failures
- ✅ Graceful error handling
- ✅ Integration with main pipeline

**Known Limitations**:
- Rate limiting with Ollama (gracefully handled with fallback)
- Requires Ollama service running locally
- No semantic similarity check for reformulated vs original

## LLM Provider Configuration

### Multi-Provider Support (Implemented)

**Status**: Fully implemented (2025-12-11)

The system supports multiple LLM providers through a lightweight abstraction layer:
- **Ollama** (default): Local deployment, no API costs
- **Azure OpenAI**: Enterprise-grade cloud deployment

#### Provider Abstraction

**Module**: `src/llm_provider.py`

```python
from enum import Enum
from dataclasses import dataclass
from typing import Union
from openai import OpenAI, AzureOpenAI

class LLMProvider(Enum):
    """Supported LLM providers."""
    OLLAMA = "ollama"
    AZURE = "azure"

@dataclass
class LLMConfig:
    """Unified LLM configuration for all providers."""
    provider: LLMProvider

    # Ollama configuration
    ollama_base_url: str | None = None
    ollama_chat_model: str | None = None
    ollama_embedding_model: str | None = None

    # Azure configuration
    azure_endpoint: str | None = None
    azure_api_key: str | None = None
    azure_api_version: str | None = None
    azure_chat_deployment: str | None = None
    azure_embedding_deployment: str | None = None

    @classmethod
    def from_env_and_args(cls, args) -> "LLMConfig":
        """Create config from environment variables and CLI arguments."""
        # CLI args override environment variables
        # Defaults to Ollama if no provider specified

def create_llm_client(config: LLMConfig) -> Union[OpenAI, AzureOpenAI]:
    """Factory function to create appropriate LLM client."""
    # Returns OpenAI client for Ollama or AzureOpenAI client for Azure

def get_chat_model_name(config: LLMConfig) -> str:
    """Get chat model name/deployment for the provider."""
    # Returns model name for Ollama or deployment name for Azure

def get_embedding_model_name(config: LLMConfig) -> str:
    """Get embedding model name/deployment for the provider."""
    # Returns model name for Ollama or deployment name for Azure
```

#### Configuration Options

**Environment Variables:**

```bash
# Provider selection (default: ollama)
LLM_PROVIDER=azure|ollama

# Ollama configuration (existing behavior)
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=gpt-oss:120b-cloud
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Azure OpenAI configuration (new)
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<your-api-key>
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_CHAT_DEPLOYMENT=<deployment-name>
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=<deployment-name>
```

**CLI Arguments:**

```bash
# Provider selection
--provider {ollama,azure}

# Azure-specific arguments
--azure-endpoint <url>
--azure-api-key <key>
--azure-chat-deployment <deployment-name>
--azure-embedding-deployment <deployment-name>

# Existing Ollama arguments (backward compatible)
--ollama-url <url>
--model <model-name>
```

**Configuration Priority:**
1. CLI arguments (highest priority)
2. Environment variables
3. Defaults (Ollama)

#### Usage Examples

**Using Ollama (default):**
```bash
python -m src.main input.jsonl
```

**Using Azure OpenAI:**
```bash
python -m src.main input.jsonl \
  --provider azure \
  --azure-endpoint https://myresource.openai.azure.com \
  --azure-api-key <key> \
  --azure-chat-deployment gpt4-deployment \
  --azure-embedding-deployment embedding-deployment
```

**Using environment variables:**
```bash
export LLM_PROVIDER=azure
export AZURE_OPENAI_ENDPOINT=https://myresource.openai.azure.com
export AZURE_OPENAI_API_KEY=<key>
export AZURE_OPENAI_CHAT_DEPLOYMENT=gpt4-deployment
export AZURE_OPENAI_EMBEDDING_DEPLOYMENT=embedding-deployment

python -m src.main input.jsonl
```

#### Dual Model Support

The system uses two types of models:
- **Chat Model**: Used for question reformulation, usage categorization, and subject topic categorization
- **Embedding Model**: Used for semantic deduplication

Both models are configured separately to allow flexibility in deployment.

#### Backward Compatibility

- Existing Ollama usage requires **no changes**
- Default provider is Ollama
- Existing CLI arguments (--ollama-url, --model) continue to work
- No breaking changes to function signatures

#### Error Handling

**Missing Azure Configuration:**
```
Azure provider requires AZURE_OPENAI_ENDPOINT.
Set via --azure-endpoint or AZURE_OPENAI_ENDPOINT env var.
```

**Provider-Aware Logging:**
```
Using azure provider
Azure endpoint: https://myresource.openai.azure.com
Chat deployment: gpt4-deployment
Embedding deployment: embedding-deployment
```

#### Implementation Status

- [x] Provider abstraction layer (llm_provider.py)
- [x] Configuration from environment variables
- [x] Configuration from CLI arguments
- [x] Factory function for client creation
- [x] Model name resolution helpers
- [x] Input validation with clear error messages
- [x] Unit tests with ~100% coverage
- [x] Integration with main.py
- [x] Integration with categorizer_llm.py
- [x] Integration with subject_categorizer_llm.py
- [x] Integration with reformulator_llm.py
- [x] Integration with deduplicator.py
- [x] Langfuse compatibility verified
- [x] Documentation (.env.example, README)
- [x] Full backward compatibility verified

## Known Limitations

1. No question quality scoring
2. No language detection (assumes Norwegian)
3. No answer quality filtering
4. Semantic deduplication is O(n²) for large datasets (optimized but still quadratic)
5. Embedding model (`nomic-embed-text`) requires ~2GB model download for Ollama

## Future Enhancements

1. Question quality scoring with confidence thresholds
2. Expected answer extraction from assistant responses
3. Multi-language support beyond Norwegian
4. Answer validation (check if chunks contain answer)
5. Usage mode distribution analysis and balancing
6. Stratified sampling based on usage modes
7. Support for additional LLM providers (Anthropic Claude, OpenRouter)
8. Semantic similarity search for finding similar questions in dataset
