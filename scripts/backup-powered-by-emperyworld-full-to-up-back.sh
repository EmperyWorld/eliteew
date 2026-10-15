#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Полный бэкап монорепозитория powered_by_emperyworld в /up_back/ без исключений
#   (docker/data, .git, node_modules и всё остальное — в архиве).
# Invariants:
# - Источник: ELITEEW_REPO_ROOT; tar --same-owner (требует root).
# - Архив: /up_back/powered_by_emperyworld-full-YYYY-MM-DD_HH-MM-SS.tar
# - После записи: владелец root:root, режим 600 (только root читает/пишет).
# - Лог: /up_back/logs/backup-full-*.log (root:root 600).
# Related:
# - scripts/backup-powered-by-emperyworld-to-up-back.sh (eebackup, с исключениями)
# - docker/scripts/eliteew-docker-aliases.sh (eebackupfull, ee???)
# - documentation/platform/docker-re_doc/STACK-CONTAINER-CONTROL.md
# ---

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]:-$0}")")" && pwd)"
# shellcheck source=_lib/repo-root.sh
source "$SCRIPT_DIR/_lib/repo-root.sh"
eliteew_source_repo_paths

BACKUP_ROOT="${BACKUP_ROOT:-/up_back}"
ARCHIVE_DIR="${ARCHIVE_DIR:-$BACKUP_ROOT}"
LOG_DIR="${LOG_DIR:-$BACKUP_ROOT/logs}"
STAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
ARCHIVE_NAME="powered_by_emperyworld-full-${STAMP}.tar"
ARCHIVE_PATH="$ARCHIVE_DIR/$ARCHIVE_NAME"
LOG_FILE="$LOG_DIR/backup-full-${STAMP}.log"

DRY_RUN=0
DO_ANALYZE=0
KEEP_ARCHIVES="${KEEP_ARCHIVES:-2}"

usage() {
	cat <<'EOF'
Usage: backup-powered-by-emperyworld-full-to-up-back.sh [OPTIONS]

Полный бэкап powered_by_emperyworld → /up_back/ (без исключений, ~90+ GiB).

Options:
  --dry-run        План: размер источника, путь архива, без записи
  --analyze        Анализ размеров (du) без записи
  --keep N         Хранить последние N full-архивов (по умолчанию: 2)
  -h, --help       Справка

Требования:
  Запись — только от root (sudo). Архив: root:root, chmod 600.

Примеры:
  source docker/scripts/eliteew-docker-aliases.sh && eebackupfull
  sudo ./scripts/eebackupfull
  sudo eebackupfull --dry-run
  sudo eebackupfull --analyze --keep 3

Восстановление (от root):
  tar -xpf /up_back/powered_by_emperyworld-full-YYYY-MM-DD_HH-MM-SS.tar -C /home/owned

EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--dry-run) DRY_RUN=1 ;;
	--analyze) DO_ANALYZE=1 ;;
	--keep)
		shift
		KEEP_ARCHIVES="${1:?--keep требует число}"
		;;
	-h | --help)
		usage
		exit 0
		;;
	*)
		echo "Неизвестный аргумент: $1" >&2
		usage >&2
		exit 2
		;;
	esac
	shift
done

human_size() {
	numfmt --to=iec-i --suffix=B "$1" 2>/dev/null || echo "${1}B"
}

repo_parent() {
	dirname "$ELITEEW_REPO_ROOT"
}

repo_basename() {
	basename "$ELITEEW_REPO_ROOT"
}

run_analyze() {
	echo "=== Полный бэкап (без исключений): $ELITEEW_REPO_ROOT ==="
	echo
	echo "Полный размер источника:"
	du -sh "$ELITEEW_REPO_ROOT" 2>/dev/null || true
	echo
	echo "Топ каталогов (уровень 1):"
	du -h --max-depth=1 "$ELITEEW_REPO_ROOT" 2>/dev/null | sort -hr | head -20 || true
	echo
	echo "Файлы > 1 GiB (первые 20):"
	find "$ELITEEW_REPO_ROOT" -type f -size +1G 2>/dev/null \
		| head -20 \
		| while read -r f; do
			printf '  %8s  %s\n' "$(du -h "$f" 2>/dev/null | awk '{print $1}')" "$f"
		done || true
	echo
	echo "Архив: $ARCHIVE_PATH"
	echo "Оценка: несжатый tar ≈ размеру источника на диске; время — десятки минут при ~90 GiB."
}

require_root_for_write() {
	if [[ "$DRY_RUN" -eq 1 || "$DO_ANALYZE" -eq 1 ]]; then
		return 0
	fi
	if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
		echo "Полный бэкап требует root (--same-owner, архив root:600)." >&2
		echo "  sudo $0" >&2
		echo "  source …/eliteew-docker-aliases.sh && eebackupfull" >&2
		exit 1
	fi
}

secure_root_file() {
	local path="$1"
	chown root:root "$path"
	chmod 600 "$path"
}

verify_archive() {
	local archive="$1"
	local listing failed=0 archive_bytes mode owner

	if [[ ! -f "$archive" ]]; then
		echo "verify: файл не найден: $archive" >&2
		return 1
	fi

	echo "=== Проверка full-архива ==="
	mapfile -t listing < <(tar -tf "$archive" | head -5)
	if [[ ${#listing[@]} -eq 0 || "${listing[0]}" != powered_by_emperyworld/* && "${listing[0]}" != "powered_by_emperyworld" ]]; then
		echo "  FAIL: ожидался префикс powered_by_emperyworld/ в архиве (первая запись: ${listing[0]:-пусто})" >&2
		failed=1
	fi

	mode="$(stat -c '%a' "$archive")"
	owner="$(stat -c '%U:%G' "$archive")"
	if [[ "$mode" != "600" ]]; then
		echo "  FAIL: режим $mode (ожидался 600)" >&2
		failed=1
	fi
	if [[ "$owner" != "root:root" ]]; then
		echo "  FAIL: владелец $owner (ожидался root:root)" >&2
		failed=1
	fi

	archive_bytes="$(stat -c%s "$archive")"
	echo "  размер: $(human_size "$archive_bytes")"
	echo "  владелец: $owner  mode: $mode"
	echo "  начало списка:"
	printf '    %s\n' "${listing[@]}"

	if ((failed != 0)); then
		echo "Архив не прошёл проверку — удаляю $archive" >&2
		rm -f "$archive"
		return 1
	fi
	echo "Проверка full-архива: OK"
}

run_tar() {
	if [[ "$DRY_RUN" -eq 1 ]]; then
		echo "=== full tar (dry-run) ==="
		echo "  source: $(repo_parent)/$(repo_basename)"
		echo "  archive: $ARCHIVE_PATH"
		echo "  права после записи: root:root 600"
		du -sh "$ELITEEW_REPO_ROOT" 2>/dev/null || true
		echo "  (запись пропущена)"
		return 0
	fi

	echo "=== full tar (без исключений) ==="
	echo "  source: $(repo_parent)/$(repo_basename)"
	echo "  archive: $ARCHIVE_PATH"
	echo "  started: $(date -Is)"
	echo "  WARNING: объём большой — не прерывайте процесс."

	mkdir -p "$ARCHIVE_DIR" "$LOG_DIR"
	{
		echo "backup-full start: $(date -Is)"
		echo "source: $ELITEEW_REPO_ROOT"
		echo "archive: $ARCHIVE_PATH"
	} >>"$LOG_FILE"
	secure_root_file "$LOG_FILE"

	tar -cpf "$ARCHIVE_PATH" --same-owner \
		-C "$(repo_parent)" "$(repo_basename)" 2>&1 | tee -a "$LOG_FILE"

	secure_root_file "$ARCHIVE_PATH"
	verify_archive "$ARCHIVE_PATH"

	local archive_size
	archive_size="$(du -h "$ARCHIVE_PATH" | awk '{print $1}')"
	echo "Архив: $ARCHIVE_PATH ($archive_size, root:root 600)"
	echo "backup-full done: $ARCHIVE_PATH size=$archive_size" >>"$LOG_FILE"
	secure_root_file "$LOG_FILE"

	mapfile -t old_archives < <(ls -1t "$ARCHIVE_DIR"/powered_by_emperyworld-full-*.tar 2>/dev/null || true)
	if ((${#old_archives[@]} > KEEP_ARCHIVES)); then
		for ((i = KEEP_ARCHIVES; i < ${#old_archives[@]}; i++)); do
			echo "Удаление старого full-архива: ${old_archives[$i]}"
			rm -f "${old_archives[$i]}"
			echo "rotate delete: ${old_archives[$i]}" >>"$LOG_FILE"
		done
		secure_root_file "$LOG_FILE"
	fi
}

if [[ "$DO_ANALYZE" -eq 1 ]]; then
	run_analyze
	exit 0
fi

if [[ ! -d "$BACKUP_ROOT" ]]; then
	echo "Каталог бэкапа не найден: $BACKUP_ROOT" >&2
	exit 1
fi

if [[ ! -d "$ELITEEW_REPO_ROOT" ]]; then
	echo "Источник не найден: $ELITEEW_REPO_ROOT" >&2
	exit 1
fi

require_root_for_write
run_tar

echo
echo "Готово ($(date -Is))."
if [[ "$DRY_RUN" -eq 0 ]]; then
	echo "Архив: $ARCHIVE_PATH (root:root, 600)"
	echo "Лог:   $LOG_FILE (root:root, 600)"
	echo "Чтение архива: sudo tar -tf $ARCHIVE_PATH | head"
fi
