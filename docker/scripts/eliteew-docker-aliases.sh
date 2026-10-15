# shellcheck shell=bash
# EliteEW container ops: shell functions (cwd-independent). Short names: eec, eectl, eesd, eesr, eedeploy, eecc, eemigrate, ees0, eeconn, eetunnel, eebackup, eebackupfull.
#
# Install once in ~/.bashrc:
#   source /path/to/powered_by_emperyworld/docker/scripts/eliteew-docker-aliases.sh
#
# Short names: eec, eectl, … — подробная справка: ee???  ·  все алиасы системы: ???
#
# Если репозиторий не рядом с этим файлом (редкий случай), перед source:
#   export POWERED_BY_EMPERYWORLD_ROOT=/path/to/powered_by_emperyworld

if [[ -z "${BASH_VERSION:-}" ]]; then
  echo "eliteew-docker-aliases.sh: requires bash" >&2
  return 2 2>/dev/null || exit 2
fi

if [[ "${BASH_SOURCE[0]:-}" == "$0" ]]; then
  echo "Do not execute this file. Source it instead, e.g.:"
  echo "  source $(readlink -f "$0" 2>/dev/null || echo "$0")"
  exit 64
fi

_eliteew_ops_this="${BASH_SOURCE[0]}"
_eliteew_ops_scripts_dir="$(cd "$(dirname "$_eliteew_ops_this")" && pwd)"

# Override only when the tree is not at the default location relative to this file.
if [[ -n "${POWERED_BY_EMPERYWORLD_ROOT:-}" ]]; then
  ELITEEW_MONOREPO_ROOT="$(cd "${POWERED_BY_EMPERYWORLD_ROOT}" && pwd)"
else
  # Always derive from the file being sourced (safe when opening a new shell from any cwd).
  ELITEEW_MONOREPO_ROOT="$(cd "$_eliteew_ops_scripts_dir/../.." && pwd)"
fi

if [[ ! -f "$ELITEEW_MONOREPO_ROOT/docker/scripts/eliteew-container-control.py" ]]; then
  echo "eliteew-docker-aliases: cannot find controller under ELITEEW_MONOREPO_ROOT=$ELITEEW_MONOREPO_ROOT" >&2
  echo "Hint: export POWERED_BY_EMPERYWORLD_ROOT=/correct/path/to/powered_by_emperyworld" >&2
  return 1 2>/dev/null || exit 1
fi

export ELITEEW_MONOREPO_ROOT

eliteew-console() {
  bash "$ELITEEW_MONOREPO_ROOT/docker/scripts/eliteew-container-console.sh" "$@"
}

# Flags before subcommand (see STACK-CONTAINER-CONTROL.md). Repo root forced for any cwd.
eliteew-ctl() {
  python3 "$ELITEEW_MONOREPO_ROOT/docker/scripts/eliteew-container-control.py" \
    --repo-root "$ELITEEW_MONOREPO_ROOT" "$@"
}

eliteew-stack-down() {
  bash "$ELITEEW_MONOREPO_ROOT/docker/scripts/stack-all-down.sh" "$@"
}

eliteew-stack-recreate() {
  bash "$ELITEEW_MONOREPO_ROOT/docker/scripts/stack-all-recreate.sh" "$@"
}

eliteew-conn-audit() {
  bash "$ELITEEW_MONOREPO_ROOT/docker/scripts/eliteew-conn-audit.sh" "$@"
}

eliteew-user-logins-audit() {
  bash "$ELITEEW_MONOREPO_ROOT/docker/scripts/eliteew-user-logins-audit.sh" "$@"
}

eliteew-yandex-tunnel-monitor() {
  bash "$ELITEEW_MONOREPO_ROOT/docker/scripts/yandex-tunnel/yandex-tunnel-security-monitor.sh" "$@"
}

eliteew-migration-command-center() {
  bash "$ELITEEW_MONOREPO_ROOT/docker/scripts/eliteew-migration-command-center.sh" "$@"
}

eliteew-command-center() {
  bash "$ELITEEW_MONOREPO_ROOT/docker/scripts/eliteew-command-center.sh" "$@"
}

eliteew-mobile-apk-release() {
  bash "$ELITEEW_MONOREPO_ROOT/docker/scripts/mobile-apk-release-cycle.sh" "$@"
}

eliteew-prod-core-mobile-deploy() {
  bash "$ELITEEW_MONOREPO_ROOT/docker/scripts/deploy-prod-core-mobile.sh" "$@"
}

eliteew-prod-core-baked-deploy() {
  bash "$ELITEEW_MONOREPO_ROOT/docker/scripts/eliteew-stack0-baked-deploy.sh" "$@"
}

eliteew-prod-core-runtime-deploy() {
  bash "$ELITEEW_MONOREPO_ROOT/docker/scripts/eliteew-prod-core-runtime-deploy.sh" "$@"
}

eliteew-stack0-recreate-local() {
  bash "$ELITEEW_MONOREPO_ROOT/docker/scripts/stack0-recreate-local.sh" "$@"
}

eliteew-up-back-backup() {
  local backup_root="${BACKUP_ROOT:-/up_back}"
  local arg needs_write=1
  for arg in "$@"; do
    case "$arg" in
      --dry-run | --analyze | -h | --help) needs_write=0 ;;
    esac
  done
  if ((needs_write)) && [[ ! -w "$backup_root" ]] && [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    exec sudo -E bash "$ELITEEW_MONOREPO_ROOT/scripts/backup-powered-by-emperyworld-to-up-back.sh" "$@"
  fi
  bash "$ELITEEW_MONOREPO_ROOT/scripts/backup-powered-by-emperyworld-to-up-back.sh" "$@"
}

eliteew-up-back-full-backup() {
  local arg needs_root=1
  for arg in "$@"; do
    case "$arg" in
      --dry-run | --analyze | -h | --help) needs_root=0 ;;
    esac
  done
  if ((needs_root)) && [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    exec sudo -E bash "$ELITEEW_MONOREPO_ROOT/scripts/backup-powered-by-emperyworld-full-to-up-back.sh" "$@"
  fi
  bash "$ELITEEW_MONOREPO_ROOT/scripts/backup-powered-by-emperyworld-full-to-up-back.sh" "$@"
}

# Подробная справка EliteEW: ee???  (глобальная сводка всех алиасов: ???)
eliteew-short-help() {
  cat <<'EOF'
EliteEW · короткие команды (нужен: source …/eliteew-docker-aliases.sh)

  eec       интерактивная консоль контейнеров (eliteew-container-console.sh)
            п.32 list-stacks · п.33 recreate-running · п.34 skip stack nums
  eectl     eliteew-container-control.py (status, analyze, doctor, …)
  eesd      упорядоченный stack down
  eesr      полный stack recreate
  eedeploy  → eliteew-deploy.sh (канон release stack0 --all; не interactive menu)
  eecc      командный пункт .136: status, smoke, restart, baseline, acceptance, workload-smoke, reboot-gate
  eemigrate финализация .111/.141/.136: baseline/smoke/workload-smoke/acceptance/reboot-gate, remote eectl, install units
  eemobile  полный цикл mobile APK: build → edge → TG → web (mobile-apk-release-cycle.sh)
            pack-cloud door ONLY — не собирает pack-organization/connection-agent
  # Org Connection Agent OTA (не alias; явный путь):
  #   bash scripts/eliteew/desktop-client-ota-release.sh
  # Contours: documentation/platform/ELITEEW-RELEASE-CHECKLIST.md §Pack release
  # Optional: ELITEEW_PACK_RELEASE=cloud|org  (cross-door needs ELITEEW_PACK_ALLOW_CROSS_DOOR=1)
  eec mobile-apk  то же из интерактивной консоли (п.31 или subcommand)
  ees0      force-recreate stack0 + локальные воркеры (punisher-local-workers,site-studio-worker)
  eeconn    аудит сетевых соединений (journal, runtime logs, API-log)
  eelogin   аудит входов пользователей (Keycloak LOGIN + API activity)
  eetunnel  цветной мониторинг edge/tunnel + security logs + fail2ban
  eebackup  несжатый .tar монорепо → /up_back/ (без docker/data, node_modules, .git;
            AI weights — /home/owned/models вне архива; shared/api/models/ ORM в архиве). Логи: /up_back/logs/
            Сначала: source …/eliteew-docker-aliases.sh  (не «sudo eebackup» — функция не в PATH sudo)

  eebackup                   tar в /up_back/ (сам запросит sudo при записи)
  eebackup --dry-run         проверка контракта + план без записи
  eebackup --analyze         размеры и оценка объёма
  eebackup --mirror          tar + rsync-зеркало в /up_back/powered_by_emperyworld/
  sudo …/scripts/eebackup    то же без source (обёртка-скрипт)

  eebackupfull полный .tar монорепо → /up_back/ БЕЗ исключений (~90+ GiB, docker/data, .git, всё).
               tar --same-owner; архив root:root chmod 600 (читает только root). Лог: /up_back/logs/

  eebackupfull               sudo запросится автоматически
  eebackupfull --dry-run     план без записи
  eebackupfull --analyze     du по источнику
  sudo …/scripts/eebackupfull обёртка без source

  eelogin 12          период 12 ч без меню (также: 1, 3, 6, 24)
  eetunnel report 200 полный отчёт по туннелю и edge за 200 строк
  eetunnel suspicious быстрый grep подозрительных auth/nginx/tunnel логов
  eetunnel install-fail2ban  поставить/обновить jail на edge (после YES)
  eectl --color always status
  bash docker/scripts/eliteew-deploy.sh release stack0 --all
                        канон Line A (агенты — только так; без --frontend-only)
  bash docker/scripts/eliteew-deploy.sh hotfix stack0 sync|up-dev-bind|up-baked|status
                        канон Line B (без rebake)
  bash docker/scripts/eliteew-deploy.sh release runtime --yes --all
                        stack2+stack4 runtime
  bash docker/scripts/eliteew-deploy.sh release stack6 --all
                        Keycloak 26.7.1 + binding SPI (build on .136; do not bake on .111)
  eedeploy …            то же, что eliteew-deploy.sh (legacy alias name)
  eeprodcore --yes --ota  OTA deploy на prod-core (.111)
  eeprodbaked / eeprodline / eeprodruntime
                        внутренние implementers / aliases (предпочитать eliteew-deploy.sh)
  eeproddev                 convenience: pnpm build + sync + recreate (scripts/eliteew/prod-dev-deploy.sh)
  eemigrate acceptance    baseline + prod-core doctor + distributed/workload smoke
  ees0   force-recreate stack0 + local workers

  Запущенные стеки (нумерация + выборочный recreate):
  eec list-stacks / eectl list-stacks
  eectl list-stacks --all              все managed-стеки с контейнерами
  eectl --yes recreate-running         down+up --force-recreate только running
  eectl --yes recreate-running --skip-stack-num 1,8,9
  eectl recreate-running --ask-skip    список + ввод номеров для исключения
  eectl --dry-run --yes recreate-running --skip-stack-num 2,5   только план
  eectl --stack2-profiles local-stack2-embed-rerank --yes recreate-running
  eecc status / eecc smoke / eecc workload-smoke / eecc reboot-gate / eecc acceptance

  Документация: documentation/platform/docker-re_doc/STACK-CONTAINER-CONTROL.md
  Deploy menu: documentation/platform/docker-re_doc/FRONTEND-STALE-CHUNK-404.md §Оператору
  Redis: documentation/platform/REDIS_ARCHITECTURE.md
EOF
}
alias 'ee???'='eliteew-short-help'

# Stale STACK0_*_BAKED_IMAGE from a prior manual export/session must not pin old tags
# when operator runs eeprodbaked (script unsets at entry; shell env would still win).
eliteew_clear_stale_baked_shell_env() {
  unset STACK0_PROD_BAKED_TAG \
    STACK0_API_BAKED_IMAGE \
    STACK0_QUEUE_WORKER_BAKED_IMAGE \
    STACK0_CELERY_WORKER_BAKED_IMAGE \
    STACK0_CELERY_BEAT_BAKED_IMAGE \
    STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE \
    STACK0_FRONTEND_BAKED_IMAGE \
    STACK0_CELERY_AGENTIC_WORKER_BAKED_IMAGE \
    STACK0_CELERY_COMPANION_WORKER_BAKED_IMAGE \
    STACK0_CELERY_DISCUSSION_WORKER_BAKED_IMAGE
}
eliteew_clear_stale_baked_shell_env

# Короткие имена (функции — работают в одном bash -c после source, в отличие от alias).
eec() { eliteew-console "$@"; }
eectl() { eliteew-ctl "$@"; }
eesd() { eliteew-stack-down "$@"; }
eesr() { eliteew-stack-recreate "$@"; }
eeconn() { eliteew-conn-audit "$@"; }
eelogin() { eliteew-user-logins-audit "$@"; }
eetunnel() { eliteew-yandex-tunnel-monitor "$@"; }
eedeploy() { bash "$ELITEEW_MONOREPO_ROOT/docker/scripts/eliteew-deploy.sh" "$@"; }
eecc() { eliteew-command-center "$@"; }
eemigrate() { eliteew-migration-command-center "$@"; }
eemobile() { eliteew-mobile-apk-release "$@"; }
eeprodcore() { eliteew-prod-core-mobile-deploy "$@"; }
eeprodbaked() { eliteew-prod-core-baked-deploy "$@"; }
eeprodline() { bash "${ELITEEW_MONOREPO_ROOT}/docker/scripts/eeprodline.sh" "$@"; }
eeproddev() { bash "${ELITEEW_MONOREPO_ROOT}/scripts/eliteew/prod-dev-deploy.sh" "$@"; }
eeprodruntime() { eliteew-prod-core-runtime-deploy "$@"; }
eeprodstack6() { bash "${ELITEEW_MONOREPO_ROOT}/docker/scripts/eeprodstack6.sh" "$@"; }
ees0() { eliteew-stack0-recreate-local "$@"; }
eebackup() { eliteew-up-back-backup "$@"; }
eebackupfull() { eliteew-up-back-full-backup "$@"; }
