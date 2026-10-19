# Spec: Bokmål to Nynorsk evaluation against a locked parallel reference

## Purpose

Give #18 (Vurdering av norsk språkmodell) a measurement that can be repeated:
how well does a model translate Bokmål to Nynorsk, compared with a human-checked
reference?

## Scope

- A new sibling module in `evals/`. No change to product code or to the other
  eval modules.
- Independent of `Config` and `RAGQuerier` in `eval_from_golden_questions`,
  which need RAG API and Langfuse keys.
- Runs against a local Ollama model or an API key of your own.

## Requirements

1. **Locked reference.** `data/fasit.tsv` has the columns `id`, `nb`, `nn`.
   Its sha256 is stored in `data/fasit.sha256` and checked on every load.
   A mismatch stops the run.
2. **Fixed instruction.** Every model gets the same prompt: the instruction in
   `src/translator.py` followed by the Bokmål sentence, in one user turn.
3. **Models in a config file.** `models.toml` lists the models. Providers are
   `ollama`, `openai` and `azure_openai`, as in `eval_from_golden_questions`.
4. **Repetitions.** Each model translates the whole reference set N times
   (default 3), with seed `base_seed + repetition - 1`.
5. **Metric.** chrF from sacrebleu, per sentence and for the whole set, with
   the mean and sample standard deviation of the set score across repetitions.
   The exact match rate is the share of sentences where the output is
   identical to the reference after strip() and whitespace normalization,
   reported per repetition and as a mean. The untranslated Bokmål sentence is
   scored as a baseline for both.
6. **Blinding.** Each (model, repetition) is stored as `<hash>.jsonl`. The hash
   uses a random salt that only lives in memory. The key that links hash and
   model is written after scoring is finished, and not before.
7. **One model at a time.** Models run in the order given, and an Ollama model
   is unloaded before the next one starts.
8. **Stopping rules.** A model is skipped after N consecutive errors, when the
   deadline passes, or when its cost cap is reached. Only complete repetitions
   are scored.

## Acceptance criteria

- `uv run pytest` passes, with tests for the loader, scoring and blinding.
- `ruff check .` and `ruff format --check .` pass.
- A changed `fasit.tsv` is rejected.
- No file under `blinded/` contains a model name.
- `blind_key.json` cannot be written before `mark_scored()` is called.
