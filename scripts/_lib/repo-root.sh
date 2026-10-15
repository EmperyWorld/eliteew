#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Единый резолв корня монорепозитория powered_by_emperyworld для shell-скриптов.
# Invariants:
# - Маркеры корня: .cursorrules + каталоги docker/ и shared/.
# - Подключать через: source "$SCRIPT_DIR/../_lib/repo-root.sh" (из scripts/*).
# Related:
# - scripts/README.md, docker/scripts/eliteew-docker-aliases.sh
# ---

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Source this file; do not execute directly." >&2
  exit 64
fi

# eliteew_repo_root [start_dir] — печатает абсолютный путь корня репо.
eliteew_repo_root() {
  local dir="${1:-}"
  if [[ -z "$dir" ]]; then
    dir="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
  else
    dir="$(cd "$dir" && pwd)"
  fi
  while [[ -n "$dir" && "$dir" != "/" ]]; do
    if [[ -f "$dir/.cursorrules" && -d "$dir/docker" && -d "$dir/shared" ]]; then
      printf '%s\n' "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  echo "eliteew_repo_root: cannot find monorepo root from ${1:-caller}" >&2
  return 1
}

# Устанавливает ELITEEW_REPO_ROOT, ELITEEW_DIR, ELITEEW_API_DIR, DOCKER_DIR, SCRIPTS_DIR, DOCKER_SCRIPTS_DIR.
# ELITEEW_DIR = shared mid (api/web/apps/packages); historical name kept for callers.
eliteew_source_repo_paths() {
  local root
  root="$(eliteew_repo_root "$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)")" || return 1
  ELITEEW_REPO_ROOT="$root"
  ELITEEW_DIR="$root/shared"
  ELITEEW_API_DIR="$root/shared/api"
  DOCKER_DIR="$root/docker"
  SCRIPTS_DIR="$root/scripts"
  DOCKER_SCRIPTS_DIR="$root/docker/scripts"
  export ELITEEW_REPO_ROOT ELITEEW_DIR ELITEEW_API_DIR DOCKER_DIR SCRIPTS_DIR DOCKER_SCRIPTS_DIR
}
