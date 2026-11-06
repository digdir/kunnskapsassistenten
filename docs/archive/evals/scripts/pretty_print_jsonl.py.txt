#!/usr/bin/env python3
"""Pretty print JSONL files."""

import json
import sys
from pathlib import Path
from typing import Any


def pretty_print_jsonl(
    file_path: str, index: int | None = None, output_file: str | None = None
) -> None:
    """
    Pretty print a JSONL file.

    Args:
        file_path: Path to the JSONL file to print
        index: Optional 0-based index of the line to print (prints all if None)
        output_file: Optional output file path to write the formatted JSON to
    """
    import io

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    if not path.is_file():
        raise ValueError(f"Not a file: {file_path}")

    # Use StringIO to capture output if writing to file
    output_buffer: io.StringIO | None = None
    if output_file:
        output_buffer = io.StringIO()
        output = output_buffer
    else:
        output = sys.stdout

    found = False
    last_line_num = 0

    with open(path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            last_line_num = line_num
            line = line.strip()
            if not line:
                continue

            # Skip if index is specified and doesn't match
            if index is not None and line_num - 1 != index:
                continue

            try:
                data: Any = json.loads(line)
                print(f"--- Line {line_num} (index {line_num - 1}) ---", file=output)
                print(json.dumps(data, indent=2, ensure_ascii=False), file=output)
                print(file=output)
                found = True

                # If we found the requested index, we can stop
                if index is not None:
                    break
            except json.JSONDecodeError as e:
                print(f"Error parsing line {line_num}: {e}", file=sys.stderr)
                print(f"Content: {line[:100]}...", file=sys.stderr)
                print(file=sys.stderr)

                # If this was the requested index, stop even on error
                if index is not None:
                    break

    # If we get here and index was specified but not found
    if index is not None and not found and last_line_num - 1 < index:
        raise ValueError(f"Index {index} not found in file (file has fewer lines)")

    # Write to file if specified
    if output_file and output_buffer:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(output_buffer.getvalue())
        print(f"Output written to {output_file}")


def main() -> None:
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Pretty print JSONL files")
    parser.add_argument("file", help="Path to JSONL file")
    parser.add_argument(
        "-i",
        "--index",
        type=int,
        default=None,
        help="Print only the line at this 0-based index",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=str,
        default=None,
        help="Write output to file instead of stdout",
    )

    args = parser.parse_args()

    try:
        pretty_print_jsonl(args.file, index=args.index, output_file=args.output)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
