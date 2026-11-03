#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Utility script to view cached responses from the evaluation runs.
"""

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from diskcache import Cache


def format_value(value: Any, indent: int = 0) -> str:
    """Format a cache value for display."""
    indent_str: str = "  " * indent

    if isinstance(value, dict):
        lines: List[str] = ["{"]
        for key, val in value.items():
            lines.append(f"{indent_str}  {key}: {format_value(val, indent + 1)}")
        lines.append(f"{indent_str}}}")
        return "\n".join(lines)
    elif isinstance(value, list):
        if len(value) == 0:
            return "[]"
        lines: List[str] = ["["]
        for item in value[:3]:  # Show first 3 items
            lines.append(f"{indent_str}  {format_value(item, indent + 1)}")
        if len(value) > 3:
            lines.append(f"{indent_str}  ... ({len(value) - 3} more items)")
        lines.append(f"{indent_str}]")
        return "\n".join(lines)
    elif isinstance(value, str):
        if len(value) > 200:
            return f'"{value[:200]}..." ({len(value)} chars)'
        return f'"{value}"'
    else:
        return str(value)


def extract_query_from_value(value: Any, cache_name: str) -> Optional[str]:
    """Extract the query from the cache value if possible."""
    if cache_name == "rag":
        # For RAG cache, we need to look at the AgentResponse object
        # Since we're getting a string representation, we can't easily extract it
        return None
    elif cache_name == "judge":
        # For judge cache, the value is a tuple (bool, str) and doesn't contain query
        return None
    return None


def view_cache(cache_path: Path, max_entries: int = 10) -> None:
    """View contents of a cache directory."""
    import sqlite3
    from datetime import datetime

    if not cache_path.exists():
        print(f"Cache directory not found: {cache_path}")
        return

    cache: Cache = Cache(str(cache_path))

    print(f"\n{'=' * 80}")
    print(f"Cache: {cache_path.name}")
    print(f"{'=' * 80}")
    print(f"Total entries: {len(cache)}")
    print(f"Size: {cache.volume()} bytes")
    print(f"{'=' * 80}\n")

    if len(cache) == 0:
        print("Cache is empty\n")
        return

    # Get entries ordered by store_time (newest first) using SQL
    db_path: Path = cache_path / "cache.db"
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # Get all keys ordered by store_time descending (newest first)
    cursor.execute(
        "SELECT key, store_time, tag FROM Cache ORDER BY store_time DESC LIMIT ?",
        (max_entries,)
    )
    entries: List[tuple[bytes, float, Optional[bytes]]] = cursor.fetchall()

    total_count: int = len(cache)

    for i, (key_bytes, store_time, tag_bytes) in enumerate(entries):
        # Convert bytes key to hex string
        key: str = key_bytes.hex() if isinstance(key_bytes, bytes) else str(key_bytes)

        # Get value from cache
        value: Any = cache.get(key)

        # Format timestamp
        timestamp: str = datetime.fromtimestamp(store_time).strftime("%Y-%m-%d %H:%M:%S")

        # Decode tag (query) if present
        query: Optional[str] = None
        if tag_bytes:
            try:
                query = tag_bytes.decode("utf-8") if isinstance(tag_bytes, bytes) else str(tag_bytes)
            except Exception:
                query = None

        print(f"\nEntry {i + 1} (stored: {timestamp}):")
        print(f"{'-' * 80}")
        if query:
            # Truncate long queries for display
            display_query: str = query[:150] + "..." if len(query) > 150 else query
            print(f"Query: {display_query}")
        print(f"Key: {key}")
        print(f"\nValue:")
        print(format_value(value))
        print(f"{'-' * 80}")

    if len(entries) < total_count:
        print(f"\n... showing {len(entries)} of {total_count} entries")
        print("Use --max-entries to show more\n")

    conn.close()
    cache.close()


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="View cached evaluation responses")
    parser.add_argument(
        "--cache",
        choices=["rag", "judge", "all"],
        default="all",
        help="Which cache to view (default: all)",
    )
    parser.add_argument(
        "--max-entries",
        type=int,
        default=10,
        help="Maximum number of entries to display per cache (default: 10)",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear the specified cache(s) instead of viewing",
    )
    args = parser.parse_args()

    cache_dir: Path = Path(__file__).parent / ".cache"

    if not cache_dir.exists():
        print(f"Cache directory not found: {cache_dir}")
        return

    caches_to_process: List[str] = []
    if args.cache == "all":
        caches_to_process = ["rag", "judge"]
    else:
        caches_to_process = [args.cache]

    for cache_name in caches_to_process:
        cache_path: Path = cache_dir / cache_name

        if args.clear:
            if cache_path.exists():
                cache: Cache = Cache(str(cache_path))
                count: int = len(cache)
                cache.clear()
                cache.close()
                print(f"Cleared {count} entries from {cache_name} cache")
            else:
                print(f"Cache not found: {cache_name}")
        else:
            view_cache(cache_path, args.max_entries)


if __name__ == "__main__":
    main()
