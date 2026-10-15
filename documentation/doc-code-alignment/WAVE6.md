# Alignment remediation — Wave 6 (2026-09-30)

Residual non-actionable buckets after Wave 5: mid-alias `EliteEW/*`, `migrations/pending/*` that already landed in `applied/`, retired worklog journals, and structural `eectl` alias.

## Done

| Area | Change |
|------|--------|
| Migrations | All cited `shared/api/migrations/pending/2026*.sql` → `…/applied/…` (confirmed on disk) |
| EWA agentic SQL | `0XX_ewa_agentic_substrate.sql` → `023_ewa_agentic_substrate.sql` |
| EliteEW mid-alias | logo → `pack-organization/connection-agent/src-tauri/app-icon-src/logo.png`; assistant manifest → `shared/…`; validate-local → `scripts/eliteew/…`; run_migration → `docker/scripts/apply-eliteew-migrations.sh`; vscode → monorepo `.vscode/` |
| Ban phrasing | `EliteEW/api` / `EliteEW/apps` / retired frontend prefix — prose without false living path refs; sync cites → `shared/apps` |
| Worklog | Monthly journals / session-summaries → `documentation/worklog/README.md` stub + honesty |
| Pack layout | Tree comment no longer emits mid-alias path token |
| Structural | `eectl` alias check accepts `eliteew-container-control.py` + `eliteew-docker-aliases.sh` |
| Classifier | `RELOCATED` map for remapped EliteEW script/asset cites |

## Audit delta (cumulative)

| Metric | After Wave 5 | After Wave 6 |
|--------|-------------:|-------------:|
| Path mismatch | 242 | **200** |
| Actionable (+ relocated wrong cite) | 0 | **0** |
| Broken internal `.md` links | 0 | **0** |
| `stale_eliteew_mid_alias` | 7 | **0** |
| `maybe_moved_migration` | 21 | **0** |
| `expected_worklog_stub_only` | 4 | **0** |
| Structural `eectl` | mismatch | **match** |

## Left as classified (not rewrite blockers)

Forbidden-alias *mentions* in writing guides (`documentation/archive/`, `docker/re_doc/`, …), soft-retire `trash/` history, intentional absent ops helpers, secrets/runtime host paths, brace/ellipsis noise.

## Regen

```bash
python3 documentation/doc-code-alignment/scripts/audit_doc_code_paths.py
python3 documentation/doc-code-alignment/scripts/classify_mismatches.py
```
