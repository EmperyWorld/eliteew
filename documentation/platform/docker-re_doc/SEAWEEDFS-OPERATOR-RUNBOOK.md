# SeaweedFS operator runbook (Unified Content)

**Статус:** канон (операторский).  
**Scope:** blob storage для `unified_content` (S3-compatible API через MinIO client в API). Env historically `minio_*`; контейнер **`stack1-seaweedfs`**.

Продуктовый контракт HTTP (404 vs 503) — [CONTENT-MANAGER.md](../../product/CONTENT-MANAGER.md) §download/thumbnail. Код backend — `shared/api/services/unified_content/storage_backends/minio_storage.py`.

---

## Architecture (кратко)

| Слой | Где правда |
|------|------------|
| Метаданные файла | Postgres `unified_content` (`file_path`, `thumbnail_path`, `storage_backend`) |
| Бинарные объекты | SeaweedFS bucket **`unified-content`**, ключ `{content_id}/{filename}` |
| API read path | `GET /api/v1/content/{id}/download`, `GET .../thumbnail` |

---

## Health checks

```bash
# Контейнер
docker ps --filter name=stack1-seaweedfs

# Из API-контейнера (S3 list buckets)
docker exec stack0-eliteew-api-prod python3 -c "
from minio import Minio
import os
host = os.environ.get('MINIO_HOST','stack1-seaweedfs')
port = os.environ.get('MINIO_PORT','8333')
c = Minio(f'{host}:{port}', access_key=os.environ['MINIO_ACCESS_KEY'],
          secret_key=os.environ['MINIO_SECRET_KEY'], secure=False)
print('buckets:', [b.name for b in c.list_buckets()])
"
```

---

## Orphan metadata (filer OK, chunk missing)

**Симптом:** API лог `SeaweedFS S3Error ... code=InternalError`; filer log:

```text
failed to stream content ... read chunk: http://...:8080/...: 404 Not Found
```

**Смысл:** в filer/S3 есть запись объекта, но volume chunk на backend отсутствует (orphan). API классифицирует `InternalError` как **повреждённый объект** → HTTP **404** для пользователя (не 503).

**Диагностика:**

```bash
CONTENT_ID="<uuid>"
docker exec stack0-eliteew-api-prod python3 <<PY
import os
from minio import Minio
cid = "$CONTENT_ID"
host = os.environ.get("MINIO_HOST","stack1-seaweedfs")
port = os.environ.get("MINIO_PORT","8333")
c = Minio(f"{host}:{port}", access_key=os.environ["MINIO_ACCESS_KEY"],
          secret_key=os.environ["MINIO_SECRET_KEY"], secure=False)
for key in [f"{cid}/thumbnail_{cid}.jpg", f"{cid}/ComfyUI_example.png"]:
    try:
        st = c.stat_object("unified-content", key)
        print("STAT OK", key, "size=", st.size)
        resp = c.get_object("unified-content", key, offset=0, length=1)
        resp.read(1)
        print("READ OK", key)
    except Exception as e:
        print("FAIL", key, type(e).__name__, e)
PY
```

**Операторские действия:**

1. Подтвердить, что Postgres row не soft-deleted (`deleted_at IS NULL`).
2. Если объект irreparable — перезалить файл (`POST replace-file`) или пометить контент недоступным; удалить orphan keys в Seaweed при необходимости (ops-only).
3. Для массового аудита — admin scan с `verify_object_readable()` (см. `minio_storage.py`).

---

## Transient errors (503)

S3 codes **`ServiceUnavailable`**, **`SlowDown`**, timeout-like → API **`SeaweedStorageUnavailableError`** → HTTP **503** «повторите позже».

**Действия:** проверить `docker logs stack1-seaweedfs`, restart filer/volume при повторяемых 503 без orphan pattern; проверить disk space на volume host.

---

## Volume capacity / «only -N volumes left» (KBSEW, bucket `eliteew`)

**Симптом:** S3 PUT в bucket **`eliteew`** → **500**; master log:

```text
volume grow request … failed: only -13 volumes left, not enough for 2
No writable volumes and no free volumes left for collection:eliteew
```

**Причина:** single-node `weed server` с дефолтным **`-volume.max=8`**, при этом на диске уже **>8** volume-файлов (`.dat`). Master считает `Free = Max - allocated` отрицательным → не может вырастить collection для нового bucket (KBSEW → `eliteew/kbsew/…`).

**Диагностика (prod-core `.111`):**

```bash
ssh 192.168.1.111 'podman exec stack1-seaweedfs wget -qO- http://127.0.0.1:9333/dir/status'
# смотреть Topology.Max, Topology.Free, Layouts[].collection / writables
ssh 192.168.1.111 'podman exec stack1-seaweedfs sh -c "echo collection.list | weed shell -master=127.0.0.1:9333"'
```

**Исправление (2026-07-01 prod):**

1. В `docker/stack/stack1.yml` для `seaweedfs` добавить **`-volume.max=64`** (или выше запас по числу `.dat` в `docker/data/stack1/seaweedfs/data`).
2. Recreate только `stack1-seaweedfs` (данные в bind-mount `/data` сохраняются):

```bash
cd <repo>
podman compose -f docker/stack/stack1.yml \
  --env-file /run/user/1000/eliteew/env-runtime/.env.stack1 \
  up -d seaweedfs --force-recreate
```

3. Smoke S3 write (из `stack-kbsew` или API-контейнера с `MINIO_*`):

```bash
# PUT + stat + remove в bucket eliteew, prefix kbsew/
```

После первого успешного PUT collection **`eliteew`** появляется в `collection.list` с writable volumes.

**Не путать:** bucket **`unified-content`** может быть здоров, пока **`eliteew`** сломан — KBSEW использует `MINIO_BUCKET=eliteew`.

---

## Env (stack0)

| Key | Назначение |
|-----|------------|
| `MINIO_HOST` / `MINIO_PORT` | S3 endpoint (often `stack1-seaweedfs:8333`) |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | S3 credentials |
| `S3_BUCKET` | default `unified-content` |

---

## Связанные документы

- [STORAGE-AND-VECTOR-TOPOLOGY.md](STORAGE-AND-VECTOR-TOPOLOGY.md)
- Historical `STACK1-POSTGRES-REMEDIATION-2026-07-11.md` (BYTEA migrate + soft-delete hard-purge) → `trash/`; living: this runbook + [STORAGE-AND-VECTOR-TOPOLOGY.md](STORAGE-AND-VECTOR-TOPOLOGY.md)
- [CONTENT-MANAGER.md](../../product/CONTENT-MANAGER.md)
- [PRODUCTION-TOPOLOGY-STATE.md](../PRODUCTION-TOPOLOGY-STATE.md)
