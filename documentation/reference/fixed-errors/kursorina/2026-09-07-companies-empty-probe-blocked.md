# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed error — empty CRM company probe forced blocked incomplete after finish-gate fix.
# ---

# Курсорина: empty search_companies → blocked incomplete

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-07` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **evidence** | Mission `50ad606e-fde0-4b73-a3ab-f7b4de0a504f`; `refuse_finish … pending_facets=['companies']`; pytest empty-probe locks |

## Symptom

After premature-complete fix: Е-лаб brief mission `blocked` with incomplete companies, despite library reads + web deepen. User saw errors / dead end instead of brief.

## Failure layers

1. **`run_tool(search_companies)`:** `ok=bool(ev)` → empty CRM = ok=False.  
2. **`facet_covered(companies)`:** requires `_tool_ok` → never covered on honest miss.  
3. **`goal_ready_for_finish`:** pending companies → `block` instead of synthesize.

## Root cause

Honest CRM miss was treated as tool failure, so companies facet stayed open forever after the finish-gate wave.

## What we did

- `search_companies` ok unless observation contains `error`.
- Guard: skip thrash re-probe when companies already run.
- Tests: empty probe covers; SERP alone does not; brief can finish with depth.

## Recommendations

- Empty internal probe ≠ fail; empty docs/code still fail facet cover (different contract).
- Do not reopen premature web_cap complete.

## Verification

```text
pytest tests/test_kursorina_worker.py -q
# → 99 passed
```

## Residual risk

LLM may still call `run_python` for brief (ImportError noise) — separate; does not block finish after this fix.
