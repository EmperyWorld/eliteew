# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed error — Курсорина marked missions completed when investigation was incomplete.
# ---

# Курсорина: premature complete (web_cap + empty facet cover)

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-07` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **evidence** | Mission `75afec1b-1021-45fb-851a-c451c96f4820`; pytest `test_web_cap_does_not_complete_brief_with_unread_library`, `test_empty_search_docs_does_not_cover_architecture`; 97 passed `tests/test_kursorina_worker.py` |

## Symptom

Е-лаб brief mission status `completed` with ~798 words / ~5.5k chars. Steps: library hits=3 (never `read_content`) → companies empty×2 → thin kbsew → empty docs → 2×web → fetch + 429 → `finish` reason=`guard_web_cap_finish` → save. Goal (questions/brief) not achieved; tools barely used.

## Failure layers

1. **`search_docs` / empty probes:** empty result still `ok=True` → architecture/standards treated as covered → web budget collapsed to 2.  
2. **`facet_covered`:** companies could fall through to SERP keyword theatre; empty docs covered architecture.  
3. **`rewrite_premature_finish` / web_cap:** any thin substantive evidence allowed `finish` → fake `completed`.  
4. **Brief path:** unread `library_hit` never forced before finish.

## Root cause

Finish gate treated «web budget exhausted + some evidence» as goal achieved, while facet cover accepted empty/thin tool success as investigation done.

## What we did

- `tools.py`: `search_docs` / `search_code` → `ok=bool(ev)`.
- `plan.py`: stricter `facet_covered` (architecture needs diagram/doc/path; companies no SERP-only; standards need KB/doc ≥200 or compliance).
- `decide.py`: `goal_ready_for_finish` + `_finish_or_incomplete`; brief forces `read_content`; incomplete → honest `block` not fake complete.
- Tests + KURSORINA finish-gate canon + readiness projection.

## Recommendations

- Do not raise min answer length as a finish proxy.
- Do not cover facets on empty tool `ok=True`.
- Brief / question-list goals: require depth (library read / company / deep web / docs) before `completed`.

## Verification

```text
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_kursorina_worker.py -q
# → 97 passed
```

## Residual risk

LLM may still propose finish early; guard must keep rewriting. Soft market facets with thin SERP may `block` instead of theatre complete — preferred.
