# -*- coding: utf-8 -*-
import logging
from dataclasses import dataclass

from agents.agent import Agent, AgentRequest, AgentResponse
from eval import Eval
from llm_judge import LLMJudge

logger = logging.getLogger(__name__)


@dataclass
class EvalResult:
    """Result of running an evaluation."""

    eval: Eval
    response: AgentResponse
    passed: bool
    reason: str


class EvalRunner:
    """Runs evaluations against an agent."""

    def __init__(self, agent: Agent, judge: LLMJudge) -> None:
        self.agent: Agent = agent
        self.judge: LLMJudge = judge

    def run_eval(self, eval_case: Eval) -> EvalResult:
        """Run a single evaluation."""
        logger.info(f"Running eval: {eval_case.test_id}")
        logger.debug(f"Query: {eval_case.query}")

        request = AgentRequest(
            query=eval_case.query,
            document_types=eval_case.document_types,
            organizations=eval_case.organizations
        )

        logger.debug(f"Sending request to agent: {request}")
        response: AgentResponse = self.agent.query(request)
        logger.debug(f"Agent response: {response.answer}")

        # Validate the response using LLM judge
        logger.debug("Starting LLM judge evaluation")
        passed, reason = self.judge.evaluate(
            query=eval_case.query,
            response=response.answer,
            expected_behavior=eval_case.expected_behavior
        )

        logger.info(f"Eval {eval_case.test_id} {'PASSED' if passed else 'FAILED'}")

        return EvalResult(
            eval=eval_case,
            response=response,
            passed=passed,
            reason=reason
        )

    def print_result(self, result: EvalResult) -> None:
        """Print the result of an evaluation."""
        status: str = "✓ PASS" if result.passed else "✗ FAIL"
        known_issue_info: str = f" [Known Issue: {result.eval.known_issue_comment}]" if result.eval.known_issue_comment else ""
        reason_label: str = "Reason for PASS" if result.passed else "Reason for FAIL"

        print(f"\n{'='*80}")
        print(f"Test {result.eval.test_id}: {status}{known_issue_info}")
        print(f"{'='*80}")
        print(f"Query: {result.eval.query}")
        print(f"\nResponse:\n{result.response.answer}")
        print(f"\n{reason_label}:\n{result.reason}")
        print(f"\nExpected behavior:\n{result.eval.expected_behavior}")
        print(f"\nNotes:\n{result.eval.notes}")
        print(f"{'='*80}\n")
