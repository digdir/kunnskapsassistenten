# -*- coding: utf-8 -*-
"""
Script to run RAG quality evaluations (relevance, completeness, faithfulness).
"""

import argparse
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from diskcache import Cache

from agents.agent import Agent, AgentRequest, AgentResponse
from agents.RagAgent import RagAgent
from llm_judge import LLMJudge
from mock_responses import get_agent

questions: List[str] = [
    "Finn alle strategier fra forsvarssektoren om bruk av kunstig intelligens (KI) de siste tre årene",
    "Jeg vil finne offentlige utredninger om KI",
]


@dataclass
class EvaluationResult:
    """Result of a quality evaluation."""

    query: str
    response: str
    is_relevant: bool
    relevance_reason: str
    is_complete: bool
    completeness_reason: str
    is_faithful: bool
    faithfulness_reason: str
    has_context_relevance: bool 
    context_relevance_reason: str


def evaluate_quality(query: str, agent: Agent, judge: LLMJudge) -> EvaluationResult:
    """
    Evaluate the quality of the agent's response across multiple dimensions.

    Args:
        query: The user's query
        agent: The agent to query
        judge: The LLM judge to evaluate quality

    Returns:
        EvaluationResult with evaluation details for relevance, completeness, and faithfulness
    """
    # Query the agent
    request = AgentRequest(query=query, document_types=[], organizations=[])
    response: AgentResponse = agent.query(request)

    # Evaluate relevance
    relevance_criteria: str = """The response must be relevant to the query.
A relevant response should:
1. Directly address the question asked
2. Provide information that answers or attempts to answer the query
3. Not be completely off-topic or unrelated to the query
4. If the query cannot be answered, acknowledging this and explaining why IS RELEVANT

IMPORTANT: A response that says "I cannot find this information" or "No results found" IS RELEVANT if it directly addresses what was asked.
The response does NOT need to successfully answer the query to be relevant - it just needs to be on-topic and address the question.

Only mark as NOT RELEVANT if the response is completely off-topic or discusses something unrelated to the query."""

    is_relevant, relevance_reason = judge.evaluate(
        query=query, response=response.answer, expected_behavior=relevance_criteria
    )

    # Build chunk information for both completeness and faithfulness evaluation
    chunks_info: str = ""
    if response.chunks_used:
        chunks_info = "\n\nRetrieved Chunks for Verification:\n"
        for i, chunk in enumerate(response.chunks_used, 1):
            chunks_info += (
                f"\nChunk {i} (ID: {chunk.chunk_id}, Doc: {chunk.doc_num}):\n"
            )
            # Include first 500 chars of each chunk to keep prompt manageable
            chunk_preview: str = chunk.content_markdown[:500]
            if len(chunk.content_markdown) > 500:
                chunk_preview += "... [truncated]"
            chunks_info += f"{chunk_preview}\n"

    # Evaluate completeness
    completeness_criteria: str = f"""The response must be complete - it should include ALL relevant information available in the chunks.

The following chunks were retrieved from the knowledge base:
{chunks_info if chunks_info else "No chunks were retrieved for this query."}

Evaluation Guidelines:

**FOCUS: Did the response OMIT any relevant information that was available in the chunks?**

**SCENARIO 1: Chunks contain RELEVANT information to answer the query**
   - ✗ Mark as INCOMPLETE if response says "I cannot find this" when relevant info EXISTS in chunks (OMISSION)
   - ✗ Mark as INCOMPLETE if response omits key details/facts that are present in the chunks (OMISSION)
   - ✗ Mark as INCOMPLETE if response is superficial when more details are available in chunks (OMISSION)
   - ✓ Mark as COMPLETE if response includes all major relevant points from the chunks

**SCENARIO 2: Chunks do NOT contain relevant information (irrelevant or off-topic chunks)**
   - ✓ Mark as COMPLETE if response says "I cannot find this information"
   - ✓ Mark as COMPLETE if response says "No results found"
   - Nothing to include, so nothing can be omitted

**SCENARIO 3: No chunks retrieved**
   - ✓ Mark as COMPLETE if response acknowledges no information was found

**IMPORTANT DISTINCTION:**
- Completeness is about MISSING information (omissions)
- Do NOT penalize for ADDING unsupported information (that's Faithfulness)
- Even if response adds fabricated claims, mark COMPLETE if it included all chunk information

CRITICAL QUESTIONS:
1. What relevant information exists in the chunks?
2. Did the response include all of that information?
3. Ignore any extra information added by the response

The key question: "Did the response include all available relevant information from the chunks (ignoring any additions)?"
"""

    is_complete, completeness_reason = judge.evaluate(
        query=query, response=response.answer, expected_behavior=completeness_criteria
    )

    faithfulness_criteria: str = f"""The response must be faithful to the source documents.
A faithful response should:
1. Only make claims that are supported by the retrieved documents
2. Not hallucinate or fabricate information not present in the sources
3. Accurately represent the information from the sources without distortion
4. When providing specific information or facts, include proper citations to the source documents
5. When unable to find information, acknowledge this based on the available sources

IMPORTANT: The following chunks were retrieved from the knowledge base and should be used to verify claims in the response.
{chunks_info if chunks_info else "No chunks were retrieved for this query."}

Guidelines for evaluation:
- If the response says "I cannot find this information" and the chunks don't contain that information, this IS faithful
- If the response makes specific factual claims (names, dates, numbers), these MUST be cited and verifiable in the chunks
- Citations are NOT required when acknowledging inability to find information
- The response should not fabricate information that doesn't exist in the chunks

Verify that all factual claims in the response are supported by the retrieved chunks above."""

    is_faithful, faithfulness_reason = judge.evaluate(
        query=query, response=response.answer, expected_behavior=faithfulness_criteria
    )

    # Evaluate context relevance (quality of retrieved chunks)
    context_relevance_criteria: str = f"""The retrieved chunks must be relevant to answering the query.

The following chunks were retrieved from the knowledge base:
{chunks_info if chunks_info else "No chunks were retrieved for this query."}

Evaluation Guidelines:

**What is Context Relevance?**
Context relevance measures whether the retrieval system fetched chunks that could help answer the query.
This evaluates the RETRIEVAL QUALITY, not the response quality.

**Evaluation Criteria:**

✓ Mark as RELEVANT if:
   - The chunks contain information directly related to the query topic
   - The chunks could reasonably be used to answer or address the query
   - At least some chunks contain pertinent information (not all chunks need to be perfect)
   - No chunks were retrieved AND the query is unanswerable from the knowledge base (correct negative case)

✗ Mark as NOT RELEVANT if:
   - All chunks are completely off-topic or unrelated to the query
   - The chunks discuss different subjects that cannot help answer the query
   - The retrieval system fetched irrelevant documents

**Special Cases:**
- If NO chunks were retrieved: This is RELEVANT only if the information genuinely doesn't exist in the knowledge base
- Mixed results (some relevant, some not): Focus on whether ANY chunks are useful - mark as RELEVANT if at least some chunks can help

The key question: "Could these retrieved chunks help answer the query?"
"""

    has_context_relevance, context_relevance_reason = judge.evaluate(
        query=query,
        response=chunks_info if chunks_info else "No chunks were retrieved.",
        expected_behavior=context_relevance_criteria
    )

    return EvaluationResult(
        query=query,
        response=response.answer,
        is_relevant=is_relevant,
        relevance_reason=relevance_reason,
        is_complete=is_complete,
        completeness_reason=completeness_reason,
        is_faithful=is_faithful,
        faithfulness_reason=faithfulness_reason,
        has_context_relevance=has_context_relevance,
        context_relevance_reason=context_relevance_reason,
    )


def print_evaluation_result(result: EvaluationResult) -> None:
    """Print a quality evaluation result."""
    relevance_status: str = "✓" if result.is_relevant else "✗"
    completeness_status: str = "✓" if result.is_complete else "✗"
    faithfulness_status: str = "✓" if result.is_faithful else "✗"
    context_relevance_status: str = "✓" if result.has_context_relevance else "✗"

    print(f"\n{'=' * 80}")
    print("Quality Evaluation Results")
    print(f"{'=' * 80}")
    print(f"Query: {result.query}")
    print(f"\nResponse:\n{result.response}")
    print(f"\n{'-' * 80}")
    print(f"RELEVANCE: {relevance_status}")
    print(f"Reason: {result.relevance_reason}")
    print(f"\n{'-' * 80}")
    print(f"COMPLETENESS: {completeness_status}")
    print(f"Reason: {result.completeness_reason}")
    print(f"\n{'-' * 80}")
    print(f"FAITHFULNESS: {faithfulness_status}")
    print(f"Reason: {result.faithfulness_reason}")
    print(f"\n{'-' * 80}")
    print(f"CONTEXT RELEVANCE: {context_relevance_status}")
    print(f"Reason: {result.context_relevance_reason}")
    print(f"{'=' * 80}\n")


def main() -> None:
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Run relevance evaluations")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    parser.add_argument(
        "--no-cache", action="store_true", help="Disable caching of LLM responses"
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Use mock agent instead of real RAG API",
    )
    args = parser.parse_args()

    # Configure logging
    log_level: int = logging.DEBUG if args.debug else logging.INFO
    logging.basicConfig(
        level=log_level, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    # Suppress verbose HTTP debug messages
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("openai._base_client").setLevel(logging.WARNING)

    # Initialize cache if not disabled
    cache_rag: Optional[Cache] = None
    cache_judge: Optional[Cache] = None
    if not args.no_cache:
        cache_dir: Path = Path(__file__).parent / ".cache"
        # Set size limit to 2GB and enable eviction policy
        cache_rag = Cache(
            str(cache_dir / "rag"), size_limit=2 * 1024**3
        )  # 2GB in bytes
        cache_judge = Cache(
            str(cache_dir / "judge"), size_limit=2 * 1024**3
        )  # 2GB in bytes
        print(f"Cache enabled: {cache_dir} (max size: 2GB)")
    else:
        print("Cache disabled")

    # Get agent - use mock or real RAG API based on command line argument
    if args.mock:
        print("Using mock agent with predefined responses")
        agent: Agent = get_agent()
    else:
        print("Using real RAG API")
        agent: Agent = RagAgent(cache=cache_rag)

    # Create LLM judge
    judge: LLMJudge = LLMJudge(cache=cache_judge)

    # Run quality evaluations
    print(f"Running quality evaluations for {len(questions)} questions...")
    print("=" * 80)

    results: List[EvaluationResult] = []
    for question in questions:
        print(f"\nEvaluating: {question}")
        result: EvaluationResult = evaluate_quality(question, agent, judge)
        print_evaluation_result(result)
        results.append(result)
        print("-" * 80)

    # Print summary
    print("\n" + "=" * 80)
    print("QUALITY EVALUATION SUMMARY")
    print("=" * 80)

    relevant_count: int = sum(1 for r in results if r.is_relevant)
    complete_count: int = sum(1 for r in results if r.is_complete)
    faithful_count: int = sum(1 for r in results if r.is_faithful)
    context_relevant_count: int = sum(1 for r in results if r.has_context_relevance)
    all_passed_count: int = sum(
        1 for r in results if r.is_relevant and r.is_complete and r.is_faithful and r.has_context_relevance
    )

    print(f"\nTotal Evaluations: {len(results)}")
    print("\nDimension Results:")
    print(
        f"  Relevant:          {relevant_count}/{len(results)} ({relevant_count / len(results) * 100:.1f}%)"
    )
    print(
        f"  Complete:          {complete_count}/{len(results)} ({complete_count / len(results) * 100:.1f}%)"
    )
    print(
        f"  Faithful:          {faithful_count}/{len(results)} ({faithful_count / len(results) * 100:.1f}%)"
    )
    print(
        f"  Context Relevant:  {context_relevant_count}/{len(results)} ({context_relevant_count / len(results) * 100:.1f}%)"
    )
    print(
        f"\nAll Dimensions Passed: {all_passed_count}/{len(results)} ({all_passed_count / len(results) * 100:.1f}%)"
    )

    # List failures by dimension
    failed_relevance: List[EvaluationResult] = [r for r in results if not r.is_relevant]
    failed_completeness: List[EvaluationResult] = [
        r for r in results if not r.is_complete
    ]
    failed_faithfulness: List[EvaluationResult] = [
        r for r in results if not r.is_faithful
    ]
    failed_context_relevance: List[EvaluationResult] = [
        r for r in results if not r.has_context_relevance
    ]

    if failed_relevance:
        print("\nFAILED RELEVANCE:")
        for result in failed_relevance:
            print(f"  ✗ {result.query[:80]}...")

    if failed_completeness:
        print("\nFAILED COMPLETENESS:")
        for result in failed_completeness:
            print(f"  ✗ {result.query[:80]}...")

    if failed_faithfulness:
        print("\nFAILED FAITHFULNESS:")
        for result in failed_faithfulness:
            print(f"  ✗ {result.query[:80]}...")

    if failed_context_relevance:
        print("\nFAILED CONTEXT RELEVANCE:")
        for result in failed_context_relevance:
            print(f"  ✗ {result.query[:80]}...")

    print("\n" + "=" * 80)


if __name__ == "__main__":
    main()
