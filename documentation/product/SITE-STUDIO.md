# Site Studio (desktop workspace)

**Status:** living product SoT (large hub). Day-to-day ops: Carrier [SITE-EDGE-CARRIER.md](../platform/SITE-EDGE-CARRIER.md), public hosts [INTERNAL-SITES-ACCESS.md](../platform/docker-re_doc/INTERNAL-SITES-ACCESS.md). Soft-retired UI-perfection one-shots → `trash/` (not hubs).

**Scope:** per-user site builder in the EliteEW **Desktop** shell — not Файловый менеджер (ContentManagerPro) / Unified Content.

**Итоговый отчёт по циклу 2026-05-29** и **UI perfection plan (2026-07)** / UX baseline audit — soft-retired one-shots → `trash/` (not living hubs). Living product SoT is **this document**.

**UI perfection program (2026-07):** waves W0–W7 implemented in FE (journey stage shell, trust copy without engine ids, RuntimePanel split, Site Manager Attention-first, `siteStudioCms` shell i18n, stale/offline banner). Target interface audit Overall ≥15 after SPA deploy.

**Public hostname (living, 2026-07-18):** product storefront hosts are `{slug}-site.eliteew.ru` (cert `*.eliteew.ru`). Public path: edge VM → **Meet WG** `10.77.77.2` (primary) → prod-core API gateway `:29000` — [PRODUCTION-TOPOLOGY-STATE.md](../platform/PRODUCTION-TOPOLOGY-STATE.md) §Current, [INTERNAL-SITES-ACCESS.md](../platform/docker-re_doc/INTERNAL-SITES-ACCESS.md), [WG-HTTP-BACKHAUL-PRIMARY.md](../platform/docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md). Reverse SSH `-R` = manual reserve. Legacy zone `*.sites.eliteew.ru` is **deferred** (DNS-01 track), not the active product shape. Historical `*.sites.empery.world` is **not** a living routing domain — rewrite on sync only; brand URL `https://empery.world` is unrelated.

## Static Site-Edge Carrier (LAN Celeron) — publish path

Full Site Studio CMS (olenti API + DB + Desktop-embedded admin) remains on the Desktop / Heavy path. **Public static LAN preview** can deploy via Carrier when enabled:

```text
.111 API (publish OPEN) → RabbitMQ → .136 site-studio-worker (build) → .10 Site-Image
```

- Canon: [platform/SITE-EDGE-CARRIER.md](../platform/SITE-EDGE-CARRIER.md) — topology, env names, health `edge` block, Carrier + IoT flash.
- Gate: `SITE_EDGE_CARRIER_ENABLED` (worker/API). Off = publication_state only (legacy). On = enqueue `site_studio_edge_publish` / `unpublish`.
- Edge content order: runtime `dist` → HTTP storefront **snapshot** → minimal **stub**; stub is **not** a successful public publish when Carrier is on (`SITE_EDGE_ALLOW_STUB_PUBLISH` dry-run only).
- Runtime panel: **Edge live** CTA only for non-stub `health.edge`; otherwise needs-attention.
- **Deferred (separate plans):** optional DNS-01 `*.sites.eliteew.ru` cutover (not living today), hybrid CMS / shared PG on Edge, catalog unpause for all users. See [SITE-EDGE-CARRIER.md](../platform/SITE-EDGE-CARRIER.md) §Deferred backlog.

## Product shape (1A) and catalog (2026-07-15)

**1A locked:** Desktop CMS (olenti) for create/edit/admin; **visitor public path** for NoRes = static Site-Image on LAN Edge (`.10`) via Carrier when `SITE_EDGE_CARRIER_ENABLED=1`. Living public Host shape remains interim `{slug}-site.eliteew.ru` (legacy `*.sites.eliteew.ru` deferred); Carrier does not dual-run full olenti on Edge.

| Contour | Role |
|---------|------|
| Desktop + API (`.111`) | CMS edit, lifecycle enqueue |
| `site-studio-worker` (build host) | RabbitMQ consumer; Carrier SSH to Edge — **required** (no inline fallback as normal path) |
| Edge `.10` | Visitor LAN URL only |

**Catalog:** `app-site-studio` access group **NoRes** (migration `20260715_desktop_site_studio_catalog_access_nores.sql`, runner key `20260715_01|desktop_site_studio_catalog_access_nores` in `docker/scripts/apply-eliteew-migrations.sh`). Not full Default. Rollback catalog: re-apply `20260522_desktop_site_studio_catalog_access_no.sql`.

**Publish honesty:** with Carrier on, Edge success requires `health.edge.content_source ∈ {runtime_dist, snapshot}`; stub fails the job unless `SITE_EDGE_ALLOW_STUB_PUBLISH=1` (operator dry-run only). FE distinguishes CMS open vs Edge live vs needs-attention.

## Partial unpause (NoRes) — status since 2026-07-15

**Статус:** **partial unpause (NoRes)** — catalog open for NoRes; worker + Edge required for honest publish. Not a full Default reopen. Product and runtime code remain; do not treat stub Edge as “published”.

| Что | Сейчас | Как откатить / включить |
|-----|--------|-------------------------|
| RabbitMQ worker | Must run (baked `stack0-eliteew-site-studio-worker-prod-baked` on build/runtime host with `SITE_EDGE_*`) | Stop container / disable profile; catalog can stay NoRes but publish fails closed |
| Приложение **`app-site-studio`** | access group **NoRes** | Rollback SQL `20260522_…_no.sql` or admin catalog |
| Edge Carrier | `SITE_EDGE_CARRIER_ENABLED=1` + SSH to `.10` | Set `SITE_EDGE_CARRIER_ENABLED=0` (legacy publication_state only) |
| API `/api/v1/desktop/site-studio/*` | provision/start **без worker** → 503 (honest) | Do **not** enable `ELITEEW_SITE_STUDIO_ALLOW_INLINE_FALLBACK` as normal prod path |

Остановка worker на host: stop-punisher-local-workers.sh *[absent — historical LAN helper]* (если local profile) или `podman stop` целевого worker-контейнера.

Live Edge smoke: `bash docker/scripts/site-studio-edge-publish-smoke.sh` (exit codes 0/1/2/3/4/5 — see [SITE-EDGE-CARRIER.md](../platform/SITE-EDGE-CARRIER.md)).

См. также: `documentation/platform/docker-re_doc/STACK0-BACKEND-IMAGES.md`, `documentation/platform/DOCKER-STACKS-PROD-OVERVIEW.md`.

## Временная пауза (исторический baseline 2026-05-22)

До partial unpause: worker profile off by default; catalog group **`NO`**. That baseline is superseded by §Partial unpause above for NoRes; keep this section for rollback archaeology only.

| Что | Было (pause) | Как включали |
|-----|--------------|--------------|
| RabbitMQ worker `eliteew-site-studio-worker-prod` | profile **`site-studio-worker`** не на обычном `up` | `… --stack0-profiles punisher-local-workers,site-studio-worker` |
| Приложение **`app-site-studio`** | группа **`NO`** (`20260522_…_no.sql`) | NoRes migration / admin |
| API | без worker → очередь/503 | worker + не использовать inline fallback в prod |

Остановка контейнера на хосте: stop-punisher-local-workers.sh *[absent — historical LAN helper]* (в т.ч. site-studio-worker).

## Lifecycle jobs and worker readiness (2026-05-29)

Runtime actions now persist machine-readable evidence in Postgres:

- `site_studio_lifecycle_jobs` records each `provision/start/stop/redeploy/destroy` request, queue state, worker id, current stage, attempts, final status, duration and error text.
- `site_studio_worker_heartbeats` records the freshest `site_studio` worker signal. The API treats the worker as ready while the heartbeat is fresh (`SITE_STUDIO_WORKER_READY_WINDOW_SECONDS`, default `180`). The heartbeat is bound to the logical queue key `site_studio`, even though RabbitMQ consumes the physical queue `site-studio.runtime.queue`.
- Action responses include `job_id`; health responses include `worker_ready`, `worker_last_seen_at`, `pending_job` and `last_job`.
- Backend routes enforce the same state-machine guardrails as the UI before mutating status: duplicate pending transitions, impossible start/stop/redeploy states, missing compose metadata and missing worker now fail before a new lifecycle mutation is accepted. **Destroy** is allowed even while status is a stuck pending transition (`provisioning` / `starting` / …), so operators can tear down orphaned sites.
- Public hostname base is `USER_SITE_STUDIO_PUBLIC_BASE_DOMAIN` (default `eliteew.ru`) with label suffix `USER_SITE_STUDIO_PUBLIC_HOST_LABEL_SUFFIX` (default `-site`) → `{slug}-site.eliteew.ru`. Matcher requires the `-site` suffix so `app`/`auth`/`meet` are never public-site hosts. Legacy `*.sites.eliteew.ru` and historical `*.sites.empery.world` values rewrite on sync to the interim shape; they are not active product hosts. Custom domains outside the product shape are kept.
- Stack0 API startup is fail-fast by default for queue mode: `ELITEEW_REQUIRE_SITE_STUDIO_WORKER_AT_STARTUP=true` makes `start_all.sh` wait for a fresh `site_studio` heartbeat before `uvicorn`, and FastAPI lifespan repeats the same check. Without a fresh worker heartbeat, backend startup aborts with an explicit Site Studio preflight error in logs.
- Health reads also run a stale-job reaper: old `created|queued|running` jobs fail with `stale_worker_heartbeat` when the worker heartbeat is expired. Operators can cancel/retry non-destroy jobs through `.../instance/jobs/{job_id}/cancel|retry`.
- `USER_SITE_STUDIO_RUNTIME_MODE=images|source|auto` controls runtime packaging. `images` fails preflight unless `SITE_STUDIO_OLENTI_API_IMAGE` and `SITE_STUDIO_OLENTI_FRONTEND_IMAGE` are set; `source` forces source-copy mode; `auto` uses images when both are configured.
- Runtime compose images must use fully-qualified names (default `docker.io/library/postgres:16-alpine`, `docker.io/library/node:20-alpine`) via `USER_SITE_STUDIO_POSTGRES_IMAGE` / `USER_SITE_STUDIO_NODE_RUNTIME_IMAGE`. Short names (`postgres:16-alpine`) hang rootless Podman without a TTY (`short-name resolution enforced`) and block the whole site-studio worker queue (`prefetch=1`).
- Container CLI (`podman`/`docker` / `compose …`) is bounded by `USER_SITE_STUDIO_COMPOSE_TIMEOUT` (default `600` seconds). Without this bound a stuck `compose up` can leave destroy/start/apply jobs queued forever while the UI already shows “deleted” on HTTP 202.
- Template runtime overlays are loaded from versioned manifests under `site-templates/runtime-profiles/*.json`; `olenti`, `allenti` and `aurelia` keep profile ids `olenti-v1`, `allenti-v1`, `aurelia-v1`.

## Internal custom domains (MVP, 2026-05-29)

Site Studio supports binding an already-owned custom hostname for internal LAN/VPN access.

- Persistence is separate from `public_hostname`: `site_studio_domain_bindings`, `site_studio_domain_binding_audit`, and `site_studio_domain_dns_outbox`.
- API: `/api/v1/desktop/site-studio/instance/domains/*` lists, creates, verifies TXT ownership, requests internal DNS routing, activates after operator TLS readiness, and disables bindings.
- Verification uses `_eliteew-site.<domain> TXT <token>`. Hostnames are normalized with IDNA/punycode and reject schemes, paths, ports, wildcards, IP literals, localhost/control hosts, deferred `*.sites.eliteew.ru`, historical `*.sites.empery.world`, and platform hosts such as `app.eliteew.ru`.
- Public gateway resolves active domain bindings before the interim product host `{slug}-site.eliteew.ru`, while all public blocked paths (`/admin/*`, `/api/admin/*`, Desktop APIs) remain blocked.
- Activation is deliberately operator-gated: TXT verification is not enough. Internal DNS and TLS readiness are tracked separately so UI can show “verified, waiting for route/cert”.

## Site Manager Ops control center (2026-05-29)

Site Manager has a shared operator contour for personal Site Studio and KIRS project sites.

**Where operators open it (2026-07-16):**

| Surface | How to open | Who |
|---------|-------------|-----|
| **Unified Admin** (primary) | Admin panel → product group → **Site Studio** (`section=siteStudio`); single scroll on the ops panel (`space-y`, not shrink-flex) | EliteEW admin |
| **Desktop app** | Catalog app **Контроль сайтов** (`app-site-manager-ops` / `SiteManagerOps`), `is_system` | same admin roles |
| Embedded CMS inside a site | Desktop Site Studio → site edit (olenti mirror) | site owner; not platform ops |

Domain binding remains user-initiated in Desktop Site Studio (`/api/v1/desktop/site-studio/instance/domains/*`); EliteEW admin confirms DNS applied / TLS ready via Site Manager Ops (`mark-applied`, `mark-tls-ready`).

- Backend admin API: `/api/v1/desktop/site-manager/ops/*`.
- `GET /overview` aggregates worker readiness, recent lifecycle jobs, domain bindings, DNS/TLS outbox rows, recent instances and runtime reconcile issues.
- Lifecycle job repair: `POST /jobs/{job_id}/cancel` cancels pending jobs and `POST /jobs/{job_id}/retry` queues a fresh retry for retryable Site Studio runtime tasks; both routes are admin-only and audit-backed.
- DNS/TLS workflow: `GET /dns-outbox/preview`, `POST /dns-outbox/{id}/mark-applied`, `POST /domains/{binding_id}/mark-tls-ready`.
- Runtime reconcile: `GET /reconcile` reports open sites without runtime metadata, stale transition states, missing runtime paths and follow-up container checks; `POST /reconcile/{scope}/{id}/mark-failed` is the explicit safe repair action.
- Template registry: `GET /templates` exposes `olenti`, `allenti`, `aurelia` profile ids, runtime mode and image readiness.
- Publish quality gate: `POST /smoke/publish` returns structured hard/soft checks for runtime metadata, public URL, publication state and optional live storefront/admin-block probes. Normal Site Studio runtime panel and Site Manager Ops both pass `run_live: true` for user-triggered publish checks, so the same storefront/admin/assets/SEO evidence path is used from either surface.
- Frontend Site Studio runtime panel includes an admin-only **Operator control** card for overview refresh and current-instance publish smoke.
- **Frontend module map (2026-07-31):** stable import path `features/site-studio/desktop/components/SiteManagerOpsPanel.tsx` is a thin facade (named + default re-export). Implementation lives under `features/site-studio/desktop/components/siteManagerOps/`:

| Module | Role |
|--------|------|
| `SiteManagerOpsPanel.tsx` | Shell: header, error banner, view-mode tabs, mode panels |
| `useSiteManagerOps.ts` | Compose hook: overview/templates fetch, mutations, UX derivation, selection/controls persistence |
| `siteManagerOpsStorage.ts` | `sessionStorage` helpers (`selectedSiteKey`, controls) |
| `siteManagerOpsFormatters.ts` | Pure label/format helpers |
| `AttentionModePanel.tsx` / `DomainsModePanel.tsx` / `AdvancedModePanel.tsx` | View-mode sections |
| `DomainStepperCard.tsx` / `RecoveryCard.tsx` | Domain stepper + recovery cards |
| Shared siblings (not duplicated) | `SiteManagerOpsAtoms.tsx`, `SiteManagerDrilldownPanel.tsx`, `SiteManagerSiteCards.tsx` |

Atomization lock: `siteManagerOps/__tests__/SiteManagerOpsPanel.atomization.contract.test.ts`.

Hardening wave (same day):

- Ops routes now expose explicit Pydantic response models in OpenAPI for overview, jobs, domains, DNS outbox, reconcile, templates, smoke, audit and KIRS collaboration.
- Unified Admin Site Manager Ops **Advanced** mode includes `KirsCollaborationOpsCard`: load/save `GET|PATCH …/kirs/projects/{id}/collaboration` (readiness, approval, operator notes) via New World Admin atoms.
- Durable audit table `site_manager_ops_audit_events` records operator mutations: DNS applied, TLS-ready, reconcile mark-failed, publish smoke and KIRS collaboration updates.
- Desktop catalog entry `app-site-manager-ops` (`SiteManagerOps`) is seeded as `is_system` / `is_factory` for admin visibility; the same panel mounts in Unified Admin under **Site Studio**.
- The operator surface keeps machine ids available for support export, but primary UI labels are human-facing: scopes/statuses/jobs/stages/severity, template readiness, audit targets and audit actions are formatted before rendering (`Личный сайт`, `Проверка публикации`, `Сверка состояния`, `Журнал событий`) instead of raw `user/running/publish/finished/publish_smoke/runtime_missing/site:id`.
- Publish smoke V2 persists the last result through audit events and distinguishes hard failures (`storefront_http`, `/api/health`, `/admin` block, required assets) from soft findings (SEO title/description, first-level links).
- Read-only reconcile can run outside the API via `docker/scripts/site-manager-reconcile-report.py`; it reports drift without deleting runtime data.

## User-facing copy guardrails (2026-05-29)

- First-run, existing-site setup, assistant, auto-fill panel and primary navigation copy must describe the product in user terms: create a site, describe audience/offer/style, prepare structure, auto-fill, review drafts, launch and publish.
- Normal user surfaces must not expose raw labels such as `Brief`, `AI brief wizard`, `AI Studio`, `site title`, `blueprint`, `tone of voice` or `runtime` as primary instructions. Operator-only diagnostics may keep exact support terms where they help incident triage.
- The main generation tab is labeled `Автозаполнение` / `Auto-fill`; the internal `ImperorG` codename stays in API/module names and operator/debug contexts only.
- The auto-fill panel title, launch CTA, running/complete states, low-level launch error fallback and interrupted-stream recovery hints must use `Автозаполнение` / `Auto-fill` wording rather than `ImperorG`, `пайплайн`, or “masterpiece” copy.
- The extracted first-run panel, image preview status and auto-fill document picker must read copy from `siteStudio.json`; new user-visible strings in these surfaces need RU/EN parity and locale tests.
- The runtime panel formats launch/API/public health, background task state, domain/TLS state, operator-control labels and publish-smoke checks before rendering. User-triggered publish smoke shows an `aria-live` summary (`ready to publish` vs `needs attention`) above detailed checks, so visitors-readiness is clear without reading raw evidence rows. Raw values such as `running`, `job:`, `route_pending`, `Hostname`, `Public URL` and `API URL` stay out of the primary view.
- Site Manager repair/config copy must keep raw support terms out of primary labels: use `Зафиксировать ошибку`, `Сигнал состояния`, `Область`, `Доля включения`, `Флаги возможностей` instead of `failed`, `reconcile`, `Scope`, `Rollout %` or `Feature flags`.
- `UserSiteStudioApp.nullInstance.test.tsx` guards empty-instance intro copy, existing-site setup/assistant copy, and locale labels for the auto-fill tab / first-run copy. `SiteStudioRuntimePanel.test.tsx` guards user-facing runtime/status/domain labels. `siteStudioLocaleCopyGuard.test.ts` guards Site Manager repair/config labels plus localized preview/document-picker labels in RU/EN locales.

## Безопасный запуск Site Studio под Podman (rootless)

1. Включить user socket Podman:
   - `systemctl --user enable --now podman.socket`
   - проверить: `test -S /run/user/$(id -u)/podman/podman.sock`
2. Проверить профиль worker (он должен запускаться только явно):
   - `ELITEEW_CONTAINER_RUNTIME=podman python3 docker/scripts/eliteew-container-control.py --repo-root <repo> validate --include stack0-backend --stack0-profiles punisher-local-workers,site-studio-worker`
3. Поднять worker:
   - `ELITEEW_CONTAINER_RUNTIME=podman python3 docker/scripts/eliteew-container-control.py --repo-root <repo> up --include stack0-backend --stack0-profiles punisher-local-workers,site-studio-worker`
   - При следующем recreate/up без этого профиля API сам упадёт на startup preflight, если `ELITEEW_REQUIRE_SITE_STUDIO_WORKER_AT_STARTUP=true`.
4. Smoke:
   - `podman ps --format '{{.Names}} {{.Status}}' | rg 'stack0-eliteew-site-studio-worker-prod'`
   - `podman logs --tail 80 stack0-eliteew-site-studio-worker-prod`
   - `podman exec -i stack1-postgres psql -U ai_user -d ai_services -c "SELECT worker_id, queue_name, last_seen_at FROM site_studio_worker_heartbeats ORDER BY last_seen_at DESC LIMIT 1;"`
   - `podman exec stack0-eliteew-site-studio-worker-prod sh -lc 'command -v podman && command -v podman-compose && command -v docker || true'`
5. Инварианты безопасности:
   - `/var/run/docker.sock` не монтируется в `eliteew-site-studio-worker-prod`.
   - Docker CLI больше не монтируется в `eliteew-site-studio-worker-prod` (podman/podman-compose предустановлены в image `site-studio-worker`).
   - используется только user-level podman socket (`/run/user/<uid>/podman/podman.sock`).
   - SELinux `label=disable` применяется точечно только к этому сервису из-за socket bind.

## Troubleshooting (Podman worker)

- `POST .../instance/provision|start` возвращает `503` с `Site Studio worker is not ready`, хотя `stack0-eliteew-site-studio-worker-prod` `healthy`:
  - Проверить heartbeat: `SELECT worker_id, queue_name, last_seen_at FROM site_studio_worker_heartbeats ORDER BY last_seen_at DESC LIMIT 1;`
  - Если строк нет или `last_seen_at` старый, worker может слушать physical queue `site-studio.runtime.queue`, но не писать readiness heartbeat по logical key `site_studio`. Пересобрать/пересоздать `stack0-backend` с profile `site-studio-worker`.
  - Smoke после фикса: свежий heartbeat с `queue_name='site_studio'` и возрастом меньше `SITE_STUDIO_WORKER_READY_WINDOW_SECONDS`.
- `RuntimeError: missing networks: default` в логах `stack0-eliteew-site-studio-worker-prod` означает, что runtime compose-файл инстанса ссылается на `default`, но не объявляет его явно. В Podman path (через `podman-compose`) `default` нужно явно присутствовать в секции `networks`.
- `stat /home/owned/.config: no such file or directory` on `compose_up` / `podman info` in the worker: Carrier compose sets `HOME=/home/owned` for SSH (`~/.ssh` bind) but does **not** mount host `~/.config`. Podman stats that path and dies. Fix: worker **base** image **and** thin `Dockerfile.prod-baked` `site-studio-worker-baked` create `XDG_CONFIG_HOME=/var/lib/eliteew/xdg-config` (uid 1000). Line A `SKIP_BASE=1` does not apply the base `RUN mkdir`. Fail closed if that dir is missing or not writable — no `/tmp` fallback. Do **not** bind host `~/.config` (sops/cdi leak). Smoke: `ls -ld /var/lib/eliteew/xdg-config` then provision; `podman info` alone is insufficient.
- `Error: short-name resolution enforced but cannot prompt without a TTY` на `compose up` — short image names without registry. Symptom for operators: delete returns OK (202) but site reappears; start/apply buttons stay inert because `prefetch=1` waits on the hung provision. Fix: FQIN in generated compose + `USER_SITE_STUDIO_COMPOSE_TIMEOUT`; recovery: kill hung `podman-compose` for that slug, then let destroy drain (or restart `stack0-eliteew-site-studio-worker-prod-baked`).
- Implementation layout (2026-07-15): compose/lifecycle/health live under `shared/api/services/site_studio_runtime/` (`helpers.py`, `manager.py`, `manager_compose.py`, `manager_lifecycle.py`, `manager_health.py`); public import path remains `api.services.site_studio_runtime_service`.
- Каноническая фиксация (2026-05-26): генератор runtime compose (`site_studio_runtime_service` → `site_studio_runtime/manager_compose.py`) всегда добавляет:
  - `networks.default: {}`
  - `networks.eliteew-shared` (external `ew_net_6211`)
- После обновления кода перезапустить worker: `podman restart stack0-eliteew-site-studio-worker-prod`.
- `ValueError: Fernet key must be 32 url-safe base64-encoded bytes` — это warning конфигурации шифрования. Runtime использует fallback-шифратор, но для production желательно задать валидный `ENCRYPTION_MASTER_KEY` в backend env.
- `site-studio-<slug>-elite_api_1` / `site-studio-<slug>-elite_frontend_1` в `Exited` с `npm EACCES` (`/app/node_modules/...`) под rootless Podman:
  - Причина: `podman-compose` оставляет private userns; при `user: "1000:1000"` контейнерный UID 1000 не совпадает с хостовым владельцем bind-mount (runtime `node_modules`/build cache).
  - Каноническая фиксация (2026-05-26): в Podman path генератор `site_studio_runtime_service.py` задаёт для `api/frontend` `user: "0:0"` (rootless-map на хостовый uid оператора), для Docker path остаётся `1000:1000`.
  - Recovery существующего инстанса: обновить runtime compose конкретного сайта и выполнить `podman compose -f <runtime-compose.yml> -p <compose_project_name> up -d --remove-orphans --force-recreate`.
- `SiteStudioRuntimeError: Frontend health failed: [Errno -3] Temporary failure in name resolution` в `wait_until_healthy`:
  - Причина: runtime health-check ходит на host вида `<compose_project_name>-frontend-1`, но без явных aliases на `ew_net_6211` этот hostname может не резолвиться.
  - Каноническая фиксация (2026-05-26): генератор compose добавляет уникальные aliases в `eliteew-shared` для `api/frontend` (`<compose_project_name>-api-1`, `<compose_project_name>-frontend-1`).
  - Проверка из worker: `podman exec stack0-eliteew-site-studio-worker-prod getent hosts <compose_project_name>-frontend-1`.
- Удаление инстанса возвращает `202`, но сайт «появляется снова» после перезахода:
  - Симптомы в worker-логах: `Permission denied removing Site Studio path .../postgres-data` и после удаления старая витрина/контент возвращаются.
  - Причина: bind-монтированные каталоги Postgres в rootless Podman часто имеют сдвинутый owner из user namespace (на хосте это выглядит как UID вроде `524357` + `0700`), поэтому обычный `rm -rf` и fallback `podman run ... rm -rf` могут не иметь доступа.
  - Каноническая фиксация (2026-05-26): `SiteStudioRuntimeManager._remove_tree` сначала пробует `podman unshare rm -rf -- <runtime_path>`, и только потом legacy helper-контейнер.
  - Follow-up (2026-05-27): worker Site Studio работает через **remote podman client** (`CONTAINER_HOST=unix:///run/user/<uid>/podman/podman.sock`), где `podman unshare` недоступен. Генератор cleanup теперь:
    - **пропускает** `podman unshare` при remote client;
    - сначала вызывает helper `podman run --rm --userns=host ... alpine:3.20 rm -rf` (видит shifted uid на host namespace);
    - затем legacy fallback `node:20-alpine`, если первый шаг не удалил дерево.
  - Для диагностики добавлены явные логи `Site Studio destroy task started/succeeded/failed` в `queue_handlers.handle_site_studio_destroy`.
  - Быстрый smoke:
    1. удалить сайт из Site Studio/KIRS (режим без `preserve_runtime_data`);
    2. проверить логи worker: `podman logs --tail 200 stack0-eliteew-site-studio-worker-prod | rg 'Site Studio destroy task'`;
    3. убедиться, что runtime-папка отсутствует: `ls -la host/runtime/user_site_studio/`.
- ImperorG-пайплайн останавливается каскадом ошибок (`AI returned invalid JSON` -> `greenlet_spawn has not been called` на следующих фазах):
  - Симптом: первая ошибка приходит на одном из content-шагов, после чего SEO/images/apply массово падают с `MissingGreenlet`.
  - Причина: после AI contract error (невалидный JSON от модели) выполнялся `rollback`, что в async SQLAlchemy истекало ORM-атрибуты `UserSiteInstance`; последующие чтения в пайплайне пытались сделать lazy IO вне корректного greenlet-контекста.
  - Каноническая фиксация (2026-05-26): в `ImperorGService` rollback **пропускается** для `SiteStudioAIError`, а после остальных фазовых ошибок инстанс перезагружается из БД; при `greenlet_spawn` добавлено восстановление сессии + reload инстанса.
  - Дополнительно:
    - для `generate_content_pack` добавлен единичный retry на transient contract-errors (`AI returned invalid JSON`, `Content pack JSON is missing blocks`, `Content pack generation returned empty values`) без перезапуска всего пайплайна;
    - в `SiteStudioAIService._complete_json_prompt` добавлен repair-pass: при первом parse-fail сервис делает отдельный low-temperature запрос на починку синтаксиса и повторно парсит ответ;
    - `_extract_json_object` переведён на общий robust extractor `api.utils.llm_json_extract.extract_llm_json_payload` (fences, balanced slice, JSON comments/trailing commas).
    - **Stack2 native JSON (2026-06):** все JSON-потоки Site Studio (`brief`, content pack, SEO, repair pass) вызывают `DocEditorService.ai_complete(..., json_format=True)` → UGS `text_chat` с `input_data.json_format`; stack2 получает `format=json` / OpenAI `json_object`. Промпты описывают схему полей, без boilerplate «только JSON / без markdown».
    - follow-up hardening (2026-05-27): если LLM вернул JSON без `blocks`, `SiteStudioAIService.generate_content_pack` делает schema-normalization pass и повторно собирает payload в канонический формат `{"title","summary","blocks":[...]}`; дополнительно включено мягкое сопоставление block identity по `key`/`id`/`path` для «кривых» ответов модели.
    - follow-up tuning (2026-05-27): research-stage получил runtime-env ручки (без изменения кода) — `IMPERORG_RESEARCH_CONTEXT_BUDGET`, `IMPERORG_CRAWL_CONTEXT_BUDGET`, `IMPERORG_SEARCH_QUERY_TIMEOUT_SEC`, `IMPERORG_CRAWL_URL_TIMEOUT_SEC`, `IMPERORG_SEARCH_EARLY_STOP_RESULTS_TARGET`, `IMPERORG_SEARCH_EARLY_STOP_DOMAINS_TARGET`, `IMPERORG_SEARCH_MAX_QUERIES`, `IMPERORG_FALLBACK_MAX_QUERIES`, `IMPERORG_SEARCH_RESULTS_LIMIT`, `IMPERORG_CRAWL_URL_LIMIT`, `IMPERORG_SEARCH_PAUSE_SEC`, `IMPERORG_FALLBACK_PAUSE_SEC`.
    - telemetry-лог `Research telemetry` теперь пишется как сериализованный JSON-строкой; это устраняет `TypeError: not all arguments converted during string formatting` из стандартного Python logging handler.
    - web-search в research-stage теперь **per-operation opt-in**: `POST /api/v1/desktop/site-studio/imperorg/launch` принимает `use_web_search` (default `false`), UI «Автозаполнение» показывает чекбокс «Веб-поиск». При включении запросы идут через quota-aware `search_service.web_search(user_id, db)`; при выключении пайплайн строит локальный brief без web-контекста.
    - **Wall-clock (2026-07):** research brief и блоки веб-поиска получают authoritative server time (`llm_wall_clock_context.py`); модель не должна выдумывать «системную дату» и не выдавать архивные даты из сниппетов как предстоящие события.
    - research-stage оптимизирован для сценария «внешний поиск пустой/деградирует»: нормализация и шумоподавление поисковых запросов, early-stop после серии пустых ответов, fallback-кандидаты и dedupe выдачи перед формированием контекста.
    - в research-step добавлены timeout-guards для внешних IO (`web_search`, `scrape_url`) через `asyncio.timeout`, чтобы пайплайн не зависал на медленных источниках и быстрее завершал шаг по fallback-логике.
    - quality-оптимизация deep-analysis: crawl URL выбираются с приоритетом уникальных доменов (а не просто первые 2 ссылки), плюс нормализуются даже вручную переданные `search_queries`.
    - добавлена lightweight telemetry в research-step (attempts/timeouts/fallback/unique domains/crawl success + elapsed ms) для быстрой диагностики причин деградации качества/скорости в логах.
    - в primary web-search добавлен early-stop по quality target: если уже набран достаточный объём уникальных результатов и доменов, лишние поисковые запросы не выполняются (ускоряет переход к strategy/content).
    - image-stage оптимизирован на уровне UGS-клиента: в `_phase_images` используется один shared `UnifiedGenerationService` на весь набор image-слотов вместо пересоздания клиента на каждый слот (меньше накладных расходов и соединений при серии генераций).
    - AI Fill wave (2026-05-29): перед apply включён shared quality validator `site_studio_ai_quality.py`; hard findings (`empty_value`, `placeholder_ellipsis`, `template_demo_drift`, `max_length_overflow`, `boilerplate_placeholder`, `missing_required_block`) не применяются к runtime, soft findings остаются в structured report.
    - ImperorG launch теперь делает AI/UGS queue preflight до длинного SSE run: при включённом queue-mode отсутствие `ai.generation.queue`, RabbitMQ management snapshot или активных consumers возвращает `503` с явным текстом для оператора.
    - ImperorG apply отдаёт structured report в SSE (`applied/skipped/failed/retried` по content, SEO, full rewrite, image upload, site settings, entities, entity images) и `pipeline_complete.apply_report`; частичный apply больше не выглядит как полный успех.
    - frontend ImperorG SSE parser поддерживает multi-line `data:`, CRLF/comments, flush последнего буфера и переводит внезапный EOF без `pipeline_complete` в terminal `interrupted`, а не вечный `running`.
    - image/entity-image generation получает UGS idempotency key на site/template/slot-or-entity/prompt digest и visual-only anti-text policy: суффикс `Text-free image` + **запрет подставлять brand/title/имя сайта** в positive prompt (иначе Comfy всё равно рисует текст на картинке).
    - обычный Site Studio UI показывает progress по non-image AI streams и per-draft apply result (`applied/skipped/failed`) без внутренних queue/UGS деталей в пользовательском тексте.
- `ImperorG apply/full_rewrite` показывал `64 блоков перезаписано из 75 оставшихся` и оставлял часть текста без адаптации:
  - Причина: батч-ответ LLM мог вернуть только часть `blocks`; до follow-up 2026-05-27 пайплайн не делал обязательный добор пропущенных элементов.
  - Каноническая фиксация (2026-05-27): в `ImperorGService._phase_apply` после батч-перезаписи добавлен per-block fallback (`single-block rewrite`) для каждого отсутствующего блока.
  - Summary шага теперь явно показывает хвост `пропущено: N`, а лог пишет preview unresolved keys для диагностики.

- Покрытие шага `Загрузка изображений на сайт` (слоты контента) ограничено объявленными image-slots:
  - Текущий baseline: **6** слотов (`home.hero.background`, `home.about_preview.portrait`, `about.hero.atelier`, `about.founder.portrait`, `about.philosophy.ingredients`, `about.process.crafting`).
  - Каноническая фиксация (2026-05-27, follow-up): в apply-пайплайне добавлен отдельный шаг `Адаптация изображений каталога и галереи`, который генерирует и обновляет:
    - карточки `products` (`PATCH /products/{id}`),
    - карточки `consultations` (`PATCH /consultations/{id}`),
    - карточки `masterclasses` (`PATCH /masterclasses/{id}`),
    - записи галереи (`PATCH /gallery/{id}`),
    используя `POST /admin/upload` для загрузки новых assets.
  - **Catalog publish guard (2026-07-27):** Olenti `POST`/`PATCH` for consultations and masterclasses reject `isActive: true` unless merged `title`, `price` (>0), and `duration` are present (`server/src/utils/catalogPublishGuard.ts` → HTTP **422**). Deactivate / draft (`isActive: false`) remains allowed with incomplete fields. Selftest: `npx tsx src/utils/catalogPublishGuard.selftest.ts` from `site-templates/olenti/server`.
  - Guardrails (2026-05-27, follow-up-2; updated 2026-07-16): runtime-лимиты и опциональный фильтр категорий галереи через env:
    - `IMPERORG_ENTITY_IMAGES_PRODUCTS_LIMIT`
    - `IMPERORG_ENTITY_IMAGES_CONSULTATIONS_LIMIT`
    - `IMPERORG_ENTITY_IMAGES_MASTERCLASSES_LIMIT`
    - `IMPERORG_ENTITY_IMAGES_GALLERY_LIMIT`
    - `IMPERORG_ENTITY_IMAGES_GALLERY_ALLOWED_CATEGORIES` (CSV; `*` или пустой default = без фильтра, все категории)
  - Дефолтный лимит по каждому типу — `100` (было `24`); по умолчанию gallery rewrite **без** category-фильтра (раньше whitelist `brand,consultations,…` отбрасывал часть медиа).
  - Image prompt policy (2026-07-16, updated 2026-09-15): slots and entity images build **visual-only** prompts — no `brand:` / `title:` / site name and no card titles in the positive prompt. Names are scrubbed from descriptions. Cyrillic in topic/blueprint is stripped before Comfy. Example quotes (`"Brand Name"`) are **forbidden** in guard text. On-image lettering is allowed **only** as an ASCII English wordmark in quotes (for example `"Plasma Studio"`). **Stills graph (2026-09-15):** Site Studio / ImperorG use `site_studio_photo` — Flux.2 Klein 4B distilled on command-center Comfy (`~/podryad/`, RTX 3090), `host/comfyui/site_studio_photo.json`. Slot aspects are kept (hero 1600×896, portraits 1200×1600). `01_top` / z-image-turbo remains Image Studio / EWRP only and stays native **1024×1024**. Klein distilled also zeros negative CLIP (`ConditioningZeroOut`); anti-text lives on the positive prompt (`ugs/z_image_prompt.py`).
- Товары в `olenti`: поле `category` ранее не отправлялось в PATCH в entity-rewrite:
  - Каноническая фиксация (2026-05-27): `ImperorGService._rewrite_products` нормализует `category` в enum (`perfumes|ingredients|accessories`) и отправляет обновлённое значение в patch, если оно изменилось.
- `502` на публичном `https://{slug}-site.eliteew.ru` при working runtime контейнерах:
  - Симптом: edge не достучался до prod-core gateway `:29000` (Meet WG primary `10.77.77.2:29000`, или SSH reserve `-R 29000` если mode=`ssh`).
  - Частая причина на reserve path: reverse SSH требует loopback-listener на prod-core; если `API_BIND_ADDRESS` не `127.0.0.1`, туннель не подключается. На primary WG path сначала проверить `eliteew-wg-tcp-proxy@29000` / backhaul mode — [WG-HTTP-BACKHAUL-PRIMARY.md](../platform/docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md).
  - Фикс (reserve/local): `API_BIND_ADDRESS=127.0.0.1` + recreate stack0 API/worker на **prod-core** (не build host). Living release: `bash docker/scripts/eliteew-deploy.sh release stack0 --all` с command-center.
  - Smoke: `curl -k https://{slug}-site.eliteew.ru` должен вернуть `200` (не `*.sites.eliteew.ru` / не `*.sites.empery.world`).

## User UX guided flow (2026-05-29)

Site Studio теперь ведёт пользователя по единому маршруту `идея -> AI заполнение -> проверка черновиков -> запуск -> публикация` вместо разрозненных технических вкладок:

- frontend helper `siteStudioUserJourney.ts` выводит текущий stage (`setup`, `ai_fill`, `review`, `media`, `runtime`, `publish`, `live`, `blocked`), primary/secondary CTA, blocker copy и progress по шагам из `instance`, `health`, `drafts`, busy-state и apply reports;
- под header добавлен guided cockpit: next best action, progress strip, blocker/recovery text и aggregate apply summary;
- follow-up UI expansion: guided cockpit также показывает карточную `Карту запуска` / `Launch map` по шагам маршрута с порядковым номером, статусом, описанием и CTA для незавершённых этапов, чтобы пользователь видел весь путь без перехода в Setup checklist;
- follow-up setup layout fix: на вкладке `Setup` guided cockpit (`Карта запуска`) теперь рендерится внутри `#site-studio-panel-setup` как первый элемент того же scroll-flow, чтобы launch map и checklist не оказывались в разных flex/overflow областях и не сжимали друг друга;
- follow-up desktop window scroll fix: окно `UserSiteStudio` помечено как self-scroll приложение в `EnhancedWindow`, поэтому внешний desktop body больше не получает `overflow-auto` / `data-desktop-scroll`; прокрутка остаётся у внутренних вкладок Site Studio и не создаёт двойной scrollbar;
- follow-up tab scroll alignment: `Карта запуска` рендерится внутри scroll-контейнера каждой пользовательской вкладки (`Идея`, `Автозаполнение`, `Помощник`, `Черновики`, `Изображения`), поэтому все разделы прокручиваются одним flow так же, как вкладка `Идея`;
- follow-up apply review pass: если aggregate apply report содержит skipped/failed items, guided cockpit поднимает это в отдельный `DesktopProductStatusBanner` (`warning` или `danger`) с CTA обратно к проверке черновиков; частичный apply больше не прячется только в компактной строке прогресса;
- checklist в Setup стал кликабельными journey cards со статусами `done/current/blocked/next`, keyboard-reachable CTA и пользовательским copy без queue/UGS терминов;
- draft review стал явным: content cards показывают число блоков и review state, SEO cards показывают readiness title/description, image cards показывают slot target и apply state; partial/failed apply отображается как `Needs review`;
- follow-up draft UI expansion: раздел `Черновики` теперь начинается со `Сводки черновиков` / `Draft summary`, где видны counts по text drafts, SEO basics, visuals and applied drafts; summary reminds that site content changes only after explicit per-card apply;
- follow-up media UI expansion: вкладка `Изображения` теперь показывает `Сводку визуалов` / `Visual summary` with expected slots, generated drafts and applied visuals before generation slots and draft cards;
- follow-up slot UI expansion: each image generation slot now shows localized readiness (`draft ready` / `needs visual`) based on existing `slotId` draft matching, so the user sees which placements already have a candidate before generating again;
- follow-up image card expansion: generated image draft cards now expose localized visual details (size, placement and accessibility description) next to review state and prompt before the explicit apply action;
- follow-up draft/media localization pass: primary draft/media labels, apply CTAs, SEO labels, image prompt text and empty states moved to `siteStudio.json` RU/EN keys, so English UI no longer inherits Russian hardcoded copy in review/media surfaces.
- follow-up assistant/blueprint localization pass: assistant roles, quick actions, progress messages, Professional Worlds handoff notice/prompt and blueprint summary labels moved to `siteStudio.json` RU/EN keys; `UserSiteStudioApp` no longer carries hardcoded Cyrillic primary copy.
- follow-up auto-fill roadmap localization pass: the running phase badge in `ImperorGRoadmap` now uses RU/EN `siteStudio.json` copy instead of hardcoded Russian, and the component has the canonical frontend header.
- follow-up auto-fill recovery/error localization pass: built-in runner recovery/error states now store i18n keys (`errorMessageKey` / `recoveryHintKey`) while keeping raw string fallbacks for legacy persisted snapshots and server-provided errors.
- follow-up header route-progress pass: `SiteStudioHeader` now mirrors the existing guided journey model with compact `Route N/M` and `Next: <stage>` badges in the sticky status row, so the next step remains visible above the detailed cockpit.
- follow-up Site Manager drilldown job-error pass: lifecycle job cards now show `Last error` / `Последняя ошибка` as a localized warning label above raw job error text, so the failure reason is visually separated from regular metadata.
- follow-up Site Manager reconcile-signal pass: selected-site reconcile cards now show raw issue text inside a localized `Signal` / `Сигнал` warning block before severity/code/next-action chips, keeping operator diagnostics readable without hiding the original machine reason.
- follow-up runtime error-label pass: Site Studio runtime diagnostics now show last lifecycle job errors, domain binding errors, domain load/action failures and operator overview failures through the localized `Last error` / `Последняя ошибка` treatment instead of unlabeled raw lines.
- runtime panel начинает с user actions (`prepare/start`, publish/unpublish, open storefront, open Desktop admin), а stop/redeploy вынесены в дополнительный support block; operator details остаются вторичными. На publish-ready стадии guided cockpit показывает ручной переход в embedded admin до публикации, если admin shell доступен, чтобы пользователь мог проверить контент перед публичным запуском.
- follow-up runtime UI expansion: launch control теперь показывает `Готовность к запуску` / `Launch readiness` с четырьмя user-facing пунктами: content, launch, publication and management. Summary derives only from existing `drafts`, runtime guard, publication state and `canOpenAdminShell`; no new API contract is introduced.
- follow-up launch/runtime UI pass: runtime panel показывает единый счётчик готовности `N из 4` и следующий фокус запуска над readiness cards, а привязанные домены получили stepper `TXT -> маршрут -> TLS -> активен`, чтобы пользователь видел прогресс домена без чтения raw статусов.

Coverage: `siteStudioUserJourney.test.ts`, `SiteStudioJourneyComponents.test.tsx`, `SiteStudioDraftCard.test.tsx`.

Follow-up boot safety (2026-05-29):

- `UserSiteStudioApp` must render the create/recover workspace screen when `GET /api/v1/desktop/site-studio/instance` returns no instance. Hook creation must not read `instance.public_url` until `instance` is non-null.
- First-run copy uses user-facing wording (`сайт`, `описание`, `черновики`, `витрина`, `управление`) and avoids primary-screen leakage of `workspace`, `brief`, `runtime`, `storefront` and `apply-flow`.
- Existing-site assistant, draft review and image panels keep the same rule: visible labels say `помощник`, `структура сайта`, `черновик текста`, `SEO-черновик`, `изображения для сайта`, `задание для изображения`; raw labels such as `AI Quick Actions`, `Blueprint Snapshot`, `Apply To Site`, `Content Draft`, `SEO Draft`, `Image Draft`, `Prompt`, `Keywords` and `Suggestions` stay out of the primary UI.
- Regression coverage: `UserSiteStudioApp.nullInstance.test.tsx`.

## Site Manager user UX (2026-05-29)

Site Manager Ops больше не начинается с сырых операторских таблиц. Поверх существующих контрактов `/api/v1/desktop/site-manager/ops/*` добавлен пользовательский слой состояния сайтов:

- `siteManagerUserStatus.ts` собирает site cards из `instances`, lifecycle jobs, domain bindings, DNS outbox, reconcile entries и publish smoke results;
- каждая карточка сайта показывает понятный статус (`published`, `ready`, `domain_pending`, `launching`, `needs_attention`, `offline`) и одно primary action: открыть витрину, проверить публикацию, проверить домен, открыть восстановление, смотреть задачу или передать оператору;
- верх панели получил фильтры `all / needs attention / published / domains pending / jobs running`, чтобы оператор начинал с проблемных сайтов, а не с raw counters;
- domain/TLS блок теперь отображается как stepper `domain added -> TXT verified -> route ready -> TLS ready -> active`; operator actions (`mark route applied`, `mark TLS ready`) остаются явными и вторичными;
- recovery блок группирует активные задачи, failed jobs, reconcile issues и failed smoke results по сайту, объясняя “что происходит” и “почему сайт требует внимания” без необходимости читать raw outbox/reconcile;
- клиентская KIRS-страница получила простой next-step блок: доступ не открыт, сайт запускается, проверьте витрину или сайт согласован.
- follow-up safety pass: raw template/audit tables скрыты в `Operator details`, publish smoke после запуска показывает check-level детали прямо в site card, а operator mutations `route applied` / `TLS ready` требуют явного второго подтверждения перед API-вызовом.
- follow-up drilldown pass: каждая site card может открыть фокусную панель выбранного сайта с доменами, lifecycle jobs, последней publish smoke проверкой и audit events, чтобы оператор разбирал один сайт без перехода к raw таблицам.
- follow-up support handoff pass: selected-site drilldown умеет копировать компактное support summary (`site`, `scope/id`, runtime/publication state, domains, jobs, smoke checks, audit tail) для передачи в чат или тикет без ручного пересобирания фактов.
- follow-up issue digest pass: верх selected-site drilldown показывает отсортированный по severity digest сигналов (`runtime`, `job`, `domain`, `reconcile`, `smoke`), чтобы оператор видел причину внимания до чтения подробных секций и до копирования support summary.
- follow-up digest anchor pass: digest cards стали кликабельными и прокручивают к соответствующей секции selected-site drilldown (`domains`, `jobs`, `smoke`, `reconcile`); reconcile-сигналы теперь также видны внутри самого drilldown, а не только в общем recovery block.
- follow-up selection persistence pass: выбранная site card сохраняется в `sessionStorage` (`eliteew.siteManagerOps.selectedSiteKey.v1`) и восстанавливается после refresh/remount; если сайт исчез из overview, панель безопасно возвращается к первой доступной card.
- follow-up selected breadcrumb pass: над grid карточек показывается compact selected-site context (название, state, scope/slug/domain summary) и кнопка `Go to details`, чтобы оператор не терял выбранный сайт, пока drilldown находится ниже экрана.
- follow-up copy digest pass: selected-site drilldown получил отдельный `Copy signals` для короткого incident update; он копирует только severity-sorted issue digest без полного support summary.
- follow-up drilldown summary pass: selected-site drilldown now starts with a localized `Site at a glance` summary strip for domains, jobs, latest publish check and attention signals before the detailed sections.
- follow-up drilldown section density pass: drilldown section headers now show localized item-count badges (`Items: N`) for domains, jobs, publish smoke checks, state-review signals and audit events.
- follow-up drilldown domain pass: domain cards inside selected-site drilldown now show the same compact `added -> verified -> route -> TLS -> active` stepper as the global domain panel, scoped to the selected site.
- follow-up drilldown job pass: lifecycle job cards in selected-site drilldown now show localized chips for stage, updated time and attempt count instead of a single mixed meta line.
- follow-up drilldown smoke pass: publish smoke checks in selected-site drilldown now render as compact OK/Fail cards with severity and check key, rather than a flat message list.
- follow-up drilldown audit pass: audit event cards in selected-site drilldown now show localized target/time chips, preserving raw target ids while making event history easier to scan.
- follow-up drilldown reconcile pass: state-review signal cards in selected-site drilldown now show localized severity/code/next-action chips before the explicit repair confirmation action.
- follow-up support export localization pass: `Copy summary` и `Copy signals` используют i18n-подписи текущей локали для заголовков/секций (`site`, `jobs`, `signals`, empty-state), но сохраняют raw diagnostic ids/status/action keys (`scope/id`, job id, `publish/finished`, hostname, smoke key), чтобы текст был понятен оператору и пригоден для техподдержки.
- follow-up breadcrumb signal pass: compact selected-site context теперь показывает chip `Signals: N`, подсвеченный максимальной severity выбранного сайта, чтобы оператор видел нагрузку по сигналам без прокрутки к drilldown.
- follow-up breadcrumb signal action pass: если `Signals: N` больше нуля, chip в selected-site context становится кнопкой и прокручивает к первому разделу drilldown с проблемой (`domains`, `jobs`, `smoke` или `reconcile`).
- follow-up card signal pass: каждая site card показывает тот же `Signals: N` chip с tone по максимальной severity, чтобы оператор видел проблемность сайта ещё до выбора карточки.
- follow-up card signal action pass: `Signals: N` на site card стал кнопкой при наличии сигналов; клик выбирает сайт и после render выбранного drilldown прокручивает к первому проблемному разделу.
- follow-up card signal preview pass: site card с сигналами показывает короткий preview первого issue digest item (тип + detail), чтобы оператор видел причину внимания до выбора сайта.
- follow-up card copy pass: publication status inside site cards now uses localized visitor-facing labels (`open/closed to visitors`) instead of raw backend values like `open` / `closed`.
- follow-up card freshness pass: site cards now include a localized `Updated` metric from `instance.updated_at` alongside publication, domain and publish-check state, so operators can see stale rows before opening details.
- follow-up card meta pass: site card `scope / slug / status` summary now renders as localized compact chips instead of a single dotted metadata line.
- follow-up card action pass: each site card primary CTA now has a localized `Next action` label above the button, making the card's recommended step explicit.
- follow-up repair action pass: reconcile-сигналы в selected-site drilldown получили явное operator-действие `Mark failed` с подтверждением; действие вызывает существующий `POST /reconcile/{scope}/{id}/mark-failed`, пишет audit через backend и обновляет overview после мутации.
- follow-up lifecycle job repair pass: lifecycle jobs в selected-site drilldown получили явные `Retry job` для failed retryable runtime tasks и `Cancel job` для pending/running jobs; оба действия требуют подтверждения, идут через Site Manager Ops admin API, пишут audit и обновляют overview.
- follow-up signal semantics pass: card/breadcrumb `Signals: N`, top preview и jump считают только attention-сигналы (`warn`/`danger`), чтобы обычные `info` состояния вроде активной фоновой задачи не выглядели как проблема; полный selected-site digest по-прежнему показывает `info` для операторского контекста.
- overview scaling guard: `GET /desktop/site-manager/ops/overview` возвращает additive `overview_limits` (`limit`, `returned`, `truncated`) для jobs/domains/DNS outbox/instances/reconcile/audit; backend читает `limit + 1`, UI показывает operator notice при усечённых коллекциях, чтобы большие инсталляции не скрывали старые данные молча.
- UX masterplan closeout (2026-05-29): first-run Site Studio вынесен в отдельный presentational component, auto-fill completion shows pre-apply confidence counters, Site Manager cards gained persisted search/sort controls, severity no longer renders runtime errors / failed jobs / failed smoke as `ok`, and large estates can use read-only `GET /api/v1/desktop/site-manager/ops/instances?q=&scope=&status=&limit=&offset=` beyond the capped overview. Follow-up UI wiring: when `overview_limits.instances.truncated=true` and the operator enters a search query, Site Manager renders a separate server-side “search all sites” result block without mixing instance-only rows into repair/drilldown cards.
- follow-up error-state pass: top-level Site Manager Ops load/mutation errors now render through shared `DesktopProductStatusBanner` with `role="alert"` / assertive live-region semantics and a retry CTA, instead of a local red surface without a title.
- Browser smoke now covers both Site Manager click chains and a mock-friendly Site Studio guided journey. UX baseline audit one-shot soft-retired → `trash/` (inventory lives in this doc + Vitest/Playwright locks).

Coverage: `siteManagerUserStatus.test.ts`, `SiteManagerOpsPanel.test.tsx`, `siteManagerOps/__tests__/SiteManagerOpsPanel.atomization.contract.test.ts`.

## UX launch-control (Site Manager)

С 2026-05-26 runtime-кнопки в приложении «Менеджер сайтов» и связанных панелях КИРС приведены к более понятному пользовательскому языку:

- `Подготовить сайт` — бывший `Provision` (подготовка и проверка перед запуском).
- `Запустить сайт` — бывший `Start`.
- `Поставить на паузу` — бывший `Stop`.
- `Обновить сайт` — бывший `Redeploy` (перезапуск с подхватом последних изменений).
- `Закрыть сайт` / `Открыть сайт для посетителей` — управление публикацией витрины.
- `Открыть публичную витрину` и `Открыть админку (Desktop)` — отдельные действия с подробными tooltip на простом языке.

Follow-up (2026-05-27): в основной панели Site Studio (`features/site-studio/desktop/components/SiteStudioRuntimePanel.tsx`) добавлены те же runtime-guardrails, что и в KIRS:

- централизованный расчёт доступности действий в `siteStudioRuntimeGuards.ts` (`provision/start/stop/redeploy/publish`);
- action-state учитывает `busy` + pending статусы (`provisioning|starting|redeploying|stopping`) + фактический runtime-state;
- disabled tooltip теперь объясняет причину блокировки (`busy`, `pending`, `already running`, `already stopped`, `needs running`), а не только общий action-hint;
- причины disabled дополнительно выводятся отдельным текстовым блоком «Почему часть действий недоступна» под launch-control кнопками (для touch/keyboard сценариев без hover);
- вывод причин вынесен в общий Desktop-компонент `pages/Desktop/components/RuntimeDisabledActionsHintCard.tsx` и переиспользуется также в КИРС;
- одинаковые причины автоматически схлопываются в одну строку с перечислением действий (`A / B / C: причина`), чтобы в pending/busy состояниях не дублировать одинаковые подсказки;
- добавлен переключатель подробностей (`Show/Hide detailed list`) для раскрытия причин отдельно по каждому действию при необходимости операторской диагностики;
- в compact режиме кнопка показывает количество скрытых подробностей (`Show detailed list (N)`);
- для screen reader добавлены `aria-expanded` + `aria-controls` на toggle и details-region;
- состояние detail-toggle сохраняется в `sessionStorage` (ключ `siteStudio.runtimeDisabledReasons.showDetailed`) и восстанавливается в пределах текущей сессии браузера;
- если grouping временно исчезает (toggle скрывается), сохранённое expanded-состояние автоматически очищается, чтобы при повторном grouping не было «залипания» в detail-режиме;
- переключение detail-mode отправляет desktop telemetry-событие `runtime_disabled_reasons_toggle` (surface=`site_studio`) с агрегатами `raw/collapsed/hidden` для оценки частоты использования;
- поведение shared-карточки закреплено component-тестом `pages/Desktop/components/__tests__/RuntimeDisabledActionsHintCard.test.tsx` (toggle + grouped output + remount restore);
- блок причин помечен `aria-live="polite"` для доступного анонса изменений при смене runtime-state;
- summary и details рендерятся семантическими списками `ul/li`, чтобы навигация по причинам была корректной в ассистивных технологиях;
- details-блок сохраняет стабильный DOM-id в collapsed (`hidden`) состоянии, чтобы `aria-controls` toggle-кнопки всегда указывал на существующий элемент;
- details-блок реализован как `section` landmark и в expanded режиме читается как именованный `region` ("Per-action details");
- строки подсказок стилизованы как «action + reason»: action-prefix выделяется визуально, что ускоряет чтение в runtime-стрессе;
- заголовок карточки показывает компактный числовой индикатор количества сгруппированных причин, а details-panel выделен рамкой/фоном для чёткого визуального разделения режимов;
- grouped action-prefix (`A / B / C`) рендерится отдельными compact chips для более быстрого сканирования причин блокировки;
- при доступном подробном режиме header дополнительно показывает hidden-details индикатор (`+N`) рядом с grouped-count;
- grouped/hidden/details бейджи получили явные подписи (`Reasons`, `Hidden`, `Rows`) и локализованы для RU/EN runtime-panel;
- summary/details элементы оформлены как отдельные bordered rows внутри списков, что повышает плотность сканирования и уменьшает «слипание» длинных причин;
- в details-panel отображается отдельный row-count badge, чтобы объём подробного списка читался без прокрутки;
- при длинном списке причин summary/details переключаются в внутренний scroll-area, чтобы runtime-карточка оставалась компактной и не уводила launch-кнопки за экран;
- scroll-mode дополнен локализованными helper-подсказками и keyboard-focus для списков, чтобы оператор мог пролистывать длинные причины без мыши;
- для scroll-mode добавлены edge-индикаторы «More above / More below» (локализованы для RU/EN), чтобы быстро видеть наличие скрытых пунктов сверху/снизу и не терять контекст в длинных списках;
- в scroll-mode добавлены мягкие верхний/нижний fade-mask поверх списка причин: это усиливает визуальную навигацию без изменения логики guardrails;
- runtime-панель Site Studio использует усиленный preset fade-mask (`overflowFadeStrength="strong"`), чтобы длинные списки причин лучше читались в компактной operator-layout;
- runtime-панель Site Studio использует плотную раскладку строк карточки (`rowDensity="compact"`), чтобы уменьшить вертикальный шум в launch-control блоке;
- для compact-режима задан `scrollThreshold={5}`, чтобы внутренний скролл включался позже и не мешал чтению коротких групп причин;
- в scrollable details-режиме отображается компактный sticky-subheader (заголовок + count), который удерживает контекст списка во время прокрутки;
- detail-toggle карточки отправляет SR-only `aria-live` анонс состояния (expanded/collapsed), локализованный через `runtime.disabledActionsExpandedSr|CollapsedSr`;
- sticky-subheader в details-режиме получает мягкую динамическую тень, когда список уже прокручен вниз, чтобы лучше считывалась глубина длинного списка;
- SR-only анонс toggle использует plural-локализацию RU/EN (`one/few/many/other`) и проговаривает размер подробного списка с корректной грамматикой;
- grouped/hidden count-семантика в header вынесена в SR-only formatter callbacks и локализуется через plural-ключи (`runtime.disabledActionsGroupedCountSr*`, `runtime.disabledActionsHiddenCountSr*`);
- polling cadence и `Admin` gate в `UserSiteStudioApp.tsx` используют тот же helper `isSiteStudioPendingStatus`, чтобы избежать расхождения условий между кнопками и авто-refresh;
- добавлены unit-тесты `siteStudioRuntimeGuards.test.ts` (pending/running/stopped/busy/publish-toggle cases).

Цветовая семантика:

- подготовка/позитивные действия — акцент/зелёные оттенки;
- пауза/остановка — красный (danger);
- обновление — янтарный;
- переходы в витрину/админку — отдельные мягкие цвета (sky/violet).

## Изоляция runtime-сайтов

Текущее поведение (канон):

- каждый сайт живёт в своём compose-`default` сегменте (`db + api + frontend`) и не разделяет его с другими сайтами;
- дополнительно runtime подключается к `eliteew-shared` только как к служебному шлюзу для `Site Studio` API/worker (health-check, admin-session proxy, apply/sync операций);
- полное отключение runtime от общего служебного шлюза сейчас **неправильно**: сломает встроенную админку Desktop и автоматические проверки/синхронизацию.

Итог: изоляция данных и runtime между сайтами уже есть, а общий сетевой слой оставлен только для управляемого служебного доступа платформы.

## Entry points (code)

| Layer | Location |
|--------|----------|
| Desktop app shell | `shared/web/frontend/src/features/site-studio/desktop/UserSiteStudioApp.tsx` |
| Desktop tab panels | `UserSiteStudio{Setup,Ai,Content,Media}Tab.tsx` — `UserSiteStudioTabVm` (controller + view render helpers) |
| HTTP client | `shared/web/frontend/src/features/site-studio/desktop/api.ts` |
| Instance / health / proxy | `shared/api/routers/desktop_sites.py` |
| Lifecycle jobs / guardrails | `shared/api/services/site_studio_lifecycle_jobs.py`, `shared/api/services/site_studio_lifecycle_policy.py` |
| Shared admin proxy plumbing | `shared/api/services/site_studio_admin_proxy.py` |
| AI drafts / catalog / streams | `shared/api/routers/site_studio_ai.py` |

## API contours

1. **Instance** — `GET/PATCH/DELETE /api/v1/desktop/site-studio/instance*`, runtime actions `POST .../instance/provision|start|stop|redeploy`, publish/unpublish, health. Responses for actions include `queued`, `detail`, `job_id` and `worker_ready` (`SiteStudioActionResponse`).
2. **AI** — under `/api/v1/desktop/site-studio/ai/*` (catalog, drafts, streaming generation). **Canonical drafts** after load: `GET .../ai/drafts`; `brief_json` on the instance is a fallback until that request succeeds or if it fails (see comment in `refreshWorkspace` in `UserSiteStudioApp.tsx`).
3. **Proxy** — `/api/v1/desktop/site-studio/proxy/*` for applying drafts to the running site through the API when runtime is up; 409/502/503 are mapped to user-facing copy via `siteStudioUserError.ts`. Статика **`/uploads/...`** в разметке админки должна указывать на **origin публичной витрины** (`publicSiteUrl` / `instance.public_url`), иначе при подстановке только API-прокси `<img>` получает **401** (нет Bearer). Логика: `siteStudioProxy.ts` (`publicUploadsOrigin`, `setSiteStudioKirsProxyScope(..., publicUrl)`), `SiteStudioAdminShell` (`publicSiteUrl`), `getUploadedImageUrl`.
4. **Olenti catalog money/KPI (via proxy)** — server-authoritative on the site runtime (`site-templates/olenti/server`):
   - `POST /api/products/bulk-price` `{ ids, percentage }` — computes `max(0, round(price * (1 + percentage/100)))`; FE must not invent prices.
   - `GET /api/products/summary` — `totalProducts`, stock counts, `totalValue` (Σ price × stock).
   - `GET /api/admin/orders/summary` — status counts + `totalRevenue` over full order set (not client reduce of the loaded list).

## Public vs admin

- **Public storefront** — interim `{slug}-site.eliteew.ru` via edge → Meet WG → prod-core `:29000` (LAN/CoreDNS aliases may exist; see [INTERNAL-SITES-ACCESS.md](../platform/docker-re_doc/INTERNAL-SITES-ACCESS.md)). Legacy `*.sites.eliteew.ru` deferred; `*.sites.empery.world` not living.
- **Embedded admin** — only in Desktop on `app.eliteew.ru` (`Admin` tab + `SiteStudioAdminShell`), not on the public site URL. See **`product/desktop/DESKTOP-ONLY-NAV.md`**.
- **KIRS (project sites):** same embedded admin pattern via `/api/v1/desktop/kirs/projects/{project_id}/proxy/...` and вкладки в `KirsPage` / `KirsClientSite` — см. **`product/KIRS-SITE-CURATION.md`**.

## Frontend checks

From `shared/web/frontend`: `pnpm run typecheck`, `pnpm run build:react-compiler`, `pnpm run i18n:check`, `pnpm run test` (includes `siteStudioApi.contract.test.ts`).

**Магазин приложений (админ каталог):** при сохранении записи каталога PATCH отправляет только изменённые поля (`buildCatalogPatchPayload` в `pages/Desktop/services/desktopAdminApi.ts`), чтобы не повторно валидировать неизменённый `app_component` — иначе на бэкенде без актуального `KNOWN_DESKTOP_APP_COMPONENTS` ловился 422 у приложений КИРС.

## Olenti: шаблон → runtime → встроенная админка

### Нейтральный baseline (2026-05-27)

Шаблон `site-templates/olenti` приведён к **вертикально-нейтральной** витрине (без демо-парфюмерии / «Ольги»):

| Артефакт | Назначение |
|----------|------------|
| `server/template-baseline.json` | ~111 content blocks, consultations/masterclasses/gallery — нейтральные тексты |
| `server/products.json` | 6 demo SKU (`starter` / `signature`), категория по умолчанию `accessories` |
| `src/constants/productCollections.ts` | Метки коллекций `starter`/`signature` + legacy alias для старых runtime |
| `server/template-uploads/**` | WebP-placeholder'ы; копируются в runtime `/app/uploads` при первом `tsx:seed:template` |
| `site-templates/olenti/scripts/build-neutral-template-baseline.py` | Регенерация baseline/products/placeholder'ов |

**Site Studio runtime profile:** `olenti` / `allenti` используют overlay **`olenti-v1` / `allenti-v1`** (общий starter-профиль с `aurelia-v1`, подстановки `{brand}`, `{topic}`, `{admin_email}` на provision/start).

**AI / ImperorG:** content packs расширены (`trust_pack`, `formats_pack`, `catalog_section_pack`, `about_depth_pack`, `page_heroes_pack`); фазы пайплайна — `content_trust`, `content_formats`, `content_catalog`, `content_about_depth`, `content_page_heroes` (маппинг `_PHASE_TO_PACK` в `imperorg_service.py`). Image slots — 6 ключей (`home.hero.background`, `about.philosophy.ingredients`, `about.process.crafting`, …). Промпты ImperorG больше не требуют «анти-парфюмерии» — baseline уже нейтральный.

**Image generation:** ImperorG slots and entity stills use workflow **`site_studio_photo`** (Flux.2 Klein 4B distilled, `EmptyFlux2LatentImage` + `Flux2Scheduler` 4 / CFG 1 / euler). Prompt hygiene stays in `api/services/ugs/z_image_prompt.py` — positive `SITE_STUDIO_IMAGE_NO_TEXT_POSITIVE` (no example quotes), Cyrillic/text-bait scrub. Latent size is `snap_flux2_klein_latent` (multiples of 16), **not** z-image 1024². Negative `site_studio_image_negative_prompt()` remains for graphs with a live negative CLIP; Klein distilled zeros it (`ConditioningZeroOut`), so anti-text SoT is `_finalize_z_image_user_prompt`. On-image text is allowed **only** as an ASCII English wordmark (`"Plasma Studio"`), never Cyrillic and never `"Brand Name"`. Slot `promptGuidance` values stay distinct so the six frames do not collapse into one scene. EWRP / Image Studio keep `01_top`. Live Comfy copies: `~/podryad/stack2/comfyui-clean/user/default/workflows/site_studio_photo.json` (API) and `site_studio_photo_ui.json` (official Klein T2I subgraph, local fp8 unet).

**CMS section id:** блок на главной переименован **`aromatherapy` → `value_block`** (UI: «Блок ценности»). Для старых runtime-seed чтение поддерживает alias `aromatherapy` (фронт `contentSectionAliases`, API `/content/blocks`, миграция в `seed.template.ts`).

**Shop routes (olenti storefront):** канонические пути категорий — `/shop/catalog`, `/shop/materials`, `/shop/accessories` (`ROUTES.SHOP_CATALOG` и т.д.). Legacy bookmark'и `/shop/perfumes` и `/shop/ingredients` остаются как Route-alias в `App.tsx` / `App.public.tsx` (`LEGACY_SHOP_*`).

**Скрипт `site-templates/olenti/scripts/build-neutral-template-baseline.py`:** `--audit-all` (= `--audit-only` + `--audit-src`, оба аудита выполняются до exit); `--products` / `--force-products`, `--placeholders`, `--seed-content-cjs`, `--seed-gallery-cjs`.

**Operator smoke (neutral baseline, локально):**

```bash
python3 site-templates/olenti/scripts/build-neutral-template-baseline.py --audit-all
cd shared/api && PYTHONPATH=.. UV_PROJECT_ENVIRONMENT=../../.venv uv run python -m pytest \
  tests/test_olenti_products_baseline.py \
  tests/test_imperorg_content_phases.py \
  tests/test_site_studio_template_profiles.py \
  tests/test_site_studio_image_slots.py \
  tests/test_site_studio_runtime_preflight.py -q
olenti-neutral-baseline-smoke.sh *[absent — Site Studio smoke not in tree]*
docker/scripts/site-studio-runtime-preflight-smoke.sh   # worker warn + staging pytest
docker/scripts/site-studio-runtime-provision-smoke.sh --prepare-only   # staging без compose up (host CI)
docker/scripts/site-studio-runtime-provision-smoke.sh --full-provision   # E2E (лучше при running site-studio-worker)
cd shared/web/frontend && pnpm exec vitest run \
  src/features/site-studio/shared/utils/__tests__/contentSectionAliases.test.ts
```

`SITE_STUDIO_SMOKE_REQUIRE_WORKER=1` — preflight падает без `stack0-eliteew-site-studio-worker-prod`. `--full-provision` требует `ew_net_6211`, рабочий `podman-compose`, profile **`site-studio-worker`** (health-check с `ew_net_6211` — через worker или `docker/scripts/site-studio-provision-smoke-runner.sh`).

```bash
eectl --yes up --include stack0-backend --stack0-profiles site-studio-worker
bash docker/scripts/site-studio-runtime-provision-smoke.sh --full-provision
```

**Embedded admin mirror:** `features/site-studio/admin/content/contentHints.ts` — подсказки «Где на сайте» (sync с olenti); `ContentPage` использует `contentSectionCandidates()` для legacy `aromatherapy` → `value_block`.

### Presentations admin editor module map

Route entry остаётся `features/site-studio/admin/presentations/PresentationEditPage.tsx` (`export const PresentationEditPage`). Логика разложена под `presentationEdit/` (atomization Waves 1–5, parent ≤800 LOC):

| Module | Role |
|--------|------|
| `usePresentationEditorCompose.ts` | Orchestrator: state, sub-hooks, slide handlers |
| `usePresentationEditorDraft.ts` | localStorage draft load/save/clear |
| `usePresentationEditorHistory.ts` | Undo/redo stack |
| `usePresentationEditorAutoSave.ts` | Debounced server auto-save (existing decks) |
| `usePresentationEditorKeyboard.ts` | Global shortcuts (incl. legacy Arrow* key strings) |
| `usePresentationEditorSave.ts` | Manual save, image upload, duplicate presentation |
| `useOllentiTemplateBootstrap.ts` | Single source for ollenti/ollenti2 template init |
| `PresentationEditHeader.tsx` | Top bar: view, cancel, duplicate, save |
| `PresentationEditBasicInfoCard.tsx` | Title + format select |
| `PresentationEditSlidePreview.tsx` | Slide preview + fullscreen + CSS vars |
| `PresentationEditSlidesSidebar.tsx` | Slide list, search, DnD, undo/redo |
| `PresentationEditStatisticsPanel.tsx` | Deck + current-slide stats |
| `PresentationEditPublishingPanel.tsx` | Publish checkbox |
| `PresentationEditModals.tsx` | Confirm modals (duplicate, delete slide, empty save, remove image) |
| `PresentationEditSlideEditorChrome.tsx` + `PresentationEditSlideSettings*Tab.tsx` | Per-slide settings tabs (Wave 1–2) |
| `presentationEditorPresets.ts`, `ollentiPresentationTemplates.ts`, `presentationDomCssVars.ts`, `presentationEditorStats.ts` | Presets, templates, CSS helpers, stats (Wave 1–2) |

Contract test: `presentationEdit/__tests__/PresentationEditPage.atomization.contract.test.ts`.

После правок embedded admin (`features/site-studio/admin`, i18n): `cd shared/web/frontend && pnpm run build:react-compiler` и recreate stack0 frontend.

1. **Исходник шаблона** в монорепозитории: `site-templates/olenti` (исходники читаемы агентом; hard-block только `node_modules/`, `data/`, `public/uploads/` в `.cursorignore`). Зеркало логики в `host/runtime/user_site_studio/<instance>/source` после provision. Канон Express-роут контента: `server/src/routes/content.ts` — при правках контракта синхронизировать с шаблоном вручную или через копирование при обновлении образа.
2. **Живые данные** сайта — PostgreSQL в контейнере runtime (блоки/изображения контента и т.д.), не в EliteEW.
3. **EliteEW** показывает ту же админку (`features/site-studio/admin`), запросы к runtime идут через admin-session и прокси (`/api/v1/desktop/.../proxy/...` или КИРС `.../kirs/projects/{id}/proxy/...`).
4. **Runtime compose** (генерация в `site_studio_runtime_service.py`): только **db + api + frontend**; Redis в стеке olenti **не** поднимается. Очередь уведомлений и rate limit в шаблоне — **in-memory** (`RateLimiterMemory`, обработка jobs в процессе Node).

**Админка olenti (шаблон ↔ EliteEW):** общие примитивы шапки/секций — `AdminPageHeader`, `AdminSectionCard` в `site-templates/olenti/src/pages/admin/components/` и зеркалом в `shared/web/frontend/src/features/site-studio/admin/components/`. Demo product/presentation binaries **не** импортируются в Rollup graph: placeholder и template art — `public/site-studio-template-assets/` (см. `productImages.ts`, `ollentiPresentationTemplates.ts`). Полный demirror embedded admin (runtime-only iframe) — отдельная программа. После правок в шаблоне синхронизировать изменения во встроенную админку (`features/site-studio/admin`), чтобы Desktop и runtime не расходились.

### Шаблоны `allenti` и `aurelia`

- Оба ключа подключены как **olenti-совместимые** runtime-шаблоны: source/root может резолвиться в отдельный каталог, но при отсутствии отдельного tree используется olenti fallback.
- Для `aurelia` backend применяет стартовый профиль `aurelia-v1` при первом успешном runtime-цикле (`provision/start/redeploy`):
  - PATCH `admin/site-settings` (включая `defaultTheme`);
  - PUT `content/blocks/bulk` с готовым набором контента для hero/about/CTA;
  - фиксация статуса применения в `brief_json._site_template_profile`, чтобы не перезаписывать ручные правки на последующих стартах.

### `GET /content/structure` (admin UI)

Ответ помимо `pages[]` может включать:

- **`defaultExpandedSectionKeys`** — список ключей вида `` `${pageId}-${sectionId}` ``, какие секции развернуты по умолчанию в редакторе контента.
- У каждой **секции** (внутри `pages[].sections[]`) опционально **`whereOnSite`** — короткая подсказка «где на сайте» для оператора (раньше дублировалась на фронте).

Полная выгрузка дерева страниц/секций в БД (без правки кода шаблона) — возможное следующее поколение: отдельная таблица метаданных в runtime и тот же контракт API; текущая реализация задаёт структуру в коде роутера и обогащает ответ перед `res.json`.

## Полная сводка выполненной работы (май 2026)

Ниже — консолидированная документация по фактически выполненным изменениям в контуре **Менеджера сайтов / Site Studio**.

### 1) Runtime и инфраструктура (podman-first)

- Runtime Site Studio переведён на podman-контур с явным runtime-adapter (`docker|podman`) и приоритетом `podman`.
- Выделен профильный воркер `eliteew-site-studio-worker-prod` (profile `site-studio-worker`) с отдельным `QUEUE_WORKER_ALLOWED_QUEUE_KEYS=site_studio`.
- Lean image (`site-studio-worker.in`) **не** ставит `elasticsearch`. Импорт `business_intelligence` / `unified_content.processors` — **lazy** (`__getattr__`), иначе boot падал с `ModuleNotFoundError: elasticsearch` через цепочку `queue_handlers → site_studio → ContentStorage → DocumentProcessor → BI.__init__`.
- Контур безопасности жёстче:
  - в профильном воркере не используется `/var/run/docker.sock`;
  - для podman-контейнера используется user-level socket `/run/user/<uid>/podman/podman.sock`;
  - SELinux `label=disable` применяется только там, где это требуется для socket bind.
- Генератор runtime compose стабилизирован под `podman-compose`:
  - всегда объявляется `networks.default: {}` (фиксация ошибки `missing networks: default`);
  - сохраняется общий шлюз `eliteew-shared` для managed-доступа платформы.
- Для rootless Podman исправлены типовые сбои:
  - `npm EACCES` на bind mount (runtime path запускает `api/frontend` под `0:0` в podman path);
  - удаление runtime-папок с сдвинутыми uid/gid через `podman unshare rm -rf`.

### 2) Менеджер сайтов: UX/операторский контроль

- Runtime-кнопки приведены к операторскому языку: «Подготовить», «Запустить», «Поставить на паузу», «Обновить», «Открыть витрину», «Открыть админку».
- Внедрены runtime-guardrails:
  - действие блокируется не только по `busy`, но и по несоответствию state/pending;
  - оператор получает конкретную причину блокировки.
- Добавлена универсальная карточка причин блокировки (`RuntimeDisabledActionsHintCard`) с:
  - grouped-сводкой причин;
  - переключателем detailed/compact;
  - sticky/subscroll/overflow-подсказками;
  - screen-reader семантикой (`aria-live`, `aria-controls`, plural-aware labels);
  - telemetry-событием `runtime_disabled_reasons_toggle`.
- Поведение закреплено компонентными и unit-тестами (`RuntimeDisabledActionsHintCard`, runtime guards).

### 3) Шаблоны и стартовые профили

- Поддержка `olenti`, `allenti`, `aurelia` приведена к единому runtime-контуру.
- Для `aurelia` добавлен стартовый профиль `aurelia-v1`:
  - первичная запись `site-settings`;
  - первичная загрузка контент-блоков;
  - marker в `brief_json._site_template_profile`, чтобы не затирать ручные правки на следующих стартах.
- Встроенная админка Desktop и runtime-шаблон продолжают работать по одному контент-контракту (`/content/structure`, `/content/blocks`).

### 4) Надёжность ImperorG в контуре Site Studio

- Устранён каскад rollback/`MissingGreenlet` при AI contract-ошибках.
- Добавлены JSON repair/retry/hardening-проходы для генерации контента.
- Добавлен fallback для неполных batch-ответов (`full rewrite` добирает пропущенные блоки поштучно).
- Расширен image-этап: обновление не только контент-слотов, но и entity-карточек (`products`, `consultations`, `masterclasses`, `gallery`) + runtime-лимиты через env.

### 5) Инцидентный разбор (KIRS-host 503/404) и уроки для Site Manager

В ходе диагностики исторического хоста `kirs-41b1c202-site.sites.eliteew.ru` (legacy zone; living shape `{slug}-site.eliteew.ru`) зафиксирована цепочка:

1. Публичный хост отдавал `503 Site temporarily unavailable`.
2. В БД инстанс был в `starting` c пустыми `compose_*` метаданными.
3. Профильный `site-studio-worker` не был поднят, а общий `api-worker` не слушает очередь `site_studio`.
4. После запуска профильного воркера runtime успешно стартовал.
5. Затем отдельная queued-задача `site_studio_destroy` удалила инстанс, и хост перешёл в `404 Not Found` (инстанс отсутствует).

Операционный вывод:

- для любых runtime-действий Site Studio/KIRS профильный воркер `site-studio-worker` должен быть запущен;
- неожиданные `site_studio_destroy` нужно контролировать как отдельный риск (очередь/кнопки/операторские действия);
- `503` и `404` на `{slug}-site.eliteew.ru` (и на любом legacy Host, если ещё встречается) — это разные классы проблем и требуют разной диагностики.

### 6) Краткий runbook для оператора

1. Поднять backend + профильный `site-studio-worker`.
2. Создать/запустить инстанс из Site Manager.
3. Проверить в порядке:
   - `instance.status` и `publication_state` в API;
   - `api/health` и публичный URL;
   - логи `stack0-eliteew-site-studio-worker-prod`.
4. При `503`:
   - проверить наличие `compose_project_name`/`compose_file_path` в записи инстанса;
   - проверить, что профильный воркер действительно слушает `site_studio`.
5. При `404`:
   - проверить, существует ли запись инстанса (если удалена — требуется пересоздание).


## Runtime ownership and legacy migration

Runtime identity is `site-studio-u-<full instance UUID hex>` for personal sites and
`site-studio-p-<full instance UUID hex>` for project sites. Titles, public slugs and
short user UUID prefixes do not select runtime resources. New runtime directories
use that same immutable identity; public URLs remain unchanged.

Before preparing files or launching Compose, the manager checks saved project/path
metadata and records `.site-studio-owner.json` in the instance directory. The binding
contains instance UUID, owner UUID, scope, scope ID and canonical project name. It is
written before launch so failed provisioning can still be cleaned up when the DB has
not received successful runtime metadata. This file is trusted operator/API state;
uploaded content must never be allowed to replace it or the Compose files.

Every generated service and the default network has `ru.eliteew.site-studio.*` labels.
Lifecycle mutations verify the binding and inspect all matching Docker/Podman project
containers and the default network. Missing, foreign or ambiguous labels fail closed.
Stop/delete use inspected immutable resource IDs; delete no longer runs project-wide
`down --remove-orphans --volumes`. The shared external network is never removed.
Managed path symlinks and swapped persisted paths are rejected. A never-provisioned
draft performs no container operations. `preserve_runtime_data` retains the bound directory.
Operation locks live outside instance directories under `.locks`, so deletion cannot
unlink a held lock and create a second lock for the same instance.

Host autostart uses the same identity/binding/label checks and locks. It skips unbound
legacy Compose directories. Invalid or partial bindings are reported without preventing
other validated runtimes from starting; an invalid binding makes the command exit nonzero
after processing the remaining entries. Autostart no longer guesses a project from a slug
or performs unconditional recursive chown. Operator data restores must preserve appropriate
runtime file ownership.

### Offline inventory (no mutations)

Export both `user_site_instances` and `project_site_instances` with only these fields:
`id`, `user_id` (personal), `owner_user_id` and `marketing_project_id` (project),
`site_slug`, `compose_project_name`, `runtime_dir`, `compose_file_path`.
Use a JSON array; UUIDs are strings. Export a second JSON array of runtime resources:
`kind` (`container` or `network`), `id`, `name`, `labels`. Include both Docker/Podman
Compose project labels and `ru.eliteew.site-studio.*` labels. Do not export environment
variables, passwords or tokens. Collect the inventory from the actual runtime host only
when it is available; offline examples do not establish ownership of live resources.

```bash
python3 docker/scripts/site-studio-runtime-ownership.py inventory \
  --instances instances.json --resources resources.json > inventory.json
python3 docker/scripts/site-studio-runtime-ownership.py autostart \
  --root /absolute/runtime/root
```

`inventory` is read-only and lists each old/new identity, colliding DB records and exact
candidate resource IDs. Unknown resources remain in the top-level resource list. It never
authorizes automatic adoption. `autostart` without `--apply` performs read-only runtime
inspection (and creates lock files); it does not start, stop, remove or relabel resources.
The existing boot shell wrapper explicitly requests `--apply` for validated entries only.

### Controlled migration after inventory

1. Pause Site Studio lifecycle workers and legacy autostart while taking a consistent
   inventory of both DB tables and the runtime host. Close public/admin routing for
   ambiguous legacy bindings; their old persisted aliases may already overlap.
2. Treat duplicate project/path bindings, absent ownership labels and unclear mounts as
   blocked. Corroborate owner and instance using DB history, mounts and operator records.
   Never assign an ambiguous resource to whoever requests deletion or migration first.
3. For each independently verified instance, list exact container/network IDs and data
   paths in the reviewed migration record. Back up its PostgreSQL data and uploads before
   any teardown. Test restoration. No wildcard/project-wide cleanup is permitted.
4. Recreate under the immutable identity through the manager: an operator clears reviewed
   legacy runtime metadata, retains the instance/tenant IDs and public slug, and provisions
   the new runtime. Do not copy old unbound directories into the new location or forge a
   binding file to bypass the checks. Restore the verified database and uploads into the
   new owned runtime with the runtime stopped as appropriate for the restore method.
5. Validate personal and project sites, internal API aliases, public/admin routes, start,
   stop, redeploy and preserve-data delete. Then resume updated API/workers/autostart
   together. Retire only the individually verified old resource IDs under the reviewed plan.
6. On failure, stop the new runtime and retain data/backups for repair. Do not roll back
   to slug-derived project ownership or re-enable blind legacy cleanup.
