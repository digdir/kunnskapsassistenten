# -*- coding: utf-8 -*-
"""LLM as a Judge for evaluating agent responses."""

import hashlib
import logging
from typing import Dict, List, Optional

from diskcache import Cache
from openai import OpenAI

logger = logging.getLogger(__name__)


class LLMJudge:
    """Uses an LLM to evaluate if responses meet expected behavior."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434/v1",
        api_key: str = "ollama",
        model: str = "gpt-oss:120b-cloud",
        cache: Optional[Cache] = None,
        temperature: float = 0.0,
    ) -> None:
        self.client: OpenAI = OpenAI(base_url=base_url, api_key=api_key)
        self.model: str = model
        self.temperature: float = temperature
        self.cache: Optional[Cache] = cache

    def _get_cache_key(
        self, query: str, response: str, expected_behavior: str, current_date: str
    ) -> str:
        """Generate a cache key from all relevant parameters."""
        # Include all parameters that affect the evaluation
        content: str = (
            f"{query}|{response}|{expected_behavior}|{current_date}|"
            f"{self.model}|temperature:{self.temperature:.2f}"
        )
        return hashlib.sha256(content.encode()).hexdigest()

    def evaluate(
        self, query: str, response: str, expected_behavior: str
    ) -> tuple[bool, str]:
        """
        Evaluate if a response meets the expected behavior.

        Returns:
            tuple[bool, str]: (passed, reason)
        """
        from datetime import datetime

        current_date: str = datetime.now().strftime("%A %d. %B %Y")

        # Check cache if enabled
        if self.cache is not None:
            cache_key: str = self._get_cache_key(
                query, response, expected_behavior, current_date
            )
            cached_result: Optional[tuple[bool, str]] = self.cache.get(cache_key)
            if cached_result is not None:
                logger.info("LLM Judge: Cache hit")
                return cached_result
            logger.info("LLM Judge: Cache miss")

        system_prompt: str = """You are an evaluation judge for a knowledge base system.
Your task is to determine if a response meets the expected behavior criteria.

Respond ONLY with valid JSON in this exact format:
{"passed": true, "reason": "explanation"}
or
{"passed": false, "reason": "explanation"}

Be strict in your evaluation. Only return passed=true if:
1. The response clearly meets ALL criteria in the expected behavior
2. Any factual claims in the response can be verified as correct
3. You have sufficient information to make an accurate judgment

If you lack information to verify factual claims, return passed=false."""

        user_prompt: str = f"""Current date for reference: {current_date}

Query: {query}

Response: {response}

Expected Behavior: {expected_behavior}

Evaluate if the response meets the expected behavior. Return ONLY valid JSON, nothing else."""

        messages: List[Dict[str, str]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        logger.debug(f"LLM Judge Request - Query: {query}")
        logger.debug(f"LLM Judge Request - Response: {response}")
        logger.debug(f"LLM Judge Request - Expected Behavior: {expected_behavior}")
        logger.debug(f"LLM Judge Request - Current Date: {current_date}")
        logger.debug(f"LLM Judge System Prompt:\n{system_prompt}")
        logger.debug(f"LLM Judge User Prompt:\n{user_prompt}")

        result_text: str = ""  # Initialize to avoid unbound variable in except block

        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
            )

            logger.debug(f"LLM Judge Completion: {completion}")

            message = completion.choices[0].message
            result_text = message.content or ""

            # Check for reasoning field
            reasoning: str | None = getattr(message, "reasoning", None)
            if reasoning:
                logger.debug(f"LLM Judge Reasoning: {reasoning}")

            # If content is empty but reasoning exists, fail with explanation
            if not result_text:
                if reasoning:
                    logger.warning(
                        "LLM judge used reasoning mode but did not output final JSON"
                    )
                    return (
                        False,
                        "LLM judge used reasoning mode but did not output final JSON. Judge needs to output evaluation result.",
                    )
                raise ValueError(
                    f"Empty response from LLM judge. Response: {completion}"
                )

            # Parse JSON response
            import json

            logger.debug(f"LLM Judge Raw Response: {result_text}")

            result: dict = json.loads(result_text.strip())

            passed: bool = result.get("passed", False)
            reason: str = result.get("reason", "No reason provided")

            logger.debug(f"LLM Judge Result - Passed: {passed}, Reason: {reason}")

            # Store result in cache if enabled
            if self.cache is not None:
                cache_key: str = self._get_cache_key(
                    query, response, expected_behavior, current_date
                )
                # Store query as tag for easier viewing
                self.cache.set(cache_key, (passed, reason), tag=query)
                logger.debug(f"LLM Judge: Cached result with key {cache_key[:8]}...")

            return passed, reason

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            logger.error(f"Raw result text (first 500 chars): {result_text[:500]}")
            logger.error(f"Result text length: {len(result_text)} chars")

            # Check if response was truncated
            if not result_text.endswith("}"):
                raise RuntimeError(
                    f"LLM judge response was truncated. Increase max_tokens. "
                    f"Response length: {len(result_text)} chars. "
                    f"Last 100 chars: ...{result_text[-100:]}"
                ) from e

            raise RuntimeError(
                f"LLM judge returned invalid JSON. Error: {e}. "
                f"Response preview: {result_text[:200]}..."
            ) from e
        except Exception as e:
            raise RuntimeError(f"LLM judge evaluation failed: {e}") from e
