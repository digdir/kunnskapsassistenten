"""LLM-based question reformulation."""

import json
import logging
import time
from typing import List

from langfuse.openai import OpenAI
from openai import APIError

from .models import Message

logger = logging.getLogger(__name__)


FEW_SHOT_EXAMPLES = [
    {
        "question": "Hva innebærer det?",
        "context": "Assistant: Regjeringen har lansert en dataspillstrategi for 2024-2026.",
        "reformulated": "Hva innebærer regjeringens dataspillstrategi for 2024-2026?",
        "reasoning": "Replaced the vague pronoun 'det' (that) with the specific topic 'regjeringens dataspillstrategi for 2024-2026' from the assistant's previous message.",
    },
    {
        "question": "Og hvordan søker jeg på det?",
        "context": "User: Hva er skattefradraget for dataspill?\nAssistant: Skattefradraget for dataspill er en ny ordning...",
        "reformulated": "Hvordan søker jeg på skattefradraget for dataspill?",
        "reasoning": "Removed the filler word 'Og' (and) and replaced 'det' (it) with the specific topic 'skattefradraget for dataspill' from the conversation context.",
    },
    {
        "question": "Hvilke land kommer barna fra?",
        "context": "System: Barnevernsstatistikk 2023",
        "reformulated": "Hvilke land kommer barna i barnevernsstatistikken 2023 fra?",
        "reasoning": "Added context 'i barnevernsstatistikken 2023' to clarify which children are being referenced, using information from the document title.",
    },
    {
        "question": "Kan du oppsummere?",
        "context": "System: NIM høringssvar barnevern",
        "reformulated": "Kan du oppsummere NIMs høringssvar om barnevern?",
        "reasoning": "Added the missing object 'NIMs høringssvar om barnevern' from the context to make the request specific and standalone.",
    },
]


SYSTEM_PROMPT = """You are an expert at reformulating vague questions into clear, standalone questions in Norwegian.

Your task is to:
1. Analyze the question for vague references (pronouns, unclear references, filler words)
2. Review the conversation history to identify what is being referenced
3. Replace vague terms with specific information from the context
4. Preserve the original question structure and intent
5. Return a clear, standalone question in Norwegian

Critical rules:
- If the question is already clear and standalone, return it unchanged
- Only use information explicitly present in the context
- Preserve Norwegian language and grammar perfectly
- Do NOT add information not found in the context
- Do NOT translate the question to English - keep it in Norwegian
- The reformulated question must be answerable without reading the context

You MUST respond with valid JSON in this exact format:
{
  "reformulated": "the reformulated question in Norwegian",
  "reasoning": "brief explanation of what changes were made and why",
  "is_changed": true or false
}"""


def _build_context_string(messages: List[Message], max_messages: int = 3) -> str:
    """
    Build context string from previous messages.

    Args:
        messages: Previous messages in conversation
        max_messages: Maximum number of messages to include

    Returns:
        Formatted context string
    """
    if not messages:
        return ""

    # Take last N messages
    recent_messages = messages[-max_messages:]

    context_lines: List[str] = []
    for msg in recent_messages:
        role = msg.role or "unknown"
        text = msg.text.strip()

        # Add document titles from chunks if available
        if msg.chunks:
            doc_titles = [
                chunk.get("docTitle", "") for chunk in msg.chunks if chunk.get("docTitle")
            ]
            if doc_titles:
                text = f"[Document: {doc_titles[0]}] {text}"

        context_lines.append(f"{role.capitalize()}: {text}")

    return "\n".join(context_lines)


def _build_user_prompt(question: str, context: str) -> str:
    """
    Build user prompt with few-shot examples in JSON format.

    Args:
        question: Question to reformulate
        context: Conversation context

    Returns:
        Formatted prompt string
    """
    examples_text = "\n\n".join(
        [
            f"Example {i + 1}:\n"
            f"Question: {ex['question']}\n"
            f"Context:\n{ex['context']}\n\n"
            f"Expected JSON output:\n"
            f'{{"reformulated": "{ex["reformulated"]}", "reasoning": "{ex["reasoning"]}", "is_changed": true}}'
            for i, ex in enumerate(FEW_SHOT_EXAMPLES)
        ]
    )

    return f"""{examples_text}

Now reformulate this question:

Question: {question}
Context:
{context if context else "(No prior context)"}

Respond with valid JSON only. No additional text before or after the JSON."""


def reformulate_question_llm(
    question: str,
    previous_messages: List[Message],
    client: OpenAI,
    model: str = "gpt-oss:120b-cloud",
    max_retries: int = 0,
) -> str:
    """
    Use LLM to reformulate vague question into standalone question.

    Args:
        question: Original user question
        previous_messages: Previous messages for context
        client: OpenAI client configured for Ollama
        model: Model name to use
        max_retries: Number of retry attempts on failure

    Returns:
        Reformulated standalone question

    Raises:
        ValueError: If LLM returns invalid response after all retries
    """
    context = _build_context_string(previous_messages)
    user_prompt = _build_user_prompt(question, context)

    for attempt in range(max_retries + 1):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.0,  # Deterministic for consistency
                # max_tokens=300,  # Increased for JSON response
                response_format={"type": "json_object"},  # Request JSON output
            )

            # Check if response was truncated due to token limit
            choice = response.choices[0]
            if choice.finish_reason == "length":
                raise ValueError(
                    "Response truncated due to token limit. "
                    "The question or context may be too long."
                )

            content = choice.message.content
            if not content or not content.strip():
                raise ValueError("Empty or invalid response from LLM")

            # Parse JSON response
            try:
                result = json.loads(content.strip())
            except json.JSONDecodeError as e:
                # If JSON parsing fails, check if it might be due to truncation
                if len(content) >= 250:  # Close to max_tokens limit
                    raise ValueError(
                        f"Incomplete JSON response (possibly truncated): {content}"
                    ) from e
                raise ValueError(f"Invalid JSON response: {content}") from e

            # Extract reformulated question
            if "reformulated" not in result:
                raise ValueError(f"Missing 'reformulated' field in response: {result}")

            reformulated = result["reformulated"].strip()
            if not reformulated:
                raise ValueError("Empty reformulated question in response")

            # Log the reformulation details
            is_changed = result.get("is_changed", True)
            reasoning = result.get("reasoning", "No reasoning provided")

            if is_changed:
                logger.debug(
                    f"Reformulated question: '{question}' -> '{reformulated}' "
                    f"(Reasoning: {reasoning})"
                )
            else:
                logger.debug(f"Question unchanged: '{question}'")

            return reformulated

        except APIError as e:
            logger.warning(f"Attempt {attempt + 1}/{max_retries + 1}: API error: {e}")
            if attempt == max_retries:
                raise ValueError(f"Failed to reformulate after {max_retries + 1} attempts") from e
            # Exponential backoff
            time.sleep(2 ** (attempt + 1))

        except Exception as e:
            logger.warning(f"Attempt {attempt + 1}/{max_retries + 1}: Reformulation failed: {e}")
            if attempt == max_retries:
                raise ValueError(
                    f"Failed to reformulate after {max_retries + 1} attempts: {e}"
                ) from e
            # Exponential backoff
            time.sleep(2 ** (attempt + 1))

    # Should never reach here
    raise ValueError(f"Failed to reformulate after {max_retries + 1} attempts")
