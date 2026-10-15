# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Registry: AMKA execute failed when mutation_result called .get on MarketingFunnelOut.
# ---

# AMKA execute: MarketingFunnelOut has no attribute get

| Field | Value |
|-------|--------|
| **product_id** | `marketing-cabinet` |
| **status** | `fixed` |
| **date** | `2026-09-13` |
| **also_affects** | AMKA execute autofill for any `Marketing*Out` entity |
| **canon** | `documentation/product/marketing/` (AMKA execute mutations) |
| **commit** | — |

## Symptom

`[AMKA] event=execute.failed … err='MarketingFunnelOut' object has no attribute 'get' phase=execute` during autofill/update funnel.

## Failure layers

1. **Router contract** — `create_funnel` / `update_funnel` return `MarketingFunnelOut` (Pydantic).
2. **Mutation boundary** — `AmkaMutationService._mutation_result` assumed `dict` and called `item.get("id")`.

## Root cause

Shared mutation result builder treated router Out models as dicts.

## What we did

- `_as_mutation_snapshot()` coerces BaseModel via `model_dump(mode="json")` or passes dicts through.
- `_mutation_result` uses the snapshot for ids / `_entity_ref`.
- Unit lock: `tests/test_amka_mutation_result_snapshot.py`.

## Recommendations

- Do not assume cabinet router returns are dicts inside AMKA services.
- Prefer one coerce helper over per-entity `.model_dump()` at call sites.

## Verification

- [x] `pytest tests/test_amka_mutation_result_snapshot.py -q`
