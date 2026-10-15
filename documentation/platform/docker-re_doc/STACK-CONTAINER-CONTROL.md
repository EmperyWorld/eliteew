# Stack Container Control (операторский контур)

Единый контур управления docker/podman-стеками EliteEW без `sudo` и без запуска контейнеров с `docker.sock`.

**Host roles (канон):** builds и release CLI — **command-center `.136`**; публичный runtime — **prod-core `.111`** ([PRODUCTION-TOPOLOGY-STATE.md](../PRODUCTION-TOPOLOGY-STATE.md)). Не путать: `punisher` в именах compose-profile — исторический label локальных воркеров на `.136`, не имя prod-хоста.

## Что в контуре

- `docker/scripts/eliteew-container-control.py` — основной модуль управления.
- `docker/scripts/stack-all-down.sh` — полный **упорядоченный** shutdown.
- `docker/scripts/stack-all-recreate.sh` — полный **упорядоченный** recreate (`down` -> `up --force-recreate`).
- `docker/scripts/eliteew-container-console.sh` — пользовательское интерактивное меню (wrapper над controller).
- `docker/scripts/eliteew-deploy.sh` — **канон** release/deploy (stack0 baked `release stack0 --all`, runtime, gates).
- `docker/scripts/eliteew-command-center.sh` — `.136` single pane: ComfyUI + migration baseline/acceptance/workload-smoke/reboot-gate.
- `docker/scripts/eliteew-migration-command-center.sh` — `.136` wrapper для baseline/smoke/workload-smoke/acceptance/reboot-gate/remote `eectl` на `.111/.141/.136`.
- `docker/scripts/eliteew-docker-aliases.sh` — функции из любой cwd; короткие имена **`eec`**, **`eectl`**, **`eesd`**, **`eesr`**, **`eecc`**. Legacy shell name **`eedeploy`** → тот же `eliteew-deploy.sh` (в runbooks предпочитать полный путь / `eliteew-deploy.sh`).

## Запуск из любой директории

Скрипты сами находят корень монорепозитория по пути к файлу (`SCRIPT_DIR/../..`). Достаточно вызывать их **по абсолютному пути**, либо один раз подключить алиасы:

```bash
# В ~/.bashrc (подставьте свой путь к клону):
source /path/to/powered_by_emperyworld/docker/scripts/eliteew-docker-aliases.sh
```

Дальше из **любого** каталога:

| Команда | Назначение |
|--------|------------|
| `eliteew-console` / `eec` | интерактивная консоль |
| `eliteew-ctl` / `eectl` | `eliteew-container-control.py` с `--repo-root` |
| `eliteew-stack-down` / `eesd` | упорядоченный `down` |
| `eliteew-stack-recreate` / `eesr` | полный `recreate` |
| `eliteew-deploy.sh` (`eedeploy` = legacy alias) | канон `release stack0 --all` (и связанные subcommands) |
| `eliteew-command-center` / `eecc` | command-center `.136`: status/smoke/restart + baseline/acceptance/workload-smoke/reboot-gate |
| `eliteew-migration-command-center` / `eemigrate` | финальный migration control wrapper: baseline/smoke/workload-smoke/acceptance/reboot-gate, remote `eectl`, install user units |
| `eliteew-mobile-apk-release` / `eemobile` | mobile APK: build → edge OTA → 7z TG → web /mobile-app/ |
| `eliteew-stack0-recreate-local` / `ees0` | force-recreate stack0 + локальные воркеры (`punisher-local-workers,site-studio-worker`) |
| `eliteew-conn-audit` / `eeconn` | интерактивный аудит сетевых соединений |
| `eliteew-user-logins-audit` / `eelogin` | интерактивный аудит входов (Keycloak LOGIN + API), период 1/3/6/12/24 ч |
| `eliteew-up-back-backup` / `eebackup` | несжатый `.tar` монорепо → `/up_back/powered_by_emperyworld-YYYY-MM-DD_HH-MM-SS.tar` (без `docker/data`; AI weights — `/home/owned/models` вне архива; `shared/api/models/` ORM в архиве) |
| `eliteew-up-back-full-backup` / `eebackupfull` | **полный** несжатый `.tar` без исключений → `/up_back/powered_by_emperyworld-full-YYYY-MM-DD_HH-MM-SS.tar` (`tar --same-owner`, **root:root**, **chmod 600**; ~90+ GiB) |

Короткие имена — это **функции** (не `alias`): так они надёжно работают и в одной команде вида `bash -c 'source …/eliteew-docker-aliases.sh && eectl status'`. Полный список после `source`: команда **`???`** в shell.

Примеры:

```bash
eectl --color always status
# Глобальные флаги (--yes, --include, --exclude, …) — до или после subcommand; controller нормализует порядок
eectl --yes recreate --include stack0-backend,stack0-frontend
eectl --yes --include stack0-backend,stack0-frontend recreate
# ``stop --timeout`` при down/recreate: по умолчанию **10 с**, максимум **10 с** (`--timeout`, `eliteew-container-control.py`)
bash docker/scripts/eliteew-deploy.sh release stack0 --all
# same-release OpenAPI pilots before SPA build (optional):
# bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --refresh-openapi-pilots
# eedeploy …  # только legacy alias; предпочитать eliteew-deploy.sh
bash docker/scripts/eliteew-command-center.sh smoke
bash docker/scripts/eliteew-migration-command-center.sh acceptance
bash docker/scripts/eliteew-migration-command-center.sh workload-smoke
bash docker/scripts/eliteew-migration-command-center.sh reboot-gate all
bash docker/scripts/eliteew-migration-command-center.sh rollback-plan
ees0   # stack0 local force-recreate
eec
eec mobile-apk --yes --all   # mobile release full cycle (или eemobile)
eemobile --yes --all
sudo eebackup              # бэкап монорепо в /up_back/ (см. scripts/backup-powered-by-emperyworld-to-up-back.sh)
sudo eebackup --dry-run
eebackupfull               # полный бэкап без исключений → /up_back/ (sudo; архив root:600)
sudo eebackupfull --analyze
```

Если клон лежит не там, откуда ожидается дерево относительно файла алиасов, задайте корень вручную **перед** `source`:

```bash
export POWERED_BY_EMPERYWORLD_ROOT=/correct/path/to/powered_by_emperyworld
source "$POWERED_BY_EMPERYWORLD_ROOT/docker/scripts/eliteew-docker-aliases.sh"
```

После `source` доступна переменная **`ELITEEW_MONOREPO_ROOT`**.

## Инварианты безопасности

- Скрипт по умолчанию **отказывается** работать от `root`.
- Скрипт не использует `sudo` и не монтирует `/var/run/docker.sock`.
- При `validate`/`doctor` выполняется security scan compose:
  - предупреждение по `privileged: true`;
  - предупреждение по `network_mode: host`;
  - риск по bind `docker.sock`.
- Проверки прав работают только с bind-путями из `docker compose config --format json`.

## Порядок полного цикла

### Остановка (`STOP_ORDER` — consumers → data)

Канон: `docker/scripts/eliteew-container-control.py`. stack666 / OpenVPN compose — **retired → `trash/`** (не в STOP/START order).

1. `meet-edge-wg`
2. `stack-yandex-tunnel`
3. `stack0-frontend`
4. `stack0-backend`
5. `stack11`
6. `stack9`
7. `stack4`
8. `stack6`
9. `stack2`
10. `stack12`
11. `stack-ewa-postgres`
12. `stack1`

### Запуск (`START_ORDER` — data → consumers)

1. `stack1`
2. `stack-ewa-postgres`
3. `stack12`
4. `stack2`
5. `stack6`
6. `stack4`
7. `stack9`
8. `stack11`
9. `stack0-backend`
10. `stack0-frontend`
11. `stack-yandex-tunnel`
12. `meet-edge-wg`

> Rootless Podman + `stack12`: хостовый порт `53` привилегированный и обычно недоступен для rootless bind.
> В `eec` (`eliteew-container-console.sh`) теперь выставляется safe-default
> `INTERNAL_DNS_HOST_PORT=8053`, если переменная не задана. Для нестандартного порта задайте
> `INTERNAL_DNS_HOST_PORT` явно перед `up/recreate`.
> На prod-core `.111` переменная `INTERNAL_DNS_BIND_ADDRESS` должна указывать на актуальный IP хоста
> (обычно `192.168.1.111`, либо `127.0.0.1` для local-only), иначе `stack12` не стартует с
> `bind: cannot assign requested address`.

## Major Upgrade Notes (validated 2026-06-19)

- Full upgrade report + rollback artifact map:
  [PROD-DB-CONTOUR-UPGRADE-2026-06-19.md](PROD-DB-CONTOUR-UPGRADE-2026-06-19.md)
- For DB major windows, baseline must explicitly prove
  `dumps + volume snapshots + SHA256 checksums` before recreate/cutover
  (no "blind upgrade" path).

- **Elasticsearch 8.x -> 9.x:** прямой jump с `8.11.x` на `9.x` не поддерживается. Нужен мост
  через `8.19.0+`, затем повторный recreate на `9.x`.
- **PostgreSQL 18 (alpine image):** при mount в `/var/lib/postgresql/data` обязательно задавайте
  `PGDATA=/var/lib/postgresql/data/pgdata` (или переводите mount на `/var/lib/postgresql` по
  каноничной схеме image entrypoint). Без этого контейнер циклически падает с ошибкой
  `in 18+, these Docker images are configured...`.
- **stack1-postgres после major restore:** для снижения checkpoint spikes валидирован baseline
  `checkpoint_timeout=10min`, `checkpoint_completion_target=0.9`, `max_wal_size=8GB` (через compose
  `command -c ...`). После dump/restore прогоняйте `vacuumdb --all --analyze-in-stages`.
- **stack0 frontend baked:** `start-prod-core-stacks.sh all` требует
  `STACK0_FRONTEND_BAKED_IMAGE` в runtime env (`/run/user/1000/eliteew/env-runtime/.env.stack0.backend`).
  Если переменная отсутствует, поднимайте frontend через baked override с явным env:
  `STACK0_FRONTEND_BAKED_IMAGE=<local_baked_tag> podman compose -f stack0_f.yml -f stack0_f.prod-baked.override.yml ... up -d`.
- **Redis (AOF everysec + RDB fallback):** для снижения `Asynchronous AOF fsync is taking too long`
  при сохранении durability, убирайте агрессивный `save 60 10000` и используйте минимум
  `save 900 1` + `save 300 10000`, плюс `latency-monitor-threshold 100`.
  Хостовый `vm.overcommit_memory=1` остаётся обязательным системным precheck (root-only).
  Валидированный patch-track на 2026-06-19: `redis:7.2.14-alpine`; ветку `8.x` не включать без
  отдельного регрессионного окна и проверки совместимости модулей.

## Базовые команды

Из корня репозитория:

```bash
python3 docker/scripts/eliteew-container-control.py validate
python3 docker/scripts/eliteew-container-control.py status
python3 docker/scripts/eliteew-container-control.py analyze
python3 docker/scripts/eliteew-container-control.py check-perms
python3 docker/scripts/eliteew-container-control.py doctor
```

## check-perms (bind mounts)

`check-perms` / пункт **5** в `eec` проверяет, что пути bind-mount из compose доступны **текущему пользователю хоста** (обычно deploy user, uid 1000).

| Уровень | Смысл | Влияет на exit code |
|---------|--------|---------------------|
| `[ok]` | read/write/exec достаточны для режима mount (ro/rw) | — |
| `[warn]` | том под `docker/data` или `docker/logs` **принадлежит UID сервиса** (postgres 999, prosody 101, …) — с хоста read/write не требуются | нет |
| `[fail]` | путь отсутствует или deploy user **должен** иметь доступ (логи/chroma/qdrant на 1000:1000, ro-конфиги репозитория) | да |

Типичные `[warn]` (не чинить через `chown 1000`):

- `docker/data/stack1/postgresql` — **700, uid 999** (Postgres в контейнере)
- postgresql.conf *[runtime under docker/data/stack1/postgresql/]* — «cannot verify path under …» (файл есть, хост не может stat внутри 700)
- `docker/data/stack6/keycloak-postgres`, `redis`, `rabbitmq`, prosody/jvb/jicofo config

Итоговая строка: `bind permission summary: N ok, M warn, K fail`.

Unit-тесты классификации (без Docker):

```bash
python3 docker/scripts/test_bind_mount_permissions.py -v
```


Lifecycle:

```bash
python3 docker/scripts/eliteew-container-control.py down
python3 docker/scripts/eliteew-container-control.py up
python3 docker/scripts/eliteew-container-control.py recreate
```

Shortcut-скрипты:

```bash
bash docker/scripts/stack-all-down.sh
bash docker/scripts/stack-all-recreate.sh
```

## Интерактивный режим

```bash
# Встроенное меню controller
python3 docker/scripts/eliteew-container-control.py interactive

# Пользовательская консоль-обёртка
bash docker/scripts/eliteew-container-console.sh
```

Меню включает:

- валидацию runtime/compose;
- статус стеков;
- анализ unhealthy/restart/exited и **stack0 completeness** (воркеры без API/frontend);
- проверку прав bind-директорий;
- ordered stop/start/recreate;
- **`list-stacks`** — нумерация запущенных managed-стеков; **`recreate-running`** — down+up `--force-recreate` только для них, с **`--skip-stack-num`**;
- общий `doctor`;
- быстрый запуск `fix-stack11-permissions.sh` (Prosody **101:102**), **`fix-stack1-permissions.sh`**, **`fix-docker-permissions-final.sh`**, SELinux `restorecon` для `docker/logs/stack0`, **stack0 local recreate** (как `ees0`);
- быстрый пункт `stack2 full up` (chat + embed + rerank) с профилем `local-stack2-embed-rerank` по умолчанию;
- переключение режима цвета (`auto` / `always` / `never`) и **post-up smoke** (API health + analyze).

Быстрый non-interactive эквивалент через wrapper:

```bash
bash docker/scripts/eliteew-container-console.sh \
  --include stack2 \
  --stack2-profiles local-stack2-embed-rerank \
  up
```

### Distributed command-center (`.111/.141/.136`)

Для финального переезда `.136` остаётся command-center. С него запускается:

```bash
bash docker/scripts/eliteew-migration-command-center.sh baseline
bash docker/scripts/eliteew-command-center.sh smoke
bash docker/scripts/eliteew-migration-command-center.sh workload-smoke
bash docker/scripts/eliteew-migration-command-center.sh reboot-gate all
bash docker/scripts/eliteew-migration-command-center.sh eectl prod-core analyze
bash docker/scripts/eliteew-migration-command-center.sh install-autostart prod-core
bash docker/scripts/eliteew-migration-command-center.sh acceptance
bash docker/scripts/eliteew-migration-command-center.sh rollback-plan
```

EWPower remote-hosts API mirror is **soft-retired → `trash/`** (not a living control plane). Use `eectl` / `eliteew-migration-command-center.sh` / `eliteew-command-center.sh` from command-center.

Canonical migration runbook: [../PROD-CORE-FINAL-CUTOVER-RUNBOOK.md](../PROD-CORE-FINAL-CUTOVER-RUNBOOK.md).

### stack0-backend profiles

**Prod-core `.111` (канон):** не использовать голый `eectl recreate stack0-*` без `stack0_*.prod-baked.override.yml`. Release — **`bash docker/scripts/eliteew-deploy.sh release stack0 --all`** с command-center (внутри: baked export → load → recreate). Runtime stack2/4 — **`eeprodruntime`**. См. [PROD-CORE-MIGRATION-BAKED-IMAGES.md](PROD-CORE-MIGRATION-BAKED-IMAGES.md).

По умолчанию controller на **command-center / local** поднимает `stack0-backend` с профилями `punisher-local-workers,site-studio-worker` (имя профиля историческое). На prod-core baked override/env должны обеспечивать **API + queue/celery workers + единственный celery-beat**; на `.136` не должно оставаться второго beat.

Переопределение:

```bash
eectl --stack0-profiles punisher-local-workers,site-studio-worker up --include stack0-backend
eectl --stack0-profiles "" up --include stack0-backend
```

Цветной вывод (по умолчанию **auto**: цвет только в TTY) применяется к командам **`status`**, **`analyze`**, а также к блокам статуса/анализа внутри **`doctor`**.

### Landing root-домена

`stack0-eliteew-landing` не является compose-сервисом stack0_f, но активный runtime всё равно должен быть в pod topology на **prod-core `.111:29002`**.
Канонический запуск на prod-core: `docker/scripts/prod-core-landing-start.sh` (также phase в `podman-autostart-prod-core.sh`). DEWA mission `landing-start` is **retired** with DEWA → `trash/`.
Полный деплой с command-center: `docker/scripts/eliteew-landing-deploy.sh --yes` (historical `dewa-ops` prefix — EliteEW helper; **podman build** `shared/web/site_prod` на `.136` → load на `.111` → recreate; image `local/eliteew-site-prod:secure`).
Локальная dev-сборка: `shared/web/site_prod/run-podman-secure.sh` создаёт
`pod_stack0-landing` с публикацией `127.0.0.1:29002:8080`. Проверка:

```bash
curl -sf http://127.0.0.1:29002/health
podman ps --format '{{.Names}}|{{.PodName}}' | awk -F'|' '$2=="" {print}'
```

Второй вывод должен быть пустым для активных runtime-контейнеров.

## Deploy (stack0 + runtime)

### Prod-core (публичный runtime на `.111`)

После правок на **command-center** — канон release / runtime:

```bash
bash docker/scripts/eliteew-deploy.sh release stack0 --all
# optional same-release FE OpenAPI types:
# bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --refresh-openapi-pilots
bash docker/scripts/eliteew-deploy.sh release runtime --yes --all --skip-build --tag prod-runtime-YYYYMMDD-HHMM
```

### Legacy command-center bind-mount (`.136`, не prod-core)

После `pnpm run build:react-compiler` — recreate stack0 локально; gpu141 remote inference отдельно:

```bash
eectl --yes recreate --include stack0-backend,stack0-frontend
bash docker/scripts/start-gpu141-embed-rerank.sh
bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --maintenance --notice-seconds 300
```

`--maintenance` на baked deploy пишет `shared/web/frontend/dist-build/maintenance-state.json`, показывает пользователям окно обслуживания, переводит фазы `warning → active → recovering → completed` и снижает retry/toast storm во время recreate.

Edge fallback для `app.eliteew.ru` доставляется через `bash docker/scripts/yandex-tunnel/deploy-nginx-app-to-vm.sh`: скрипт копирует `nginx-app-https.conf` и `eliteew-maintenance.html`, затем делает `nginx -t` и reload на VM.

Канон сценариев: **`FRONTEND-STALE-CHUNK-404.md`** §Оператору, **`USER-SAFE-RESTARTS-AND-MAINTENANCE.md`**, **`LAN-WORKERS-141.md`** §Скрипты.

## Standalone launcher (без eectl)

Если нужен один независимый entrypoint для запуска с нуля или полного force-recreate на Fedora/SELinux-хосте:

```bash
# legacy helper absent/retired from tree — prefer eliteew-deploy / prod-line:
# bash eliteew-standalone-runtime.sh full-up --yes
# (eliteew-standalone-runtime.sh not in tree as of 2026-09-30)
```

Скрипт сам чинит bind-права/SELinux labels, поднимает `stack2` с `local-stack2-embed-rerank`, `stack0` с `punisher-local-workers,site-studio-worker`, mobile OTA server, landing и yandex tunnel. Edge nginx deploy выполняется отдельной командой `edge-deploy` или явным флагом `--with-edge`. `gpu141` workers он не стартует.

> **Prod-core note:** для публичного runtime на `.111` канон — **baked / dev-bind** (`PROD-CORE-DEV-BIND-LINE.md`, `eliteew-deploy.sh release stack0 --all`). `eliteew-standalone-runtime.sh` — **absent from tree** (legacy single-host helper); not a prod-line replacement — use `eliteew-deploy.sh` / `PROD-CORE-DEV-BIND-LINE.md`.

## Производительность (2026-05)

- **`status` / `list` / `logs`**: один вызов `docker ps -a` вместо `docker compose ps` по каждому стеку; стек определяется по label `com.docker.compose.project`.
- **`validate` / `doctor`**: кэш `compose config` между проверками; **`--jobs N`** (по умолчанию **4**) — параллельный prefetch конфигов.
- **`logs-errors`**: строки из **stdout и stderr** контейнерного лога.
- **`analyze`**: учитывает **`--include` / `--exclude`** (как `status`).

## Полезные флаги

```bash
# Цвет: auto (по умолчанию), always, never
python3 docker/scripts/eliteew-container-control.py --color always status

# Параллельная проверка compose (быстрее validate/doctor)
python3 docker/scripts/eliteew-container-control.py --jobs 6 validate

# Пропустить подтверждение
python3 docker/scripts/eliteew-container-control.py --yes recreate

# Только часть стеков (--include/--exclude — глобальные флаги; допустимы до или после subcommand)
python3 docker/scripts/eliteew-container-control.py --include stack1,stack0-backend up
python3 docker/scripts/eliteew-container-control.py up --include stack1,stack0-backend

# Исключить стек
python3 docker/scripts/eliteew-container-control.py --exclude stack0-frontend down

# Сухой прогон
python3 docker/scripts/eliteew-container-control.py --dry-run --yes recreate

# Нумерация только запущенных managed-стеков (для выборочного recreate)
eec list-stacks
eectl list-stacks
eectl list-stacks --all   # все стеки с контейнерами, не только running

# Recreate down+up --force-recreate только для стеков, у которых сейчас есть running-контейнеры
eectl --yes recreate-running
eectl --yes recreate-running --skip-stack-num 2,5
eectl recreate-running --ask-skip   # показать список и спросить номера для исключения

# Профили для stack2/stack11
python3 docker/scripts/eliteew-container-control.py \
  --stack2-profiles local-stack2-embed-rerank,tei-cpu-embed \
  --stack11-profiles recording,collab \
  up

# Жёсткий режим: запрет локального unix endpoint Docker
python3 docker/scripts/eliteew-container-control.py \
  --require-nonlocal-endpoint \
  validate
```

## Замечания по доступу к Docker

- Скрипт использует `docker`/`docker compose` от текущего пользователя.

## Часовой пояс в логах контейнеров

**Канон EliteEW:** `TZ=Asia/Vladivostok` (+10, без DST) во всех compose-стеках и в PostgreSQL через `-c timezone=` / `-c log_timezone=` (см. `stack1.yml`, `stack6.yml`, `stack-ewa-postgres.yml`).

| Источник | Что показывает |
|----------|----------------|
| `docker logs --timestamps` | **UTC** (префикс `…Z`) — так пишет Docker, не приложение |
| Текст строки внутри лога (Keycloak, API, Postgres `+10`) | **Asia/Vladivostok** — ориентир для оператора |
| `eec` / `eectl logs-errors` | оба слоя: UTC-префикс + локальное время в теле строки |

Проверка TZ на хосте стека:

```bash
docker ps --format '{{.Names}}' | sort | while read c; do
  docker exec "$c" sh -c 'printf "%s TZ=%s date=%s\n" "'"$c"'" "${TZ:-<unset>}" "$(date +"%F %T %Z %z" 2>/dev/null || echo n/a)"' 2>/dev/null || echo "$c exec-fail"
done
```

Исключения: минимальные образы без `sh` (`stack12-internal-dns`); SeaweedFS/Go может писать UTC в своих логах несмотря на `TZ` (транзиент при старте filer — шум).

- Если endpoint контекста `unix:///var/run/docker.sock`, скрипт выводит предупреждение.
- Для жёсткой политики включите `--require-nonlocal-endpoint` (ошибка при локальном socket endpoint).
- Для более строгой модели без локального unix endpoint используйте docker context через SSH/TCP.
