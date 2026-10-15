# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Forensic: mission bdec7da0 — meal-kit facet hardcode, no Python/PNG tool,
# fetch of wrong SERP, «virtual» chart excuse.
# Related:
# - documentation/product/desktop/KURSORINA.md
# ---

# Курсорина: Search→Python→File missing; meal-kit facet pollution

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — (pending) |
| **evidence** | mission `bdec7da0`; pytest 49 passed |

## Symptom

Operator asked for AI-logistics audit with Python unit model, `cash_flow_forecast.png`, and `Market_Intelligence_Report.md`. Worker: ZOZH food facet query → fetch food articles → finish saying chart «cannot be generated»; save used goal text as title; competitors section empty.

## Failure layers

1. **plan.py** — facet `query_hint` hardcoded to meal-kit; cue `сервис` fired on «SaaS-сервис».
2. **Tool surface** — no `run_python` / PNG writer; synthesize invented «cannot generate».
3. **fetch** — FIFO deepen of first (wrong) SERP, not goal-overlap ranking.
4. **Autosave** — ignored requested `*.md` filename.

## Root cause

Domain-specific facet hardcode plus missing compute/file tools in the worker tool-use chain.

## What we did

- Generic goal-topic facets; scored fetch; `run_python` + Pillow PNG → library; deliverable gates; named MD autosave; step_budget 24 for deliverable goals.

## Recommendations

- Never reintroduce vertical-specific query_hint tables.
- Do not claim missing tools in answers when gates require them.

## Verification

```text
pytest tests/test_kursorina_worker.py -q → 49 passed
```

## Residual risk

Pillow line charts (not matplotlib polish); sandbox cannot import arbitrary packages.
