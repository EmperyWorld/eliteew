# Deploy CLI — Immutable Provenance (operator reference)

**Status:** canonical · **2026-08-06**
**Scripts live in:** `docker/scripts/` — operator map: [`docker/scripts/README.md`](../../../docker/scripts/README.md).

---

## Primary entrypoint

```bash
bash docker/scripts/eliteew-deploy.sh <command> [subcommand] [options]
```

| Command | Action |
|---------|--------|
| `release stack0 --all` | **Agent / default Line A:** bake → export → recreate (optional `--yes`; optional `--refresh-openapi-pilots` for tree OpenAPI → pilots before SPA build) |
| `deploy stack0 --yes --all` | Same + provenance gate before bake (gate also inside bake script) |
| `hotfix stack0 sync\|up-dev-bind\|up-baked\|status\|…` | Line B via implementer `eeprodline.sh` |
| `release runtime …` | stack2 + stack4 via `eeprodruntime` |
| `gate --release` | Pre-check only; exit **42** if dirty deploy source paths |
| `gate --hotfix [--acknowledge-dirty]` | Line B pre-check |
| `verify --live --strict` | Post-deploy P0 audit |
| `audit export [--live]` | JSON chaos scorecard |
| `selftest` | Gate selftest |

Aliases after `source docker/scripts/eliteew-docker-aliases.sh`: `eeprodbaked`, `eeprodline`, `eeprodruntime` (shortcuts to implementers — prefer full `eliteew-deploy.sh` in runbooks).

**Soft-retired (→ `trash/`, not canon):** thin `dewa-ops-prod-line-*.sh`, `dewa-ops-stack0-recreate-all.sh`.

---

## Gate tiers

| Tier | Flag | Behavior |
|------|------|----------|
| Release (Line A) | `--release` | Fail if **blocking** deploy source paths have uncommitted changes |
| Hotfix (Line B) | `--hotfix` | Fail unless clean OR `--acknowledge-dirty` |
| OpenAPI regen leftovers | (automatic) | Dirty **only** under `shared/web/frontend/openapi/pilot/**` or `src/generated/*-openapi.ts` → **WARN-pass** (expected after `--refresh-openapi-pilots`; still commit when ready) |
| Bypass | `SKIP_DEPLOY_PROVENANCE_GATE=1` | Emergency only (logged WARN) |

Audit finding `openapi_regen_dirty_tree` is **P2** (advisory). Blocking dirt remains **P0** `dirty_source_tree`.

**Invariant (2026-08-06):** `deploy_provenance_is_openapi_regen_dirty_path` must filter via `python3 -c` (not a stdin heredoc). A heredoc steals the pipe from `dirty_source_files`, so the producer hits `BrokenPipeError` and `set -o pipefail` makes `verify --live --strict` exit **1** even when runtime smoke is green (typical after `--refresh-openapi-pilots`). That is a **provenance lib bug**, not a smoke failure.

**Invariant (2026-08-19):** OpenAPI leftover classifiers (`is_openapi_regen_path`, pipe filter, blocking-source skip) match **`shared/web/frontend/...`**. Retired mid-alias EliteEW/web/frontend/ prefixes must not be used — they treat real leftovers as blocking dirt and abort Line A after `--refresh-openapi-pilots`.

---

## Verify URLs (prod-core `.111`)

```bash
curl -sf http://127.0.0.1:29001/deployment-manifest.json
curl -sf http://127.0.0.1:29001/app-build-version.txt
curl -sf http://127.0.0.1:29000/api/health
```

Public: `https://app.eliteew.ru/app-build-version.txt` only for deploy id.
`https://app.eliteew.ru/deployment-manifest.json` → **404** (ops Host `127.0.0.1`/`localhost` on `:29001` only; also blocked on edge host nginx).
Public `/api/health` is `{"ok": bool}` only; full detail needs **admin** JWT.
Smoke: `bash docker/scripts/eliteew-public-surface-smoke.sh`

---

## Related

- Historical `platform/audit/*` one-shots soft-retired → `trash/` (not living hubs)
- [PROD-CORE-MIGRATION-BAKED-IMAGES.md](PROD-CORE-MIGRATION-BAKED-IMAGES.md)
- [../PROD-CORE-DEV-BIND-LINE.md](../PROD-CORE-DEV-BIND-LINE.md)
