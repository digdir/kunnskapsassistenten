# Archived: the evaluation code from the headless-rag period

This folder is **documentation**. It is not run, not maintained, and not part of any build.

## What it was

An evaluation system for Kunnskapsassistenten, written while the product ran on
`digdir-headless-rag`. It was a pipeline in four steps — fetch conversation threads
(`ka_api`), extract and categorise questions (`golden_questions`), select a balanced subset,
and run the evaluations (`eval_from_golden_questions`, with a Streamlit dashboard) — plus
`agents`, `exploration` and `scripts` beside them. `README-original.md` in this folder is the original
description, kept as it was, and `STATUS_dec25.md` is where it was left.

The last substantial change was January 2026.

## Why it is kept

The questions, the results in `evals.csv`, the screenshots and the notes are worth keeping:
they are the record of how the answers were measured in that period, and what was learned
from it.

## Why the files were renamed

Keeping runnable code in the repository had a cost that the code was no longer paying for.
Its dependency manifests produced the majority of the repository's open Dependabot alerts, and
its Python gave CodeQL an analysis that covered nothing anyone ships.

So, on purpose:

- **the manifests and lockfiles are gone** — `pyproject.toml`, `uv.lock` and `.python-version`.
  Without them nothing resolves dependencies here, and the alerts they raised do not apply to
  code that is not built;
- **every `.py` is now `.py.txt`**, and the one `.sh` is `.sh.txt`, so no tool finds a language
  to analyse here and nothing can be run by accident. The five files that carried an executable
  bit no longer do, shebang or not;
- **the agent configuration is renamed** — `.claude/` to `claude-config/` and each `CLAUDE.md`
  to `CLAUDE.md.txt` — so no coding agent reads instructions meant for a project that ended.

The content itself is unchanged. To read a file, open it; to run any of it, copy it out of the
repository first and restore the names and the manifests.

## Where evaluation happens now

On the platform. Kunnskapsassistenten runs on genki, and the evaluations come from there.
