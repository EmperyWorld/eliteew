# Docker bind mounts и SELinux (Fedora)

**Статус:** канон command-center / prod-core на Fedora Enforcing (Podman).

## Симптом

AVC: redis `append` AOF, celery `lock` `.__celery.lock`, api/nginx/postgres logs, coredns read `*.hosts`.

## Причина

MCS-категории на `container_file_t` (`s0:c1022,c1023`) **≠** категории процесса `container_t` (`s0:c236,c932`). Unix uid/gid могут быть верными.

## Долгосрочный fix (compose)

На сервисах stack1 / stack0 с bind `:z`:

```yaml
security_opt:
  - no-new-privileges:true
  - label=level:s0
```

Контейнер и relabel тома → **`container_t:s0`** / **`container_file_t:s0`** (без `:cNNN,cNNN`).

Файлы: `docker/stack/stack1.yml`, `stack0_b.yml`, `stack0_f.yml`.

## Операторский прогон (без sudo, через docker)

```bash
bash docker/scripts/fix-docker-selinux-labels.sh --restart
```

Порядок: `down` stack1+stack0 → `chcon -l s0` на `docker/data`, `docker/logs`, coredns → `up`.

**eec → 26** — то же.

## Не делать

- audit2allow для Monitoring/chromium из Troubleshooter
- `label=disable` на prod без worklog

## Проверка

```bash
docker inspect stack1-redis --format '{{.ProcessLabel}}'
ls -dZ docker/data/stack1/redis docker/logs/stack0/eliteew-celery-beat-prod
# оба container_*:s0 без категорий
```

См. `STACK0-BACKEND-IMAGES.md` §SELinux.
