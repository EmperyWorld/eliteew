# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Forensic: mission 614c81a6 — worker egress timeout aborting before python,
# sandbox import restrictions, LLM claiming tools not initialized.
# Related:
# - documentation/product/desktop/KURSORINA.md
# ---

# Курсорина: Runtime/Sandbox failure, egress timeout abort before Python, uninitialized tools excuse

| Field | Value |
|-------|--------|
| **product_id** | `kursorina` |
| **status** | `fixed` |
| **date** | `2026-09-05` |
| **also_affects** | — |
| **canon** | `documentation/product/desktop/KURSORINA.md` |
| **commit** | — (pending) |
| **evidence** | mission `614c81a6`; pytest 52 passed; podman egress verify |

## Symptom

Operator ran a stress-test requesting search, Python data calculations, `.png` chart, and `.md` deliverable. The agent timed out on `fetch_url`, skipped Python entirely, and synthesized an answer saying: «инструменты не были инициализированы, файлы .md и .png не созданы».

## Failure layers

1. **Worker Container Egress (Netfilter Lock):** `stack0-eliteew-celery-worker-prod-baked` was in `allowlist` mode, dropping external traffic to third-party web domains (`ConnectTimeout`).
2. **Premature Loop Abort:** Consecutive fetch timeouts triggered `_after_fetch_fail_abort`, returning `finish` before `_maybe_run_python` had a chance to execute.
3. **Sandbox Module Imports:** Sandboxed Python lacked safe import capability and `matplotlib.pyplot` compatibility shim.
4. **Synthesizer Ledger Filtering:** Python output was tagged `kind="note"` and skipped by `evidence_for_synthesize`, hiding calculations from LLM synthesize prompt.
5. **Physical Filesystem Persistence:** Deliverables were only written to Content Manager database, without direct files on disk in `/app/generated_files`.

## Root cause

Netfilter egress policy blocked background worker HTTP fetches, triggering abort-to-finish before compute tools could execute, combined with sandbox isolation gaps and lack of physical disk exports.

## What we did

- Switched Celery worker egress mode to `wan_open` in `docker/host_conf/podman-egress/policy.default.json` and on host `.111`.
- Made `_after_fetch_fail_abort` and decide loop check `_maybe_run_python` before terminating.
- Added `_PltShim` (headless Matplotlib compatibility) and `safe_import` for analytical modules (`math`, `statistics`, `json`, `random`, `re`, `datetime`).
- Tagged compute evidence as `kind="python"` and prioritized it in synthesizer prompt.
- Added physical filesystem writing to `/app/generated_files/kursorina/{mission_id}/` for all saved `.md` and `.png` deliverables.

## Recommendations

- Keep background scrape workers in `wan_open` mode while keeping frontend and internal stacks locked.
- Never let network failure skip independent offline computation tools like Python.

## Verification

```text
pytest tests/test_kursorina_worker.py -q → 52 passed
bash docker/scripts/eliteew-podman-egress.sh verify → PASS
```
