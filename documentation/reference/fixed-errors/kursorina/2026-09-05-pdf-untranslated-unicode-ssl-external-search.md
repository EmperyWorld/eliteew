# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Forensic: missions a6faea50 & e3fbf07c — UntranslatableCharacterError on PDF fetch,
# SSL verification failure on Russian national root CAs, false search_code on external goals,
# and hallucinated deliverable lists.
# Related:
# - documentation/product/desktop/KURSORINA.md
# ---

# Курсорина: UntranslatableCharacterError on PDF fetch, SSL verify failure on domestic CAs, false code search

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **also_affects** | `desktop_chat`, `ewa_platform` |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **evidence** | missions `a6faea50`, `e3fbf07c`, `c4718571`; pytest 56 passed; prod logs |

## Symptom

1. Missions `a6faea50` and `e3fbf07c` crashed and entered `blocked` status with: `Внутренняя ошибка выполнения. Попробуйте ещё раз.`, Celery worker logged: `UntranslatableCharacterError('unsupported Unicode escape sequence')`.
2. Public government and registry sites (`https://reestr.digital.gov.ru/`) failed with: `[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate`.
3. In mission `c4718571`, general industry research goals caused the agent to execute `search_code` against the local internal repository (`Конекст ситуации изучить Российский протокол...`).
4. In mission `c4718571`, the LLM synthesized fake deliverables (`market_analysis_chart.png — в процессе генерации`), while real requested tables and reports were not saved to the user's Content Manager.

## Failure layers

1. **PDF Text Extraction & Null-Byte Injection:** `fetch_url.py` fetched PDF files (e.g. `Strategy_Partners.pdf`) and ran `data.decode("utf-8", errors="replace")`. Raw PDF binary streams contain null bytes `\x00`. When serialized by `json.dumps()` into `state_json` and passed to `$5::jsonb` in PostgreSQL, PostgreSQL JSONB rejected `\u0000` with `UntranslatableCharacterError`.
2. **Missing Domestic SSL Trust:** Russian government and enterprise portals (`digital.gov.ru`, `reestr.digital.gov.ru`, `sberbank.ru`) use the Russian National Root CA (Минцифры), which is absent from standard Linux container SSL bundles, causing `httpx` to drop the connection.
3. **Regex Incompleteness for External Research:** `_EXTERNAL_FACTS_RE` matched `рынк` but missed `рыночн*` (alternation in Russian), `отрасл*`, `b2b`, `b2c`, `b2g`, `производител*`, `импортозамещен*`. Consequently, complex market/OS/vendor research was misclassified as an internal codebase task (`wants_external = False`), and the presence of «код» in «кто разработал код» triggered `search_code` in our local git repo.
4. **Rigid Synthesizer Prompt:** `_SYNTH_SYSTEM` instructed the LLM to output a «Сгенерированные deliverables» block listing `.png` graphics, forcing the model to hallucinate fake file names when no graphics had been produced.
5. **Autosave Keywords:** `_SAVE_LIBRARY_RE` lacked triggers for tables, comparative matrices, and analytical reports.

## Root cause

Binary PDF data decoded directly into strings injected `\x00` into `kursorina_missions.state_json`, crashing PostgreSQL JSONB deserialization; Russian state portals failed default CA verification; and linguistic inflections caused external market goals to fall through to local code search.

## What we did

- In `shared/api/services/desktop_chat/tools/fetch_url.py`:
  - Added PDF detection (`application/pdf`, URL ending in `.pdf`, or `%PDF` magic bytes) and text extraction via `pymupdf` (`fitz`).
  - Added SSL fallback for public read-only web fetches: if `CERTIFICATE_VERIFY_FAILED` occurs on domestic/state portals, retries with `verify=False` and logs `[STEP] desktop_fetch_url_ssl_fallback`.
  - Added `_sanitize_extracted_text` to strip null bytes (`\x00`, `\0`) and ASCII control characters from any extracted text.
- In `shared/api/services/kursorina/store.py`:
  - Added `_dump_safe_jsonb` replacing `r"\u0000"` and `"\x00"` prior to database insertion.
- In `shared/api/services/kursorina/decide.py`:
  - Expanded `_EXTERNAL_FACTS_RE` to cover `рыночн*`, `отрасл*`, `b2b/b2c/b2g`, `производител*`, `поставщик*`, `разработчик*`, `импортозамещен*`, `реестр*`, `лидер*`, `бенчмарк*`, `сравнен*`.
  - Enforced that if `wants_net and not wants_plat`, `wants_code` is disabled in heuristic decide and forbidden in `guard_llm_action`.
  - Expanded `_SAVE_LIBRARY_RE` to match `составь таблицу`, `таблиц*`, `аналитический отчет`, `выводы и рекомендации`.
- In `shared/api/services/kursorina/synthesize.py`:
  - Rewrote `_SYNTH_SYSTEM` to prohibit hallucinated deliverables and forbidden "в процессе генерации" text, referencing only actual evidence artifacts.
  - Increased `num_predict` to 2500 for full enterprise report and table generation.
- In `shared/api/services/kursorina/loop.py`:
  - Cleaned up document title generation in `_maybe_save_answer_to_library` using `goal_topic_query`.

## Verification

- `PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_kursorina_worker.py -q`: 56 tests passed.
- `PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_desktop_fetch_url_ssrf.py -q`: 5 tests passed.
- Ruff check & format clean on all modified files.
- Live test on prod-core verified PDF extraction with PyMuPDF and `reestr.digital.gov.ru` access with SSL fallback.
