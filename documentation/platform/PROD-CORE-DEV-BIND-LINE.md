# Prod-core stack0 · dual line (baked A / dev-bind B)

**Статус:** операторский контур на command-center `.136`; prod-core `.111` читает NFS export read-only.
**Связанный канон baked:** [docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md](docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md)
**Топология:** [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md) §Current

---

## Зачем две линии

На prod-core публичный stack0 слушает **`:29000` (API)** и **`:29001` (SPA)**. Исторически единственный путь — **baked line (A)**: сборка образов на `.136`, `podman save → scp → load`, recreate без bind-mount кода.

**Dev-bind line (B)** — альтернатива для **быстрых hotfix** без полного rebake (~30–50 мин `--all`):

| | **A — baked** | **B — dev-bind** |
|---|---------------|------------------|
| Код API/SPA | Внутри образа `prod-baked-*` | NFS ro с `.136` поверх того же образа |
| Сборка на `.136` | `pnpm build` + `podman build` + export tar | `eeprodline sync` (rsync + опционально `pnpm build:react-compiler`) |
| Действия на `.111` | `podman load` + compose baked override | compose dev-bind override + bind `/mnt/eliteew-prod-line-export/…` |
| Типичное время выкладки | десятки минут | минуты (sync + recreate) |
| Риск | эталон prod release | оператор держит export в актуальном состоянии |

Линии **взаимоисключающие**: одни и те же `container_name` (`stack0-eliteew-*-prod-baked`) и порты. Одновременно активна только одна.

---

## Архитектура

```text
command-center (.136)                              prod-core (.111)
──────────────────────                             ────────────────
Git repo (источник правды для sync)

/srv/eliteew/prod-line-export/                     /mnt/eliteew-prod-line-export/  (NFSv4.2 ro)
  api/                  ─── rsync ───►               ▲ bind ro → /app/api
  apps/                                              ▲ bind ro → /app/apps
  documentation/                                      ▲ bind ro → /app/documentation
  frontend-dist/                                      ▲ bind ro → /usr/share/nginx/html
  manifest.json                                       (read-only через NFS)
  .prod-line-state.json

NFS export (/etc/exports.d/eliteew-prod-line.exports)
firewalld: tcp 111,2049,20048 с 192.168.1.111/32

podman compose:
  stack0_b.yml + stack0_b.dev-bind.override.yml
  stack0_f.yml + stack0_f.dev-bind.override.yml
  --env-file $ELITEEW_ENV_RUNTIME_DIR/.env.stack0.backend

Образы: STACK0_*_BAKED_IMAGE из runtime env (не «голые» :v3 — см. §Образы)
```

### Переменные окружения (defaults)

| Переменная | Default | Где |
|------------|---------|-----|
| `ELITEEW_PROD_LINE_EXPORT_ROOT` | `/srv/eliteew/prod-line-export` | `.136` staging |
| `ELITEEW_PROD_LINE_MOUNT` | `/mnt/eliteew-prod-line-export` | `.111` mountpoint |
| `ELITEEW_PROD_LINE_NFS_CLIENT` | `192.168.1.111(ro,sync,no_subtree_check,no_root_squash)` | exports.d |
| `DEWA_OPS_PROD_CORE_SSH` | `prod-core` | CLI с `.136`; alias → **`192.168.1.111`** (LAN). Former 2.5G `10.255.136.111` retired — [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md) §Current |
| `DEWA_OPS_REMOTE_REPO` | `<repo>` | путь репо на `.111` |

---

## Состояние и manifest (immutable provenance)

| Файл | Расположение | Смысл |
|------|--------------|-------|
| `deployment-manifest.json` | export root **+** `dist-build/` (при `--with-frontend-build`) | **Schema v1** — `monorepo.git_sha`, `deploy_id`, `manifest_sha256`, `artifacts.frontend_dist_sha256`, image tags |
| `manifest.json` | export root | `git_sha`, `deploy_id`, `sync_mode` — deploy provenance / line status |
| `.prod-line-state.json` | export root (виден на `.111` через NFS) | `active_line`: `baked` \| `dev-bind` |

**Line B gate (2026-07-05):** перед `eeprodline sync` вызывается `deploy-provenance-gate.sh --hotfix`. Dirty deploy source paths блокируют sync без `--acknowledge-dirty` (exit **42**). При `--with-frontend-build` дополнительно: `verify-app-build-id.mjs` + запись `deployment-manifest.json`.

**Line A vs B — источник правды на `.111`:**

| Active line | Authoritative verify |
|-------------|---------------------|
| **baked** | `curl :29001/deployment-manifest.json` + image labels |
| **dev-bind** | NFS `deployment-manifest.json` (и legacy `manifest.json`) + `:29001/app-build-version.txt` |

Проверка:

```bash
bash docker/scripts/eliteew-deploy.sh hotfix stack0 status
# alias implementer: eeprodline status
```

Контейнеры на dev-bind получают env **`ELITEEW_RUNTIME_LINE=dev-bind`** (на baked override эта переменная не выставляется).

---

## Одноразовая настройка хостов

### 1. Export на command-center (`.136`)

```bash
cd ~/powered_by_emperyworld
bash docker/scripts/eliteew-deploy.sh hotfix stack0 export-setup
# alias: eeprodline export-setup
```

Скрипт (через **sudo**):

1. `mkdir -p` + `chown` export root ( `/srv` требует root; дальше `sync` идёт от обычного пользователя).
2. Добавляет строку в `/etc/exports.d/eliteew-prod-line.exports`, `exportfs -ra`.
3. Вызывает **`prod-line-firewalld-command-center.sh`** — rich-rules для `.111` на tcp **111, 2049, 20048**.

Если mount на `.111` **таймаутится**, а `ping .136` OK — почти всегда firewalld на `.136`:

```bash
sudo bash docker/scripts/prod-line-firewalld-command-center.sh
# с .111: showmount -e 192.168.1.136
```

На `.136` уже есть NFS export для gpu141 (`generated_files` → `.141`); правила для `.111` — **отдельные**, только для prod-line path.

### 2. Mount на prod-core (`.111`)

Unit (имя файла с `\x2d` — требование systemd для путей с дефисами):

```bash
sudo tee /etc/systemd/system/mnt-eliteew\\x2dprod\\x2dline\\x2dexport.mount <<'EOF'
[Unit]
Description=EliteEW prod-line NFS export from command-center
After=network-online.target
Wants=network-online.target

[Mount]
What=192.168.1.136:/srv/eliteew/prod-line-export
Where=/mnt/eliteew-prod-line-export
Type=nfs
Options=ro,nfsvers=4.2,hard,timeo=600,retrans=2,_netdev

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now 'mnt-eliteew\x2dprod\x2dline\x2dexport.mount'
mountpoint /mnt/eliteew-prod-line-export
showmount -e 192.168.1.136
```

До первого `eeprodline sync` каталоги `api/`, `frontend-dist/` на mount могут быть пустыми — это нормально.

### 3. Deploy-tree на prod-core

Перед **первым** `up-dev-bind` на `.111` должны быть актуальные:

- `docker/stack/stack0_*.dev-bind.override.yml`
- `docker/scripts/prod-core-deploy-lib.sh` (функция `prod_core_deploy_recreate_stack0_dev_bind`)

`eeprodline up-dev-bind` **автоматически** вызывает `sync-prod-core-deploy-tree.sh` перед recreate. При ручной отладке:

```bash
bash docker/scripts/sync-prod-core-deploy-tree.sh prod-core <repo>
```

Полный `shared/api` и `dist-build` на `.111` **не** rsync'ятся (как и для baked) — код при dev-bind идёт через NFS.

---

## Операторские сценарии

User-facing CLI: **`bash docker/scripts/eliteew-deploy.sh hotfix stack0 …`**. Ниже также указан alias implementer `eeprodline` (после `source docker/scripts/eliteew-docker-aliases.sh`).

### Статус

```bash
bash docker/scripts/eliteew-deploy.sh hotfix stack0 status
# alias: eeprodline status
```

Read-only rollup in Unified Admin (**Platform ops** → Stack0 line) mirrors in-process `ELITEEW_RUNTIME_LINE` + deploy id — not a substitute for CLI status. Canon: `documentation/platform/docker-re_doc/ADMIN-PLATFORM-OPS.md`.

### Sync export (только `.136`)

```bash
# API + documentation + существующий dist-build
bash docker/scripts/eliteew-deploy.sh hotfix stack0 sync
# alias: eeprodline sync

# + пересборка SPA на .136
bash docker/scripts/eliteew-deploy.sh hotfix stack0 sync --with-frontend-build
```

Rsync-пути: `shared/api/`, `shared/apps/`, `documentation/`, `host/kernel-offline/` → export `shared/` **плюс** `shared/assistant_desktop_link_components.json` (как в bake `Dockerfile.prod-baked`); host `shared/tools/` → export `shared_tools/` (runtime alias); `shared/web/frontend/dist-build/` → export root. Обновляются `manifest.json` и **`deployment-manifest.json`** (schema v1).

**Invariant:** `apps/` → `/app/apps` обязателен на line B вместе с `api/` → `/app/api`. Без `shared/apps` в export API падает при импорте (`KNOWN_DESKTOP_APP_COMPONENTS would be empty`). Gate: `apps/README.md` на mount перед `up-dev-bind`.

**Invariant:** `shared/assistant_desktop_link_components.json` → `/app/shared/…` обязателен на line B. Sync `host/kernel-offline/` с `--delete` иначе затирает bake-файл и API падает на import (`FileNotFoundError: assistant_desktop_link_components.json`). Gate: тот же путь на mount перед `up-dev-bind`.

**Provenance gate:** `deploy-provenance-gate.sh --hotfix` (или `--acknowledge-dirty` при intentional dirty hotfix).

### Переключение на dev-bind (downtime ~29000/29001)

```bash
# one-shot: pnpm build:react-compiler + sync + recreate (рекомендуемый shortcut)
bash scripts/eliteew/prod-dev-deploy.sh
# alias после source docker/scripts/eliteew-docker-aliases.sh:
eeproddev

# эквивалент в два шага:
bash docker/scripts/eliteew-deploy.sh hotfix stack0 sync --with-frontend-build
bash docker/scripts/eliteew-deploy.sh hotfix stack0 up-dev-bind --yes --with-frontend-build
```

Флаги:

| Флаг | Эффект |
|------|--------|
| `--yes` | без интерактивного `[y/N]` (CI / non-interactive ops) |
| `--skip-sync` | не rsync'ить export перед recreate (export уже свежий) |
| `--with-frontend-build` | `sync` или `up-dev-bind` (перед recreate): `pnpm build:react-compiler` на `.136` |
| `--dry-run` | `DEWA_DRY_RUN=1` — план без side effects |

Последовательность `up-dev-bind`:

1. `prod_line_sync_deploy_tree` → `.111`
2. Проверка mount + наличие `api/main.py`, `apps/README.md`, `frontend-dist/index.html`, `documentation/README.md`, `shared/assistant_desktop_link_components.json`
3. `prod_core_deploy_recreate_stack0_dev_bind` на `.111` (**включая** `prod_core_deploy_ensure_baked_image_short_tags` — dual-tag `localhost/<name>:<tag>` ↔ `<name>:<tag>`, иначе non-TTY compose падает на short-name)
4. Запись `.prod-line-state.json` (`active_line=dev-bind`)
5. Smoke: API health, frontend `/api/health` через nginx

### Boot / autostart (prod-core)

`podman-autostart-prod-core.sh` → `start-prod-core-stacks.sh` stack0 и `prod-core-stack0-host-port-guard.sh` вызывают **`prod_core_deploy_recreate_stack0_for_active_line`**: читают `active_line` с NFS `.prod-line-state.json` и поднимают **dev-bind** или **baked** соответственно (не всегда baked). Перед compose — short-tags. После bake/hotfix: sync bake keys в staging **и** пересобери SOPS (`prod-core-env-bundle-build.sh` + `prod-core-env-sops-encrypt.sh` + `eliteew-prod-core-env-push.sh`), иначе env-pull на reboot вернёт старый тег.

### Hotfix API без пересборки фронта

```bash
bash docker/scripts/eliteew-deploy.sh hotfix stack0 sync
bash docker/scripts/eliteew-deploy.sh hotfix stack0 up-dev-bind --yes --skip-sync
```

Recreate перезапускает workers — учитывайте краткий downtime.

### Hotfix `start_all.sh` + `docker/builders/stack0-api/scripts/lib/` (без rebake API-образа)

1. Правки в `docker/builders/stack0-api/scripts/start_all.sh` и/или `docker/builders/stack0-api/scripts/lib/` (`stack0_preflight*.py`, …) на command-center. **Не** синхронизировать только `start_all.sh` без `lib/` — на baked/dev-bind оба пути bind'ятся парно.
2. `bash docker/scripts/eliteew-deploy.sh hotfix stack0 up-dev-bind --yes` (внутри — deploy-tree на `.111` + recreate) или:
   ```bash
   bash docker/scripts/sync-prod-core-deploy-tree.sh prod-core <repo>
   ```
   затем recreate stack0 на prod-core (см. `prod_core_deploy_recreate_stack0_dev_bind`).
3. Smoke: `ssh prod-core 'podman exec stack0-eliteew-api-prod-baked ls /app/docker/docker/builders/stack0-api/scripts/lib/stack0_preflight.py && head -3 /app/docker/docker/builders/stack0-api/scripts/start_all.sh'`

**Command-center local dev** (`stack0_b.yml` без prod override): bind уже в базовом compose — достаточно recreate API-контейнера после правки файла.

### Возврат на baked

```bash
bash docker/scripts/eliteew-deploy.sh hotfix stack0 up-baked --yes
# затем полный release (только --all):
bash docker/scripts/eliteew-deploy.sh release stack0 --all
```

После успешного Line A release / `eeprodbaked` state → `active_line=baked`.

---

## Guards и взаимодействие с eeprodbaked

| Ситуация | Поведение |
|----------|-----------|
| `active_line=dev-bind`, запуск `eeprodbaked` | **Блок** с подсказкой `eeprodline up-baked` |
| Нужен rebake не снимая dev-bind осознанно | `eeprodbaked … --force-over-dev-line` |
| Второй `release` / orphan bake параллельно | **Блок** flock `docker/tmp/stack0-baked-deploy.lock` (+ meta pid/tag); orphan `build-`/`export-stack0-prod-baked-images.sh` argv refuse; SIGINT/TERM → release lock + `kill 0` process group. Emergency: `--force-unlock` |
| Успешный `eeprodbaked` | `prod_line_write_state baked` |
| Успешный `up-dev-bind` / `up-baked` | обновление `.prod-line-state.json` |

**Anti-race (2026-07-23):** abort Cursor shell ≠ stop `podman build`/export children. Never start a second `release stack0 --all` until lock is free / orphans gone. Switch to an already-loaded tag without rebuild: `eeprodbaked --yes --all --skip-build --tag prod-baked-…`.

---

## Compose и образы (важные нюансы prod-core)

### podman-compose 1.x на `.111`

Зафиксировано на prod-core (см. также [PROD-CORE-CONFIG-PLANE.md](PROD-CORE-CONFIG-PLANE.md)):

| Ограничение | Следствие для dev-bind |
|-------------|------------------------|
| **Не раскрывает** `${VAR:-default}` в volume mounts | Пути NFS **захардкожены**: `/mnt/eliteew-prod-line-export/...` |
| **Не раскрывает** `${VAR}` в mount до parse (иногда) | Не использовать переменные в left-hand side volume |
| **`!override`** для списков volumes | Требуется как в baked override |

### SELinux и NFS read-only

Mount export — **ro**. Сuffix **`:z` / `:Z`** на bind с NFS вызывает:

```text
lsetxattr(...) .dockerignore: read-only file system
```

На NFS bind в dev-bind override используется только **`:ro`** (без relabel). Локальные пути repo (`generated_files`, `comfyui`, logs) — **`:z`** как в baked.

### Образы: не `:v3`, а prod-baked + overlay

На prod-core **нет** загруженных `localhost/eliteew-api:v3` — только теги **`prod-baked-*`**. Dev-bind **не rebake'ит** `:v3` на `.111`.

Модель dev-bind на текущем prod-core:

- **Image:** `${STACK0_*_BAKED_IMAGE}` из runtime env (тот же тег, что baked line).
- **Code overlay:** bind `/mnt/eliteew-prod-line-export/api` → `/app/api` and `/mnt/eliteew-prod-line-export/apps` → `/app/apps` (desktop manifests; paired with api — see `desktop_app_manifests.apps_root`).
- **Entrypoint overlay:** bind `docker/builders/stack0-api/scripts/start_all.sh` **и** `docker/builders/stack0-api/scripts/lib/` → `/app/docker/scripts/{start_all.sh,lib}` (из git на `.111`, доставляется `sync-prod-core-deploy-tree.sh` + recreate). Пара обязательна: новый `start_all` без `lib/` даёт restart loop (`Missing helpers under …/scripts/lib`). Без этих bind контейнер использует скрипты **из baked-образа**.
- Workers (celery, queue, site-studio) — bind `api/` + `apps/` (+ `documentation/` где нужно) с NFS.
- **Celery queue isolation (Trust T6 / V-C1, 2026-07-09):** line B matches baked A — general worker `short,maintenance,broadcast,ewa_reembed`; separate `eliteew-celery-agentic-worker-prod` (`ewa_agentic,ewa_agentic_step,ewa_factory`), `eliteew-celery-companion-worker-prod` (`ewa_companion`), and `eliteew-celery-discussion-worker-prod` (`desktop_discussion`). Collapsing all EWA/Discussion queues onto one worker under hotfix load is forbidden.

**Bytecode (line B — без `.pyc`):** hotfix-код на NFS `:ro`; dev-bind **не** кэширует Python bytecode:

- compose override: `PYTHONDONTWRITEBYTECODE=1`, workers/API через `python -B` (bytecode не пишется; `start_all.sh` не чистит `.pyc` на dev-bind);
- `eeprodline sync`: rsync без `__pycache__`/`*.pyc` + purge забытых кэшей на export staging (`.136`);
- после sync нужен recreate (`up-dev-bind`), иначе процесс держит старый import в памяти.

Проверка в контейнере: `find /app/api -name '*.pyc' | wc -l` → `0`; `python -c 'import sys; print(sys.dont_write_bytecode)'` → `True`.

**Runtime env completeness:** dev-bind compose требует все `STACK0_*_BAKED_IMAGE` + `STACK0_PROD_BAKED_TAG` в `$ELITEEW_ENV_RUNTIME_DIR/.env.stack0.backend`. Частичный env после `eeprodbaked --frontend-only` ломает `up-dev-bind`. Авто-восстановление: `eeprodline ensure-baked-env --yes` или implicit в `up-dev-bind` / `up-baked` (infer из running `stack0-eliteew-*-prod-baked` через `prod_core_deploy_ensure_stack0_baked_image_env`).

**Explicit env wins:** `prod_core_deploy_ensure_stack0_baked_image_env` заполняет только **пустые** или `...` ключи. Явные значения из `eeprodbaked` tag patch **не** перезаписываются inference из running containers — иначе recreate откатывает новый tag на старый образ и smoke ловит `deploy id mismatch`.

Проверка после switch:

```bash
ssh prod-core 'podman inspect stack0-eliteew-api-prod-baked --format "{{range .Mounts}}{{if eq .Destination \"/app/api\"}}{{.Source}}{{end}}{{end}}"'
# → /mnt/eliteew-prod-line-export/api
ssh prod-core 'podman inspect stack0-eliteew-api-prod-baked --format "{{range .Mounts}}{{if eq .Destination \"/app/apps\"}}{{.Source}}{{end}}{{end}}"'
# → /mnt/eliteew-prod-line-export/apps
```
### Frontend dev-bind

- SPA: NFS `frontend-dist/` → `/usr/share/nginx/html:ro`
- **Не** монтируются `nginx.prod.conf` / `snippets` с repo — на `.111` их нет в deploy-tree; конфиг nginx остаётся **из baked frontend image** + `fix-prod-core-baked-frontend-nginx.sh` после up.
- **Desktop-client OTA (O2):** host volume `/srv/eliteew/desktop-client-updates` → `/srv/eliteew/desktop-client-updates:ro` on both baked and dev-bind frontend overrides. New `/desktop-client-updates/` nginx `location` requires a **frontend image** that includes updated `nginx.prod.conf` (stack0 release) — volume alone does not add the location.
- **FoFline OTA (W4):** host volume `/srv/eliteew/fofline-updates` → `/srv/eliteew/fofline-updates:ro` on both baked and dev-bind frontend overrides (local compose uses `docker/data/fofline-updates`). Nginx `/fofline-updates/` is in `nginx.prod.conf`; requires frontend rebake. Stage via `scripts/eliteew/fofline-publish-update.sh`; do not confuse with `/desktop-client-updates/`.

- **Baked line:** `deployment-manifest.json` внутри frontend image → `:29001/deployment-manifest.json` (manifest-first verify).
- **Dev-bind line:** `app-build-version.txt` на `:29001` должен совпадать с `manifest.json` / `deployment-manifest.json` → `deploy_id` на export.

---

## CLI command plane (prod-line)

**Единый user-facing entrypoint:** [`docker/scripts/eliteew-deploy.sh`](../../docker/scripts/eliteew-deploy.sh) на command-center.

| Action | Canonical command | Scope |
|--------|-------------------|-------|
| Line A release | `bash docker/scripts/eliteew-deploy.sh release stack0 --all` | bake → export → recreate |
| Line A + same-release OpenAPI pilots | `… release stack0 --all --refresh-openapi-pilots` | tree OpenAPI → pilots → SPA build, then bake (optional; see `api/FRONTEND-BACKEND-HTTP.md` §Bake-time) |
| Line B status | `bash docker/scripts/eliteew-deploy.sh hotfix stack0 status` | cc → prod-core read |
| Line B sync | `bash docker/scripts/eliteew-deploy.sh hotfix stack0 sync [--with-frontend-build]` | command-center export |
| Line B export-setup | `bash docker/scripts/eliteew-deploy.sh hotfix stack0 export-setup` | command-center NFS |
| Line B up-dev-bind | `bash docker/scripts/eliteew-deploy.sh hotfix stack0 up-dev-bind --yes` | cc → prod-core switch |
| Line B up-baked | `bash docker/scripts/eliteew-deploy.sh hotfix stack0 up-baked --yes` | switch back to baked (no rebake) |

Implementer line B: `eeprodline.sh` (alias `eeprodline` after `source docker/scripts/eliteew-docker-aliases.sh`). Historical thin wrappers `dewa-ops-prod-line-*.sh` → `trash/` (не канон).

Typical hotfix: `eliteew-deploy.sh hotfix stack0 sync --with-frontend-build` then `hotfix stack0 up-dev-bind --yes`. Planned release: `release stack0 --all` (line A). Same-release FE OpenAPI types: add `--refresh-openapi-pilots` (incompatible with `--skip-build` / `--skip-frontend-build`).

---

## Smoke и acceptance

```bash
# с .136
bash docker/scripts/eliteew-deploy.sh hotfix stack0 status
bash docker/scripts/deploy-provenance-verify.sh --live --strict   # baked line: manifest-first

# с .111
curl -sf http://127.0.0.1:29000/api/health
curl -sf http://127.0.0.1:29001/ >/dev/null
curl -sf http://127.0.0.1:29001/app-build-version.txt
curl -sf http://127.0.0.1:29001/deployment-manifest.json | python3 -m json.tool

# deploy_id ↔ manifest (dev-bind)
python3 -c "import json; print(json.load(open('/mnt/eliteew-prod-line-export/deployment-manifest.json'))['deploy_id'])"
curl -sf http://127.0.0.1:29001/app-build-version.txt
```

Публично (через edge): `https://app.eliteew.ru/app-build-version.txt`, `/api/health`.

---

## Troubleshooting

| Симптом | Вероятная причина | Действие |
|---------|-------------------|----------|
| `mkdir /srv/eliteew: Permission denied` | export-setup без sudo | Повторить `eeprodline export-setup` (скрипт вызывает sudo) |
| systemd mount **timeout** | firewalld `.136` не пускает NFS | `sudo bash docker/scripts/prod-line-firewalld-command-center.sh`; `showmount -e 192.168.1.136` с `.111` |
| `showmount: RPC: Unable to receive` | то же | то же |
| `prod_core_deploy_recreate_stack0_dev_bind: command not found` | старый `prod-core-deploy-lib.sh` на `.111` | `sync-prod-core-deploy-tree.sh` или `up-dev-bind` (синхронизирует tree) |
| `could not parse mount ${ELITEEW...:-...}` | podman-compose 1.x | Использовать fixed path `/mnt/eliteew-prod-line-export` в override (уже в репо) |
| `lsetxattr ... read-only file system` | `:z` на NFS ro | Только `:ro` на NFS binds |
| `short-name resolution enforced` | образ `eliteew-api:v3` без `localhost/` | Dev-bind использует `STACK0_*_BAKED_IMAGE` |
| `incomplete STACK0 baked image env` | partial env после `--frontend-only` / ручной правки | `eeprodline ensure-baked-env --yes` или `up-dev-bind` (auto-ensure из running containers) |
| `nginx.prod.conf: Not a directory` | bind nginx config с repo на `.111` | Frontend override без repo nginx paths (канон текущий) |
| `eeprodbaked` refused | active dev-bind | `eeprodline up-baked --yes` или `--force-over-dev-line` |
| API healthy, старый deploy_id | всё ещё baked line | `eeprodline up-dev-bind --yes` |
| `deploy id mismatch` после `eeprodbaked` | `ensure_stack0_baked_image_env` перезаписал новый tag старыми running images (до fix 2026-06-29) или thin bake без общего dist-build | Обновить `prod-core-deploy-lib.sh`; rebake **оба** frontend+api из одного `dist-build`; не использовать `--skip-frontend-build` после изменений SPA |
| Thin bake image tag ≠ this release `BAKED_TAG` | leftover `STACK0_*_BAKED_IMAGE` in agent shell from prior sync | `eeprodbaked` unsets stale image env; build always derives names from `BAKED_TAG` — do not export old image vars before release |
| SOPS age: `no identity found in …/tmp/.config/sops/` | shell leaked `HOME=/tmp` | restore host `HOME` before env-push (`eeprodbaked` auto-fixes when `USER` home exists) |
| `--refresh-openapi-pilots` refused with skip-frontend | refresh must precede SPA build | drop `--skip-build` / `--skip-frontend-build`; use full `--all` release |
| `KNOWN_DESKTOP_APP_COMPONENTS would be empty` / API restart loop on line B | export без `apps/` или override без `/app/apps` bind | `eeprodline sync` (rsync `shared/apps`) + `up-dev-bind`; проверить mount `apps/README.md` |
| Celery/music после switch | workers перезапущены с NFS api | Проверить `ELITEEW_RUNTIME_LINE`, логи worker; hotfix api → sync + up-dev-bind |
| EWRP PDF: `BrowserRenderUnavailableError` / `All connection attempts failed` на `:8095` | queue-worker command без sidecar (`python -m api.workers.queue_worker`) | В `stack0_b.dev-bind.override.yml` command = `start_queue_worker.sh` (как baked); `eeprodline up-dev-bind --yes --skip-sync`; внутри worker должен слушать `:8095` |

---

## Файлы репозитория

| Путь | Назначение |
|------|------------|
| `docker/scripts/eliteew-deploy.sh` | User-facing deploy CLI (`release` / `hotfix` / `release runtime`) |
| `docker/scripts/eeprodline.sh` | Line B implementer (status / sync / up-dev-bind / up-baked) |
| `docker/scripts/prod-line-lib.sh` | sync, state, NFS, remote recreate, deploy-tree |
| `docker/scripts/prod-line-firewalld-command-center.sh` | firewalld `.136` для `.111` |
| `docker/scripts/prod-core-deploy-lib.sh` | `prod_core_deploy_recreate_stack0_dev_bind`, `_baked` |
| `docker/scripts/sync-prod-core-deploy-tree.sh` | compose/scripts → `.111` |
| `docker/scripts/eliteew-stack0-baked-deploy.sh` | Line A implementer (historical name; called by `eliteew-deploy.sh release stack0`) |
| `docker/scripts/stack0-refresh-openapi-pilots.sh` | Opt-in bake-time OpenAPI → pilots (used by `--refresh-openapi-pilots`) |
| `docker/scripts/openapi-export.env.defaults` | Staging defaults for tree OpenAPI export during bake |
| `docker/stack/stack0_b.dev-bind.override.yml` | backend workers; **queue-worker command must be `start_queue_worker.sh`** (Playwright sidecar `:8095` + science `:8096`) — not bare `python -m api.workers.queue_worker` |
| `docker/stack/stack0_f.dev-bind.override.yml` | frontend nginx |
| `docker/scripts/eliteew-docker-aliases.sh` | aliases `eeprodline`, `eeprodbaked`, `eeproddev` |
| `scripts/eliteew/prod-dev-deploy.sh` | convenience one-shot dev-bind (`eeproddev`): pnpm build + sync + recreate |

---

## Когда не использовать dev-bind

- Плановый **release** с новыми образами, миграциями, изменением base layers → **baked** (`bash docker/scripts/eliteew-deploy.sh release stack0 --all`).
- Длительная работа на dev-bind без discipline sync → drift manifest vs реальный git.
- Если NFS/mount нестабилен — вернуться на baked (`eeprodline up-baked`).

Dev-bind — **операторский ускоритель hotfix**, не замена baked release pipeline.

---

## См. также

- [PROD-CORE-MIGRATION-BAKED-IMAGES.md](docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md) — основной prod deploy
- [PROD-CORE-CONFIG-PLANE.md](PROD-CORE-CONFIG-PLANE.md) — runtime env на `.111`
- [STACK-CONTAINER-CONTROL.md](docker-re_doc/STACK-CONTAINER-CONTROL.md) — podman compose на prod-core
- [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md) — §Current host roles / smoke
