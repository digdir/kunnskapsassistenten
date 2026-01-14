#!/usr/bin/env python3
"""Import JSONL files into MongoDB for easy exploration and querying."""

import json
import logging
from pathlib import Path
from typing import Optional

from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def import_jsonl_to_mongodb(
    jsonl_path: Path,
    collection_name: Optional[str] = None,
    mongo_uri: str = "mongodb://localhost:27017/",
    database_name: str = "kua_evals",
) -> None:
    """
    Import a JSONL file into a MongoDB collection.

    Always drops existing collection to ensure fresh data.

    Args:
        jsonl_path: Path to input JSONL file
        collection_name: Name for MongoDB collection (defaults to filename without extension)
        mongo_uri: MongoDB connection URI
        database_name: Name of the database to use
    """
    # Connect to MongoDB
    try:
        client: MongoClient = MongoClient(mongo_uri)
        client.admin.command("ping")
        logger.info(f"Connected to MongoDB at {mongo_uri}")
    except ConnectionFailure as e:
        raise ConnectionError(f"Failed to connect to MongoDB: {e}")

    # Get database and collection
    db = client[database_name]
    if collection_name is None:
        collection_name = jsonl_path.stem
    collection = db[collection_name]

    # Always drop existing collection to invalidate old data
    if collection_name in db.list_collection_names():
        collection.drop()
        logger.info(f"Dropped existing collection: {collection_name}")

    # Read and import JSONL file
    documents = []
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if line:
                try:
                    documents.append(json.loads(line))
                except json.JSONDecodeError as e:
                    logger.warning(f"Skipping invalid JSON at line {line_num}: {e}")

    if not documents:
        logger.warning(f"No valid documents found in {jsonl_path}")
        return

    # Insert documents
    result = collection.insert_many(documents)
    inserted_count = len(result.inserted_ids)

    logger.info(f"Imported {inserted_count} documents into '{database_name}.{collection_name}'")
    logger.info(f"Source: {jsonl_path}")

    # Create useful indexes
    if "question_id" in documents[0]:
        collection.create_index("question_id")
        logger.info("Created index on 'question_id'")
    if "conversation_id" in documents[0]:
        collection.create_index("conversation_id")
        logger.info("Created index on 'conversation_id'")

    # Print sample query
    logger.info(f"\nExample queries:")
    logger.info(f"  db.{collection_name}.find().limit(5)")
    logger.info(f"  db.{collection_name}.countDocuments({{}})")
    if "success" in documents[0]:
        logger.info(f"  db.{collection_name}.find({{success: true}})")


def main() -> None:
    """Import all JSONL files in the current directory to MongoDB."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Import JSONL files into MongoDB",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Import all JSONL files in current directory (drops existing data)
  %(prog)s

  # Import specific file
  %(prog)s --file data.jsonl

  # Use custom MongoDB URI and database
  %(prog)s --uri mongodb://localhost:27017/ --db my_database
        """,
    )
    parser.add_argument(
        "--file",
        type=Path,
        help="Specific JSONL file to import (default: import all *.jsonl in current dir)",
    )
    parser.add_argument(
        "--uri",
        default="mongodb://localhost:27017/",
        help="MongoDB connection URI (default: mongodb://localhost:27017/)",
    )
    parser.add_argument(
        "--db",
        default="kua_evals",
        help="Database name (default: kua_evals)",
    )
    parser.add_argument(
        "--collection",
        help="Collection name (default: filename without extension)",
    )

    args = parser.parse_args()

    # Get JSONL files to import
    if args.file:
        jsonl_files = [args.file] if args.file.exists() else []
        if not jsonl_files:
            logger.error(f"File not found: {args.file}")
            return
    else:
        jsonl_files = list(Path(".").glob("*.jsonl"))

    if not jsonl_files:
        logger.error("No JSONL files found")
        return

    logger.info(f"Found {len(jsonl_files)} JSONL file(s)\n")

    # Import each file
    for jsonl_file in jsonl_files:
        try:
            import_jsonl_to_mongodb(
                jsonl_file,
                collection_name=args.collection,
                mongo_uri=args.uri,
                database_name=args.db,
            )
            logger.info("")
        except Exception as e:
            logger.error(f"Error importing {jsonl_file.name}: {e}\n")


if __name__ == "__main__":
    main()
