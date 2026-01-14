#!/usr/bin/env python3
"""Convert JSONL files to Parquet format for efficient querying and analysis."""

import json
from pathlib import Path
from typing import List, Dict, Any

import pandas as pd


def jsonl_to_parquet(jsonl_path: Path, parquet_path: Path) -> None:
    """
    Convert a JSONL file to Parquet format.

    Args:
        jsonl_path: Path to input JSONL file
        parquet_path: Path to output Parquet file
    """
    # Read JSONL file
    data: List[Dict[str, Any]] = []
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:  # Skip empty lines
                data.append(json.loads(line))

    if not data:
        print(f"Warning: No data found in {jsonl_path}")
        return

    # Convert to DataFrame and save as Parquet
    df = pd.DataFrame(data)
    df.to_parquet(parquet_path, engine='pyarrow', compression='snappy')

    # Print statistics
    jsonl_size = jsonl_path.stat().st_size
    parquet_size = parquet_path.stat().st_size
    compression_ratio = (1 - parquet_size / jsonl_size) * 100

    print(f"Converted: {jsonl_path.name}")
    print(f"  Records: {len(data)}")
    print(f"  JSONL size: {jsonl_size:,} bytes")
    print(f"  Parquet size: {parquet_size:,} bytes")
    print(f"  Compression: {compression_ratio:.1f}% smaller")
    print(f"  Output: {parquet_path}")
    print()


def main() -> None:
    """Convert all JSONL files in the current directory to Parquet."""
    current_dir = Path(__file__).parent
    jsonl_files = list(current_dir.glob("*.jsonl"))

    if not jsonl_files:
        print("No JSONL files found in the current directory")
        return

    print(f"Found {len(jsonl_files)} JSONL file(s)\n")

    for jsonl_file in jsonl_files:
        parquet_file = jsonl_file.with_suffix('.parquet')
        try:
            jsonl_to_parquet(jsonl_file, parquet_file)
        except Exception as e:
            print(f"Error converting {jsonl_file.name}: {e}\n")


if __name__ == "__main__":
    main()
