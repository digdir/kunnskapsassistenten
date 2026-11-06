#!/usr/bin/env python3
"""Analyze conversation topics from JSONL file and categorize them using LLM."""

import logging
import sys
from collections import Counter
from typing import Dict, List

from openai import OpenAI
from tqdm import tqdm

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

# Ollama client for LLM operations
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)
model = "gpt-oss:20b"


def main(file_path: str, n: int | None = None):
    import json

    categories = [
        "Particularly polite user responses",
        "Very cute thread",
        "The user is very strict with the assistant in the thread",
        "Angry user responses",
        "Strict user responses",
        "Praise from users",
    ]

    counts = Counter()
    category_to_ids: Dict[str, List[str]] = {c: [] for c in categories}
    category_to_reasons: Dict[str, List[str]] = {c: [] for c in categories}

    with open(file_path, "r", encoding="utf-8") as f:
        try:
            for i, line in enumerate(tqdm(f, desc="Processing conversations", total=n)):
                if i <= 478:
                    continue

                if n is not None and i >= n:
                    break
                try:
                    conv = json.loads(line)
                except json.JSONDecodeError:
                    continue

                # Extract full thread: concatenate all non-system, non-assistant, non-empty text messages

                msgs = conv.get("messages")
                thread_parts = []

                for m in msgs:
                    text = m.get("text") or ""
                    role = m.get("role")

                    if not text.strip():
                        continue

                    if role not in ("user", "assistant"):
                        continue

                    thread_parts.append(f"{role}: {text}")

                # print(thread_parts)
                thread_text = "\n\n".join(thread_parts)

                if not thread_text:
                    continue

                prompt = f"""
You should respond with only one category.

Categories:
{chr(10).join(categories)}

Given this conversation:
\"\"\"{thread_text}\"\"\"

Which category fits best? Focus the sentiment in the user's responses to the assistant. Dont classify based on the first user message. Briefly explain why this conversation fits that category. If the responses are formal, impartial or without sentiment use "None".
Respond in the format:
Category: <category>
Reason: <short explanation>
"""

                try:
                    resp = client.chat.completions.create(
                        model=model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0,
                    )
                    category = resp.choices[0].message.content.strip()
                except Exception:
                    continue

                # Parse category and reasoning
                lines = category.splitlines()
                cat = lines[0].replace("Kategori:", "").strip() if lines else ""
                reason = (
                    lines[1].replace("Begrunnelse:", "").strip()
                    if len(lines) > 1
                    else ""
                )

                # Normalize category if slightly off
                for c in categories:
                    if c.lower() in cat.lower():
                        counts[c] += 1
                        conv_id = conv.get("conversation", {}).get("id") or conv.get(
                            "id"
                        )
                        category_to_ids[c].append(conv_id)
                        category_to_reasons[c].append(reason)
                        break
        finally:
            # Always print results, even if there is an error
            print("\n=== Resultater ===")
            for c, n in counts.items():
                print(f"{c}: {n}")
                print("Conversation IDs:", category_to_ids[c])
                print("Begrunnelser:", category_to_reasons[c])


if __name__ == "__main__":
    file_path = sys.argv[1]
    n = int(sys.argv[2]) if len(sys.argv) > 2 else None
    main(file_path, n)
