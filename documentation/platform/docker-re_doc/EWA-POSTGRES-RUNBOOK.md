# EWA platform Postgres — операторский runbook

Отдельный контур данных для **платформенной** оркестрации рабочего стола (**`shared/api/ewa_platform/`**, HTTP **`/api/v1/ewa/desktop-orchestration/*`**). Не смешивать с основным **`DATABASE_URL`** приложения EliteEW.

Историческое имя документа было `AMKA-POSTGRES-RUNBOOK` (alias retired → `trash/`).

Контекст major-upgrade окна 2026-06-19 (включая rollback-набор dumps + snapshots +
checksums): [PROD-DB-CONTOUR-UPGRADE-2026-06-19.md](PROD-DB-CONTOUR-UPGRADE-2026-06-19.md).

## Dev vs prod (краткий чеклист)

| Шаг | Dev / локально | Prod |
|-----|----------------|------|
| Поднять Postgres EWA | `docker compose -f docker/stack/stack-ewa-postgres.yml --env-file docker/env_file/.env.stack-ewa up -d` | То же на целевом хосте; сеть `ew_net_2847` должна быть создана заранее. |
| Переменные | Скопировать `docker/env_file/.env.stack-ewa.example` → `.env.stack-ewa`, задать пользователя/БД/пароль/порт. | Секреты из операторского vault; **не** коммитить. |
| DSN API | В env сервиса API (stack0): **`EWA_DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB`** — для Docker-сети хост контейнера EWA-PG обычно **`stack-ewa-postgres:5432`**. | Тот же ключ; хост — сервисное имя или LAN-адрес, согласованный с compose. |
| Подстановка compose | **`eliteew-api-prod`** в `stack0_b.yml`: блок **`env_file: ../env_file/.env.stack0.backend`** передаёт в контейнер **`EWA_DATABASE_URL`** и остальные **`EWA_*`** / **`ELITEEW_SELF_HTTP_*`**. В секцию **`environment`** эти ключи **не дублировать** (в т. ч. не ``EWA_DATABASE_URL=${…}`` и не ``EWA_ORCH_*=${…:-0}``): при парсинге compose подстановка ``${VAR:-дефолт}`` берётся из окружения **хоста**; пустой VAR **перебивает** значения из `env_file` дефолтами → в контейнере «пропадают» флаги оркестратора / companion, хотя они заданы в файле. **export** ``EWA_DATABASE_URL`` со сторонним хостом из `.env.stack-ewa` (часто `127.0.0.1`) в том же shell, где запускаете compose, по-прежнему опасен, если DSN снова пробросить в `environment`. Рекомендуемый запуск: ``docker compose -f docker/stack/stack0_b.yml --env-file docker/env_file/.env.stack0.backend …``. | Та же дисциплина в CI/скриптах деплоя. |
| Миграции / DDL | Выполнить SQL из **`shared/api/ewa_platform/migrations/`** **или** положиться на первый вызов `init_ewa_orchestration_schema` (идемпотентно). | Предпочтительно явное применение SQL при деплое; см. ниже. |
| Пул в приложении | При старте API создаётся **`app.state.ewa_orchestration_pool`** (или эквивалент), если **`EWA_DATABASE_URL`** задан и bootstrap прошёл успешно. | Проверить логи stack0 API на ошибки подключения asyncpg. |
| Без DSN | Каждый HTTP-request без пула получает **новое** in-memory хранилище (POST→SSE не связаны). Для связки без PG задайте **`app.state.ewa_orchestration_memory_stores`** (один общий экземпляр) — см. **`DESKTOP-ORCHESTRATION.md`**. | Для продакшена ожидается **наличие** **`EWA_DATABASE_URL`**. |

## Решение по пулу данных

EWA Postgres — отдельный контур данных, поэтому bootstrap сейчас создаёт отдельный asyncpg pool из **`EWA_DATABASE_URL`** в `app.state.ewa_orchestration_pool`, а не использует основной `DATABASE_URL` приложения. Это осознанное исключение из общего правила «общие инфраструктурные клиенты через DatabaseManager»: инвариант EWA важнее общей точки входа, пока `DatabaseManager` не получит отдельный именованный пул для EWA.

Операторская проверка режима доступна в ответе turn: `payload.persistence.store_kind` (`asyncpg`, `shared_memory`, `ephemeral_memory`) и `payload.persistence.persisted_across_requests`. В prod ожидается `asyncpg`.

## Миграции

Канон: **`shared/api/ewa_platform/migrations/README.md`**.

```bash
export EWA_DATABASE_URL='postgresql://USER:PASS@HOST:5432/DB'
./shared/api/ewa_platform/migrations/apply_ewa_migrations.sh
```

Если в базе остались legacy таблицы `amka_orchestration_*`, дополнительно примените **`applied/002_rename_legacy_amka_orchestration_tables.sql`** (скрипт выше подхватит файл автоматически).

Актуальный хвост миграций платформы: **`035_ewa_companion_chat_condense_min_messages.sql`**
(`EWA_COMPANION_CHAT_CONDENSE_MIN_MESSAGES` → **8**); ранее **`034`** prompt-block plane,
**`033`…`021`** (agentic/`parent_run_id`), **`019`** prod orchestrator profile. Каталог кода
`GENERATED_CATALOG` = **282** keys (admin `catalog_total`); live `ewa_platform_setting` row count
может быть выше (orphan/legacy rows). Полный хвост: [`DATABASE_TABLES_REGISTRY.md`](../../database/DATABASE_TABLES_REGISTRY.md),
[`EWA-PLATFORM-SETTINGS-DB.md`](../../product/ewa/EWA-PLATFORM-SETTINGS-DB.md).

**Пошаговый runbook для 018:** [`shared/api/ewa_platform/migrations/README.md`](../../../shared/api/ewa_platform/migrations/README.md) (§ Migration 018).

**Пошаговый runbook для 021:** тот же README (§ Migration 021).

**Prod-core `.111` — только 021** (из command-center, DSN не нужен; SQL с хоста `.136`):

```bash
cd /path/to/powered_by_emperyworld
set -a && source docker/env_file/.env.stack-ewa && set +a
ssh 192.168.1.111 "podman exec -i stack-ewa-postgres psql \
  -U \"${EWA_POSTGRES_USER}\" \
  -d \"${EWA_POSTGRES_DB}\" \
  -v ON_ERROR_STOP=1 \
  -f -" \
  < shared/api/ewa_platform/migrations/applied/021_ewa_companion_task_runs_parent_run_id.sql
```

Ожидаемый вывод psql: `ALTER TABLE`, `UPDATE` (число backfilled rows), `CREATE INDEX`. Полный хвост — `./shared/api/ewa_platform/migrations/apply_ewa_migrations.sh` с `EWA_DATABASE_URL` на prod tunnel/host.

**Диагностика схемы после pull / apply:**

```bash
./docker/scripts/ewa-platform-migrations-verify.sh
```

Успех: `[ewa-migrate-verify] PASS — schema + image settings present` (в т.ч. `OK column ewa_companion_task_runs.run_revision`). Колонка **`parent_run_id`** (**021**) — ручной spot-check SQL в migrations README § Migration 021 (verify script пока не проверяет 021).

Если на хосте нет `psql`, `apply_ewa_migrations.sh` делает fallback через `docker exec` в контейнер EWA Postgres (`stack-ewa-postgres`) и использует `EWA_DATABASE_URL` для разбора host/port/user/db. На Podman-only хостах для точечного **018** / **021** используйте `podman exec … psql -f -` — см. migrations README § Migration 018 / § Migration 021; на prod-core — `ssh 192.168.1.111 'podman exec …'` (§ выше).

## Пересоздание кластера на пустом томе (dev / осознанный сброс)

Все сессии оркестрации и строки companion в EWA-БД будут **удалены**.

1. Остановить сервис:
   `docker compose -f docker/stack/stack-ewa-postgres.yml --env-file docker/env_file/.env.stack-ewa down`
2. Удалить данные: каталог **`docker/data/ewa/postgresql/pgdata`** (или весь **`docker/data/ewa/postgresql`**, затем создать пустой с тем же владельцем, что и раньше на хосте — см. **`EWA_PG_UID`** в `.env.stack-ewa`).
3. Поднять снова:
   `docker compose -f docker/stack/stack-ewa-postgres.yml --env-file docker/env_file/.env.stack-ewa up -d`
   Дождаться **`healthy`** у контейнера (healthcheck в compose использует TCP **`127.0.0.1:5432`** внутри контейнера).
4. Применить миграции с хоста (DSN на **`127.0.0.1:${EWA_POSTGRES_HOST_PORT}`** из `.env.stack-ewa`):
   `export EWA_DATABASE_URL='postgresql://…'`
   `./shared/api/ewa_platform/migrations/apply_ewa_migrations.sh`
5. Убедиться, что в env API (stack0) **`EWA_DATABASE_URL`** указывает на **`stack-ewa-postgres:5432`** с **теми же** `USER` / `PASS` / `DB`, что и в `.env.stack-ewa`.
   `docker restart stack0-eliteew-api-prod` (и при необходимости воркеры Celery, если задействуют EWA DSN).

### Операторские скрипты (companion)

| Скрипт | Назначение |
|--------|------------|
| [`docker/scripts/eliteew-ewa-companion-clean-slate.sh`](../../../docker/scripts/eliteew-ewa-companion-clean-slate.sh) | Living clean-slate CLI с command-center (historical `dewa-ops` prefix — EliteEW helper): SSH на prod-core → Redis FLUSHALL, EWA Postgres schema recreate + migrations, Qdrant companion episodic, restart stack0 API/Celery. **Не** трогает stack1 users / EwaFile. DEWA/EWC mission UI for this op — **soft-retired → `trash/`**. |
| [`docker/scripts/ewa-companion-user-admin.sh`](../../../docker/scripts/ewa-companion-user-admin.sh) | `inventory` / `reset` / **`reset-all`** (PG per-user + Qdrant episodic recreate; preserve settings/prompt_blocks/catalog) / `set-trust`; `truncate-all-ewa` deprecated. |

Historical interactive wrappers `ewa-companion-clean-slate-interactive.sh` / `ewa-companion-seed-memory-interactive.sh` are **not** in living `docker/scripts/` (use `eliteew-ewa-companion-clean-slate.sh` + user-admin; seed via companion profile APIs / operator runbooks).

После clean slate: пользователи проходят FirstMeet заново; для архивов старых диалогов — seed script, режим **`episodic`** для смешанных экспортов (таблицы, «Арлика:» без чётких User:/Assistant:).


- Строка **`ewa_companion_profile`** для каждого principal **исчезает** — **`GET /api/v1/ewa/companion-profile`** отдаёт **404** `companion_profile_not_initialized`, пока пользователь снова не пройдёт **`POST …/companion-profile/initialize`** (экран FirstMeet в окне EWA).
- Окно EWA, **оставшееся открытым без F5**, должно само вернуться на FirstMeet при следующем **`reloadProfile`** или отправке сообщения (SPA сбрасывает stale `gate=ready`). Надёжнее всё же **переоткрыть окно EWA или обновить вкладку** после операторского wipe.
- Qdrant episodic collection companion и Redis-сессии приложения при полном clean slate сбрасываются отдельно (см. session summary wipe); это не восстанавливает профиль автоматически.
- **`EWA_COMPANION_VOICE_ENABLED`** после re-seed миграций по умолчанию **0** — голос включается в EWA Admin Settings или env + restart API.
- **`EWA_COMPANION_PLAN_ENABLED`** после re-seed миграций по умолчанию может вернуться в **0**; если нужен plan rail smoke, включить `ewa_platform_setting.value_text=1`, перезапустить API/Celery и прогнать `docker/scripts/ewa-companion-admin-smoke.sh --skip-pytest`.

## Dual-env parity (password / DSN)

EWA auth is a **two-file contract**:

| File | Keys |
|------|------|
| `docker/env_file/.env.stack-ewa` | `EWA_POSTGRES_USER`, `EWA_POSTGRES_PASSWORD`, `EWA_POSTGRES_DB` |
| `docker/env_file/.env.stack0.backend` | `EWA_DATABASE_URL=postgresql://USER:PASS@stack-ewa-postgres:5432/DB` |

`regenerate-env-secrets.py` does **not** rotate EWA. Changing only one file (or env-push after DSN edit without `ALTER USER` on an existing PG volume) causes API `InvalidPasswordError` while `pg_isready` still passes.

**Assert before push (command-center):**

```bash
bash docker/scripts/ewa-env-dsn-parity.sh
# also runs automatically inside:
bash docker/scripts/eliteew-prod-core-env-push.sh --validate-only
```

Script never prints the password. Exit non-zero on user/password/db mismatch.

**Rotate password on an existing volume (do not wipe first):**

1. Align both env files on `.136` (URL-encode special characters in the DSN).
2. Rebuild/encrypt SOPS bundle → `eliteew-prod-core-env-push.sh --yes`.
3. On `.111`, apply role password to the running cluster, then recreate stack0 API/workers:

```bash
# on prod-core after push (password from runtime tmpfs — do not log it)
set -a && source "$XDG_RUNTIME_DIR/eliteew/env-runtime/.env.stack-ewa" && set +a
podman exec stack-ewa-postgres psql -U "$EWA_POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "ALTER USER \"${EWA_POSTGRES_USER}\" PASSWORD '${EWA_POSTGRES_PASSWORD}';"
```

Wipe `docker/data/ewa/postgresql` only for intentional greenfield (backup first) — see §«Пересоздание кластера».

## Резервное копирование и восстановление

- **Том данных:** хост-путь **`docker/data/ewa/postgresql`** (маппится в контейнер на `/var/lib/postgresql/data`), см. `docker/stack/stack-ewa-postgres.yml`.
- **Минимальная процедура:** остановить контейнер **`stack-ewa-postgres`**, сделать снимок каталога тома (tar/rsync), поднять снова. Восстановление — замена тома из снимка при остановленном контейнере.
- Продуктовый контекст greenfield: **`product/amka-seed-album/EWA-PLATFORM-GREENFIELD.md`**.

## Наблюдаемость

Структурированные логи turn в **`shared/api/ewa_platform/desktop/runtime.py`**: строки с префиксом **`[STEP]`**, поля `correlation_id`, `session_id`, `store_kind`, `observation_kind`, `last_branch`, `last_intent_kind` — для разборов без центральной VictoriaLogs.

Агрегированный статус EWA Postgres (наличие DSN, открыт ли пул, опционально ``SELECT 1``) включён в тела **`GET /api/health`**, **`GET /api/v1/health`**, **`GET /api/v1/system-info`** и **`GET /api/database/health`** под ключом **`ewa_postgres`**. Опциональный лёгкий probe: **`EWA_HEALTH_PG_PROBE=1`** (по умолчанию выкл., чтобы не нагружать БД на каждом scrape). Ключ задаётся в **`docker/env_file/.env.stack0.backend`** (и шаблон **`.env.stack0.backend.example`**); в шаблоне строка закомментирована.

Если DSN задан, а ``app.state.ewa_orchestration_pool`` ещё ``None`` (гонка lifespan / worker), health path вызывает **`ensure_ewa_orchestration_pool`** (self-heal) прежде чем пометить EWA как ``down`` и снизить public ``{"ok": false}``.

## Checkpoint diagnostics

`stack-ewa-postgres` intentionally does **not** inherit the stack1 checkpoint overrides from `docker/stack/stack1.yml`; its compose command currently sets only `timezone` and `log_timezone`. Regular log lines like `checkpoint starting: time` every ~5 minutes follow the PostgreSQL default `checkpoint_timeout`. Write times in the single-digit or low-tens seconds are diagnostic noise unless they correlate with app latency, restart loops, connection backlog, or requested checkpoints.

For read-only diagnosis, use the database name from the container env instead of guessing it. Prod uses `EWA_POSTGRES_DB` (currently `ewa`); probing `ewa_platform` creates `FATAL: database "ewa_platform" does not exist` log noise and is not an app failure.

```bash
ssh 192.168.1.111 <<'EOF'
podman exec stack-ewa-postgres bash -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT num_timed, num_requested, restartpoints_timed, restartpoints_req FROM pg_stat_checkpointer;"'
EOF
```

Interpretation:

- **Normal:** `num_timed` grows, `num_requested` is flat or rare, `pg_stat_activity` has no backlog, container restart count stays `0`, and app health is stable.
- **Investigate tuning:** requested checkpoints grow repeatedly, logs warn that checkpoints are occurring too frequently, checkpoint write/sync time tracks user-visible latency, or WAL/disk growth is abnormal.
- **Runtime tuning path:** only after baseline evidence, add explicit compose `-c checkpoint_timeout=10min`, `-c checkpoint_completion_target=0.9`, and a justified `max_wal_size`; recreate/restart in a low-traffic window. Rollback is removing those `-c` overrides and recreating the container with the previous compose plus the current data volume.

## HTTP 503: структурированный `detail` (компаньон)

Эндпоинты **`/api/v1/ewa/companion-profile*`** и **`/api/v1/ewa/companion-chat/*`** при отсутствии пула EWA отвечают **503** с телом ошибки FastAPI вида **`{"detail":{"code":"…","message":"…"}}`** (не одна строка).

| `detail.code` | Когда | Что сделать оператору |
|---------------|--------|------------------------|
| **`ewa_database_url_unset`** | В процессе API не задан **`EWA_DATABASE_URL`** | Задать DSN в **`docker/env_file/.env.stack0.backend`**, убедиться что compose не затирает ключ из `environment`, перезапустить API. |
| **`ewa_orchestration_pool_unavailable`** | **`EWA_DATABASE_URL`** задан, но **`app.state.ewa_orchestration_pool`** всё ещё `None` | Логи старта stack0 API (asyncpg / schema init), доступность **`stack-ewa-postgres:5432`**, применение миграций EWA. |
| **`companion_chat_llm_disabled`** | Включён запрет HTTP LLM для чата: **`EWA_COMPANION_CHAT_USE_HTTP_LLM`** не truthy | Выставить **`EWA_COMPANION_CHAT_USE_HTTP_LLM=1`** (или снять явное `0`) и перезапустить API. |

Канон в коде: **`shared/api/ewa_platform/gateways/ewa_service_unavailable.py`**.

Compose в **`docker/stack/stack-ewa-postgres.yml`** в healthcheck задаёт строку **`CMD-SHELL`** с **`$$POSTGRES_USER`** / **`$$POSTGRES_DB`**: двойной **`$$`** нужен, чтобы переменные раскрывал **shell контейнера**, а не пустые подстановки с хоста при `docker compose up`.

## Связанные документы

- `shared/api/ewa_platform/docs/DESKTOP-ORCHESTRATION.md`
- `product/amka-seed-album/EWA-PLATFORM-GREENFIELD.md`
- `shared/api/ewa_platform/migrations/README.md`
