# Alignment remediation — Wave 11 (2026-09-30)

Clear the last classified residuals: local secrets, runtime host paths, and build-artifact placeholders — honesty prose without extractable path_refs.

## Done

| Area | Change |
|------|--------|
| Secrets / local | `google-services.json`, `wg-mobile-server.private`, `ssh_authorized_keys.local`, env overrides → basename + local/gitignored honesty |
| Factory runtime | `host/runtime/factory/{atoms,intentions}.json` → basename + runtime honesty |
| Stack data/logs | `postgresql.conf`, llama data dir, smoke SSE, API log paths → basename + runtime honesty |
| Nested venv | `shared/api/.venv` → forbidden nested-venv prose |
| Kiosk ISO | `EliteEW-Kiosk-F44-YYYYMMDD-HHMM.iso` → `<build-stamp>` artifact prose |

## Audit delta

| Metric | After Wave 10 | After Wave 11 |
|--------|-------------:|-------------:|
| Path mismatch | 14 | **0** |
| Unique missing | 14 | **0** |
| Path matches | 2878 | **2873** |
| Actionable | 0 | **0** |
| Broken internal links | 0 | **0** |
| Intentional absent | 7 | **0** |

## Left

None for path_ref mismatch. Further waves only if new living cites drift or operator restores intentionally unhooked assets.

## Regen

```bash
python3 documentation/doc-code-alignment/scripts/audit_doc_code_paths.py
python3 documentation/doc-code-alignment/scripts/classify_mismatches.py
```
