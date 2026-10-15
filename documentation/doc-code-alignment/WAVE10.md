# Alignment remediation — Wave 10 (2026-09-30)

Expand remaining Kotlin/FE ellipsis stubs to real paths; neutralize soft-retire `trash/<timestamp>/` cites; strip absent ops-script path prefixes; point agentic bridge at living module.

## Done

| Area | Change |
|------|--------|
| Mobile contracts | `.../MobileAppApiContracts.kt` / `FriendsApiContracts.kt` → full `core/network/.../api/` paths |
| FE tests | `buildEwaCompanionShellContext` / `sanitizePersistedDesktopWindowPayload` → full `__tests__/` paths |
| Soft-retire | `trash/YYYYMMDD-HHMMSS/…` → `soft-retired under trash/ (id …)` |
| Absent ops | `docker/scripts/{redis-flush,patch-prod-core-env,…}` → basename + honesty |
| Bridge | Root `tools/bridge` → `shared/api/ewa_platform/agentic/tools/bridge.py` |
| Retired FE | WorkflowBuilder / workflowBuilderRoute full paths → basename honesty |
| Absent stubs | CURSOR-SUBAGENTS-OVERVIEW, chat-history migration, eliteew-os-foundation, shared/api docs |

## Audit delta

| Metric | After Wave 9 | After Wave 10 |
|--------|-------------:|-------------:|
| Path mismatch | 61 | **14** |
| Unique missing | 53 | **14** |
| Path matches | 2875 | **2878** |
| Actionable | 0 | **0** |
| Broken internal links | 0 | **0** |
| Intentional absent | 29 | **7** |
| Soft-retire cites | 13 | **0** |
| Ellipsis noise | 4 | **0** |

## Left (classified, not rewrite blockers)

Local/untracked secrets (`google-services.json`, `wg-mobile-server.private`, env files), runtime host paths (`docker/data`, `docker/logs`), kiosk ISO placeholder, `shared/api/.venv`, factory JSON under `host/runtime/`.

## Regen

```bash
python3 documentation/doc-code-alignment/scripts/audit_doc_code_paths.py
python3 documentation/doc-code-alignment/scripts/classify_mismatches.py
```
