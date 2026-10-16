# -*- coding: utf-8 -*-
"""Main entry point for the Bokmål to Nynorsk evaluation."""

import argparse
import logging
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict

from dotenv import load_dotenv

from src.blinding import BlindKey
from src.config import load_config
from src.fasit import load_fasit, read_manifest
from src.reporter import build_results, print_summary, save_results, unblind
from src.scoring import score_blinded_dir
from src.translator import INSTRUCTION, ModelStatus, Translator

logger = logging.getLogger(__name__)


def main() -> int:
    """
    Run translation, blinded scoring and unblinding, in that order.

    Returns:
        Exit code.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config_file", type=Path, help="TOML file with models")
    parser.add_argument("--fasit", type=Path, default=Path("data/fasit.tsv"))
    parser.add_argument("--manifest", type=Path, default=Path("data/fasit.sha256"))
    parser.add_argument("--output-dir", "-o", type=Path, default=Path("output"))
    parser.add_argument("--env-file", type=Path, default=None)
    parser.add_argument(
        "--deadline-minutes",
        type=float,
        default=None,
        help="Stop sending requests after this many minutes",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    load_dotenv(args.env_file)

    config = load_config(args.config_file)
    fasit = load_fasit(args.fasit, args.manifest)

    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = args.output_dir / run_id
    blinded_dir = run_dir / "blinded"

    deadline = (
        time.monotonic() + args.deadline_minutes * 60
        if args.deadline_minutes is not None
        else None
    )

    # 1. Translate, one model at a time. Output is stored under blind ids.
    blind_key = BlindKey()
    translator = Translator(config.run, blind_key, blinded_dir, deadline)
    statuses: Dict[str, ModelStatus] = {}
    for model in config.models:
        logger.info(f"Translating with {model.name}")
        try:
            statuses[model.name] = translator.translate_model(model, fasit)
        except Exception as e:
            logger.error(f"Skipping {model.name}: {e}")
            statuses[model.name] = ModelStatus(skipped_reason=str(e))

    # 2. Score the blinded files. The scorer only sees hash ids.
    scores = score_blinded_dir(fasit, blinded_dir)
    save_results(
        {blind_id: score.model_dump() for blind_id, score in scores.items()},
        run_dir / "blinded_scores.json",
    )

    # 3. Reveal the key, now that scoring is finished.
    blind_key.mark_scored()
    blind_key.write(run_dir / "blind_key.json")
    summaries = unblind(scores, blind_key.reveal())

    results = build_results(
        run_id=run_id,
        config=config,
        fasit=fasit,
        fasit_sha256=read_manifest(args.manifest),
        instruction=INSTRUCTION,
        summaries=summaries,
        statuses=statuses,
    )
    save_results(results, run_dir / "results.json")
    print_summary(results)
    return 0


if __name__ == "__main__":
    sys.exit(main())
