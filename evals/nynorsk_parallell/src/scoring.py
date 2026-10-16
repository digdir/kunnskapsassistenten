# -*- coding: utf-8 -*-
"""Scoring of blinded translations with chrF (sacrebleu)."""

import json
import logging
import statistics
from pathlib import Path
from typing import Dict, List

from pydantic import BaseModel
from sacrebleu.metrics import CHRF

from src.fasit import FasitPair

logger = logging.getLogger(__name__)

COPY_BASELINE = "kopi-av-bokmaal"


class RepetitionScore(BaseModel):
    """chrF for one blinded repetition."""

    corpus_chrf: float
    mean_sentence_chrf: float
    sentence_chrf: Dict[str, float]
    exact_match_rate: float
    empty_outputs: int


class ModelSummary(BaseModel):
    """chrF for one model across repetitions."""

    repetitions: int
    corpus_chrf_per_repetition: List[float]
    corpus_chrf_mean: float
    corpus_chrf_std: float
    mean_sentence_chrf: float
    exact_match_rate_per_repetition: List[float]
    exact_match_rate_mean: float
    empty_outputs: int


def normalize_whitespace(text: str) -> str:
    """
    Strip a text and collapse every run of whitespace to one space.

    Args:
        text: Translation or reference.

    Returns:
        Text used for the exact match comparison.
    """
    return " ".join(text.split())


def is_exact_match(output: str, reference: str) -> bool:
    """
    Check whether a translation is identical to the reference.

    The comparison is made after strip() and whitespace normalization. Case
    and punctuation must be the same.

    Args:
        output: Translation from the model.
        reference: Nynorsk reference.

    Returns:
        True if the two texts are identical.
    """
    return normalize_whitespace(output) == normalize_whitespace(reference)


def chrf_signature() -> str:
    """
    Return the sacrebleu signature for the chrF configuration in use.

    Returns:
        Signature string.
    """
    chrf = CHRF()
    chrf.corpus_score(["a"], [["a"]])  # the signature needs the reference count
    return str(chrf.get_signature())


def score_translations(
    fasit: List[FasitPair], hypotheses: Dict[str, str]
) -> RepetitionScore:
    """
    Score one set of translations against the Nynorsk references.

    A missing or empty translation is scored as an empty string.

    Args:
        fasit: Reference pairs.
        hypotheses: Mapping from fasit id to translation.

    Returns:
        Corpus chrF, mean sentence chrF, chrF per sentence and the share of
        sentences that are identical to the reference.
    """
    chrf = CHRF()
    references = [pair.nn for pair in fasit]
    outputs = [hypotheses.get(pair.id, "").strip() for pair in fasit]

    sentence_scores = {
        pair.id: chrf.sentence_score(output, [pair.nn]).score
        for pair, output in zip(fasit, outputs)
    }
    corpus = chrf.corpus_score(outputs, [references]).score

    return RepetitionScore(
        corpus_chrf=corpus,
        mean_sentence_chrf=statistics.fmean(sentence_scores.values()),
        sentence_chrf=sentence_scores,
        exact_match_rate=statistics.fmean(
            is_exact_match(output, pair.nn) for pair, output in zip(fasit, outputs)
        ),
        empty_outputs=sum(1 for output in outputs if not output),
    )


def read_blinded_file(path: Path) -> Dict[str, str]:
    """
    Read one blinded output file.

    Args:
        path: JSONL file with one {"id", "translation"} object per line.

    Returns:
        Mapping from fasit id to translation.
    """
    hypotheses: Dict[str, str] = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            hypotheses[row["id"]] = row["translation"]
    return hypotheses


def score_blinded_dir(
    fasit: List[FasitPair], blinded_dir: Path
) -> Dict[str, RepetitionScore]:
    """
    Score every blinded output file in a directory.

    The scorer only sees hash ids, never model names.

    Args:
        fasit: Reference pairs.
        blinded_dir: Directory with one <blind_id>.jsonl file per repetition.

    Returns:
        Mapping from blind id to scores.
    """
    scores: Dict[str, RepetitionScore] = {}
    for path in sorted(blinded_dir.glob("*.jsonl")):
        scores[path.stem] = score_translations(fasit, read_blinded_file(path))
        logger.info(f"Scored {path.stem}: chrF {scores[path.stem].corpus_chrf:.2f}")
    return scores


def score_copy_baseline(fasit: List[FasitPair]) -> RepetitionScore:
    """
    Score the untranslated Bokmål sentences against the Nynorsk references.

    Bokmål and Nynorsk share much of their spelling, so this is the floor a
    translation has to beat.

    Args:
        fasit: Reference pairs.

    Returns:
        Scores for returning the source unchanged.
    """
    return score_translations(fasit, {pair.id: pair.nb for pair in fasit})


def summarize(repetition_scores: List[RepetitionScore]) -> ModelSummary:
    """
    Summarize chrF across the repetitions of one model.

    Args:
        repetition_scores: Scores for each repetition of the same model.

    Returns:
        Mean and sample standard deviation of corpus chrF across repetitions,
        and the exact match rate per repetition and as a mean.

    Raises:
        ValueError: If there are no repetitions.
    """
    if not repetition_scores:
        raise ValueError("Cannot summarize a model without repetitions")

    corpus = [score.corpus_chrf for score in repetition_scores]
    return ModelSummary(
        repetitions=len(corpus),
        corpus_chrf_per_repetition=corpus,
        corpus_chrf_mean=statistics.fmean(corpus),
        corpus_chrf_std=statistics.stdev(corpus) if len(corpus) > 1 else 0.0,
        mean_sentence_chrf=statistics.fmean(
            score.mean_sentence_chrf for score in repetition_scores
        ),
        exact_match_rate_per_repetition=[
            score.exact_match_rate for score in repetition_scores
        ],
        exact_match_rate_mean=statistics.fmean(
            score.exact_match_rate for score in repetition_scores
        ),
        empty_outputs=sum(score.empty_outputs for score in repetition_scores),
    )
