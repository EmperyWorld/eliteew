#!/usr/bin/env bash
# Install / update recommended Cursor/VS Code extensions for this workspace.
# Prefer proxychains4 when available (marketplace reachability).
# Usage:
#   bash .vscode/install-recommended-extensions.sh
#   bash .vscode/install-recommended-extensions.sh --uninstall-unwanted
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JSON="$ROOT/.vscode/extensions.json"

UNINSTALL_UNWANTED=0
for arg in "$@"; do
  case "$arg" in
    --uninstall-unwanted) UNINSTALL_UNWANTED=1 ;;
    -h|--help)
      echo "Usage: $0 [--uninstall-unwanted]"
      exit 0
      ;;
  esac
done

if ! command -v jq >/dev/null 2>&1; then
  echo "Install jq (e.g. sudo dnf install -y jq) or install extensions manually from the Recommended list." >&2
  exit 1
fi

INSTALLER=()
if command -v cursor >/dev/null 2>&1; then
  INSTALLER=(cursor --install-extension)
  UNINSTALLER=(cursor --uninstall-extension)
elif command -v code >/dev/null 2>&1; then
  INSTALLER=(code --install-extension)
  UNINSTALLER=(code --uninstall-extension)
else
  echo "Neither 'cursor' nor 'code' CLI found in PATH." >&2
  exit 1
fi

RUN=()
if command -v proxychains4 >/dev/null 2>&1; then
  RUN=(proxychains4 -q)
  echo "Using proxychains4 + ${INSTALLER[*]}"
else
  echo "Using ${INSTALLER[*]} (no proxychains4)"
fi

mapfile -t IDS < <(jq -r '.recommendations[]?' "$JSON")
if [[ ${#IDS[@]} -eq 0 ]]; then
  echo "No recommendations in $JSON" >&2
  exit 1
fi

for id in "${IDS[@]}"; do
  echo "Install/update $id ..."
  # --force refreshes to latest when already installed
  "${RUN[@]}" "${INSTALLER[@]}" "$id" --force || {
    echo "WARN: failed $id (network/marketplace?) — continue" >&2
  }
done

if [[ "$UNINSTALL_UNWANTED" -eq 1 ]]; then
  mapfile -t BAD < <(jq -r '.unwantedRecommendations[]?' "$JSON")
  # Also drop session-noise not always listed historically
  EXTRA_BAD=(
    foxundermoon.shell-format
    gruntfuggly.todo-tree
    ms-playwright.playwright
    streetsidesoftware.code-spell-checker
    streetsidesoftware.code-spell-checker-russian
    davidanson.vscode-markdownlint
    ms-python.vscode-python-envs
  )
  declare -A SEEN=()
  for id in "${BAD[@]}" "${EXTRA_BAD[@]}"; do
    [[ -z "$id" ]] && continue
    [[ -n "${SEEN[$id]:-}" ]] && continue
    SEEN[$id]=1
    echo "Uninstall unwanted $id (if present) ..."
    "${RUN[@]}" "${UNINSTALLER[@]}" "$id" 2>/dev/null || true
  done
fi

echo "Done. Reload Window recommended."
