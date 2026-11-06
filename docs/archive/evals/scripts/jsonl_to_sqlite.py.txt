#!/usr/bin/env python3
"""Convert JSONL files to SQLite database.

Each JSONL file becomes a table, and each line becomes a row.
Nested JSON structures are preserved as JSON text in columns.
"""

import argparse
import json
import logging
import sqlite3
from pathlib import Path
from typing import Any, Set

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def sanitize_table_name(filename: str) -> str:
    """
    Convert filename to valid SQLite table name.

    Args:
        filename: Original filename

    Returns:
        Sanitized table name
    """
    # Remove extension
    name = Path(filename).stem
    # Replace invalid characters with underscore
    name = "".join(c if c.isalnum() or c == "_" else "_" for c in name)
    # Ensure doesn't start with number
    if name[0].isdigit():
        name = f"table_{name}"
    return name


def get_all_keys(jsonl_path: Path) -> Set[str]:
    """
    Scan JSONL file to discover all unique keys.

    Args:
        jsonl_path: Path to JSONL file

    Returns:
        Set of all unique top-level keys
    """
    keys: Set[str] = set()
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                keys.update(record.keys())
            except json.JSONDecodeError:
                continue
    return keys


def infer_column_type(value: Any) -> str:
    """
    Infer SQLite column type from Python value.

    Args:
        value: Python value

    Returns:
        SQLite type name
    """
    if value is None:
        return "TEXT"
    elif isinstance(value, bool):
        return "BOOLEAN"
    elif isinstance(value, int):
        return "INTEGER"
    elif isinstance(value, float):
        return "REAL"
    elif isinstance(value, (dict, list)):
        return "TEXT"  # Store as JSON
    else:
        return "TEXT"


def create_table_for_jsonl(
    conn: sqlite3.Connection,
    table_name: str,
    jsonl_path: Path
) -> None:
    """
    Create table with schema inferred from JSONL file.

    Args:
        conn: SQLite database connection
        table_name: Name for the table
        jsonl_path: Path to JSONL file
    """
    # Get all keys from file
    keys = get_all_keys(jsonl_path)

    if not keys:
        raise ValueError(f"No valid JSON records found in {jsonl_path}")

    # Read first record to infer types
    first_record = {}
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                first_record = json.loads(line)
                break

    # Build column definitions
    columns = ["id INTEGER PRIMARY KEY AUTOINCREMENT"]
    for key in sorted(keys):
        col_type = infer_column_type(first_record.get(key))
        # Escape column names with spaces or special chars
        safe_key = f'"{key}"' if not key.isidentifier() else key
        columns.append(f"{safe_key} {col_type}")

    # Create table
    create_sql = f"CREATE TABLE IF NOT EXISTS {table_name} ({', '.join(columns)})"
    cursor = conn.cursor()
    cursor.execute(create_sql)
    conn.commit()

    logger.info(f"Created table '{table_name}' with {len(keys)} columns")


def insert_records(
    conn: sqlite3.Connection,
    table_name: str,
    jsonl_path: Path
) -> int:
    """
    Insert records from JSONL into table.

    Args:
        conn: SQLite database connection
        table_name: Name of the table
        jsonl_path: Path to JSONL file

    Returns:
        Number of records inserted
    """
    cursor = conn.cursor()
    count = 0

    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue

            try:
                record = json.loads(line)

                # Get column names and values
                columns = []
                values = []

                for key, value in record.items():
                    # Escape column names with spaces or special chars
                    safe_key = f'"{key}"' if not key.isidentifier() else key
                    columns.append(safe_key)

                    # Convert nested structures to JSON strings
                    if isinstance(value, (dict, list)):
                        values.append(json.dumps(value))
                    else:
                        values.append(value)

                # Build and execute insert
                placeholders = ",".join(["?"] * len(columns))
                insert_sql = f"INSERT INTO {table_name} ({','.join(columns)}) VALUES ({placeholders})"

                cursor.execute(insert_sql, values)
                count += 1

                if count % 100 == 0:
                    conn.commit()
                    logger.debug(f"Inserted {count} records into {table_name}")

            except json.JSONDecodeError as e:
                logger.error(
                    f"Error parsing JSON on line {line_num} in {jsonl_path}: {e}"
                )
            except Exception as e:
                logger.error(
                    f"Error inserting record on line {line_num} in {jsonl_path}: {e}"
                )

    conn.commit()
    return count


def load_jsonl_to_table(
    conn: sqlite3.Connection,
    jsonl_path: Path
) -> None:
    """
    Load JSONL file into a table.

    Args:
        conn: SQLite database connection
        jsonl_path: Path to JSONL file
    """
    table_name = sanitize_table_name(jsonl_path.name)

    logger.info(f"Processing {jsonl_path.name} -> table '{table_name}'")

    # Create table with inferred schema
    create_table_for_jsonl(conn, table_name, jsonl_path)

    # Insert all records
    count = insert_records(conn, table_name, jsonl_path)

    logger.info(f"Inserted {count} records into '{table_name}'")


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Convert JSONL files to SQLite database. "
        "Each JSONL file becomes a table named after the file."
    )
    parser.add_argument(
        "jsonl_files",
        nargs="+",
        type=Path,
        help="JSONL files to convert"
    )
    parser.add_argument(
        "-o", "--output",
        type=Path,
        default=Path("output.db"),
        help="Output SQLite database file (default: output.db)"
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing database"
    )

    args = parser.parse_args()

    # Check if database exists
    if args.output.exists() and not args.overwrite:
        logger.error(
            f"Database {args.output} already exists. "
            f"Use --overwrite to replace it."
        )
        return

    # Remove existing database if overwriting
    if args.overwrite and args.output.exists():
        args.output.unlink()
        logger.info(f"Removed existing database {args.output}")

    # Create database connection
    conn = sqlite3.connect(args.output)

    try:
        # Load each JSONL file as a table
        for jsonl_file in args.jsonl_files:
            if not jsonl_file.exists():
                logger.error(f"File not found: {jsonl_file}")
                continue

            try:
                load_jsonl_to_table(conn, jsonl_file)
            except Exception as e:
                logger.error(f"Failed to load {jsonl_file}: {e}")

        logger.info(f"\nDatabase created: {args.output}")

        # Print summary
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()

        logger.info(f"\nDatabase Summary:")
        logger.info(f"  Total tables: {len(tables)}")

        for (table_name,) in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            logger.info(f"    {table_name}: {count} rows")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
