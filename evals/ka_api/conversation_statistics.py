"""Find shortest and longest conversations in a JSONL file."""

import argparse
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

import pandas as pd


def analyze_conversation_lengths(jsonl_file: Path) -> None:
    """
    Analyze conversation lengths and find shortest/longest conversations.

    Args:
        jsonl_file: Path to input JSONL file with conversations
    """
    print(f"Loading conversations from {jsonl_file}...")
    df = pd.read_json(jsonl_file, lines=True)
    print(f"Loaded {len(df)} conversations\n")

    # Calculate conversation lengths (number of messages)
    conversation_lengths: list[Dict[str, Any]] = []
    timestamps: list[datetime] = []
    all_chunks: list[Dict[str, Any]] = []  # Track all source references
    all_document_types: list[str] = []  # Track filtered document types
    all_organizations: list[str] = []  # Track filtered organizations
    user_conversations: Dict[str, list[str]] = {}  # Track conversations per user

    for idx, row in df.iterrows():
        conversation = row.to_dict()
        conversation_id = conversation.get("conversation", {}).get("id", "unknown")
        topic = conversation.get("conversation", {}).get("topic", "")
        created_timestamp = conversation.get("conversation", {}).get("created", None)
        user_id = conversation.get("conversation", {}).get("userId", "unknown")

        # Track conversations per user
        if user_id not in user_conversations:
            user_conversations[user_id] = []
        user_conversations[user_id].append(conversation_id)

        # Parse timestamp (Unix timestamp in milliseconds)
        if created_timestamp:
            try:
                ts = datetime.fromtimestamp(created_timestamp / 1000.0)
                timestamps.append(ts)
            except (ValueError, TypeError, OSError):
                pass

        messages = conversation.get("messages", [])
        num_messages = len(messages)

        # Collect chunks (source references) from all messages
        for msg in messages:
            chunks = msg.get("chunks", [])
            for chunk_idx, chunk in enumerate(chunks):
                chunk_with_context = {
                    "conversation_id": conversation_id,
                    "position": chunk_idx,  # Position in relevance order (0 = most relevant)
                    "chunk": chunk,
                }
                all_chunks.append(chunk_with_context)

            # Collect filter values from messages
            filter_value = msg.get("filterValue")
            if filter_value and filter_value.get("type") == "typesense":
                fields = filter_value.get("fields", [])
                for field in fields:
                    field_name = field.get("field")
                    selected_options = field.get("selected-options", [])

                    if field_name == "type":
                        all_document_types.extend(selected_options)
                    elif field_name == "orgs_long":
                        all_organizations.extend(selected_options)

        # Count user and assistant messages separately
        user_messages = sum(1 for m in messages if m.get("role") == "user")
        assistant_messages = sum(1 for m in messages if m.get("role") == "assistant")

        # Calculate total text length
        total_text_length = sum(len(m.get("text", "")) for m in messages)

        # Find user message lengths and texts
        user_messages_data = [
            {"text": m.get("text", ""), "length": len(m.get("text", ""))}
            for m in messages
            if m.get("role") == "user"
        ]

        shortest_user_prompt = (
            min(user_messages_data, key=lambda x: x["length"])["length"]
            if user_messages_data
            else 0
        )
        longest_user_prompt = (
            max(user_messages_data, key=lambda x: x["length"])["length"]
            if user_messages_data
            else 0
        )
        shortest_user_prompt_text = (
            min(user_messages_data, key=lambda x: x["length"])["text"]
            if user_messages_data
            else ""
        )
        longest_user_prompt_text = (
            max(user_messages_data, key=lambda x: x["length"])["text"]
            if user_messages_data
            else ""
        )

        # Get last user message
        last_user_message = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_message = m.get("text", "")
                break

        conversation_lengths.append(
            {
                "conversation_id": conversation_id,
                "topic": topic,
                "total_messages": num_messages,
                "user_messages": user_messages,
                "assistant_messages": assistant_messages,
                "total_text_length": total_text_length,
                "shortest_user_prompt": shortest_user_prompt,
                "longest_user_prompt": longest_user_prompt,
                "shortest_user_prompt_text": shortest_user_prompt_text,
                "longest_user_prompt_text": longest_user_prompt_text,
                "last_user_message": last_user_message,
                "index": idx,
            }
        )

    # Sort by total messages first, then by text length (for ties)
    sorted_by_messages = sorted(
        conversation_lengths, key=lambda x: (x["total_messages"], x["total_text_length"])
    )

    # Find shortest (fewest messages, shortest text)
    shortest = sorted_by_messages[0]

    # Find longest (most messages, longest text)
    longest = sorted_by_messages[-1]

    print("=" * 60)
    print("SHORTEST CONVERSATION (by message count)")
    print("=" * 60)
    print(f"Conversation ID: {shortest['conversation_id']}")
    print(f"Total messages: {shortest['total_messages']}")
    print(f"  - User messages: {shortest['user_messages']}")
    print(f"  - Assistant messages: {shortest['assistant_messages']}")
    print(f"Total text length: {shortest['total_text_length']} characters")
    print(f"Shortest user prompt: {shortest['shortest_user_prompt']} characters")
    print(f"Longest user prompt: {shortest['longest_user_prompt']} characters")
    print(f"Index in file: {shortest['index']}")

    print("\n" + "=" * 60)
    print("LONGEST CONVERSATION (by message count)")
    print("=" * 60)
    print(f"Conversation ID: {longest['conversation_id']}")
    print(f"Total messages: {longest['total_messages']}")
    print(f"  - User messages: {longest['user_messages']}")
    print(f"  - Assistant messages: {longest['assistant_messages']}")
    print(f"Total text length: {longest['total_text_length']} characters")
    print(f"Shortest user prompt: {longest['shortest_user_prompt']} characters")
    print(f"Longest user prompt: {longest['longest_user_prompt']} characters")
    print(f"Index in file: {longest['index']}")

    # Statistics
    print("\n" + "=" * 60)
    print("STATISTICS")
    print("=" * 60)
    avg_messages = sum(c["total_messages"] for c in conversation_lengths) / len(
        conversation_lengths
    )
    avg_text_length = sum(c["total_text_length"] for c in conversation_lengths) / len(
        conversation_lengths
    )
    total_assistant_messages = sum(c["assistant_messages"] for c in conversation_lengths)
    avg_assistant_messages = total_assistant_messages / len(conversation_lengths)
    assistant_messages_list = [c["assistant_messages"] for c in sorted_by_messages]
    median_assistant_messages = assistant_messages_list[len(assistant_messages_list) // 2]

    print(f"Average messages per conversation: {avg_messages:.2f}")
    print(f"Average text length per conversation: {avg_text_length:.2f} characters")
    print(f"Median messages: {sorted_by_messages[len(sorted_by_messages) // 2]['total_messages']}")
    print(f"\nTotal assistant messages: {total_assistant_messages}")
    print(f"Average assistant messages per conversation: {avg_assistant_messages:.2f}")
    print(f"Median assistant messages: {median_assistant_messages}")

    # User-based statistics
    print("\n" + "=" * 60)
    print("USER-BASED INSIGHTS")
    print("=" * 60)

    # Count unique users (excluding "unknown" and None/null)
    unique_users = [
        user_id
        for user_id in user_conversations.keys()
        if user_id not in ("unknown", None)
    ]
    num_unique_users = len(unique_users)
    num_excluded_users = len([
        user_id
        for user_id in user_conversations.keys()
        if user_id in ("unknown", None)
    ])

    print(f"Total unique users: {num_unique_users}")
    if num_excluded_users > 0:
        excluded_conversations_count = sum(
            len(user_conversations.get(user_id, []))
            for user_id in ("unknown", None)
            if user_id in user_conversations
        )
        print(f"Conversations with unknown/null user: {excluded_conversations_count}")

    # Calculate threads (conversations) per user (excluding "unknown" and None/null)
    threads_per_user: list[int] = [
        len(convs)
        for user_id, convs in user_conversations.items()
        if user_id not in ("unknown", None)
    ]

    if threads_per_user:
        max_threads = max(threads_per_user)
        avg_threads = sum(threads_per_user) / len(threads_per_user)

        print(f"\nMaximum threads created by a single user: {max_threads}")
        print(f"Average threads per user: {avg_threads:.2f}")

        # Show top 10 users by thread count
        user_thread_counts: list[tuple[str, int]] = [
            (user_id, len(convs))
            for user_id, convs in user_conversations.items()
            if user_id not in ("unknown", None)
        ]
        user_thread_counts.sort(key=lambda x: x[1], reverse=True)

        print("\n" + "-" * 60)
        print("TOP 10 USERS BY THREAD COUNT")
        print("-" * 60)
        for i, (user_id, count) in enumerate(user_thread_counts[:10], 1):
            # Mask user ID for privacy (show first 8 chars)
            if user_id is None:
                masked_id = "None"
            elif len(user_id) > 8:
                masked_id = f"{user_id[:8]}..."
            else:
                masked_id = user_id
            print(f"{i:2d}. {count:4d} threads - User: {masked_id}")

    # Analyze conversations by day of week
    print("\n" + "=" * 60)
    print("CONVERSATIONS BY DAY OF WEEK")
    print("=" * 60)
    day_names = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ]
    day_counts = Counter(ts.weekday() for ts in timestamps)
    for day_num in range(7):
        count = day_counts.get(day_num, 0)
        print(f"{day_names[day_num]:>10}: {count:4d}")

    # Analyze conversations by year-month
    print("\n" + "=" * 60)
    print("CONVERSATIONS BY YEAR-MONTH")
    print("=" * 60)
    month_counts = Counter(ts.strftime("%Y-%m") for ts in timestamps)
    sorted_months = sorted(month_counts.items())

    for year_month, count in sorted_months:
        print(f"{year_month}: {count:4d}")

    # Print last user message from 10 shortest threads
    print("\n" + "=" * 60)
    print("LAST USER MESSAGE FROM 10 SHORTEST THREADS")
    print("=" * 60)
    for i, conv in enumerate(sorted_by_messages[:10], 1):
        topic_text = f" - {conv['topic']}" if conv['topic'] else ""
        print(f"\n{i}. Conversation {conv['conversation_id']} ({conv['total_messages']} messages){topic_text}")
        print(f"   Last user message ({len(conv['last_user_message'])} chars):")
        print(f"   {conv['last_user_message'][:200]}{'...' if len(conv['last_user_message']) > 200 else ''}")

    # Collect all user prompts with conversation context
    all_user_prompts: list[Dict[str, Any]] = []
    for conv in conversation_lengths:
        conversation_dict = df.iloc[conv["index"]].to_dict()
        messages = conversation_dict.get("messages", [])
        for msg in messages:
            if msg.get("role") == "user":
                text = msg.get("text", "")
                if text:  # Only include non-empty prompts
                    all_user_prompts.append(
                        {
                            "conversation_id": conv["conversation_id"],
                            "topic": conv["topic"],
                            "text": text,
                            "length": len(text),
                        }
                    )

    # Sort by length
    all_user_prompts.sort(key=lambda x: x["length"])

    # Find overall shortest and longest user prompts
    print("\n" + "=" * 60)
    print("10 SHORTEST USER PROMPTS")
    print("=" * 60)

    for i, prompt in enumerate(all_user_prompts[:10], 1):
        topic_text = f" - {prompt['topic']}" if prompt['topic'] else ""
        print(f"\n{i}. {prompt['length']} characters - Conversation {prompt['conversation_id']}{topic_text}")
        print(f"   Text: {prompt['text']}")

    # Filter prompts with at least 2 words
    multi_word_prompts = [
        p for p in all_user_prompts if len(p["text"].split()) >= 2
    ]

    print("\n" + "=" * 60)
    print("10 SHORTEST USER PROMPTS (2+ WORDS)")
    print("=" * 60)

    for i, prompt in enumerate(multi_word_prompts[:10], 1):
        topic_text = f" - {prompt['topic']}" if prompt['topic'] else ""
        word_count = len(prompt["text"].split())
        print(f"\n{i}. {prompt['length']} chars, {word_count} words - Conversation {prompt['conversation_id']}{topic_text}")
        print(f"   Text: {prompt['text']}")

    print("\n" + "=" * 60)
    print("SHORTEST AND LONGEST USER PROMPTS")
    print("=" * 60)

    if all_user_prompts:
        shortest_prompt = all_user_prompts[0]
        print(f"\nShortest user prompt: {shortest_prompt['length']} characters")
        print(f"Text: {shortest_prompt['text']}")

        longest_prompt = all_user_prompts[-1]
        print(f"\nLongest user prompt: {longest_prompt['length']} characters")
        print("Text:")
        print(longest_prompt['text'])

    # Analyze source references (chunks)
    if all_chunks:
        print("\n" + "=" * 60)
        print("SOURCE REFERENCES (KILDER) STATISTICS")
        print("=" * 60)

        # Extract unique document IDs (using docNum)
        doc_ids = [c["chunk"].get("docNum") for c in all_chunks if c["chunk"].get("docNum")]
        unique_docs = set(doc_ids)

        print(f"\nTotal source references returned: {len(all_chunks)}")
        print(f"Total unique documents referenced: {len(unique_docs)}")

        if doc_ids:
            # Count frequency of each document
            doc_frequency = Counter(doc_ids)
            most_common_docs = doc_frequency.most_common(10)

            print("\n" + "-" * 60)
            print("TOP 10 MOST FREQUENTLY RETURNED SOURCES")
            print("-" * 60)
            for i, (doc_id, count) in enumerate(most_common_docs, 1):
                # Find a sample chunk to get document title
                sample_chunk = next(
                    (c["chunk"] for c in all_chunks if c["chunk"].get("docNum") == doc_id),
                    {}
                )
                title = sample_chunk.get("docTitle", "Unknown")
                print(f"{i:2d}. {count:4d} times - {title}")
                print(f"    Document #: {doc_id}")

            # Analyze top 10 most relevant sources (position 0-9)
            top_10_chunks = [c for c in all_chunks if c["position"] < 10]
            top_10_doc_ids = [c["chunk"].get("docNum") for c in top_10_chunks if c["chunk"].get("docNum")]

            if top_10_doc_ids:
                top_10_frequency = Counter(top_10_doc_ids)
                most_common_top_10 = top_10_frequency.most_common(10)

                print("\n" + "-" * 60)
                print("TOP 10 SOURCES MOST FREQUENTLY IN TOP 10 RESULTS")
                print("-" * 60)
                for i, (doc_id, count) in enumerate(most_common_top_10, 1):
                    sample_chunk = next(
                        (c["chunk"] for c in all_chunks if c["chunk"].get("docNum") == doc_id),
                        {}
                    )
                    title = sample_chunk.get("docTitle", "Unknown")
                    print(f"{i:2d}. {count:4d} times in top 10 - {title}")
                    print(f"    Document #: {doc_id}")

            # Analyze position 0 (most relevant)
            position_0_chunks = [c for c in all_chunks if c["position"] == 0]
            position_0_doc_ids = [c["chunk"].get("docNum") for c in position_0_chunks if c["chunk"].get("docNum")]

            if position_0_doc_ids:
                position_0_frequency = Counter(position_0_doc_ids)
                most_common_position_0 = position_0_frequency.most_common(10)

                print("\n" + "-" * 60)
                print("TOP 10 SOURCES AS MOST RELEVANT RESULT (POSITION #1)")
                print("-" * 60)
                for i, (doc_id, count) in enumerate(most_common_position_0, 1):
                    sample_chunk = next(
                        (c["chunk"] for c in all_chunks if c["chunk"].get("docNum") == doc_id),
                        {}
                    )
                    title = sample_chunk.get("docTitle", "Unknown")
                    print(f"{i:2d}. {count:4d} times as #1 - {title}")
                    print(f"    Document #: {doc_id}")

            # Average number of sources per response
            messages_with_chunks = sum(1 for row in df.iterrows() for msg in row[1].get("messages", []) if msg.get("chunks"))
            if messages_with_chunks > 0:
                avg_sources = len(all_chunks) / messages_with_chunks
                print("\n" + "-" * 60)
                print(f"Average sources per response with sources: {avg_sources:.2f}")
                print(f"Total messages with sources: {messages_with_chunks}")

    # Analyze filter usage (document types and organizations)
    if all_document_types or all_organizations:
        print("\n" + "=" * 60)
        print("FILTER USAGE STATISTICS")
        print("=" * 60)

        if all_document_types:
            print(f"\nTotal document type filters applied: {len(all_document_types)}")
            doc_type_counts = Counter(all_document_types)
            print("\n" + "-" * 60)
            print("DOCUMENT TYPES FILTERED")
            print("-" * 60)
            for i, (doc_type, count) in enumerate(doc_type_counts.most_common(), 1):
                print(f"{i:2d}. {count:4d} times - {doc_type}")

        if all_organizations:
            print(f"\nTotal organization filters applied: {len(all_organizations)}")
            org_counts = Counter(all_organizations)
            print("\n" + "-" * 60)
            print("ORGANIZATIONS FILTERED")
            print("-" * 60)
            for i, (org, count) in enumerate(org_counts.most_common(), 1):
                print(f"{i:2d}. {count:4d} times - {org}")


def main() -> None:
    """Main function."""
    parser = argparse.ArgumentParser(
        description="Find shortest and longest conversations in JSONL file"
    )
    parser.add_argument(
        "input_file",
        type=Path,
        help="Path to input JSONL file",
    )
    args = parser.parse_args()

    if not args.input_file.exists():
        print(f"File not found: {args.input_file}")
        return

    analyze_conversation_lengths(args.input_file)


if __name__ == "__main__":
    main()
