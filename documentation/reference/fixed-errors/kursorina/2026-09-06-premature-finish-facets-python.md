# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Forensic: mission 99a09e0f completed via guard_python_already_done while
# strategy/architecture pending; unit-econ Python default on market CAGR goal.
# Related:
# - documentation/product/desktop/KURSORINA.md
# - documentation/reference/solution-readiness/2026-09-06-kursorina-premature-finish-facets-python.md
# ---

# Курсорина: premature finish + wrong python default (99a09e0f)

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-06` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — (pending Commit Package) |
| **evidence** | Celery mission `99a09e0f-be46-4f1f-9f34-47055aa9fded`; pytest locks |

## Symptom

Mission marked completed after one PNG; plan still pending strategy/architecture; answer reused thin SERP + invented-feeling unit-econ chart (CAC/ARPU) on a market/CAGR gap-fill goal.

## Failure layers

1. **decide** — `guard_python_already_done` called `_finish_action` bypassing canon §24 rewrite.
2. **decide** — web/fetch/dedupe finish shortcuts similarly short-circuited pending facets.
3. **plan** — `facet_covered` treated SERP keyword hits as strategy/economics done.
4. **python_tool** — empty code always ran SaaS unit-econ default; numpy ImportError then same path.

## Root cause

Premature-finish guards were not unified with §24; facet coverage was keyword theatre; python default ignored goal class.

## What we did

- `decide.py` — `rewrite_premature_finish` + `facet_deliverable_action`; all finish shortcuts route through it.
- `plan.py` — tool/evidence-kind coverage for strategy/architecture/economics; `goal_wants_unit_economics_default`.
- `python_tool.py` — unit-econ default only with unit-econ cues; ImportError → one goal-typed empty retry; no numpy allowlist.
- Canon + readiness + this entry; pytest locks.

## Recommendations

- Never add a second finish shortcut that skips `rewrite_premature_finish`.
- Do not raise web SERP max to “cover” strategy/architecture.
- Do not allowlist `numpy`/`pandas` in the sandbox.

## Verification

```text
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest \
  tests/test_kursorina_worker.py -q \
  -k 'python_already_done_routes or web_cap_with_pending_architecture or economics_not_covered or empty_market_goal_skips'
```

## Residual risk

Goal-paste pollution still skews topic queries; facet tools may produce thin SWOT if evidence is thin (honest gaps preferred).
