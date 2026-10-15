# docker/scripts/ — EliteEW operator CLIs

Канон стеков/деплоя. Симлинк: `scripts/docker` → сюда.

> Soft-retired junk (OpenVPN AS, stack666, guide-TTS, punisher-era, DEWA/EWGen/EWCO aux install, docker-daemon ICC/iptables fixes, niche smokes, thin `dewa-ops-prod-line-*.sh` wrappers, `dewa-ops-stack0-recreate-all.sh`) → `trash/` (не канон).  
> **Sanitary Wave 2–3 (2026-08-15):** orphan root helpers → `trash/20260815-130548/` / `…130559/` / `…130840/`.  
> **Sanitary Wave 4a (2026-08-15):** living inventory below (no trash).  
> **Sanitary Wave 4b (2026-08-15):** living `dewa-ops-*.sh` → `eliteew-*.sh` / `eliteew-ops-lib.sh` (see §Rename map).

## Prefer (operator / agent)

| Intent | Command |
|--------|---------|
| stack0 release (baked A) | `bash docker/scripts/eliteew-deploy.sh release stack0 --all` |
| stack0 hotfix (dev-bind B) | `eliteew-deploy.sh hotfix stack0 sync` → `up-dev-bind --yes` |
| stack2+stack4 runtime | `eliteew-deploy.sh release runtime --yes --all` |
| Short aliases | `source docker/scripts/eliteew-docker-aliases.sh` (`eeprodbaked`, `eeprodline`, `eeprodruntime`, `eedeploy`) |

Agents: **never** partial `--frontend-only` / `--backend-only` for planned stack0 release.

## Живые зоны (каталоги)

| Путь | Роль |
|------|------|
| **Root `*.sh`** | Deploy entrypoints, implementers, smokes, Keycloak/Meet/KBSEW helpers |
| **`yandex-tunnel/`** | Edge VM, Meet WG HTTP backhaul, SSH reserve — map: `yandex-tunnel/README.md` |
| **`mobile-private-tunnel/`** | Mobile WG edge — map: `mobile-private-tunnel/README.md` |
| **`lan-workers/`** | gpu141 embed/rerank/tool-router + living ComfyUI `.141:31003` — map: `lan-workers/README.md` |
| **`internal-sites/`** | CoreDNS / internal sites firewall — map: `internal-sites/README.md` |
| **`prod-core/`** | Prod-core remote helpers (egress lock, host harden) — map: `prod-core/README.md` |
| **`command-center/`** | command-center (.136) host harden |
| **`vps-wg-hub/`** | Home WG hub + MikroTik `.rsc` |
| **`portal-private-tunnel/`** | Portal WG helpers |
| **`tests/`** | Script selftests |

## Living root inventory (by role)

Canon entrypoints and implementers — not every niche smoke. Full list: `fd -e sh -d 1 docker/scripts`.

### Deploy / prod-line (user-facing)

| Script | Role |
|--------|------|
| `eliteew-deploy.sh` | Unified CLI: `release stack0`, `hotfix stack0`, `release runtime`; `--refresh-openapi-pilots` |
| `eeprodline.sh` | Line B implementer (`eeprodline`) |
| `eeprodstack6.sh` | stack6 Keycloak release helper |
| `eliteew-docker-aliases.sh` | Shell aliases (`eedeploy`, `eeprodbaked`, …) |
| `stack0-refresh-openapi-pilots.sh` | Bake-time OpenAPI → FE pilots |

### Implementers (called by deploy / aliases)

| Script | Role |
|--------|------|
| `eliteew-ops-lib.sh` | Shared paths / dry-run / SSH helpers (env prefix still `DEWA_OPS_*` for compat) |
| `eliteew-stack0-baked-deploy.sh` | Line A baked deploy (`eeprodbaked`) |
| `eliteew-prod-core-env-push.sh` | Config Plane: SOPS bundle → prod-core tmpfs |
| `eliteew-prod-core-runtime-deploy.sh` | stack2+stack4 runtime (`eeprodruntime`) |
| `eliteew-prod-core-start-all.sh` | Bring-up helper on prod-core |
| `build-stack0-prod-baked-images.sh` / `export-stack0-prod-baked-images.sh` | Bake + transfer |
| `build-prod-core-runtime-images.sh` / `export-prod-core-runtime-images.sh` | Runtime images |
| `prod-core-env-*.sh` / `prod-line-lib.sh` / `prod-core-deploy-lib.sh` | Env materialize / libs |
| `sync-prod-core-deploy-tree.sh` | Sync deploy scripts onto `.111` |

### Landing / mobile / edge

| Script | Role |
|--------|------|
| `eliteew-landing-deploy.sh` / `eliteew-landing-start.sh` | Landing image build/deploy + start wrappers |
| `prod-core-landing-*.sh` | On-host landing start/lib |
| `mobile-apk-release-cycle.sh` / `deploy-prod-core-mobile.sh` | APK/OTA cycle |
| `eliteew-mobile-wg-edge-sync.sh` | Mobile WG edge peer sync |
| `site-edge-carrier-deploy.sh` | Site-Image build → Edge `podman run` |
| `site-edge-iot-provision.sh` / `site-edge-iot-verify.sh` | Fedora IoT flash + verify |
| `site-studio-*` | Site studio smokes |

> Site Edge trees: `docker/site-edge-iot/` + `docker/builders/site-edge-carrier/` + CLIs above — one table in **`docker/README.md`** §Site Edge / canon **`documentation/platform/SITE-EDGE-CARRIER.md`**.

### Gates / provenance / maintenance

| Script | Role |
|--------|------|
| `deploy-provenance-*.sh` / `verify-stack0-*-gate.sh` | Deploy contract + provenance |
| `eliteew-death-spiral-gate.sh` / `eliteew-god-file-loc-guard.sh` | Regression gates |
| `eliteew-maintenance-window.sh` | User-safe maintenance window |
| `eliteew-podman-egress.sh` | Prod-core egress status/lock CLI |
| `eliteew-command-center.sh` / `eliteew-migration-command-center.sh` | CC smoke / migration acceptance |

### Domain clusters (root)

| Cluster | Examples |
|---------|----------|
| **KBSEW** | `kbsew-deploy-prod-core.sh`, `kbsew-e2e-smoke.sh`, `kbsew-eval.sh`, … |
| **EWA** | `ewa-*-smoke.sh`, `eliteew-ewa-companion-clean-slate.sh`, `ewa-env-dsn-parity.sh` |
| **Desktop app smokes** | `music-*-stack0-smoke.sh`, `image-studio-*`, `ugs-*`, `unified-admin-shell-checklist.sh` |
| **Keycloak / stack6** | `keycloak-*.sh`, `stack6-*.sh` |
| **Meet / stack11** | `apply-stack11-*.sh`, `jitsi-meet-http-smoke.sh` |
| **stack1 / DB** | `apply-eliteew-migrations.sh`, `stack1-*.sh` |
| **LLM** | `eliteew-llama-chat-model.sh`, `start-gpu141-embed-rerank.sh`, `stack2-llm-smoke.sh` |

## Rename map (Wave 4b)

| Old (`dewa-ops-*`) | New |
|--------------------|-----|
| `eliteew-ops-lib.sh` | `eliteew-ops-lib.sh` |
| `eliteew-stack0-baked-deploy.sh` | `eliteew-stack0-baked-deploy.sh` |
| `eliteew-prod-core-env-push.sh` | `eliteew-prod-core-env-push.sh` |
| `eliteew-prod-core-runtime-deploy.sh` | `eliteew-prod-core-runtime-deploy.sh` |
| `eliteew-prod-core-start-all.sh` | `eliteew-prod-core-start-all.sh` |
| `eliteew-landing-deploy.sh` | `eliteew-landing-deploy.sh` |
| `eliteew-landing-start.sh` | `eliteew-landing-start.sh` |
| `eliteew-llama-chat-model.sh` | `eliteew-llama-chat-model.sh` |
| `eliteew-mobile-wg-edge-sync.sh` | `eliteew-mobile-wg-edge-sync.sh` |
| `eliteew-podman-egress.sh` | `eliteew-podman-egress.sh` |
| `eliteew-ewa-companion-clean-slate.sh` | `eliteew-ewa-companion-clean-slate.sh` |

Soft-retired `dewa-ops-prod-line-*.sh` / `dewa-ops-stack0-recreate-all.sh` remain in `trash/` (do not recreate).

## Запуск

```bash
source docker/scripts/eliteew-docker-aliases.sh

# Line A — planned release (agents: always --all)
bash docker/scripts/eliteew-deploy.sh release stack0 --all
# optional: same-release FE OpenAPI pilots from release tree before SPA build
# bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --refresh-openapi-pilots

# Line B — hotfix without rebake
bash docker/scripts/eliteew-deploy.sh hotfix stack0 sync --with-frontend-build
bash docker/scripts/eliteew-deploy.sh hotfix stack0 up-dev-bind --yes

# stack2 + stack4 runtime
bash docker/scripts/eliteew-deploy.sh release runtime --yes --all
```

Не использовать: `fast-punisher-up`, `eliteew-standalone-runtime`, `dewa-ops-prod-line-*.sh`, `dewa-ops-stack0-recreate-all.sh`, OpenVPN AS helpers — в `trash/`.
