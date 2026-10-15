# Сверка `docker/env_file/.env.stack0.backend` и `.env.stack1`

API (stack0) и воркеры используют сервисы stack1. Значения **одного и того же ресурса** должны совпадать.

## Сводка (проверяй при смене паролей)

| Параметр | Где задаётся | Примечание |
|----------|----------------|------------|
| `POSTGRES_*` | stack1 + stack0.backend | Хост в stack0: `stack1-postgres:5432` |
| `REDIS_PASSWORD` | stack1 + stack0.backend | Должен совпадать |
| `ELASTICSEARCH_USER` / `ELASTICSEARCH_PASSWORD` | stack1 + stack0.backend | Обычно пользователь `elastic` как в образе ES |
| `RABBITMQ_PASSWORD` | stack1 + stack0.backend | В stack0 ещё `RABBITMQ_USER=admin` для management |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | stack1 + stack0.backend + stack2 | Один набор ключей для всех клиентов S3 |
| `AWS_S3_ENDPOINT`, `S3_BUCKET`, `AWS_REGION` | stack0.backend | Endpoint: `http://stack1-seaweedfs:8333` изнутри Docker-сети |
| `S3_BUCKET_DEFAULT_ENCRYPTION` | опционально stack0.backend | Только SSE бакета в S3; при глюках SeaweedFS см. `.env.stack0.backend.example` |
| `ENCRYPTION_ENABLED`, `ENCRYPTION_MASTER_KEY` | stack0.backend | PII в БД; **не** из stack1 |

## SeaweedFS и ключи

- В **`stack1.yml` сервис `seaweedfs` пробрасывает** `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` из тех же `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`, что в `.env.stack1`. На **weed 3.64** шлюз может их не использовать (см. wiki; тогда по-прежнему важны `s3.config` / `weed shell`). На новых версиях и в режиме с env-учётными данными совпадение с API обязательно.
- По документации SeaweedFS, пока **не настроены** идентичности в конфиге S3, шлюз часто в режиме **Allow All** — клиентские ключи могут «приниматься» независимо от env контейнера.
- Как только включён **режим с обязательной аутентификацией** (`s3.config` / `s3.configure`), ключи **должны совпадать** с теми, что в `.env.stack0.backend` (и stack2, если он ходит в S3). Иначе — 403 / ошибки подписи.

## Запуск

```bash
docker compose -f docker/stack/stack1.yml --env-file docker/env_file/.env.stack1 up -d
docker compose -f docker/stack/stack0_b.yml --env-file docker/env_file/.env.stack0.backend up -d
```

После смены секретов в stack1 обнови те же значения в `.env.stack0.backend` (и при необходимости в `.env.stack2`).
