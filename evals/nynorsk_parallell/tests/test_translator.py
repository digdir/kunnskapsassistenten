# -*- coding: utf-8 -*-
"""Tests for translator module."""

import time
from pathlib import Path
from types import SimpleNamespace
from typing import Any, List

from src.blinding import BlindKey
from src.config import ModelConfig, RunConfig
from src.fasit import FasitPair
from src.scoring import read_blinded_file
from src.translator import INSTRUCTION, Translator, build_messages, estimate_cost

FASIT = [
    FasitPair(id="npk-0001", nb="Jeg kommer ikke", nn="Eg kjem ikkje"),
    FasitPair(id="npk-0002", nb="Hun fikk en bok", nn="Ho fekk ei bok"),
]


class FakeClient:
    """Stand-in for an OpenAI client that records the requests it gets."""

    def __init__(self, fail: bool = False) -> None:
        self.calls: List[Any] = []
        self.fail = fail
        self.base_url = "http://localhost:11434/v1/"
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        if self.fail:
            raise RuntimeError("model failed")
        message = SimpleNamespace(content=" omsett tekst \n")
        usage = SimpleNamespace(prompt_tokens=1_000_000, completion_tokens=0)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)], usage=usage)


def _model(**kwargs: Any) -> ModelConfig:
    return ModelConfig(name="modell-a", provider="openai", model="m", **kwargs)


class TestBuildMessages:
    """Tests for build_messages function."""

    def test_build_messages_has_fixed_instruction_and_sentence(self) -> None:
        """Test that the prompt is the fixed instruction followed by the sentence."""
        messages = build_messages("Jeg kommer ikke")

        assert messages == [
            {"role": "user", "content": f"{INSTRUCTION}\n\nJeg kommer ikke"}
        ]


class TestTranslator:
    """Tests for Translator class."""

    def test_translate_model_writes_one_blinded_file_per_repetition(
        self, tmp_path: Path
    ) -> None:
        """Test that output is stored under blind ids, without the model name."""
        key = BlindKey()
        client = FakeClient()
        translator = Translator(RunConfig(repetitions=3), key, tmp_path)

        status = translator.translate_model(_model(), FASIT, client)

        files = sorted(tmp_path.glob("*.jsonl"))
        assert status.completed_repetitions == 3
        assert len(files) == 3
        assert all("modell-a" not in path.name for path in files)
        assert all("modell-a" not in path.read_text(encoding="utf-8") for path in files)
        assert read_blinded_file(files[0]) == {
            "npk-0001": "omsett tekst",
            "npk-0002": "omsett tekst",
        }

    def test_translate_model_uses_one_seed_per_repetition(self, tmp_path: Path) -> None:
        """Test that the seed follows the repetition number."""
        client = FakeClient()
        run = RunConfig(repetitions=2, base_seed=10, temperature=0.3)
        translator = Translator(run, BlindKey(), tmp_path)

        translator.translate_model(_model(), FASIT, client)

        assert [call["seed"] for call in client.calls] == [10, 10, 11, 11]
        assert all(call["temperature"] == 0.3 for call in client.calls)

    def test_translate_model_can_omit_sampling_params(self, tmp_path: Path) -> None:
        """Test that temperature and seed are left out when the model rejects them."""
        client = FakeClient()
        translator = Translator(RunConfig(repetitions=1), BlindKey(), tmp_path)

        translator.translate_model(_model(omit_sampling_params=True), FASIT, client)

        assert all("temperature" not in call for call in client.calls)
        assert all("seed" not in call for call in client.calls)

    def test_translate_model_passes_extra_body(self, tmp_path: Path) -> None:
        """Test that provider-specific request fields are sent with each request."""
        client = FakeClient()
        extra = {"thinking": {"type": "disabled"}}
        translator = Translator(RunConfig(repetitions=1), BlindKey(), tmp_path)

        translator.translate_model(_model(extra_body=extra), FASIT, client)

        assert all(call["extra_body"] == extra for call in client.calls)

    def test_translate_model_skips_after_consecutive_errors(
        self, tmp_path: Path
    ) -> None:
        """Test that a failing model is skipped and leaves no output."""
        run = RunConfig(repetitions=3, max_consecutive_errors=2)
        translator = Translator(run, BlindKey(), tmp_path)

        status = translator.translate_model(_model(), FASIT, FakeClient(fail=True))

        assert status.completed_repetitions == 0
        assert status.skipped_reason is not None
        assert "consecutive errors" in status.skipped_reason
        assert list(tmp_path.glob("*.jsonl")) == []

    def test_translate_model_stops_at_deadline(self, tmp_path: Path) -> None:
        """Test that no request is sent after the deadline."""
        client = FakeClient()
        translator = Translator(
            RunConfig(), BlindKey(), tmp_path, deadline=time.monotonic() - 1
        )

        status = translator.translate_model(_model(), FASIT, client)

        assert status.skipped_reason == "deadline reached"
        assert client.calls == []

    def test_translate_model_stops_at_cost_cap(self, tmp_path: Path) -> None:
        """Test that the cost cap stops the model before the next request."""
        client = FakeClient()
        model = _model(usd_per_mtok_input=3.0, max_cost_usd=2.0)
        translator = Translator(RunConfig(), BlindKey(), tmp_path)

        status = translator.translate_model(model, FASIT, client)

        assert status.skipped_reason == "cost cap reached"
        assert len(client.calls) == 1
        assert status.cost_usd == 3.0


class TestEstimateCost:
    """Tests for estimate_cost function."""

    def test_estimate_cost_uses_prices_per_million_tokens(self) -> None:
        """Test cost for input and output tokens."""
        model = _model(usd_per_mtok_input=1.0, usd_per_mtok_output=5.0)

        assert estimate_cost(model, 500_000, 100_000) == 1.0

    def test_estimate_cost_is_zero_without_prices(self) -> None:
        """Test that a model without prices costs nothing."""
        assert estimate_cost(_model(), 1_000_000, 1_000_000) == 0.0
