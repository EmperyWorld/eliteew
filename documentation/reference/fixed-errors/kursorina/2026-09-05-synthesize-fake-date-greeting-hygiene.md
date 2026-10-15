# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — synthesize invented dates / persona / ## ## / thin goal shell.
# ---

# Synthesize invents report date, greets as Курсорина, doubles ##, thin shells

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **also_affects** | — |

## Symptom

Live completed answers showed invented «Дата отчета: 24 мая 2024», persona greetings, `## ##` headings, and polished shells with weak goal overlap.

## Root cause

Synthesize prompt allowed decorative metadata; no deterministic polish / soft goal-coverage reject before accept.

## What we did

- Tightened `_SYNTH_SYSTEM` (no greeting/date/status invention; no doubled ATX).
- `polish_product_answer` + `goal_coverage_ok` before accepting LLM text; else `structured_user_answer`.

## Verification

```bash
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_kursorina_synthesize_polish.py -q
```

## Residual

Full facet-slot gate before `finish` remains a follow-up (plan.py facets).
