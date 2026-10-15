# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Forensic: mission b5311c09 — WARN model 'local', same-host fetch retries,
# duplicate web_search queries.
# Related:
# - documentation/product/desktop/KURSORINA.md
# - documentation/reference/solution-readiness/2026-09-06-kursorina-model-fetch-search-dedupe.md
# ---

# Курсорина: model `local` WARN + fetch host skip + web_search dedupe (b5311c09)

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-06` |
| **also_affects** | stack2 LLM OpenAI-compat callers via `pick_resolved_openai_model_id` |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — (pending Commit Package) |
| **evidence** | Celery mission `b5311c09-798d-4ade-a718-a996f8304a46`; pytest locks |

## Symptom

Mission completed with a usable answer, but celery flooded WARN `model 'local' not listed` while server had `/models/gemma-4-26B.gguf`; deepen retried slow hosts after ReadTimeout; identical `web_search` queries could fire again within one mission.

## Failure layers

1. **Settings field** — decide/synthesize read nonexistent `llama_model`; always fell back to `"local"`.
2. **Model resolve** — `pick_resolved_openai_model_id` did not route through basename resolve (`gemma-4-26B.gguf` ↔ `/models/…`) / sole-model sentinel.
3. **Deepen** — failed URL skipped, but **same host** other SERP refs still queued.
4. **Decide** — facet/internet web path lacked normalized query fingerprint dedupe.

## Root cause

Wrong UnifiedConfig attribute for `LLAMA_MODEL` plus incomplete OpenAI-compat id mapping; deepen and web_search loops lacked host- and query-level within-mission memory.

## What we did

- `api/utils/llm_openai_compat_http.py` — `pick_resolved` uses `resolve_model_id`; `local`/`default`/`auto` → sole server model.
- `api/services/kursorina/decide.py` + `synthesize.py` — `default_ai_model`; `_failed_fetch_hosts` skip in `_unfetched_web_urls`; `normalize_web_search_query` + guard reason `web_search_dedupe`.
- Canon + readiness + this registry entry.

## Recommendations

- Do not invent `llama_model` on settings — use `default_ai_model` / `LLAMA_MODEL`.
- Prefer env basename or full `/models/…` id; do not send bare `local` when `/v1/models` is nonempty.
- Keep consecutive fetch-fail abort; host-skip is additive, not a replacement.
- Dedupe is exact+normalize only — paraphrases may still search (accepted).

## Verification

```text
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest \
  tests/test_llm_chat_compat.py tests/test_kursorina_worker.py -q \
  -k 'pick_resolved or unfetched_web_urls_skips or normalize_web or guard_dedupes or facet_web_skips'
```

## Residual risk

Hostile hosts still cost one timeout each; paraphrase duplicate SERP possible; multi-model servers need unambiguous env id.
