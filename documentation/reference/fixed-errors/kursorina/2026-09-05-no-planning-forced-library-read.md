# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Forensic: Курсорина mission 83b73754 — no facet planning / tool switch;
# forced megabyte library read then 2× web + deepen-only finish.
# Related:
# - documentation/product/desktop/KURSORINA.md
# - shared/api/services/kursorina/{decide,plan}.py
# ---

# Курсорина: no planning + forced library read before web

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — (pending Commit Package) |
| **evidence** | Celery mission `83b73754`; pytest facet/guard locks |

## Symptom

ZOZH meal-kit research (~21s): `search_library` → forced `read_content` (~1.8MB weak hit) → 2× `web_search` → 3× `fetch_url` → finish. Answer honest but incomplete (Level Kitchen only; missing My Food, prices, unit math). Operator: not Planning / Tool Switching — LLM wrapper that only reads files.

## Failure layers

1. **Decide guard** — `guard_read_library_before_web` blocked web until every library hit was read (including megabyte weak hits).
2. **No investigation plan** — web cap fixed at 2; after that only deepen/finish; no facet tracker for competitors / prices / economics / strategy.
3. **Tool switching** — after library probe the worker did not switch to targeted web for open facets.

## Root cause

Hard library-read-before-web on external goals plus a flat web budget with no facet-driven next query.

## What we did

- `plan.py` — goal facets + evidence coverage + next SERP query.
- `decide.py` — skip force-read when `_wants_external`; facet web budget ≤6; prefer facet `web_search` over fetch/finish/save while pending; `decide_next` switches after library/fetch.
- SoT Decide policy + regression tests.

## Recommendations

- Do not reintroduce `guard_read_library_before_web` for `wants_net` goals.
- Keep library **search** hard gate; reading hits is for library-primary goals only.
- Extend facet cues carefully — keyword coverage is residual risk.

## Verification

```text
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_kursorina_worker.py -q
→ 46 passed
```

## Residual risk

Facet keyword coverage imperfect; SSL fetch failures remain environmental; dual-region Yandex deferred.
