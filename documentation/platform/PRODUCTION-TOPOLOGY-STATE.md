# Production topology state (EliteEW)

**Status:** канон (single source of truth для текущего prod-расклада).
**Обновлять:** при любом cutover воркеров, edge/tunnel, LAN bind или смене «домашнего» хоста для stack1/stack2.
**Статус улучшений:** таблица **Current** ниже — операционная правда; live read-only audit от 2026-06-15 зафиксирован в этом документе.

**Retired operator apps (не living prod):** `DEWA`, `EWPower`, `EWC`, `EWCoderOrchestrator` / EWCO pilot, `EWGen`, `access-gate-logwatch` soft-retired under `trash/` — не считать обязательными сервисами, smoke-gates или host roles. Restore only on explicit operator request.

> Runtime по умолчанию в prod: **Podman**. Исторические ссылки на `docker` оставляются только для legacy-контекста.

Порты и edge — [docker-re_doc/EMPERY-EDGE-IP-OPERATIONS.md](docker-re_doc/EMPERY-EDGE-IP-OPERATIONS.md). **HTTP backhaul (primary Meet WG, SSH reserve):** [docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md](docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md). Обзор compose-стеков — [DOCKER-STACKS-PROD-OVERVIEW.md](DOCKER-STACKS-PROD-OVERVIEW.md). Опциональная миграция воркеров на gpu141 — [docker-re_doc/LAN-WORKERS-141.md](docker-re_doc/LAN-WORKERS-141.md).

---

## Current (2026-07-30 · living)

| Компонент | Где | Примечание |
|-----------|-----|------------|
| **Публичный вход** | Yandex edge VM `93.77.165.185` → **Meet WG** `10.77.77.2` (primary) → prod-core `.111` proxies; reverse-SSH = **manual reserve** | Living remotes: `app`→`29001`, API/sites→`29000`, landing→`29002`, auth→`36000`, meet web→`13402`→`.111:34002`. Edge `power`/`dewa` hostnames return **410** (soft-retired; no backhaul). Canon: [WG-HTTP-BACKHAUL-PRIMARY.md](docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md). **stack666** LAN HTTPS prod path — **off**. |
| **Cloud browser SPA (edge static)** | edge VM `93.77.165.185` disk | `app.eliteew.ru` shell: `/`, `/assets/*`, `app-build-version.txt` → `/srv/eliteew/cloud-spa/current` (slim release); heavy `public/` media → `/srv/eliteew/cloud-spa/media/`. `/api/*`, `/socket.io/` still proxy WG → prod-core `:29000`. **Not** part of `release stack0 --all` — publish after release: `bash docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh --yes`. Canon: [CLOUD-SPA-EDGE-STATIC.md](CLOUD-SPA-EDGE-STATIC.md). |
| **LAN / deploy SSH** | command-center ↔ prod-core | Prod-core **`enp5s0` → `192.168.1.111/24`** (MikroTik). Deploy/SSH from `.136` = **LAN only**. Former 2.5G direct `10.255.136.0/24` — **retired 2026-07-30** (historical pointer soft-retired → `trash/`). Do **not** prefer `10.255.136.111`. |
| **Portal Private Tunnel** | edge VM `wg-portal` `10.88.89.1` UDP **51823** | Desktop/Fedora trusted access (split tunnel); isolated `dnsmasq-portal`; does **not** share mobile `wg-mobile`/`51822` or Meet `51821`. Canon: [PORTAL-PRIVATE-TUNNEL-EDGE.md](docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md). |
| **API + WS** | prod-core (`192.168.1.111`) | `stack0-eliteew-api-prod-baked`; stack0 поднимается split: backend compose отдельно от frontend compose |
| **Frontend static** | prod-core (`192.168.1.111`) | `stack0-eliteew-frontend-prod-baked`; baked/dist-build invariant после frontend build |
| **Queue worker** | prod-core (`192.168.1.111`) | `stack0-eliteew-api-worker-prod-baked`; не дублировать legacy workers на `.136` |
| **Celery worker(s)** | prod-core (`192.168.1.111`) | **E0 split + Discussion (2026-08-07):** four baked workers — (1) `stack0-eliteew-celery-worker-prod-baked` → `short,maintenance,broadcast,ewa_reembed` (concurrency `STACK0_CELERY_GENERAL_CONCURRENCY`, default 4); (2) `stack0-eliteew-celery-agentic-worker-prod-baked` → `ewa_agentic,ewa_agentic_step,ewa_factory` (concurrency `STACK0_CELERY_AGENTIC_CONCURRENCY`, default 2; soft/hard **900/960s**; factory ticks 120/180s); (3) `stack0-eliteew-celery-companion-worker-prod-baked` → `ewa_companion` (concurrency `STACK0_CELERY_COMPANION_CONCURRENCY`, default 2; soft/hard 540/600s); (4) `stack0-eliteew-celery-discussion-worker-prod-baked` → `desktop_discussion` (concurrency `STACK0_CELERY_DISCUSSION_CONCURRENCY`, default 2; soft/hard 540/600s). Same image `STACK0_CELERY_WORKER_BAKED_IMAGE`. Override: `stack0_b.prod-baked.override.yml` (mirrored in `stack0_b.dev-bind.override.yml`). Queues: [CELERY-BEAT-AND-QUEUES.md](CELERY-BEAT-AND-QUEUES.md). Product: [DESKTOP-AI-CHAT-DISCUSSION-MODE.md](../product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md). |
| **Celery beat** | prod-core (`192.168.1.111`) | `stack0-eliteew-celery-beat-prod-baked` — **единственный** beat |
| **stack1 (PG, Redis, Rabbit, Qdrant, SeaweedFS, ES, Chroma legacy)** | prod-core (`192.168.1.111`) | Bind по localhost на prod-core; LAN opening только по явному runbook |
| **EWA Postgres** | prod-core (`192.168.1.111`) | `stack-ewa-postgres`; command-center не держит второй runtime экземпляр |
| **Keycloak / SSO** | prod-core (`192.168.1.111`) | stack6 realm `empery`; edge routes указывают на prod-core |
| **Jitsi / internal DNS / tunnel** | prod-core (`192.168.1.111`) | stack11, stack12; host `wg0` + `eliteew-wg-tcp-proxy@*`; `stack-yandex-tunnel` parked (SSH reserve) |
| **llama-chat (stack2)** | prod-core (`192.168.1.111`) | Live 2026-09-04 **Phase 1:** `stack2-llama-chat` → `/models/gemma-4-26B.gguf` (MoE, single **3090**); **`-c 81920` / `--parallel 2`** → `n_ctx_slot≈40960`, KV `q8_0`; `LLAMA_CHAT_PARALLEL=2`. Dense 31B retained as rollback/deep preset. **Phase 2:** gpu141 embed/rerank = **Qwen3 0.6B** (`AI_EMBEDDINGS_DIMENSION=1024`); tool-router 4B on `:8083`. Redesign: [LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md](LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md) |
| **stack4 OCR/Tika/Paperless** | prod-core (`192.168.1.111`) | Baseline: `stack4-tika`, `stack4-ocrmypdf-api`, `stack4-gotenberg`, `stack4-tesseract`, `stack4-paperless`. Live 2026-06-30 drift: API preflight warns `http://stack4-tika:9998/tika`; `podman ps` showed only `stack4-ocrmypdf-api`, `stack4-tesseract`, `stack4-paperless`. |
| **Remote embed/rerank/tool-router** | gpu141 (`192.168.1.141`) | **Live 2026-07-14:** Debian 13 + overlayroot RO + rootful Podman **host-net** (`stack2-llama-remote-embed-rerank.host-net.yml`); systemd `gpu141-llama-remote.service`; ports `:8081/:8082/:8083`; nftables allowlist `.111`+`.136` (MikroTik isolate deferred). Bridge compose remains legacy/Fedora path. |
| **ComfyUI** | gpu141 (`192.168.1.141`) | **Living home 2026-09-26:** `.141:31003` (host-local tree `/var/lib/eliteew/comfyui` + rootful host-net; systemd `eliteew-gpu141-comfyui`). Prod API / UGS `COMFYUI_URL` + DB `generation_providers.comfyui.base_url` → `http://192.168.1.141:31003/`. Ops: `docker/scripts/lan-workers/eliteew-gpu141-comfyui-*.sh`, [LAN-WORKERS-141.md](docker-re_doc/LAN-WORKERS-141.md). Legacy `.136` Comfy + Phase-4 mutex notes: [COMFYUI-COMMAND-CENTER-OPERATIONS.md](docker-re_doc/COMFYUI-COMMAND-CENTER-OPERATIONS.md) (historical). |
| **llama-deep (Phase 4)** | command-center (`192.168.1.136`) | Bare podman **`eliteew-llama-deep`** on **`:8080`** — dense Gemma **31B** Q4 (`-c 81920`, `--parallel 1`, KV `q8_0`). Ops: `bash docker/scripts/eliteew-llama-deep.sh`. Stack0 `LLAMA_DEEP_URL=http://192.168.1.136:8080` (never compose DNS). Firewall: rich-rule `.111`→`:8080`. **No longer** mutex with living Comfy (Comfy moved to `.141`). |
| **Command-center operator plane** | command-center (`192.168.1.136`) | Git, docs, plaintext env staging, SOPS bundle, all builds (`bash docker/scripts/eliteew-deploy.sh release stack0 --all` / `eeprodruntime` / MobileAndroid), Phase 4 `llama-deep` `:8080`, deploy/smoke wrappers (`eliteew-command-center.sh`, `eliteew-migration-command-center.sh`). Alias `eedeploy` → `eliteew-deploy.sh`. **Not living:** DEWA / EWPower / EWC / EWGen / logwatch / EWCO (soft-retired → `trash/`). ComfyUI living home is **gpu141**, not this host. |
| **Landing `eliteew.ru`** | prod-core (`192.168.1.111`) | Standalone `stack0-eliteew-landing` on `.111` local `:29002`; image default `local/eliteew-site-prod:secure` from `shared/web/site_prod/` (Next standalone). Deploy: `bash docker/scripts/eliteew-landing-deploy.sh --yes` (build on `.136`). Start helper `eliteew-landing-start.sh`. Public path via Meet WG backhaul. Canon: [product/SITE-PROD-LANDING.md](../product/SITE-PROD-LANDING.md). Legacy tree `shared/web/landing/` archived-in-tree (not edited). |
| **Mobile OTA** | prod-core (`192.168.1.111`) | Standalone `stack-mobile-release` on `.111` local `:29180` from `local/binaries`; continuous policy: `restart: unless-stopped` + boot phase `prod-core-mobile-ota-start.sh` in `podman-autostart-prod-core.sh`. |
| **KBSEW (knowledge barrels)** | prod-core (`192.168.1.111`) | Standalone `stack-kbsew` on `.111` local `:28030` → container `:8030`; compose `docker/stack/kbsew.yml` (nets `ew_net_2847` / `ew_net_7198` / `ew_net_9O11`). Depends on stack1 PG/Qdrant/Seaweed, stack4 Tika/OCR, stack6 JWKS, gpu141 embed `:8081`. stack0 gateway `/api/v1/kbsew/*` via `KBSEW_SERVICE_URL`. Deploy: `bash docker/scripts/kbsew-deploy-prod-core.sh --yes` (default **does not** recreate stack0). Canon: [product/KBSEW.md](../product/KBSEW.md). |

### Smoke (ожидаемое состояние)

```bash
# command-center — baseline / acceptance (Comfy + migration gates; not DEWA/EWPower)
bash docker/scripts/eliteew-command-center.sh smoke
bash docker/scripts/eliteew-migration-command-center.sh baseline
bash docker/scripts/eliteew-migration-command-center.sh workload-smoke
bash docker/scripts/eliteew-migration-command-center.sh reboot-gate all
bash docker/scripts/eliteew-migration-command-center.sh acceptance

# prod-core — split stack0 и core health (SSH LAN 192.168.1.111)
ssh 192.168.1.111 'curl -sf http://127.0.0.1:29000/api/health'
ssh 192.168.1.111 'curl -sf http://127.0.0.1:29001/ >/dev/null'
ssh 192.168.1.111 'podman exec stack0-eliteew-api-prod-baked curl -sf http://127.0.0.1:8000/api/health'
ssh prod-core 'podman ps --format "{{.Names}}|{{.PodName}}" | awk "/stack0-eliteew-(api|frontend|api-worker|celery-worker|celery-agentic-worker|celery-companion-worker|celery-discussion-worker|celery-beat)-prod-baked/ {print}"'
ssh prod-core 'curl -sf http://127.0.0.1:29000/api/health'
ssh prod-core 'curl -sf http://127.0.0.1:29001/ >/dev/null'
ssh prod-core 'curl -sf http://127.0.0.1:34002/config.js >/dev/null'
ssh prod-core 'cd <repo> && source docker/scripts/prod-core-deploy-lib.sh && export PROD_CORE_DEPLOY_REPO_ROOT=$PWD && prod_core_deploy_smoke_stack4'
ssh prod-core 'curl -sf http://127.0.0.1:28030/health && curl -sf http://127.0.0.1:28030/ready >/dev/null'
# LAN
ping -c2 192.168.1.111

# gpu141 — inference endpoints + ComfyUI
ssh gpu141 'curl -sf http://127.0.0.1:8081/health && curl -sf http://127.0.0.1:8082/health && curl -sf http://127.0.0.1:8083/health'
ssh gpu141 'curl -sf http://127.0.0.1:31003/system_stats >/dev/null'
# from API container on prod-core
ssh 192.168.1.111 'podman exec stack0-eliteew-api-prod-baked curl -sf http://192.168.1.141:31003/system_stats >/dev/null'

# public edge (Meet WG primary) — do not require dewa.eliteew.ru / power.eliteew.ru
curl -k -sf https://app.eliteew.ru/api/health
curl -k -sf https://app.eliteew.ru/app-build-version.txt
curl -k -sf https://meet.eliteew.ru/config.js >/dev/null
# deploy_id parity (edge static vs prod-core SPA) — after deploy-cloud-spa-to-edge.sh
bash docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh --verify-only
```

### Live drift / residual (runtime work, not living host-role assumptions)

| Item | Evidence / status | Follow-up |
|------|-------------------|-----------|
| Landing / public `eliteew.ru` | **Cutover 2026-08-05:** image `local/eliteew-site-prod:secure` (Safe Workspace); `.111:29002/health=200`; public `https://eliteew.ru/=200`. Prior clear 2026-07-20 was legacy landing image. | Re-check after reboot; ensure `LANDING_IMAGE` / synced `prod-core-landing-lib.sh` |
| Mobile OTA | **Cleared 2026-07-20:** `stack-mobile-release` + local `:29180/health`. Autostart race fixed: recreate when host health dead; WG proxy `29180` → `127.0.0.1:29180` (not retired `.136:4180`). | Keep OTA on `.111` only; smoke `curl -sf http://127.0.0.1:29180/health` + `10.77.77.2:29180/health` |
| Comfy access from API | **Cutover 2026-09-26:** living Comfy on **gpu141** `.141:31003`; staging/SOPS + API/worker `COMFYUI_URL` + DB `generation_providers.comfyui` → `http://192.168.1.141:31003/`; curl-from-API container HTTP 200. Prior `.136:31003` home retired for product path. | Keep staging/SOPS + DB aligned; smoke `system_stats` from API container after env-push |
| stack4 partial runtime | Mitigated 2026-07-20: retire-before-recreate + compose log fail-closed + Healthcheck assert (`prod_core_deploy_*`). Historical 2026-06-30 missing tika/gotenberg. | `eeprodruntime --yes --stack4-only` from `.136`, then `prod_core_deploy_smoke_stack4` |
| `power.eliteew.ru` / `dewa.eliteew.ru` | Edge nginx returns **410 Gone** (no backhaul; soft-retired). Not living acceptance (**wontfix** restore) | Do not restore without operator restore-from-`trash/` task |
| Edge cloud-spa deploy_id | **Cleared 2026-09-22:** after `release stack0 --all --refresh-openapi-pilots` + `deploy-cloud-spa-to-edge.sh --yes`, public `app-build-version.txt` = prod-core `1790042937297-cjb0wwcg3c` (`prod-baked-20260922-1208`, HEAD `4300c1239`). FoFline `spa-latest` / `spa-assets-latest` restamped to the same id (8 groups; rsync no dest prune). | Repeat edge publish after every Line A SPA change; `deploy-cloud-spa-to-edge.sh --verify-only` |
| Site Studio worker Podman XDG | **Open 2026-09-15 wave 2:** `prod-baked-20260915-1122` has no `/var/lib/eliteew` (skip-base). Provision `site-3b22cefa` `EACCES` on mkdir. `podman info` was a false smoke. | Next Line A `--all` after thin `Dockerfile.prod-baked` mkdir; smoke `ls -ld /var/lib/eliteew/xdg-config` |

### Cutover scripts and ownership

| Контур | Primary | Fallback / rollback owner | Скрипт / runbook |
|--------|---------|---------------------------|-----------------|
| `stack0` backend/frontend | `.111` | stopped legacy assets on `.136` until acceptance | [docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md](docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md); release: `bash docker/scripts/eliteew-deploy.sh release stack0 --all` |
| `stack1` + EWA PG | `.111` | snapshot/rsync rollback | [docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md](docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md) |
| llama-chat `gemma-4-26B.gguf` (−c 81920 / parallel 2) | `.111` | rollback dense: `eliteew-llama-chat-model.sh 31b --with-stack0` | [STACK2-LLM-CONTRACT.md](STACK2-LLM-CONTRACT.md) |
| embed/rerank/tool-router | `.141` | local `local-stack2-embed-rerank` profile on `.111` or `.136` | [STACK2-LLM-CONTRACT.md](STACK2-LLM-CONTRACT.md) |
| ComfyUI | `.141` | historical `.136` tree only if operator restores | `docker/scripts/lan-workers/eliteew-gpu141-comfyui-*.sh` |
| Config Plane / env push | `.136` → `.111` tmpfs | CLI `eliteew-prod-core-env-push.sh` (historical name) | [PROD-CORE-CONFIG-PLANE.md](PROD-CORE-CONFIG-PLANE.md) |

Until two reboot drills pass, legacy containers on fallback hosts may exist but must be stopped and not `restart=always`/active user units.

---

## Host roles (stable)

| Хост | IP (LAN) | Роль |
|------|----------|------|
| **prod-core / whitep** | LAN `192.168.1.111` (`enp5s0`) | Public runtime only: stack0 baked split, stack1, EWA PG, stack2 `llama-chat`, stack4, stack6, stack11, stack12, tunnel, landing/mobile artifacts, **stack-kbsew**. **No builds.** Deploy SSH from `.136` = **LAN**. Former 2.5G `10.255.136.111` retired. |
| **gpu141** | `192.168.1.141` | GPU inference (Debian 13): embed/rerank/tool-router **and** living ComfyUI `:31003`; overlayroot RO + persistent `/var/lib/eliteew/comfyui`; no stack0 beat/worker duplicates |
| **command-center** (legacy hostname «punisher») | LAN `192.168.1.136` | Git, docs, plaintext env staging, SOPS bundle, all builds (`eliteew-deploy.sh` / `eeprodruntime` / MobileAndroid), Phase 4 `llama-deep` `:8080`, deploy/smoke wrappers. Living ComfyUI is on **gpu141**, not here. |
| **edge VM** | `93.77.165.185` | TLS nginx; HTTP backhaul via Meet WG `10.77.77.2` (primary); reverse-SSH `-R` only in reserve mode |

---

## Off / not prod baseline

| Компонент | Статус |
|-----------|--------|
| stack3 (VictoriaLogs) | не используется |
| stack5 (SearXNG/Crawl4AI) | снят |
| stack666 LAN HTTPS prod path | **выключен**; prod только edge + Meet WG tunnel (SSH reserve) |
| WireGuard в stack12 | снят |
| Airflow stack | снят; env `AIRFLOW_*` в stack0 — legacy keys only |
| stack9 CosyVoice3 / F5 / Qwen3-TTS | не autostart; VRAM conflict с llama на одной 3090 |
| stack9 whisper+silero (low-VRAM) | **autostart на `.111`**: `podman-autostart` → `docker/scripts/prod-core/start-stack9-voice.sh` (`legacy-whisper` large-v3 + `legacy-silero` MIT v5 CIS). Требует host NVIDIA/CDI. **Kill-switch (2026-08-01 hang triage):** operator marker .disable-stack9-voice *[operator kill-switch marker under docker/env_file/; may be absent]* (gitignored / not tracked; create with `touch` when needed) or `ELITEEW_STACK9_VOICE_DISABLED=1` — фаза skip (не поднимать рядом с llama на одной 3090, пока не закрыт MCE/PSU). |
| DEWA / EWPower / EWC / EWGen / EWCO / access-gate-logwatch | soft-retired → `trash/`; not living smoke or host roles |

### Forbidden on command-center `.136` (post cutover)

Не держать на command-center (`.136`) после acceptance на `.111` дублирующие prod stack0 / mobile OTA / stack12 / data stacks — только build/operator plane + `llama-deep` (см. §Current). Living ComfyUI runs on gpu141.

| Контур | Почему |
|--------|--------|
| `stack0-eliteew-*-prod` | prod API/workers/beat/frontend только на `.111` |
| `stack-mobile-release` | OTA nginx на prod-core |
| `stack12-internal-dns` | internal DNS на prod-core |
| `stack9-cosyvoice3` | не держать на `.136`; на `.111` Cosy тоже не baseline (VRAM). Prod voice = whisper+silero via `start-stack9-voice.sh` |
| `stack1` / `stack6` / `stack11` | БД, SSO, Jitsi на prod-core |

**Respawn guard:** `eliteew-podman-autostart.service` on `.136` remains **disabled** (prod autostart only on `.111`). Historical EWC self-care flags under retired `EWC/` tree — do not re-enable without restore-from-`trash/`.

---

## History

| Дата | Изменение | Worklog / session |
|------|-----------|-------------------|
| 2026-05-25 | Workers reverse cutover `.141` → command-center; LAN binds localhost | historical session summary (worklog retired → `trash/`) |
| 2026-06-12 | Target freeze for `.111/.141/.136`: prod-core-first, gpu141 inference, `.136` command-center | [PROD-CORE-FINAL-CUTOVER-RUNBOOK.md](PROD-CORE-FINAL-CUTOVER-RUNBOOK.md) |
| 2026-06-14 | Command-center hygiene: stop duplicate stack0/mobile/stack12 on `.136` | §Current (build/operator plane) |
| 2026-07-18 | Soft-retire DEWA/EWPower/EWC/EWGen/EWCO from living §Current; smoke = Comfy + EliteEW only; Meet WG primary; stack666 off | this document |
| 2026-08-14 | Agentic worker queues include `ewa_factory` (compose + [CELERY-BEAT-AND-QUEUES.md](CELERY-BEAT-AND-QUEUES.md)); master-card inventory sync | this document |

---

## Связанные документы

- [TESTING-STRATEGY.md](TESTING-STRATEGY.md) — immutable API test runner
- [docker-re_doc/STORAGE-AND-VECTOR-TOPOLOGY.md](docker-re_doc/STORAGE-AND-VECTOR-TOPOLOGY.md) — Qdrant, SeaweedFS, Chroma legacy
- [docker-re_doc/STACK-CONTAINER-CONTROL.md](docker-re_doc/STACK-CONTAINER-CONTROL.md) — recreate стеков
- [PROD-CORE-FINAL-CUTOVER-RUNBOOK.md](PROD-CORE-FINAL-CUTOVER-RUNBOOK.md) — final migration day-2 runbook
- [reference/HANDBOOK-MAP.md](../reference/HANDBOOK-MAP.md) — role → entrypoints (diataxis hub soft-retired → `trash/`)
