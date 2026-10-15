# Prod-core final cutover runbook (.111/.141/.136)

Status: canonical runbook for finishing the `.111/.141/.136` migration.

## Target topology

| Host | Role | Must run |
|------|------|----------|
| `.111` prod-core | Public production runtime | `stack0` baked split backend/frontend/workers, `stack1`, EWA PG, stack2 `llama-chat`, stack4, stack6, stack11, stack12, yandex-tunnel, landing/mobile artifacts. No builds. |
| `.141` gpu141 | GPU inference workers | remote embed/rerank/tool-router, no `stack0` worker/beat duplicates |
| `.136` command-center | Operator control plane and build host | Git, docs, env staging/SOPS, `bash docker/scripts/eliteew-deploy.sh release stack0 --all` (alias `eedeploy`), `eeprodruntime`, MobileAndroid builds, Phase 4 `llama-deep` `:8080`, deploy/smoke wrappers. Living ComfyUI `:31003` is on **gpu141**, not here. |

**Not living on `.136`:** DEWA / EWPower / EWC / EWGen / access-gate-logwatch / EWCO — soft-retired under `trash/`. Do not install or smoke them as cutover gates. Edge remotes `dewa.eliteew.ru` / `power.eliteew.ru` are **not** acceptance requirements. Public HTTP backhaul: **Meet WG** `10.77.77.2` primary (SSH reverse = reserve). **stack666** off.

Primary command entrypoint from `.136`:

```bash
bash docker/scripts/eliteew-command-center.sh status
bash docker/scripts/eliteew-command-center.sh smoke
bash docker/scripts/eliteew-migration-command-center.sh baseline
bash docker/scripts/lan-workers/gpu141-recovery-gate.sh
bash docker/scripts/eliteew-migration-command-center.sh workload-smoke
bash docker/scripts/eliteew-migration-command-center.sh reboot-gate all
bash docker/scripts/eliteew-migration-command-center.sh acceptance
bash docker/scripts/eliteew-migration-command-center.sh rollback-plan
```

Day-2 remote ops: SSH + `eectl` / `eliteew-migration-command-center.sh eectl …` (not EWPower RBAC).

## Phase gates

### 1. Baseline before recreate

Run before any destructive action:

```bash
bash docker/scripts/eliteew-migration-command-center.sh baseline
bash docker/scripts/eliteew-migration-command-center.sh eectl prod-core status
bash docker/scripts/eliteew-migration-command-center.sh eectl prod-core analyze
bash docker/scripts/eliteew-migration-command-center.sh eectl prod-core doctor
```

Save command output into the incident/worklog notes for comparison after each phase. Baseline must answer:

- Are there orphan Podman containers without `PodName`?
- Is `eliteew-podman-autostart.service` enabled/active?
- Is there exactly one Celery beat?
- Are legacy `.136` stack0 containers stopped before `.111` becomes primary?

### 2. Normalize stack0 on `.111`

`stack0` is valid only when backend and frontend are separate compose surfaces:

- backend: `docker/stack/stack0_b.yml`
- frontend: `docker/stack/stack0_f.yml`
- prod-core baked overrides when immutable: `docker/stack/stack0_b.prod-baked.override.yml`, `docker/stack/stack0_f.prod-baked.override.yml`

Go/no-go:

- `podman ps` on `.111` shows API, frontend, api-worker, **four** Celery workers (general / agentic / companion / discussion), and **one** celery-beat as separate baked containers (see [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md) §Current / [CELERY-BEAT-AND-QUEUES.md](CELERY-BEAT-AND-QUEUES.md)).
- No simultaneous legacy and baked containers for the same stack0 role.
- Frontend build id is verified before recreate.
- `.136` does not run a second stack0 beat.

### 3. Host placement

`.111`:

```bash
bash docker/scripts/start-prod-core-stacks.sh
bash docker/scripts/start-prod-core-remaining-stacks.sh
bash patch-prod-core-env.sh  # *[absent — use Config Plane / eliteew-deploy env flow]*
```

`.141`:

```bash
bash docker/scripts/start-gpu141-embed-rerank.sh
bash docker/scripts/eliteew-migration-command-center.sh install-unit gpu141-llm
# on gpu141: living ComfyUI
sudo bash docker/scripts/lan-workers/eliteew-gpu141-comfyui-rootful-start-sudo.sh
curl -sf http://127.0.0.1:31003/system_stats >/dev/null
```

`.136`:

```bash
bash docker/scripts/eliteew-llama-deep.sh start
# Historical .136 Comfy launcher is rollback-only after the 2026-09-26 cutover.
# Do not enable DEWA/EWPower/EWC/logwatch units (soft-retired).
```

### 4. Reboot hardening

Install `.111` autostart:

```bash
bash docker/scripts/eliteew-migration-command-center.sh install-autostart prod-core
```

Then run two reboot drill cycles:

```bash
bash docker/scripts/eliteew-migration-command-center.sh reboot-gate all
```

If `can_reboot=challenge` and/or `sudo_nopasswd=blocked` appears, reboot must be triggered from operator console/sudo shell.

1. Reboot `.111`, `.141`, `.136` in a controlled window.
2. After each host returns, run:

```bash
bash docker/scripts/eliteew-migration-command-center.sh acceptance
```

Acceptance requires the second cycle to pass without manual fix commands.

Living gate target: `.111` core stack0/stack1/stack2/stack4/stack6/stack11/stack12 + Meet WG path; `.141` embed/rerank/tool-router + **living ComfyUI `:31003`**; `.136` builds/env plane + `llama-deep` `:8080` only. Landing cutover **2026-08-05** (`local/eliteew-site-prod:secure` on `:29002`) — see [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md) §Live drift. Public `power.eliteew.ru` / `dewa.eliteew.ru` are retired and must not block acceptance.

### 5. Command-center day-2 operations

Read-only baseline from `.136`:

```bash
bash docker/scripts/eliteew-command-center.sh status
bash docker/scripts/eliteew-migration-command-center.sh eectl prod-core status
bash docker/scripts/eliteew-migration-command-center.sh eectl prod-core analyze
curl -sf http://127.0.0.1:31003/system_stats >/dev/null
```

Targeted starts/restarts: SSH + `eectl` / migration wrappers. Do not require EWPower HTTP (`:8019`) or DEWA (`:4180`).

## Acceptance matrix

| Check | Command | Expected |
|-------|---------|----------|
| Prod-core stack health | `eliteew-migration-command-center.sh eectl prod-core analyze` | `[ok] no unhealthy/restarting/exited managed containers` |
| Prod-core doctor | `eliteew-migration-command-center.sh eectl prod-core doctor` | advisory; baked stack0/optional profile bind paths may warn/fail without blocking smoke |
| API health | SSH `.111` `curl -sf http://127.0.0.1:29000/api/health` | HTTP 200 |
| Frontend | SSH `.111` `curl -sf http://127.0.0.1:29001/` | HTTP 200 |
| stack4 | SSH `.111` `podman ps --format '{{.Names}}|{{.Status}}' | awk '/stack4-/ {print}'` | Tika/OCR/Gotenberg/Tesseract/Paperless Up/healthy |
| Landing | SSH `.111` `curl -sf http://127.0.0.1:29002/health` and public `https://eliteew.ru/` | HTTP 200 when landing is in acceptance scope |
| Mobile OTA | SSH `.111` `curl -sf http://127.0.0.1:29180/v1/manifest.json` | HTTP 200 when OTA must be continuously available |
| gpu141 reachability | `docker/scripts/lan-workers/gpu141-recovery-gate.sh` | `command_center_ping_ok`, `embed_http_ok`, `rerank_http_ok` |
| Embed/rerank | `eliteew-migration-command-center.sh smoke` | `embed_ok`, `rerank_ok` (or `gpu141_host_SKIP` if LAN down) |
| ComfyUI | SSH gpu141 `curl -sf http://127.0.0.1:31003/system_stats` and curl from API container | HTTP 200 on living `.141:31003` |
| Queue workload | `eliteew-migration-command-center.sh workload-smoke` | `rabbitmq_ping_ok`, `queue_consumers_ok`, `celery_ping_ok` |
| Reboot gate preflight | `eliteew-migration-command-center.sh reboot-gate all` | explicit reboot path (`reboot_noninteractive_possible` or `reboot_manual_required`) per host |
| Public EliteEW edge | `curl -k -sf https://app.eliteew.ru/api/health` (+ optional meet) | HTTP 200 via Meet WG; **do not** require `dewa.eliteew.ru` / `power.eliteew.ru` |
| Pod topology | `podman pod ps` + `podman ps --format '{{.Names}}|{{.PodName}}'` | managed stack containers in expected pods |
| Reboot | two acceptance runs after cold reboot | pass without manual fix |

## Boot autostart on `.111` (post-motherboard / cold reboot)

Prod-core boot path is **`eliteew-podman-autostart.service`** (user unit) on `.111`. Command-center (`.136`) is build/env/`llama-deep` plane only — not a second prod runtime controller. Living ComfyUI is on gpu141.

Known failure modes after reboot:

1. **`fix-prod-core-baked-frontend-nginx.sh` exits before API is ready** — autostart aborted before `stack11`/`stack12`/tunnel; fixed by boot wait + non-fatal smoke (`ELITEEW_AUTOSTART_BOOT=1`).
2. **Podman rootlessport drift** — containers `healthy` but `127.0.0.1:29000/:29001/:36000` refuse connections; recovered by `docker/scripts/prod-core-stack0-host-port-guard.sh` (force-recreate stack0 baked + stack6 Keycloak).

Install/refresh from command-center:

```bash
bash docker/scripts/eliteew-migration-command-center.sh install-autostart prod-core
```

Manual recovery on `.111` after a failed boot:

```bash
cd ~/powered_by_emperyworld
bash docker/scripts/prod-core-stack0-host-port-guard.sh
ELITEEW_PROD_CORE_LOCAL=1 bash docker/scripts/start-prod-core-remaining-stacks.sh all
bash docker/scripts/prod-core-edge-stacks-guard.sh
```

**Boot pitfall (fixed 2026-06-14):** never call `REMOTE=""` as the first token of `_run_phase "$@"` — bash treats it as a command name. Autostart exports `REMOTE=` / `ELITEEW_PROD_CORE_LOCAL=1` before `start-prod-core-remaining-stacks.sh`.

Verify: `curl -sf http://127.0.0.1:29000/api/health`, `:29001/`, `:36000/realms/empery`, then public `https://app.eliteew.ru/api/health` and `https://auth.eliteew.ru/realms/empery`.

### GPU fan noise (LACT) after motherboard swap

`whitep` runs **LACT** (`lactd.service`) for RTX 3090 fan control. After B550 migration the GPU PCI id changes (e.g. `…05:00.0` → `…07:00.0`). Stale `/etc/lact/config.yaml` entries may leave **`mode: static` + `static_speed: 1.0`** (fans at 100% even at ~25°C) and spam `could not find GPU with id …05:00.0` in `journalctl -u lactd`.

On the host (sudo):

```bash
sudo bash docker/scripts/prod-core-fix-lact-fan-after-motherboard.sh
```

Check: `nvidia-settings -q [fan:0]/GPUTargetFanSpeed` — should track temperature (curve), not stick at 100% idle.

## Rollback ownership

| Contour | Primary | Rollback owner | Rollback action |
|---------|---------|----------------|-----------------|
| Public edge/tunnel | `.111` | `.136` | move reverse tunnel back to `.136`, restore edge upstream, verify public app |
| `stack0` | `.111` baked/split | `.136` legacy prod | stop `.111` stack0, start `.136` old compose, ensure single beat |
| `stack1` | `.111` | `.136` snapshot | restore data snapshot/rsync and bind endpoints back |
| Chat | `.111` llama-chat (`gemma-4-26B.gguf` live 2026-06-15) | `.136` smaller fallback | update `LLAMA_URL`, recreate `stack0-backend` |
| Embed/rerank/tool-router | `.141` | local stack2 profile on `.111` or `.136` | update `LLAMA_EMBEDDING_URL` / `RAG_RERANK_BASE_URL`, recreate `stack0-backend` |
| ComfyUI | `.141` | Historical `.136` tree | Explicitly reverse `COMFYUI_URL` only during rollback; otherwise smoke `.141:31003` |

Legacy containers are allowed only as stopped rollback assets until the second reboot drill passes. After acceptance, disable their restart policy/user units and update [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md) §Current (worklog monthly journals retired).
