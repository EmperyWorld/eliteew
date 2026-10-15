# Чеклист перед релизом EliteEW (stack0)

Краткий регламент для оператора и агентов перед выкладкой изменений в API, воркеры или статический фронт. Центральной агрегации логов (VictoriaLogs) в текущем контуре нет — ориентир: **`podman logs`** и файлы под **`docker/logs/stack0/<сервис>/`**.

**Канон деплоя:** сборка baked-образов на **command-center `.136`**, готовые контейнеры на **prod-core `.111`** — см. **`platform/docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md`**. На `.111` **нет** `pnpm build`, `podman build`, rebake.

## 0. Обязательные проверки до merge (CI parity)

Репозиторий: workflow **`.github/workflows/eliteew-pr-gate.yml`** (фронт `pnpm run check:release`, бэкенд `ruff` + `pytest` с `-m "not slow and not integration"`). Локально тот же контур: **`scripts/eliteew/validate-local.sh`**. Тесты с маркером **`integration`** — на runner со стеком или с `ELITEEW_VALIDATE_INTEGRATION=1` / `ELITEEW_VALIDATE_FULL=1`.

## 1. Логи и явные ошибки

На **prod-core** контейнеры `*-prod-baked`:

```bash
ssh prod-core 'podman logs --tail 200 stack0-eliteew-api-prod-baked 2>&1 | tail -80'
```

Локально (command-center `.136` dev/fallback): `stack0-eliteew-api-prod`. Исторический alias «punisher» в старых логах = `.136`.

## 2. После правок в API

### Prod-core (канон)

На **command-center** — **полный** stack0 release (API+SPA+workers; deploy id синхронизирован). **Запрещены** partial flags (`--frontend-only` / `--backend-only`) и мёртвое interactive menu `eedeploy`:

```bash
source docker/scripts/eliteew-docker-aliases.sh
bash docker/scripts/eliteew-deploy.sh release stack0 --all
# same-release FE OpenAPI types (optional):
# bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --refresh-openapi-pilots
# alias: eedeploy release stack0 --all
```

Hotfix без rebake: `bash docker/scripts/eliteew-deploy.sh hotfix stack0 sync` → `hotfix stack0 up-dev-bind --yes` (не замена release; alias `eeprodline`).

Smoke на prod-core выполняется скриптом; вручную:

```bash
ssh prod-core 'curl -sf http://127.0.0.1:29000/api/health'
```

При изменении публичных маршрутов — [`api/FE-BE-ALIGNMENT.md`](../api/FE-BE-ALIGNMENT.md). Для Android — [`ANDROID-API-CONTRACTS.md`](../api/ANDROID-API-CONTRACTS.md).

### Legacy bind-mount (command-center local, не prod-core)

```bash
podman restart stack0-eliteew-api-prod
podman exec stack0-eliteew-api-prod curl -sf http://127.0.0.1:8000/health
```

## 3. После правок в Celery

**Prod-core:** входит в `eliteew-deploy.sh release stack0 --all` (recreate **E0 split** Celery workers — general / agentic / companion / discussion — + single beat baked). Canon: [CELERY-BEAT-AND-QUEUES.md](CELERY-BEAT-AND-QUEUES.md).

**Legacy `.136` local:**

```bash
podman restart stack0-eliteew-celery-worker-prod \
  stack0-eliteew-celery-agentic-worker-prod \
  stack0-eliteew-celery-companion-worker-prod \
  stack0-eliteew-celery-discussion-worker-prod \
  stack0-eliteew-celery-beat-prod
```
## 4. Новые зависимости в образе бэкенда

**Prod-core:** пересборка base/thin baked на `.136` — полный release:

```bash
bash docker/scripts/eliteew-deploy.sh release stack0 --all
# смена requirements / api.lock: release auto-enables --rebuild-base when base
# BUILD_LOCK_HASH drifts or greenlet/sqlalchemy.asyncio is missing on eliteew-api:v3.
# Explicit: bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --rebuild-base
```

**Legacy `.136` local:** `podman compose … up -d --force-recreate` по `stack0_b.yml` (без baked override).

## 5. После правок во фронтенде

Из **command-center** — полный stack0 release (SPA+API deploy id синхронизированы). **Не** `--frontend-only`:

```bash
bash docker/scripts/eliteew-deploy.sh release stack0 --all
```

С maintenance-окном (перед disruptive recreate):

```bash
bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --maintenance --notice-seconds 300
# implementer: eliteew-stack0-baked-deploy.sh (historical name; EliteEW helper, not live DEWA)
```

Контракт: [`USER-SAFE-RESTARTS-AND-MAINTENANCE.md`](USER-SAFE-RESTARTS-AND-MAINTENANCE.md). Deploy id: [`docker-re_doc/FRONTEND-STALE-CHUNK-404.md`](docker-re_doc/FRONTEND-STALE-CHUNK-404.md).

## 5b. Cloud browser SPA на edge (app.eliteew.ru static)

**`release stack0 --all` не публикует статику на edge VM** — только prod-core `:29001`. Публичный браузерный shell (`/`, `/assets/*`, `app-build-version.txt`) обслуживается с диска edge (`/srv/eliteew/cloud-spa/current`), если активен cloud-spa vhost. API и Socket.IO по-прежнему проксируются на prod-core `:29000` через Meet WG.

После каждого stack0 release с новым `dist-build` — **отдельный шаг** с command-center (тот же `deploy_id`, что prod-core):

```bash
bash docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh --yes
bash docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh --verify-only
```

Первый cutover на media-split (один раз): `--enable-nginx`. После правок тяжёлых `public/` деревьев: `--force-media`. Rollback symlink: `--rollback --yes`.

Parity smoke:

```bash
curl -sfk https://app.eliteew.ru/app-build-version.txt
ssh 192.168.1.111 'curl -sf http://127.0.0.1:29001/app-build-version.txt'
# оба значения должны совпадать
```

Канон: [`CLOUD-SPA-EDGE-STATIC.md`](CLOUD-SPA-EDGE-STATIC.md).

## 6. stack2 / stack4 (runtime)

После смены образов llama-chat или stack4:

```bash
eeprodruntime --yes --all
```

## 6b. MusicForge (Студия песен) — после правок pipeline/config/UGS audio

Ownership + tokenized smoke (токен **обязателен**; без него smoke exit 1):

```bash
bash docker/scripts/music-forge-ownership-gate.sh
# JWT admin (SPA SSO helper):
# ELITEEW_TEST_USER_PASSWORD=… pnpm --dir shared/web/frontend exec node scripts/get-access-token-sso.mjs
MUSIC_FORGE_SMOKE_TOKEN="<admin JWT>" bash docker/scripts/music-forge-stack0-smoke.sh
```

Comfy audio SPOF (`.141:31003`):

```bash
curl -sf http://192.168.1.141:31003/system_stats >/dev/null
```

Canon: [`product/MUSIC-FORGE-APP.md`](../product/MUSIC-FORGE-APP.md) §Comfy SPOF · §Operator Smoke.

## 7. gpu141 remote inference

```bash
bash docker/scripts/start-gpu141-embed-rerank.sh
```

Deploy embed/rerank/tool-router на `.141` с command-center/local model source. Stack0 workers не должны жить на `.141` в текущем prod baseline.

## 8. Заглушки HTTP 501 / vision / voice

Снятие заглушек — **только после операторского ТЗ**; living backlog: [PRODUCT-AUDIT-STABILITY-BACKLOG.md](PRODUCT-AUDIT-STABILITY-BACKLOG.md) (dated `API-TODO-REGISTRY.md` → `trash/`).

## 9. Security / supply chain (перед prod)

- Dependabot / advisory — [`DEPENDENCY-GOVERNANCE.md`](DEPENDENCY-GOVERNANCE.md).
- Секреты — [`docker-re_doc/SECRETS-ROTATION.md`](docker-re_doc/SECRETS-ROTATION.md).
- CSP / nginx — [`FRONTEND-SECURITY-NGINX-STATIC.md`](FRONTEND-SECURITY-NGINX-STATIC.md).

## 10. Pack release (cloud vs org) — Wave 3

Канон матрицы: [`ELITEEW-PACK-LAYOUT.md`](ELITEEW-PACK-LAYOUT.md) §4. Session scope: [`eliteew-pack-layout.mdc`](../../.cursor/rules/eliteew-pack-layout.mdc).

| Contour | Include | Exclude | Command |
|---------|---------|---------|---------|
| **Shared** | stack0 API+SPA bake | — | `bash docker/scripts/eliteew-deploy.sh release stack0 --all` |
| **Cloud door** | Mobile APK/OTA (`pack-cloud/mobile/`) | Tauri Connection Agent | `eemobile --yes --all` |
| **Org door** | Connection Agent OTA (`pack-organization/connection-agent/`) | Mobile APK (не обязателен) | `bash scripts/eliteew/desktop-client-ota-release.sh` |

**Не смешивать** `eemobile` и `desktop-client-ota-release.sh` в одном job без `ELITEEW_PACK_ALLOW_CROSS_DOOR=1`.

Опционально пометить контур:

```bash
export ELITEEW_PACK_RELEASE=cloud   # forbids connection-agent OTA script
export ELITEEW_PACK_RELEASE=org     # forbids eemobile / mobile-apk-release-cycle
```

Pack stubs: [`pack-cloud/release/`](../../pack-cloud/release/) · [`pack-organization/release/`](../../pack-organization/release/).

## Связанные документы

- [`documentation/README.md`](../README.md)
- [`platform/docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md`](docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md)
- [`platform/ELITEEW-PACK-LAYOUT.md`](ELITEEW-PACK-LAYOUT.md)
- [`platform/CLOUD-SPA-EDGE-STATIC.md`](CLOUD-SPA-EDGE-STATIC.md)
- [`api/FE-BE-ALIGNMENT.md`](../api/FE-BE-ALIGNMENT.md)
- [`product/mobile/MOBILE-ANDROID-RELEASE-RUNBOOK.md`](../product/mobile/MOBILE-ANDROID-RELEASE-RUNBOOK.md)
- [`product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md`](../product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md)
