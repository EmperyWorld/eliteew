# stack-mobile-release — отдельный OTA-сервер Android APK

**Status:** living ops for MobileAndroid OTA nginx contour (dated intro 2026-05-27; topology SoT = [PRODUCTION-TOPOLOGY-STATE.md](../PRODUCTION-TOPOLOGY-STATE.md) §Current — OTA artifacts on **prod-core `.111`**, builds on **command-center `.136`**). In older prose **punisher** = historical alias for command-center.

Дата: 2026-05-27

Отдельный **Podman/Docker** стек с nginx для раздачи prod APK и JSON-манифеста версии. API (`/api/v1/mobile-app/overview`) читает манифест с release-сервера и отдаёт `version_code` / `version_name` клиенту; скачивание APK по-прежнему через API (`/api/v1/mobile-app/download`).

## Зачем отдельный контейнер

- Публикация нового APK (`publish`) **не требует** restart API — nginx отдаёт файлы из `local/binaries` напрямую.
- Единый источник правды для версии: `empery-mobile.manifest.json`.
- Локальный smoke на `127.0.0.1:29180`; внутри сети `ew_net_6211` — `http://stack-mobile-release`.

## Файлы

| Путь | Назначение |
|------|------------|
| `docker/stack/stack-mobile-release.yml` | compose: nginx `stack-mobile-release` |
| `docker/stack/mobile-release/nginx.conf` | `/health`, `/v1/manifest.json`, `/v1/empery-mobile.apk` |
| `docker/scripts/mobile-release-stack.sh` | `up` / `down` / `status` / `smoke` |
| `docker/scripts/serve-mobile-apk-tunnel.sh publish` | пишет APK + `.meta.json` + `empery-mobile.manifest.json` |
| `local/binaries/` | bind-mount в nginx и в API (`/app/mobile-release`) |

## Запуск

```bash
bash docker/scripts/mobile-release-stack.sh up
bash docker/scripts/serve-mobile-apk-tunnel.sh publish
bash docker/scripts/mobile-release-stack.sh smoke
curl -s http://127.0.0.1:29180/v1/manifest.json | python3 -m json.tool
```

Порт по умолчанию: **`127.0.0.1:29180`** (`MOBILE_RELEASE_BIND` в `.env.stack-mobile-release` при необходимости).

## API

- Env: **`MOBILE_RELEASE_BASE_URL=http://stack-mobile-release`** (default в `unified_config.py`).
- Модуль: `shared/api/services/mobile_release_manifest.py` — fetch `/v1/manifest.json`, fallback на sidecar `.meta.json` при недоступности nginx.
- Stack0 backend должен быть в сети **`ew_net_6211`** (как и release-контейнер).

## Манифест (`empery-mobile.manifest.json`)

Поля: `apk_available`, `apk_size_bytes`, `version_code`, `version_name`, `apk_name`, `published_at`, `sha256`.

Генерируется скриптом `publish` из Gradle `output-metadata.json` и SHA256 APK.

Валидация:

- `serve-mobile-apk-tunnel.sh publish` и `serve-mobile-apk-tunnel.sh status` проверяют, что manifest не пустой, `apk_available=true`, `version_code > 0`, `version_name` и `apk_name` заполнены, `apk_size_bytes` совпадает с `local/binaries/empery-mobile.apk`, а `sha256` совпадает с реальным файлом.
- `mobile-release-stack.sh status` и `mobile-release-stack.sh smoke` валидируют JSON, который отдаёт `http://127.0.0.1:29180/v1/manifest.json`.
- `mobile-apk-release-cycle.sh --smoke` считает битый manifest или недоступный `stack-mobile-release` ошибкой цикла; публичный `/mobile-app/` edge check остаётся warning-only.

## prod-core (.111) после миграции

Runtime `app.eliteew.ru` использует **prod-core**, не build-хост:

1. `local/binaries/` на **prod-core** — bind-mount в `stack-mobile-release` и API (`/app/mobile-release/`).
2. Publish на punisher/command-center **без rsync** не меняет версию для телефонов.
3. После rsync APK/meta/manifest: `podman compose -f docker/stack/stack-mobile-release.yml up -d --force-recreate` на prod-core.

Operator sync:

```bash
rsync -avz local/binaries/ prod-core:<repo>/local/binaries/
```

Канон: [MOBILE-ANDROID-GUIDELINES.md](../../product/mobile/MOBILE-ANDROID-GUIDELINES.md) + [MOBILE-ANDROID-RELEASE-RUNBOOK.md](../../product/mobile/MOBILE-ANDROID-RELEASE-RUNBOOK.md) (dated Glass UI wave one-shot → `trash/`).

## Проверка с телефона

1. Profile → **Обновления** → **Проверить**.
2. Ожидание: «Установлено: X (N) · Сервер: Y (M)» при расхождении версий.
3. Скачивание — через API (авторизация Keycloak), не напрямую с `:29180` (порт только localhost).

## См. также

- [ANDROID-DEVELOPER-HANDBOOK.md](../../product/mobile/ANDROID-DEVELOPER-HANDBOOK.md) — in-app updates
- [ANDROID-API-CONTRACTS.md](../../api/ANDROID-API-CONTRACTS.md) — HTTP контракт overview/download
