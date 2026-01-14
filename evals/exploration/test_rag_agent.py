#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Test script for RagAgent."""

import logging
import sys

from agents import AgentRequest, RagAgent

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def main() -> None:
    """Test the RagAgent with a simple query."""
    try:
        # Initialize the agent
        logger.info("Initializing RagAgent...")
        agent = RagAgent()

        # Create a test request
        request = AgentRequest(
            query="Hvilken dag er det i dag?",
            document_types=[],
            organizations=[],
            temperature=0.0,
        )

        # Send the query
        logger.info(f"Sending query: {request.query}")
        response = agent.query(request)

        # Display the results
        print("\n" + "=" * 80)
        print("QUERY:")
        print(f"  {request.query}")
        print("\nRESPONSE:")
        print(f"  {response.answer}")
        print("\nMETADATA:")
        print(f"  Conversation ID: {response.conversation_id}")
        print(f"  Model: {response.model}")
        print(f"  Chunks used: {len(response.chunks_used)}")
        print("=" * 80 + "\n")

        logger.info("Test completed successfully!")

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        logger.error(
            "Make sure RAG_API_KEY, RAG_API_URL, and RAG_API_EMAIL are set in your environment"
        )
        sys.exit(1)
    except Exception as e:
        logger.error(f"Error during test: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
