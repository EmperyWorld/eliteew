# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Forensic record: Курсорина mission returned URL dump instead of top-10
# analytics (mission 71d6ceb6, 2026-09-05). Cause fixed: decide guards + synthesize.
# Related:
# - documentation/product/desktop/KURSORINA.md
# - shared/api/services/kursorina/
# ---

# Курсорина: LLM web spam + ledger dump as «answer»

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | `9b43ab949` (+ fetch_url follow-up) |
| **evidence** | Celery logs mission `71d6ceb6-c1b2-4277-aa67-1a49a423ac3b`; pytest locks |

## Symptom

User asked for top-10 desktop tools with full analytics. UI showed SEO URL «находки» and answer = `Цель` / `Улики` / `Вывод: library=0, web=12…` (worker ledger dialect), duplicate «Готово».

## Failure layers

1. **LLM decide** — three consecutive `web_search` before any library probe (bypassed library-first).
2. **No web stop** — repeated searches after enough hits.
3. **Heuristic tail** — `search_docs` (`platform_docs`) after empty library on a consumer/market goal.
4. **Answer** — `finish` persisted `answer_from_evidence` dump, not grounded user synthesis.
5. **Evidence depth** — Yandex snippets are SEO intros; weak material for a real top-10 even after synthesize.
6. **FE** — duplicate terminal progress copy.

## Root cause

`decide_next` preferred unconstrained LLM tool choice; product answer path had no grounded synthesize step — only ledger serialization.

## What we did

- `decide_next` hard library-first + `guard_llm_action` (web cap ≤2 / ≥6 hits; skip platform tools on external goals).
- `synthesize_answer` / `structured_user_answer` for product `answer`; ledger dump no longer on finish path.
- FE: hide progress when it duplicates status label («Готово»).
- Regression tests: guard rewrite, web cap, structured answer dialect lock, tick synthesize patch.

## Recommendations

- Keep guards server-side — do not trust LLM decide alone.
- `fetch_url` landed (same-day follow-up) — deepen SERP hits before synthesize.

## Verification

```text
pytest tests/test_kursorina_worker.py -q
→ guard / web_budget / structured_answer / tick synthesize locks green
```

## Residual risk

Thin answers when Yandex snippets lack ranked lists — mitigated by `fetch_url` deepen (≤3 pages). JS-heavy pages may still yield thin text.
