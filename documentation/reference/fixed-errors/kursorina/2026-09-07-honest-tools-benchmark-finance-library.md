# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Forensic: prod lady_boss 2026-09-07 — benchmark AttributeError+RNG, empty
# finance defaults, library thrash, prose decide reasons.
# Related:
# - documentation/product/desktop/KURSORINA.md
# - documentation/reference/solution-readiness/2026-09-07-kursorina-honest-tools-library-thrash.md
# ---

# Курсорина: honest tools — benchmark crash/RNG, finance defaults, library thrash

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-07` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — (Commit Package) |
| **evidence** | Missions `38e6c507`/`643f720e` (blocked), `6871b0eb` (library thrash), `58e3a6be` (finance theatre); pytest locks |

## Symptom

Operator: competitor benchmark missions crash to `blocked`; completed missions invent CAGR/ranks; library-audit spins dozens of empty `search_library`; decide logs free-form Russian essays in `reason=`.

## Failure layers

1. **tools** — `criteria` as `list[str]` → `c.get` AttributeError; RNG scores + fake subject leadership.
2. **tools** — `calculate_financial_metrics` silent defaults when `inputs={}`.
3. **plan** — `ledger_has_finance_inputs` matched bare years (`\d{3,}`).
4. **decide** — no library query dedupe / empty streak rewrite; LLM reason prose stored raw.

## Root cause

Tool contracts trusted LLM arg shapes and invented numbers; decide lacked thrash stop; finance ledger gate was too loose.

## What we did

- `tools.py` — normalize criteria/competitors; explicit `scores` only; finance refuse empty defaults with gap evidence.
- `plan.py` — finance-context regex (cue+number / млрд|₽|%).
- `decide.py` — library thrash guards; reason snake_case coerce; benchmark needs editorial-ready ledger.
- Canon + readiness + pytest locks.

## Recommendations

- Never restore RNG / default CAC theatre under «demo» or «MVP».
- Do not raise library step budget to paper over thrash.
- Thin Yandex `hits=1` remains a separate residual.

## Verification

```text
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_kursorina_worker.py -q
→ 92 passed
```

## Residual risk

Thin SERP quality; finance needs structured number extraction into `inputs` for real calc (gap is honest until then). `aggregate_market_statistics` default series theatre is out of this wave.
