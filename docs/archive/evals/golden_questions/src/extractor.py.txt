"""Extract golden questions from conversations."""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from openai import OpenAI

from .models import Conversation, GoldenQuestion, Message, UsageMode
from .reformulator_llm import reformulate_question_llm

logger = logging.getLogger(__name__)

# Known valid document types (for logging warnings about unknown types)
KNOWN_DOCUMENT_TYPES = {
    "Evaluering",
    "Instruks",
    "Melding til Stortinget",
    "Proposisjon til Stortinget",
    "Statusrapport",
    "Strategi/plan",
    "Tildelingsbrev",
    "Årsrapport",
}

# Auto-correction mapping for document type typos
DOCUMENT_TYPE_CORRECTIONS = {
    "Årsrapprt": "Årsrapport",
}


def extract_filters(messages: List[Message]) -> Dict[str, List[str]]:
    """
    Extract all filters from filterValue structure in messages.

    Searches for all fields in filterValue.fields and extracts the
    "selected-options" lists. Groups them by field name (e.g., "type", "orgs_long").
    Applies auto-correction for known typos in document types.

    Args:
        messages: List of conversation messages

    Returns:
        Dictionary mapping field names to lists of selected values
        Example: {"type": ["Årsrapport"], "orgs_long": ["Helsedirektoratet"]}
    """
    filters: Dict[str, List[str]] = {}

    for msg in messages:
        filter_value = getattr(msg, "filterValue", None)
        if not filter_value or not isinstance(filter_value, dict):
            continue

        fields = filter_value.get("fields", [])
        if not isinstance(fields, list):
            continue

        for field in fields:
            if not isinstance(field, dict):
                continue

            field_name = field.get("field")
            selected_options = field.get("selected-options", [])

            if field_name and isinstance(selected_options, list) and selected_options:
                if field_name not in filters:
                    filters[field_name] = []

                # Apply auto-correction for document types
                if field_name == "type":
                    for option in selected_options:
                        if isinstance(option, str):
                            corrected = DOCUMENT_TYPE_CORRECTIONS.get(option, option)
                            if corrected not in filters[field_name]:
                                filters[field_name].append(corrected)

                            # Log warning for unknown types (after correction)
                            if corrected not in KNOWN_DOCUMENT_TYPES:
                                logger.warning(f"Unknown document type: '{corrected}' (preserving for analysis)")
                else:
                    # For other fields, just add unique values
                    for option in selected_options:
                        if option not in filters[field_name]:
                            filters[field_name].append(option)

    return filters


def _save_failed_reformulations(
    failed_reformulations: List[Dict[str, Any]], output_file: Path
) -> None:
    """
    Save failed reformulations to a JSON file.

    If the file exists, append to it. Otherwise, create a new file.

    Args:
        failed_reformulations: List of failed reformulation records
        output_file: Path to save the failed questions
    """
    # Save failed reformulations
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(failed_reformulations, f, indent=2, ensure_ascii=False)


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
    return f"{conversation_id}_{user_message_index}"


def extract_golden_questions(
    conv: Conversation,
    llm_client: Optional[OpenAI] = None,
    model: str = "gpt-oss:120b-cloud",
) -> tuple[List[GoldenQuestion], List[Dict[str, Any]]]:
    """
    Extract standalone questions from conversation using LLM reformulation.

    Questions that fail reformulation are removed from results.

    Args:
        conv: Conversation to process
        llm_client: Optional OpenAI client for LLM reformulation
        model: LLM model name to use for reformulation

    Returns:
        Tuple of (extracted golden questions, failed reformulations)
    """
    questions: List[GoldenQuestion] = []
    failed_reformulations: List[Dict[str, Any]] = []

    # Extract filters from all messages in conversation (once)
    conversation_filters = extract_filters(conv.messages)

    # Track user message index separately from total message index
    user_message_index = 0

    for i, msg in enumerate(conv.messages):
        # Only process user messages
        if msg.role != "user":
            continue

        # Skip empty messages
        if not msg.text or not msg.text.strip():
            continue

        # Build standalone question using LLM reformulation
        # (LLM will return original if already clear)
        original_q = msg.text.strip()

        if i > 0 and llm_client is not None:
            # Get previous messages for context
            previous_messages = conv.messages[:i]
            try:
                standalone_q = reformulate_question_llm(
                    msg.text, previous_messages, llm_client, model
                )
            except Exception as e:
                # Mark as failed and skip this question
                failure_reason = str(e)
                logger.warning(
                    f"Failed to reformulate question '{msg.text[:50]}...': {e}. "
                    f"Removing question from results."
                )

                # Generate unique ID for tracking
                message_id = generate_message_id(conv.id, user_message_index)

                # Save failed reformulation info
                failed_reformulations.append({
                    "id": message_id,
                    "conversation_id": conv.id,
                    "original_question": original_q,
                    "failure_reason": failure_reason,
                    "conversation_topic": conv.topic,
                    "user_id": conv.userId,
                    "created": msg.created,
                })

                # Increment counter and skip to next message
                user_message_index += 1
                continue

            # Get last 3 non-system messages with role and text
            context_msgs = [
                {"role": m.role, "text": m.text}
                for m in previous_messages[-3:]
                if m.text.strip() and m.role != "system"
            ]
        else:
            # First message or no LLM client - use original question
            standalone_q = original_q
            context_msgs = []

        # Check if question was changed by reformulation
        question_changed = standalone_q != original_q

        # Check if assistant response had retrieval
        has_retrieval = _check_has_retrieval(conv.messages, i)

        # Create placeholder usage mode (will be categorized later)
        usage_mode = UsageMode(
            document_scope="single_document",
            operation_type="simple_qa",
            output_complexity="prose",
        )

        # Generate unique ID for this question
        message_id = generate_message_id(conv.id, user_message_index)

        # Create golden question with new fields
        question = GoldenQuestion(
            id=message_id,
            question=standalone_q,
            original_question=msg.text.strip(),
            conversation_id=conv.id,
            context_messages=context_msgs,
            has_retrieval=has_retrieval,
            usage_mode=usage_mode,
            subject_topics=[],  # Will be populated by subject categorizer
            metadata={
                "topic": conv.topic,
                "user_id": conv.userId,
                "created": msg.created,
            },
            question_changed=question_changed,
            filters=conversation_filters if conversation_filters else None,
        )
        questions.append(question)

        # Increment user message index for next user message
        user_message_index += 1

    logger.debug(
        f"Extracted {len(questions)} questions from conversation {conv.id} "
        f"({len(failed_reformulations)} failed reformulations removed)"
    )
    return questions, failed_reformulations




def _check_has_retrieval(messages: List[Message], user_msg_index: int) -> bool:
    """
    Check if assistant response following user message had retrieval chunks.

    Args:
        messages: All messages in conversation
        user_msg_index: Index of user message

    Returns:
        True if next assistant message has chunks
    """
    # Look for next assistant message
    for i in range(user_msg_index + 1, len(messages)):
        if messages[i].role == "assistant":
            return len(messages[i].chunks) > 0

    return False
