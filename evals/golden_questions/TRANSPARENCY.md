# Pipeline Transparency

The pipeline provides full transparency by saving all dropped records to separate files for inspection. This builds trust and allows you to verify filtering decisions.

## Output Files

When you run the pipeline, you get **3 output files**:

```
output/
├── golden_questions.jsonl               # ✅ Main output: accepted questions
├── golden_questions_dropped_conversations.jsonl  # 📋 Dropped conversations
└── golden_questions_dropped_duplicates.jsonl     # 📋 Duplicate questions
```

---

## 1. Main Output (`golden_questions.jsonl`)

The final set of unique, categorized questions that passed all filters.

**Example:**
```json
{
  "question": "Hva er tiltakene i regjeringens dataspillstrategi 2024-2026?",
  "original_question": "kan du finne strategien...",
  "conversation_id": "6iRdNYynK6RuLCnKo5tRf",
  "has_retrieval": true,
  "usage_mode": {
    "document_scope": "single_document",
    "operation_type": "simple_qa",
    "output_complexity": "prose"
  },
  ...
}
```

---

## 2. Dropped Conversations (`*_dropped_conversations.jsonl`)

Conversations that were filtered out during Step 2 (filtering).

### What's Included

Each record contains:
- `conversation_id`: Unique conversation identifier
- `topic`: Conversation topic
- `user_id`: User who created the conversation
- `created`: Timestamp
- `message_count`: Total number of messages
- **`drop_reason`**: Why it was excluded (key transparency field!)
- `messages`: First 5 messages for context (truncated to 200 chars)

### Drop Reasons

| Reason | Description |
|--------|-------------|
| `Ny tråd with no user messages` | Topic is "Ny tråd" and no actual user questions |
| `No user messages` | Conversation has no messages from users |
| `Only system messages` | All messages are system-generated |
| `All messages empty` | All messages have empty text |

### Example Record

```json
{
  "conversation_id": "abc123",
  "topic": "Ny tråd",
  "user_id": "user456",
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

### Inspecting Dropped Conversations

```bash
# View all drop reasons
cat output/golden_questions_dropped_conversations.jsonl | jq '.drop_reason' | sort | uniq -c

# Find specific reason
cat output/golden_questions_dropped_conversations.jsonl | \
  jq 'select(.drop_reason == "Ny tråd with no user messages")'

# Check if legitimate conversations were dropped
cat output/golden_questions_dropped_conversations.jsonl | \
  jq 'select(.message_count > 5)' | less
```

---

## 3. Dropped Duplicates (`*_dropped_duplicates.jsonl`)

Questions that were removed during Step 5 (deduplication).

### What's Included

Each record contains:
- `dropped_question`: The duplicate that was removed
  - `text`: Standalone question text
  - `original_text`: Original user message
  - `conversation_id`: Where it came from
  - `has_retrieval`: Whether it had retrieval
- `kept_original`: The first occurrence that was kept
  - Same fields as dropped_question
- `normalized_form`: The normalized text used for matching
- `drop_reason`: Always "Duplicate of earlier question"

### Example Records

**Exact Match Duplicate:**
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
  "similarity_score": 1.0,
  "match_type": "exact_match",
  "normalized_form": "hva er budsjettet til digdir i 2024",
  "drop_reason": "Duplicate of earlier question"
}
```

**Semantic Duplicate (using embeddings):**
```json
{
  "dropped_question": {
    "text": "Hvilket budsjett har Digdir for 2024?",
    "original_text": "Hvilket budsjett har Digdir for 2024?",
    "conversation_id": "conv789",
    "has_retrieval": true
  },
  "kept_original": {
    "text": "Hva er budsjettet til Digdir i 2024?",
    "original_text": "Kan du finne budsjettet til Digdir i 2024?",
    "conversation_id": "conv123",
    "has_retrieval": true
  },
  "similarity_score": 0.9421,
  "match_type": "semantic_similarity",
  "normalized_form": "hvilket budsjett har digdir for 2024",
  "drop_reason": "Duplicate of earlier question"
}
```

### Inspecting Duplicates

```bash
# Count total duplicates
wc -l output/golden_questions_dropped_duplicates.jsonl

# Count exact matches vs semantic duplicates
cat output/golden_questions_dropped_duplicates.jsonl | jq '.match_type' | sort | uniq -c

# View similarity score distribution
cat output/golden_questions_dropped_duplicates.jsonl | jq '.similarity_score' | sort -n

# Find semantic duplicates with high similarity
cat output/golden_questions_dropped_duplicates.jsonl | \
  jq 'select(.match_type == "semantic_similarity" and .similarity_score >= 0.95)'

# Find semantic duplicates just above threshold
cat output/golden_questions_dropped_duplicates.jsonl | \
  jq 'select(.match_type == "semantic_similarity" and .similarity_score < 0.93)'

# See which conversations had duplicates
cat output/golden_questions_dropped_duplicates.jsonl | \
  jq '.dropped_question.conversation_id' | sort | uniq -c

# Find cases where duplicate had retrieval but original didn't
cat output/golden_questions_dropped_duplicates.jsonl | \
  jq 'select(.dropped_question.has_retrieval == true and .kept_original.has_retrieval == false)'

# Compare original vs dropped text with similarity scores
cat output/golden_questions_dropped_duplicates.jsonl | \
  jq '{kept: .kept_original.text, dropped: .dropped_question.text, similarity: .similarity_score, type: .match_type}' | head -20

# View semantic duplicates that are quite different textually
cat output/golden_questions_dropped_duplicates.jsonl | \
  jq 'select(.match_type == "semantic_similarity") | {kept: .kept_original.text, dropped: .dropped_question.text, similarity: .similarity_score}' | head -10
```

---

## Pipeline Output Example

```
2024-12-09 10:30:15 - src.main - INFO - Starting golden questions extraction pipeline
2024-12-09 10:30:15 - src.main - INFO - Input: prod_conversations.jsonl
2024-12-09 10:30:15 - src.main - INFO - Output: output/golden_questions.jsonl

📋 Transparency files:
  Dropped conversations: output/golden_questions_dropped_conversations.jsonl
  Dropped duplicates: output/golden_questions_dropped_duplicates.jsonl

Step 1: Loading conversations...
Loaded 870 conversations

Step 2: Filtering conversations...
Filtered 870 conversations down to 823 (47 excluded)
💾 Saved 47 dropped conversations to output/golden_questions_dropped_conversations.jsonl

Step 3: Extracting questions...
Extracted 2145 total questions

Step 4: Categorizing questions using LLM...
Completed LLM categorization for 2145 questions

Step 5: Deduplicating questions...
Deduplicated 2145 questions to 1722 (423 duplicates removed)
💾 Saved 423 duplicate questions to output/golden_questions_dropped_duplicates.jsonl

Step 6: Saving output...
Saved 1722 questions to output/golden_questions.jsonl

✅ Pipeline complete!

📂 Output files:
  Main output: output/golden_questions.jsonl
  Dropped conversations: output/golden_questions_dropped_conversations.jsonl
  Dropped duplicates: output/golden_questions_dropped_duplicates.jsonl
```

---

## Why This Matters

### 1. **Verify Filtering Logic**
Review dropped conversations to ensure legitimate data isn't being excluded.

```bash
# Check if any conversations with many messages were dropped
cat output/golden_questions_dropped_conversations.jsonl | \
  jq 'select(.message_count > 10)' | \
  jq -c '{id: .conversation_id, topic: .topic, reason: .drop_reason, count: .message_count}'
```

### 2. **Understand Deduplication**
See exactly which questions were considered duplicates and verify the logic.

```bash
# Find interesting duplicate cases
cat output/golden_questions_dropped_duplicates.jsonl | \
  jq 'select(.dropped_question.text != .kept_original.text)' | \
  jq '{dropped: .dropped_question.text, kept: .kept_original.text}' | head -10
```

### 3. **Debug Issues**
If expected questions are missing from the output, check the dropped files.

```bash
# Search for a specific conversation
cat output/golden_questions_dropped_conversations.jsonl | \
  jq 'select(.conversation_id == "your-conv-id")'

# Search for a specific question text
cat output/golden_questions_dropped_duplicates.jsonl | \
  jq 'select(.dropped_question.text | contains("your search term"))'
```

### 4. **Quality Assurance**
Audit the pipeline decisions to ensure quality.

```bash
# Random sample of dropped conversations
cat output/golden_questions_dropped_conversations.jsonl | shuf -n 10 | jq

# Random sample of duplicates
cat output/golden_questions_dropped_duplicates.jsonl | shuf -n 10 | jq
```

### 5. **Improve Filtering Rules**
If you find false positives (good data being dropped), adjust the filtering logic.

---

## Trust Through Transparency

**No black boxes.** Every decision the pipeline makes is documented:

✅ **Conversations filtered out** → See exactly why
✅ **Duplicates removed** → See what was kept vs dropped
✅ **Full audit trail** → Inspect any record

This allows you to:
- Verify correctness
- Debug issues
- Improve filtering rules
- Build confidence in the data

---

## Advanced Analysis

### Analyze Drop Patterns

```python
import json
from collections import Counter

# Load dropped conversations
with open('output/golden_questions_dropped_conversations.jsonl') as f:
    dropped = [json.loads(line) for line in f]

# Count reasons
reasons = Counter(d['drop_reason'] for d in dropped)
print("Drop reasons:", reasons)

# Find topics that were dropped
topics = Counter(d['topic'] for d in dropped)
print("Most common dropped topics:", topics.most_common(10))
```

### Analyze Duplicate Patterns

```python
import json

# Load duplicates
with open('output/golden_questions_dropped_duplicates.jsonl') as f:
    duplicates = [json.loads(line) for line in f]

# Find users with most duplicates
from collections import Counter
users = Counter(d['dropped_question']['conversation_id'][:20] for d in duplicates)
print("Users with most duplicate questions:", users.most_common(5))

# Check retrieval mismatch
retrieval_mismatch = [
    d for d in duplicates
    if d['dropped_question']['has_retrieval'] != d['kept_original']['has_retrieval']
]
print(f"Duplicates with retrieval mismatch: {len(retrieval_mismatch)}")
```

---

## Summary

| File | Purpose | When Created |
|------|---------|--------------|
| `golden_questions.jsonl` | Final output | Always |
| `*_dropped_conversations.jsonl` | Filtered conversations | If any conversations dropped |
| `*_dropped_duplicates.jsonl` | Duplicate questions | If any duplicates found |

**All files are in JSONL format** (one JSON object per line) for easy processing with `jq`, Python, or other tools.

This transparency allows you to **trust but verify** every decision the pipeline makes.
