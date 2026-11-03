"""Load and parse JSONL conversation files."""

import json
import logging
from pathlib import Path
from typing import List

from .models import Conversation, Message

logger = logging.getLogger(__name__)


def load_conversations(file_path: str, limit: int | None = None) -> List[Conversation]:
    """
    Load and parse JSONL conversation file.

    Args:
        file_path: Path to JSONL file
        limit: Optional maximum number of conversations to load

    Returns:
        List of Conversation objects

    Raises:
        FileNotFoundError: If file doesn't exist
        json.JSONDecodeError: If invalid JSON
        ValueError: If required fields missing
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    conversations: List[Conversation] = []
    line_num = 0
    skipped = 0

    limit_msg = f" (limit: {limit})" if limit else ""
    logger.info(f"Loading conversations from {file_path}{limit_msg}")

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            # Check limit
            if limit and len(conversations) >= limit:
                break

            line_num += 1
            line = line.strip()
            if not line:
                continue

            try:
                data = json.loads(line)
                conv = _parse_conversation(data)
                conversations.append(conv)
            except json.JSONDecodeError as e:
                logger.warning(f"Skipping malformed JSON at line {line_num}: {e}")
                skipped += 1
            except ValueError as e:
                logger.warning(f"Skipping invalid conversation at line {line_num}: {e}")
                skipped += 1
            except KeyError as e:
                logger.warning(f"Skipping conversation with missing field at line {line_num}: {e}")
                skipped += 1

    logger.info(
        f"Loaded {len(conversations)} conversations, skipped {skipped} invalid entries"
    )
    return conversations


def _parse_conversation(data: dict) -> Conversation:
    """
    Parse conversation from JSON data.

    Args:
        data: JSON data dictionary

    Returns:
        Conversation object

    Raises:
        ValueError: If required fields missing or invalid
        KeyError: If expected keys not present
    """
    # Validate required top-level fields
    if "conversation" not in data:
        raise ValueError("Missing 'conversation' field")
    if "messages" not in data:
        raise ValueError("Missing 'messages' field")

    conv_data = data["conversation"]
    messages_data = data["messages"]

    # Validate conversation fields
    required_conv_fields = ["id", "topic", "entityId", "userId", "created"]
    for field in required_conv_fields:
        if field not in conv_data:
            raise KeyError(f"Missing required conversation field: {field}")

    # Parse messages
    messages: List[Message] = []
    for msg_data in messages_data:
        # Validate message fields
        required_msg_fields = ["id", "text", "created"]
        for field in required_msg_fields:
            if field not in msg_data:
                raise KeyError(f"Missing required message field: {field}")

        message = Message(
            id=msg_data["id"],
            text=msg_data["text"],
            role=msg_data.get("role"),  # Optional field
            created=msg_data["created"],
            chunks=msg_data.get("chunks", []),  # Default to empty list
            filterValue=msg_data.get("filterValue"),  # Optional field
        )
        messages.append(message)

    # Create conversation
    conversation = Conversation(
        id=conv_data["id"],
        topic=conv_data["topic"],
        entityId=conv_data["entityId"],
        userId="",  # conv_data["userId"],
        created=conv_data["created"],
        messages=messages,
    )

    return conversation
