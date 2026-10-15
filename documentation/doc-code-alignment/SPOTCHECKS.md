# Spot-checks — high-value canon vs code

**Generated:** 2026-09-30T21:35:00Z  
**Edition scope:** shared + pack doors (cloud/org) as claimed in living topology.  
**Not living product canon** — audit evidence for agent follow-up.

Status legend: `match` | `mismatch` | `partial` | `intentional` (doc correctly describes absence/retirement).

## Pack layout & doors

| Claim (doc) | Code evidence | Status |
|-------------|---------------|--------|
| `shared/{api,web/frontend,apps,packages,tools}` physical mid | dirs exist at monorepo root | match |
| `pack-cloud/mobile/` cloud door | exists | match |
| `pack-organization/connection-agent/` org door | exists + `src-tauri/tauri.conf.json` | match |
| `pack-organization/trusted-substrate/` | exists | match |
| `EliteEW/` not product mid | leftover dir exists with only `.venv` — not living mid | intentional |
| Domain matrix pack paths | `eliteew_api/frontend/mobile/desktop` paths exist; `EliteEW/scripts/**` domain pattern **missing**; `trash/EliteEWWebViewAndroid/**` **missing** | partial |

## Topology / deploy scripts

| Claim | Code evidence | Status |
|-------|---------------|--------|
| `docker/scripts/eliteew-deploy.sh` release/hotfix stack0 | file exists; `hotfix` → `eeprodline.sh` | match |
| `eeprodline` implementer | `docker/scripts/eeprodline.sh` | match |
| `eectl` ops CLI as path | **not** a file; shell function in `eliteew-docker-aliases.sh` → `eliteew-container-control.py` | partial (doc OK if described as alias; path audits false-miss) |
| stack0/1/2/4/6/11/12 compose | under `docker/stack/` | match |
| stack3/stack5 yml still on disk | files exist; topology marks unused/retired | intentional (yml leftover) |
| Landing image `local/eliteew-site-prod:secure` | image tag string, not a filesystem path; `shared/web/site_prod/` exists | intentional |
| Comfy scripts `docker/scripts/lan-workers/eliteew-gpu141-comfyui-*.sh` | real files present (`…-owned-phase.sh`, `…-rootful-start-sudo.sh`, …) | match (glob truncated in path pass) |

## Auth / API / FE

| Claim | Code evidence | Status |
|-------|---------------|--------|
| `/api/health` | `shared/api/main.py` `@app.get("/api/health")` | match |
| `/api/v1/ewa/*` | routers + middleware allowlist | match |
| Keycloak clients `empery-api` / `empery-web` / `empery-mobile` / `empery-desktop` / `empery-fofline` | KEYCLOAK doc + `unified_config` defaults | match |
| FE pnpm + Biome | `packageManager: pnpm@12.4.1`, `biome.json` present | match |
| `shared/web/auth/` as path | **does not exist** (auth lives under frontend services) | mismatch |
| `shared/api/docs/` | **does not exist** (contracts under `documentation/api/`) | mismatch |

## Desktop version SoT

| Claim | Code evidence | Status |
|-------|---------------|--------|
| TREE SoT `DESKTOP-CLIENT-VERSION-SOT.md` → **0.5.37** | `package.json` / Cargo / tauri / `release-state.v1.json` all **0.5.37** | match |
| `reference/HANDBOOK-MAP.md` header TREE | TREE **0.5.37** / public lag **0.5.36** (Wave 1) | match |
| `INDEX.md` desktop TREE pointer | points at version SoT file (OK) but own date banner may lag | partial |

## Cursor governance cited by docs / `.cursorrules`

| Claim | Code evidence | Status |
|-------|---------------|--------|
| rule `eliteew-language-bridge.mdc` | **missing** under `.cursor/rules/` (cited in `.cursorrules` Rule Ownership Index) | mismatch |
| skill `eliteew-language-bridge` | dir exists; **no `SKILL.md`** (only `scripts/`) | mismatch |
| hook `language-bridge-gate.py` | exists | match |
| `.cursor/agents/tauri-security-reviewer.md` | **missing** | mismatch |
| `.cursor/rules/eliteew-bus-factor.mdc` | **missing** | mismatch |
| skill `eliteew-product-audit` reference/products.md | **missing** | mismatch |
| `AGENT-HARD-ACCEPTANCE-WORKFLOW.md` | **missing** (INDEX says hard-acceptance retired; stale links remain) | mismatch |

## Internal documentation links

| Issue | Status |
|-------|--------|
| `product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md` uses `../../api/FRONTEND-BACKEND-HTTP.md` → resolves **outside** `documentation/` to repo `/api/...` | mismatch (should be `../api/...`) |
| Links to retired `platform/AGENT-HARD-ACCEPTANCE-WORKFLOW.md` from `api/FE-BE-ALIGNMENT.md`, `platform/TESTING-STRATEGY.md` | mismatch |
| Links into retired `reference/solution-readiness/*.md` forecast files | mismatch (stub dir only) |
| Broken relative `export/md/README.md` inside public-buyer export mirrors | mismatch (export noise) |

## God-file LOC baselines (sample)

Baselines file still lists paths that exist. Sample drift vs baseline:

| Path | Baseline | Actual LOC | Δ |
|------|--------:|----------:|--:|
| `shared/api/ewa_platform/agentic/jobs/step_executor.py` | 1020 | 1089 | +69 |
| `shared/web/frontend/src/services/keycloakAuthOidcFacade.ts` | 698 | 724 | +26 |
| `shared/web/frontend/src/services/keycloak.ts` | 68 | 84 | +16 |
| `shared/api/routers/music_generator.py` | 798 | 812 | +14 |
| `shared/api/ewa_platform/settings/catalog_entries.py` | 4250 | 4250 | 0 |

Status: **partial** — files match; some baselines stale.

## Failure / edge notes for this audit

| Axis | Coverage |
|------|----------|
| Offline-mode | Path audit is offline/local tree only — does not prove live prod containers. |
| Dual-flag | Heuristic extract may mark illustrative/retired paths as mismatch; see `MISMATCHES-CLASSIFIED.md`. |
| Permission | No secrets opened; `.env` cites expected absent from git. |
| Regression | Re-run: `python3 documentation/doc-code-alignment/scripts/audit_doc_code_paths.py` then `classify_mismatches.py`. |
