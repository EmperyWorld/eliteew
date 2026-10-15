# SECRETS ROTATION & ENV FILES

## 1. Где хранятся секреты

**Prod-core Config Plane (Wave 4):** канон [`../PROD-CORE-CONFIG-PLANE.md`](../PROD-CORE-CONFIG-PLANE.md). Живые секреты редактируются на **command-center**; на prod-core — только runtime tmpfs после SOPS decrypt + push. Operator path: CLI `eliteew-prod-core-env-push.sh` / Config Plane runbooks (historical `dewa-ops` prefix — EliteEW helper). DEWA вкладка **Конфиг** — **soft-retired → `trash/`**, not living UI.

- Все живые секреты лежат в `docker/env_file`:
  - `.env.stack0.backend` — backend API (stack0).
  - `.env.stack1` — базы данных и кеш (Postgres, Redis, SeaweedFS, Elasticsearch, RabbitMQ).
  - `.env.stack2` — AI сервисы (llama-chat, ComfyUI и др.; Airflow снят).
  - `.env.stack3` — мониторинг (Grafana/Prometheus/Alertmanager) — **stack3 снят**, файл может остаться для истории.
  - `.env.stack6` — Keycloak.
  - `.env.stack7` — OAuth2 Proxy (admin/grafana/files/meet и др.).
  - `.env.stack8` — OAuth2 Proxy / audio services (если используется).
  - `.env.stack11` — Jitsi (Prosody/Jitsi Web/Jicofo/JVB/Jibri/Etherpad).
  - `.env.yandex-tunnel` (игнорируемый; пример `.env.yandex-tunnel.example`) — edge SSH / tunnel keys, см. `YANDEX-VM-SSH-TUNNEL.md`. Исторические имена env вне дерева (`rar_docker`) не канон.

Примеры для каждого стека:

- `.env.example` — общий.
- `.env.stack0.backend.example`, `.env.stack1.example`, `.env.stack2.example`,
  `.env.stack3.example`, `.env.stack4.example`, `.env.stack5.example`,
  `.env.stack6.example`, `.env.stack7.example`, `.env.stack8.example`,
  `.env.stack11.example`, `.env.yandex-tunnel.example` (reverse SSH к VM Yandex; живой `.env.yandex-tunnel` не коммитить).

## 2. Инструмент для массовой ротации

Используем `docker/scripts/regenerate-env-secrets.py`:

```bash
cd <repo>
python3 docker/scripts/regenerate-env-secrets.py
```

Скрипт:

- Генерирует **один** согласованный набор секретов (`POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `RABBITMQ_PASSWORD`, `MINIO_*`, `ELASTICSEARCH_PASSWORD`, Keycloak/Jitsi/Backend и др.).
- Обновляет значения во всех файлов:
  - `.env`
  - `.env.stack0.backend`
  - `.env.stack1`
  - `.env.stack2`
  - `.env.stack3` — **historical only** (stack3 / VictoriaLogs **not living**; may remain on disk)
  - `.env.stack6`
  - `.env.stack11`
  - `.env.stack7`, `.env.stack8` — только OAuth2 Proxy `*_CLIENT_SECRET` и `*_COOKIE_SECRET`.
- Ничего не меняет в `.env.*.example`.

После запуска **обязательно** перезапусти соответствующие стеки на **command-center / prod-core via Podman** (not Docker daemon). Prefer living wrappers (`eectl`, `eliteew-deploy.sh`, stack recreate) over raw compose; illustrative:

```bash
# stack1: БД/кеш (Podman)
podman compose -f docker/stack/stack1.yml --env-file docker/env_file/.env.stack1 up -d

# backend API — prefer stack0 Line A/B deploy from command-center for prod-core
podman compose -f docker/stack/stack0_b.yml --env-file docker/env_file/.env.stack0.backend up -d eliteew-api-prod

# AI (stack2)
podman compose -f docker/stack/stack2.yml --env-file docker/env_file/.env.stack2 up -d
# Эмбеддинги stack2: по умолчанию llama-embed (GGUF); альтернатива — tei-embed с профилем tei-cpu-embed — см. STACK2-LLM-CONTRACT.md

# Keycloak (stack6)
podman compose -f docker/stack/stack6.yml --env-file docker/env_file/.env.stack6 up -d

# Jitsi (stack11)
podman compose -f docker/stack/stack11.yml --env-file docker/env_file/.env.stack11 up -d
```

## 3. Чеклист ротации по сервисам

### 3.1. Stack1 (Postgres/Redis/SeaweedFS/Elasticsearch/RabbitMQ)

1. Остановить только зависимые кластеры (желательно сначала API и AI, затем Jitsi/Keycloak).
2. Запустить `regenerate-env-secrets.py`.
3. Перезапустить `stack/stack1.yml` с новым `.env.stack1`.
4. Перезапустить API, AI, monitoring, Jitsi — они возьмут новые пароли из своих env.

> Все пароли (`POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_*`, `ELASTICSEARCH_PASSWORD`, `RABBITMQ_PASSWORD`)
> синхронизируются между `.env.stack1`, backend, stack2, stack11 скриптом.
> **stack3** (VictoriaLogs/Grafana path) is **not living** — do not treat `.env.stack3` as a required sync target.

**Первый запуск stack1:** недостающая БД `etherpad` создаётся скриптом (БД `airflow` — legacy, Airflow снят)
`./docker/scripts/stack1-create-missing-dbs.sh` (после подъёма контейнера stack1-postgres).
**Миграции EliteEW** (схема БД `ai_services`) не применяются при `podman compose up` / stack recreate; применять отдельно:
`docker/scripts/apply-eliteew-migrations.sh` или точечно desktop-app-store-db-check.sh *[absent — historical ops helper]*.

### 3.1b. EWA Postgres (`stack-ewa-postgres`)

`regenerate-env-secrets.py` **does not** update `.env.stack-ewa` or `EWA_DATABASE_URL`.

Rotation must keep **both** files in lockstep, then `ALTER USER` on the existing data volume (same pattern as Keycloak DB):

1. Edit `docker/env_file/.env.stack-ewa` (`EWA_POSTGRES_PASSWORD`) and `docker/env_file/.env.stack0.backend` (`EWA_DATABASE_URL` with the same user/pass/db, host `stack-ewa-postgres`, URL-encoded password).
2. `bash docker/scripts/ewa-env-dsn-parity.sh` (must pass).
3. Rebuild SOPS bundle → `eliteew-prod-core-env-push.sh --yes` from command-center.
4. On prod-core: `ALTER USER … PASSWORD …` inside `stack-ewa-postgres` (see [EWA-POSTGRES-RUNBOOK.md](EWA-POSTGRES-RUNBOOK.md) §Dual-env parity).
5. Recreate stack0 API / Celery consumers so they reload `env_file`.

Do **not** wipe the EWA data volume to “fix” a password mismatch.

### 3.2. Keycloak (stack6)

1. Запустить `regenerate-env-secrets.py` — он сгенерит:
   - `KEYCLOAK_DB_PASSWORD`
   - `KEYCLOAK_ADMIN_PASSWORD`
   - `KEYCLOAK_CLIENT_SECRET`
2. ВНИМАНИЕ: пароль в БД нужно синхронизировать вручную (первый и единственный раз после ротации):

```bash
podman exec -it stack6-keycloak-postgres psql -U keycloak -d keycloak \
  -c "ALTER USER keycloak PASSWORD '<новый KEYCLOAK_DB_PASSWORD>'; "
```

3. Перезапустить `stack/stack6.yml` с новым `.env.stack6`.

**Пароль админ-консоли (admin.eliteew.ru):** `KEYCLOAK_ADMIN_PASSWORD` из .env применяется только при **первом** запуске Keycloak (когда master realm ещё не создан). После этого пароль хранится в БД Keycloak; смена значения в .env не обновляет его. Если вход в админку пишет «неверный пароль», восстановить доступ: `docker/scripts/keycloak-bootstrap-admin-recover.sh` (создаётся временный пользователь temp-admin с паролем из .env; после входа задать пароль пользователю admin и удалить temp-admin).

### 3.3. Jitsi (stack11)

1. После `regenerate-env-secrets.py` будут обновлены:
   - `JITSI_APP_SECRET`, `JITSI_JWT_SECRET`
   - `JICOFO_AUTH_PASSWORD`, `JVB_AUTH_PASSWORD`
   - `JIBRI_RECORDER_PASSWORD`, `JIBRI_XMPP_PASSWORD`
   - `ETHERPAD_ADMIN_PASSWORD`
2. Перезапустить `stack/stack11.yml` с новым `.env.stack11`.
3. Убедиться, что конфиги Prosody и веба используют те же значения (они читают их из env при старте).

### 3.4. OAuth2 Proxy (stack7/stack8)

1. `regenerate-env-secrets.py` обновит `*_CLIENT_SECRET` и `*_COOKIE_SECRET` в `.env.stack7` и `.env.stack8`.
2. Перезапустить `stack7-oauth2-proxy.yml` (и возможный `stack8-*.yml`), используя соответствующие env-файлы.

## 4. Ограничение доступа к docker/env_file

Рекомендации для хоста:

```bash
cd <repo>/docker
chmod 700 env_file
chmod 600 env_file/.env*
chown owned:owned env_file
```

- Не коммитить `docker/env_file/.env*` в git (уже в `.gitignore`, следить при добавлении новых).
- Для бэкапов использовать зашифрованный архив (например, `tar + gpg`), хранить отдельно от репозитория.

## 5. Рабочий процесс при изменении env

1. Вытащить текущие значения (при необходимости — `podman exec` и `psql`/`redis-cli`/`rabbitmqctl`).
2. Обновить env через `regenerate-env-secrets.py` или вручную в `.env.*`.
3. Перезапустить только те стеки, которые зависят от этих переменных.
4. Проверить health endpoint API и базовые сценарии (логин через Keycloak, работа Jitsi).
