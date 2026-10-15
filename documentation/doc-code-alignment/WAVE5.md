# Alignment remediation — Wave 5 (2026-09-30)

Residual ~80 actionable cites: relocated pack/shared homes, API package moves, honesty for absent ops helpers, classifier/extractor hygiene.

## Done

| Area | Change |
|------|--------|
| Script cites | Short `scripts/*` → real homes under `pack-organization/{connection-agent,trusted-substrate,command-center-image}/`, `shared/web/frontend/scripts/`, `docker/builders/stack0-api/scripts/` |
| Host / tools | `shared/kernel-offline` → `host/kernel-offline`; `tools/openapi-typescript-runtime` → `shared/web/frontend/tools/openapi-typescript-runtime` |
| EWA / companion | Flat companion module cites → `actions/`, `sidecar/`, `storage/`, `episodic/`; schemas → `schemas/json/` + `schemas/pydantic/` |
| Packages | `music_forge/algorithm.py` → `algorithm/`; `marketing_cabinet.py` → `marketing_cabinet/`; desktop runtime under `ewa_platform/desktop/` |
| Mobile Kotlin | Short `core/{ui,network}/*.kt` → full `src/main/java/world/empery/mobile/...` paths |
| Site Studio | `scripts/build-neutral-template-baseline.py` → `site-templates/olenti/scripts/...` |
| Handbook sync | CLI SoT `shared/api/scripts/sync_handbook_kb_articles.py` (cwd-relative `scripts/` when `cd shared/api`) |
| Honesty marks | Historical absent ops helpers (redis-flush, nvidia host, voice sync, patch-prod-core-env, …); retired WorkflowBuilder; absent overview/migration stubs |
| Extractor | Glob cites (`drop_*.sql`, `amka_*.py`) verify **parent directory** instead of truncated stem |
| Classifier | Expanded `RELOCATED` + `INTENTIONAL_ABSENT` (secrets/runtime, absent ops, retired FE); noise for `\|`, `()`, trailing `_` stems |

## Audit delta (cumulative)

| Metric | Start audit | After Wave 4 | After Wave 5 |
|--------|------------:|-------------:|-------------:|
| Path mismatch | 442 | 325 | **242** |
| Actionable candidates | 226 | 80 | **0** |
| Relocated wrong cite (open) | — | 10 | **0** (docs rewritten) |
| Broken internal `.md` links | 14 | 0 | **0** |
| Intentional absent/untracked | 0 | 32 | **57** |

## Residual mismatches (non-actionable)

Remaining ~242 unique misses are classified as intentional absent, noise (ellipsis/brace/glob), soft-retire `trash/` cites, forbidden aliases, mid-alias `EliteEW/`, runtime/secrets, or pending migrations — not rewrite blockers.

## Regen

```bash
python3 documentation/doc-code-alignment/scripts/audit_doc_code_paths.py
python3 documentation/doc-code-alignment/scripts/classify_mismatches.py
```
