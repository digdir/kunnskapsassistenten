# -*- coding: utf-8 -*-
"""Translator module for sending fasit sentences to the models, with blinded output."""

import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from pydantic import BaseModel
from tqdm import tqdm

from src.blinding import BlindKey
from src.config import ModelConfig, RunConfig
from src.fasit import FasitPair
from src.model_resolver import resolve_client

logger = logging.getLogger(__name__)

INSTRUCTION = (
    "Oversett denne teksten fra bokmål til nynorsk. "
    "Svar bare med oversettelsen, uten forklaringer."
)


class ModelStatus(BaseModel):
    """What happened to one model during translation."""

    completed_repetitions: int = 0
    skipped_reason: Optional[str] = None
    errors: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: Optional[float] = None
    seconds: float = 0.0


def build_messages(nb: str) -> List[Dict[str, str]]:
    """
    Build the fixed prompt for one sentence.

    Args:
        nb: Bokmål sentence.

    Returns:
        Chat messages with the instruction and the sentence in one user turn.
    """
    return [{"role": "user", "content": f"{INSTRUCTION}\n\n{nb}"}]


def estimate_cost(model: ModelConfig, input_tokens: int, output_tokens: int) -> float:
    """
    Estimate the cost of the tokens used so far.

    Args:
        model: Model configuration with prices per million tokens.
        input_tokens: Input tokens used.
        output_tokens: Output tokens used.

    Returns:
        Cost in USD. Zero when no prices are configured.
    """
    return (
        input_tokens * (model.usd_per_mtok_input or 0.0)
        + output_tokens * (model.usd_per_mtok_output or 0.0)
    ) / 1_000_000


def unload_ollama_model(model: ModelConfig, base_url: str) -> None:
    """
    Ask Ollama to unload a model, so two models are never in memory at once.

    Args:
        model: Model configuration.
        base_url: OpenAI-compatible base URL of the Ollama server.
    """
    native_url = base_url.rstrip("/").removesuffix("/v1") + "/api/generate"
    try:
        httpx.post(native_url, json={"model": model.model, "keep_alive": 0}, timeout=30)
    except httpx.HTTPError as e:
        logger.warning(f"Could not unload {model.model}: {e}")


class Translator:
    """Runs all repetitions for the configured models, one model at a time."""

    def __init__(
        self,
        run: RunConfig,
        blind_key: BlindKey,
        blinded_dir: Path,
        deadline: Optional[float] = None,
    ) -> None:
        """
        Initialize translator.

        Args:
            run: Settings shared by all models.
            blind_key: Key that hands out blind ids.
            blinded_dir: Directory for the blinded output files.
            deadline: Optional time.monotonic() value. No new request is sent
                after this point.
        """
        self.run = run
        self.blind_key = blind_key
        self.blinded_dir = blinded_dir
        self.deadline = deadline
        blinded_dir.mkdir(parents=True, exist_ok=True)

    def _out_of_time(self) -> bool:
        return self.deadline is not None and time.monotonic() >= self.deadline

    def translate_model(
        self, model: ModelConfig, fasit: List[FasitPair], client: Any = None
    ) -> ModelStatus:
        """
        Translate the fasit with one model, for every repetition.

        A repetition is only written to disk when it is complete. The model is
        skipped after too many consecutive errors, when the deadline passes or
        when the cost cap is reached.

        Args:
            model: Model configuration.
            fasit: Reference pairs.
            client: Optional client with a chat.completions interface. Created
                from the provider configuration when omitted.

        Returns:
            Status with the number of completed repetitions.
        """
        status = ModelStatus()
        started = time.monotonic()

        if client is None:
            client = resolve_client(model, self.run.request_timeout_seconds)

        for repetition in range(1, self.run.repetitions + 1):
            rows = self._translate_repetition(model, fasit, client, repetition, status)
            if rows is None:
                break

            blind_id = self.blind_key.blind_id(model.name, repetition)
            path = self.blinded_dir / f"{blind_id}.jsonl"
            with open(path, "w", encoding="utf-8") as f:
                for row in rows:
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")
            status.completed_repetitions = repetition

        if model.provider == "ollama":
            unload_ollama_model(model, str(client.base_url))

        if model.usd_per_mtok_input or model.usd_per_mtok_output:
            status.cost_usd = estimate_cost(
                model, status.input_tokens, status.output_tokens
            )
        status.seconds = time.monotonic() - started
        return status

    def _translate_repetition(
        self,
        model: ModelConfig,
        fasit: List[FasitPair],
        client: Any,
        repetition: int,
        status: ModelStatus,
    ) -> Optional[List[Dict[str, str]]]:
        """
        Translate every fasit sentence once.

        Returns:
            One row per sentence, or None if the repetition was abandoned.
        """
        rows: List[Dict[str, str]] = []
        consecutive_errors = 0

        for pair in tqdm(fasit, desc=f"model {repetition}/{self.run.repetitions}"):
            if self._out_of_time():
                status.skipped_reason = "deadline reached"
                return None

            if model.max_cost_usd is not None and (
                estimate_cost(model, status.input_tokens, status.output_tokens)
                >= model.max_cost_usd
            ):
                status.skipped_reason = "cost cap reached"
                return None

            sampling: Dict[str, Any] = {}
            if not model.omit_sampling_params:
                sampling = {
                    "temperature": self.run.temperature,
                    "seed": self.run.base_seed + repetition - 1,
                }

            try:
                response = client.chat.completions.create(
                    model=model.model,
                    messages=build_messages(pair.nb),
                    max_tokens=self.run.max_tokens,
                    extra_body=model.extra_body,
                    **sampling,
                )
                translation = response.choices[0].message.content or ""
                usage = getattr(response, "usage", None)
                if usage is not None:
                    status.input_tokens += usage.prompt_tokens or 0
                    status.output_tokens += usage.completion_tokens or 0
                consecutive_errors = 0
            except Exception as e:
                logger.error(f"Error translating {pair.id}: {e}")
                translation = ""
                status.errors += 1
                consecutive_errors += 1
                if consecutive_errors >= self.run.max_consecutive_errors:
                    status.skipped_reason = (
                        f"{consecutive_errors} consecutive errors: {e}"
                    )
                    return None

            rows.append({"id": pair.id, "translation": translation.strip()})

        return rows
