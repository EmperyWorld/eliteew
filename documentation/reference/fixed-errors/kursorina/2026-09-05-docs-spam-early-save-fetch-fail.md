# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Forensic: mission 2edb5d9b — platform_docs after library miss, early save,
# fetch deepen burned on empty errors.
# Related:
# - documentation/product/desktop/KURSORINA.md
# - documentation/reference/solution-readiness/2026-09-05-kursorina-2edb5d9b-cause-wave.md
# ---

# Курсорина: docs spam + early save + fetch-fail burn (2edb5d9b)

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — (pending Commit Package) |
| **evidence** | Celery mission `2edb5d9b-a3f7-4dcc-b541-79baf4e39bd0`; pytest locks |

## Symptom

Goal «топ программ… профессии»: worker called `search_docs` (`platform_docs_after_library_miss`), mid-loop `save_to_library` of a draft, then 3× `fetch_url` with empty `err=` (~60s), then thin SERP answer citing the draft `content_id`.

## Failure layers

1. **Decide heuristic** — `_wants_external` missed bare «топ программ» (required `топ-N`); `library_empty ⇒ search_docs`.
2. **Guard** — `save_to_library` allowed when LLM supplied `text` even without save cue / before synthesize.
3. **Deepen** — no abort after consecutive fetch failures; desktop log `err=%s` blank when `str(e)` empty.

## Root cause

External-cue regex + «library miss → platform docs» branch treated a consumer software goal as platform work; mid-loop save trusted LLM body; fetch fail path lacked typed logging and budget abort.

## What we did

- Removed `platform_docs_after_library_miss`; `search_docs` only with `_wants_platform`.
- Broadened `_EXTERNAL_FACTS_RE` (топ программ / profession-software / desktop software cues).
- Guard: mid-loop `save_to_library` → deepen or finish (autosave after synthesize if cue).
- Abort deepen after 2 consecutive failed `fetch_url`; log `err_type` + `repr` in desktop fetcher + obs snippet in kursorina tool.

## Recommendations

- Do not reintroduce library-empty → docs without platform cue.
- Do not trust mid-loop LLM save bodies; export is post-answer.
- P3c (prod-core egress to third-party sites) remains a separate forensic if pages stay empty.

## Verification

```text
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_kursorina_worker.py -q
→ profession_software / defer_save / fetch_fail_abort locks green
```

## Residual risk

Egress may still return empty pages (P3c) — worker now finishes sooner with SERP-grounded gaps instead of burning three timeouts.
