"""Filter conversations for quality and relevance."""

import json
import logging
from pathlib import Path
from typing import Optional

from .models import Conversation

logger = logging.getLogger(__name__)


def should_process_conversation(conv: Conversation) -> bool:
    """
    Determine if conversation should be processed.

    Filtering rules:
    - Exclude if topic is "Ny tråd" AND no non-empty user messages
    - Exclude if all messages are system messages or have empty text
    - Exclude if no messages with role="user"

    Args:
        conv: Conversation to evaluate

    Returns:
        True if conversation should be processed
    """
    # Check if there are any user messages with non-empty text
    has_user_message = False
    for msg in conv.messages:
        # Skip system messages
        if msg.role == "system":
            continue

        # Skip messages with no role or empty role
        if msg.role is None:
            continue

        # Check if this is a user message with non-empty text
        if msg.role == "user" and msg.text and msg.text.strip():
            has_user_message = True
            break

    # If no user messages, exclude
    if not has_user_message:
        logger.debug(f"Excluding conversation {conv.id}: no user messages")
        return False

    # Special case: "Ny tråd" with no meaningful content
    if conv.topic == "Ny tråd":
        # Already checked for user messages above
        # If we reach here and topic is "Ny tråd", we have at least one user message
        # So include it
        pass

    return True


def get_drop_reason(conv: Conversation) -> str:
    """
    Determine why a conversation was dropped.

    Args:
        conv: Conversation that was filtered out

    Returns:
        Human-readable reason string
    """
    # Check if no user messages at all
    user_messages = [m for m in conv.messages if m.role == "user" and m.text and m.text.strip()]
    if not user_messages:
        if conv.topic == "Ny tråd":
            return "Ny tråd with no user messages"
        return "No user messages"

    # Check if only system messages
    non_system = [m for m in conv.messages if m.role != "system"]
    if not non_system:
        return "Only system messages"

    # Check if all messages are empty
    non_empty = [m for m in conv.messages if m.text and m.text.strip()]
    if not non_empty:
        return "All messages empty"

    return "Other (see conversation details)"


def save_dropped_conversations(
    dropped: list[Conversation],
    reasons: list[str],
    output_file: str,
) -> None:
    """
    Save dropped conversations to JSONL file for inspection.

    Args:
        dropped: List of dropped conversations
        reasons: List of reasons (parallel to dropped list)
        output_file: Path to output file
    """
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        for conv, reason in zip(dropped, reasons):
            record = {
                "conversation_id": conv.id,
                "topic": conv.topic,
                "user_id": conv.userId,
                "created": conv.created,
                "message_count": len(conv.messages),
                "drop_reason": reason,
                "messages": [
                    {
                        "id": m.id,
                        "role": m.role,
                        "text": m.text[:200] + "..." if len(m.text) > 200 else m.text,
                        "created": m.created,
                    }
                    for m in conv.messages[:5]  # Include first 5 messages for context
                ],
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    logger.info(f"💾 Saved {len(dropped)} dropped conversations to {output_file}")


def filter_conversations(
    conversations: list[Conversation],
    output_dropped_file: Optional[str] = None,
) -> list[Conversation]:
    """
    Filter list of conversations.

    Args:
        conversations: List of conversations to filter
        output_dropped_file: Optional path to save dropped conversations

    Returns:
        Filtered list of conversations
    """
    filtered = []
    dropped = []
    dropped_reasons = []

    for conv in conversations:
        if should_process_conversation(conv):
            filtered.append(conv)
        else:
            dropped.append(conv)
            reason = get_drop_reason(conv)
            dropped_reasons.append(reason)

    logger.info(
        f"Filtered {len(conversations)} conversations down to {len(filtered)} "
        f"({len(dropped)} excluded)"
    )

    # Save dropped conversations to file for transparency
    if output_dropped_file:
        save_dropped_conversations(dropped, dropped_reasons, output_dropped_file)

    return filtered
