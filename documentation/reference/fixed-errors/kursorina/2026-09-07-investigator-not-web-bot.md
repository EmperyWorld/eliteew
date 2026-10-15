# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed error — Курсорина was a web-search bot; investigator orchestra restored.
# ---

# Курсорина: web-first bot instead of investigator

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-07` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **evidence** | Missions `e7811f9a`, `4ef8cf9a`, `5238f674` (Е-лаб brief); Celery decide logs 6× web_search; pytest investigator-first locks |

## Symptom

User goal: list of questions / brief for company Е-лаб + EliteEW closed OS fit. Worker ran library → many `web_search`/`fetch_url` → fake diagram/table/empty finance → finish with **Рекомендации + Пробелы**. One run **blocked** `web_search_limit_reached`. Never called `search_companies` / platform docs / KBSEW.

## Failure layers

1. **`facets_for_goal`:** bare «бизнес» forced market+competitors+economics pack, wiping companies lane.  
2. **`_EXTERNAL_FACTS_RE`:** «операционных систем» / broad «анализ» marked almost every brief as web-first.  
3. **`decide_next` / `rewrite_premature_finish`:** forced `facet_web` before internal tools.  
4. **Theatre deliverables:** sample mermaid/table on architecture/«таблиц» prose.  
5. **Synthesize:** normalized Рекомендации+Пробелы as the product instead of the brief.

## Root cause

Decide/plan treated Курсорина as a SERP agent; internal tools existed but were never driven.

## What we did

- Investigator-first: `_internal_probe_action` + `_needs_web_channel`; rewrite/decide/guard reorder.  
- Facet plan: do not wipe company hits; cover companies/standards/architecture via internal tools.  
- Narrow external/diagram/table cues; no sample theatre.  
- Synthesize deliverable-first.  
- Locks: `test_elab_brief_goal_probes_companies_before_web`, facet biz wipe lock.

## Verification

```text
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_kursorina_worker.py -q
→ 94 passed
```

## Residual risk

Thin Yandex when web truly needed; company DB miss → short gaps; EliteEW docs quality depends on `documentation/` content.
