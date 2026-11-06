import json
import os
from datetime import datetime
from typing import Any, Dict, List

import requests


def get_env_variable(name: str) -> str:
    """Get environment variable or raise exception if not found."""
    value = os.getenv(name)
    if value is None:
        raise ValueError(f"Environment variable {name} is not set")
    return value


def fetch_conversations_list(base_url: str, api_key: str) -> List[Dict[str, Any]]:
    """Fetch list of all conversations from the API with pagination."""
    headers = {"X-API-KEY": api_key}
    all_conversations: List[Dict[str, Any]] = []
    page_index = 0

    while True:
        url = f"{base_url}/api/conversations"
        params = {"page_index": page_index}

        print(f"Fetching page {page_index}...")
        response = requests.get(url, headers=headers, params=params)

        if response.status_code != 200:
            raise Exception(
                f"Failed to fetch conversations list. Status code: {response.status_code}, Response: {response.text}"
            )

        data = response.json()
        conversations = data.get("conversations", [])
        total = data.get("total", 0)

        if not conversations:
            break

        all_conversations.extend(conversations)
        print(
            f"Fetched {len(conversations)} conversations (total so far: {len(all_conversations)}/{total})"
        )

        # Check if we've fetched all pages
        if len(all_conversations) >= total:
            break

        page_index += 1

    if not all_conversations:
        raise Exception("No conversations found in the response")

    return all_conversations


def fetch_conversation_detail(
    base_url: str, api_key: str, conversation_id: str
) -> Dict[str, Any]:
    """Fetch detailed conversation data for a specific conversation ID."""
    url = f"{base_url}/api/conversations/{conversation_id}"
    headers = {"X-API-KEY": api_key}

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        raise Exception(
            f"Failed to fetch conversation {conversation_id}. Status code: {response.status_code}, Response: {response.text}"
        )

    return response.json()


def save_to_jsonl(data: List[Dict[str, Any]], filename: str) -> None:
    """Save data to JSONL file."""
    with open(filename, "w", encoding="utf-8") as f:
        for item in data:
            json_line = json.dumps(item, ensure_ascii=False)
            f.write(json_line + "\n")

    print(f"Saved {len(data)} conversations to {filename}")


def main() -> None:
    """Main function to fetch conversations and save to JSONL."""
    # Get environment variables
    base_url = get_env_variable("RAG_API_URL")
    api_key = get_env_variable("RAG_API_KEY")

    print(f"Fetching conversations from {base_url}...")

    # Fetch list of conversations
    conversations_list = fetch_conversations_list(base_url, api_key)
    print(f"Found {len(conversations_list)} conversations")

    # Fetch detailed data for each conversation
    detailed_conversations: List[Dict[str, Any]] = []

    for i, conversation in enumerate(conversations_list, 1):
        conversation_id = conversation.get("id")
        if not conversation_id:
            raise ValueError(f"Conversation at index {i - 1} has no ID")

        print(f"Fetching conversation {i}/{len(conversations_list)}: {conversation_id}")

        try:
            detail = fetch_conversation_detail(base_url, api_key, conversation_id)
            detailed_conversations.append(detail)
        except Exception as e:
            raise Exception(f"Failed to fetch conversation {conversation_id}: {str(e)}")

    # Generate filename with current datetime
    current_datetime = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"conversations_{current_datetime}.jsonl"

    # Save to JSONL file
    save_to_jsonl(detailed_conversations, filename)
    print(f"Successfully saved all conversations to {filename}")


if __name__ == "__main__":
    main()
