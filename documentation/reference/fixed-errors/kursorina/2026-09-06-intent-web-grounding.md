# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Forensic: pasted-report goals drove junk SERP; facet cue theatre; empty finance;
# off-topic web in synthesize (prod 491dcfdf / evening 2026-09-06).
# Related:
# - documentation/product/desktop/KURSORINA.md
# - documentation/reference/solution-readiness/2026-09-06-kursorina-intent-web-grounding.md
# ---

# Курсорина: intent vs attachment + substantive web grounding

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-06` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — (Commit Package) |
| **evidence** | Prod missions `491dcfdf`, `bef1cd95`, `3d8bc864`; pytest locks |

## Symptom

Operator: search is called but answers often ignore useful web / or look researched while SERP is YouTube junk. Mission with pasted prior report ran 5× web_search on «Notepad…EVIDENCE Sublime» + facet spam (market/economics/SWOT/finance).

## Failure layers

1. **plan** — `facets_for_goal` / `goal_topic_query` on full goal blob including `сам отчёт:` paste.
2. **facet_covered** — keyword cue theatre (≥1) marked market/standards covered by junk SERP.
3. **facet_deliverable** — empty `calculate_financial_metrics` / SWOT without ledger numbers.
4. **synthesize** — off-topic `web` rows still entered product answer ledger.

## Root cause

Investigation plan treated the entire mission goal string as intent; coverage and deliverables then legitimized noise; synthesize trusted the ledger.

## What we did

- `goal_intent_text` + intent-only facets/topic; removed bare «отчёт» market cue; bare `python` no longer opens economics.
- Substantive `facet_covered` (overlap + deliverable kinds for roadmap/risks).
- Gate empty finance/SWOT without `ledger_has_finance_inputs` / `ledger_ready_for_editorial`.
- `evidence_for_synthesize` drops off-topic web (intent token overlap).
- Pytest locks for 491-shaped paste, YouTube non-cover, on-topic cover, empty finance skip, synthesize filter.

## Recommendations

- Keep intent/attachment split server-side — do not rely on LLM to ignore paste.
- Do not raise `web_search_limit` to paper over bad topic queries.
- Thin Yandex `hits=1` remains a separate residual (see thin-SERP entry).

## Verification

```text
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_kursorina_worker.py -q
→ 85 passed
```

## Residual risk

Short goals with &lt;2 topic tokens use softer web filter; paraphrase SERP duplicates still possible; live Yandex quality unchanged.
