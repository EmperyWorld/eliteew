# God-file LOC Baselines (QW#2)

**Status:** Active (Phase B, 2026-07-26).
**Guard:** `bash docker/scripts/eliteew-god-file-loc-guard.sh`
**Machine baselines:** `docker/scripts/data/god-file-loc-baselines.json`

## Policy

- Tracked files must **not grow** past the recorded baseline LOC.
- **Shrink** or **equal** LOC → pass.
- **Growth** (current LOC > baseline) → fail.
- Raising a baseline requires an intentional split/extract plan (see [ENGINEERING-GOVERNANCE-MANIFESTO.md](ENGINEERING-GOVERNANCE-MANIFESTO.md) §God-object growth) — do not bump baselines to “make green” as a habit.
- **2026-09-30 reset:** machine JSON re-measured from disk to clear MD↔JSON drift (prior JSON lagged MD). Further growth still needs split/extract, not another silent bump.

## Tracked paths (baselines refreshed 2026-09-30 from on-disk LOC; machine SoT `docker/scripts/data/god-file-loc-baselines.json`)

| Path | Baseline LOC |
|------|-------------|
| `shared/api/ewa_platform/agentic/kernel/loop.py` | 346 |
| `shared/api/ewa_platform/agentic/jobs/step_executor.py` | 1089 |
| `shared/web/frontend/src/services/keycloak.ts` | 84 |
| `shared/web/frontend/src/services/keycloakAuthOidcFacade.ts` | 724 |
| `shared/web/frontend/src/pages/Desktop/utils/desktopVisualSystem.tsx` | 75 |
| `shared/api/ewa_platform/settings/catalog_entries.py` | 4250 |
| `shared/api/routers/music_generator.py` | 812 |
| `shared/api/routers/music_generator_generate.py` | 942 |
| `shared/web/frontend/src/components/EWRP/EWRPGeneratorMain.tsx` | 486 |

## Explicitly excluded

| Path | Reason |
|------|--------|
| WorkflowBuilder.tsx *[retired — absent from active src/]* | Excluded from growth guard; do not re-add without operator task |

## Operator command

```bash
bash docker/scripts/eliteew-god-file-loc-guard.sh
```

## Related

- [ENGINEERING-GOVERNANCE-MANIFESTO.md](ENGINEERING-GOVERNANCE-MANIFESTO.md)
- `.cursor/rules/cause-first-intake.mdc` (god-file audit caps)
