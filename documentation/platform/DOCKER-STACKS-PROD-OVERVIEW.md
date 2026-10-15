# Docker-стеки EliteEW: что обычно в прод-контуре

Дата: 2026-07-18

Краткая **одна страница** для ориентира по compose-стекам. **Текущий prod-расклад (workers, edge, hosts):** [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md). Детали деплоя и команд — [.cursor/rules/project-and-deploy.mdc](../../.cursor/rules/project-and-deploy.mdc) и [ELITEEW-RELEASE-CHECKLIST.md](ELITEEW-RELEASE-CHECKLIST.md).

> Runtime по умолчанию в операторском контуре — **Podman**. Команды ниже даны в podman-форме; `docker` допустим только как compatibility/исторический контекст.
>
> **Hosts:** public runtime = **prod-core `.111`**; builds/git/env/`llama-deep` = **command-center `.136`** (исторический alias «punisher» = `.136`); living ComfyUI `:31003` = **gpu141 `.141`**. DEWA/EWPower/EWC/EWGen — не living (→ `trash/`). Release: `bash docker/scripts/eliteew-deploy.sh release stack0 --all`. Hotfix Line B: `eliteew-deploy.sh hotfix stack0 …` (alias `eeprodline`).

## Активные стеки (типичный прод)

| Stack | Назначение | Ориентир по compose / env |
|-------|------------|---------------------------|
| **stack0** | `.111` prod-core: API (HTTP/WS), RabbitMQ worker, **E0 split Celery** — general (`short,maintenance,broadcast,ewa_reembed`), agentic (`ewa_agentic,ewa_agentic_step`), companion (`ewa_companion`), discussion (`desktop_discussion`) + **единственный** beat; frontend — отдельный split compose | `docker/stack/stack0_b.yml`, `docker/stack/stack0_b.prod-baked.override.yml`, `docker/stack/stack0_f.yml` |
| **stack1** | `.111` prod-core: PostgreSQL, Redis, RabbitMQ, Qdrant, SeaweedFS, ES, Chroma legacy | `docker/stack/stack1*.yml`, `docker/env_file/.env.stack1`. Qdrant: `QDRANT__TELEMETRY_DISABLED=true` (no outbound to `telemetry.qdrant.io`). **`stack1-chroma-code` retired** 2026-08-09 — exited orphan → `pod_stack1 Degraded`; prune: `bash docker/scripts/prod-core-cleanup-retired-stack1-chroma-code.sh` (data dir retained). |
| **stack2** | `.111` prod-core: только `llama-chat` (live 2026-06-15: `gemma-4-26B.gguf`); `.141`: remote embed/rerank/tool-router по LAN | `docker/stack/stack2.yml`, `docker/stack/stack2-llama-remote-embed-rerank.yml` |
| **stack4** | `.111` prod-core: Paperless / OCR / Tika / Gotenberg; build/pull на `.136`, runtime images на `.111` | `docker/stack/stack4.yml`, `docker/stack/stack4.prod-baked.override.yml` |
| **stack6** | `.111` prod-core: Keycloak (OIDC/SSO) + Postgres для realm `empery` | `docker/stack/stack6.yml`, `docker/env_file/.env.stack6` |
| **stack11** | `.111` prod-core: Jitsi Meet для внутренних видеозвонков EliteEW | `docker/stack/stack11.yml`, `docker/env_file/.env.stack11` |
| **stack12** | `.111` prod-core: Internal DNS (CoreDNS) для `*.sites.eliteew.ru` — без публичного forward | см. [INTERNAL-DNS.md](docker-re_doc/INTERNAL-DNS.md), [INTERNAL-SITES-ACCESS.md](docker-re_doc/INTERNAL-SITES-ACCESS.md) |
| **stack-mobile-release** | OTA nginx: manifest + APK из `local/binaries` (Android in-app updates) | `docker/stack/stack-mobile-release.yml`, [MOBILE-RELEASE-SERVER.md](docker-re_doc/MOBILE-RELEASE-SERVER.md) |
| **stack0-landing** | Standalone public landing `eliteew.ru` on `.111:29002`, not stack0 frontend compose | `shared/web/site_prod/run-podman-secure.sh` (image `local/eliteew-site-prod:secure`) |

Имена контейнеров на хосте часто с префиксом **`stack0-`**, **`stack1-`** и т.д. (см. `podman ps`).

### Часто активны, но зависят от сценария

| Stack | Назначение | Примечание |
|-------|------------|------------|
| **stack9** | Voice inference (Whisper / Silero v5 CIS GPU / optional F5·Cosy) | Prod-core autostart: `start-stack9-voice.sh` (`legacy-whisper` large-v3 + `legacy-silero`). Cosy/F5/Qwen — только по ТЗ (VRAM). |

## Выключено / вне контура без ТЗ оператора

| Stack | Статус |
|-------|--------|
| **stack3** | Центральная агрегация логов (VictoriaLogs) в описанном виде **не используется** — смотреть `podman logs` и `docker/logs/stack0/...` |
| **stack5** | SearXNG / Crawl4AI **сняты** (stack5 compose пуст). Legacy fallback при `SEARXNG_URL`; **prod web search** — [Yandex Search API](https://yandex.cloud/ru/services/search-api) через env `YANDEX_SEARCH_API_KEY` + `YANDEX_CLOUD_FOLDER_ID` (`WEB_SEARCH_PROVIDER=auto`). **Квота:** 50 бесплатных запросов/календарный месяц/пользователь (`WEB_SEARCH_MONTHLY_FREE_DEFAULT`), далее монеты (`users.web_search_coins`, 1 монета = 1 запрос); при `user_id + db` проверка quota идёт до provider call для любого provider, списание — только после non-empty results. Админка — вкладка «Магазин» пользователя, API `GET/PATCH /api/v1/desktop/admin/users/{id}/web-search-quota`. Миграция перед runtime deploy: `shared/api/migrations/applied/20260629_01_web_search_user_quota.sql`. |
| **stack666** / LAN HTTPS proxy | Soft-retired → `trash/` — не поднимать; публичный вход только edge + Meet WG / SSH reserve |
| **OpenVPN home stacks** | Soft-retired → `trash/`; home optional VPN на Keenetic = **WireGuard** (см. [KEENETIC-MIKROTIK-RUNBOOK.md](KEENETIC-MIKROTIK-RUNBOOK.md)). Public HTTP backhaul = Meet WG — [docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md](docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md) |

Инвариант подробнее: `project-and-deploy.mdc` (раздел про stack5 и веб-поиск).

## Логи и health

- Логи API: prod-core baked `podman logs stack0-eliteew-api-prod-baked` и/или eliteew-api.log *[runtime under docker/logs/stack0/eliteew-api-prod-baked/]*; legacy `.136` dev may still use `stack0-eliteew-api-prod`. Если `ELITEEW_LOG_FILE` не пишет (Permission denied в контейнере): `bash docker/scripts/fix-stack0-baked-logs-permissions.sh` (входит в `fix-docker-permissions-final.sh` §7c).
- Health после правок API: prod-core baked `podman exec stack0-eliteew-api-prod-baked curl -sf http://127.0.0.1:8000/api/health`; legacy `.136` dev uses the non-baked container.
- Раздельные backend image targets stack0 (`api`, `queue-worker` / `api-worker`, `site-studio-worker`, `celery-worker`, `celery-beat`) и политика constraints/lock: [STACK0-BACKEND-IMAGES.md](docker-re_doc/STACK0-BACKEND-IMAGES.md).
- Command-center baseline/acceptance со стороны `.136`: `bash docker/scripts/eliteew-migration-command-center.sh baseline` и `... acceptance`.

## Метаданные compose ↔ env

Проверка stack0 role materialize (не трогает SOPS / prod-core):

```bash
bash docker/scripts/stack0-env-materialize-roles.sh --check
bash docker/scripts/ewa-env-dsn-parity.sh
```

Шаблоны: `docker/env_file/.env.*.example` (per-stack templates) (включая `.env.stack9.example` для voice). Каталог образов: `docker/builders/` (не устаревший docker/build — SoT `docker/builders/`). Living map: `docker/env_file/README.md`.

## См. также

- Структура `docker/`: [docker-re_doc/DOCKER-DIR-STRUCTURE.md](docker-re_doc/DOCKER-DIR-STRUCTURE.md), команды сборки: [docker-re_doc/DOCKER-BUILD-COMMANDS.md](docker-re_doc/DOCKER-BUILD-COMMANDS.md).
- Public HTTP path: [docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md](docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md).
- Worklog journals retired — stub: [documentation/worklog/README.md](../worklog/README.md).
