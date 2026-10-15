#!/usr/bin/env bash
# EliteEW · send a local file to GAF usernames via elite_system (ops).
#
# Usage (command-center):
#   bash docker/scripts/eliteew-gaf-send-file.sh --file ./pack.tar.gz --to poet lady_boss
#   bash docker/scripts/eliteew-gaf-send-file.sh --file ./x.pdf --to poet --body "Caption"
#
# Canon: documentation/product/GAF-CHAT-BACKEND.md §Ops file delivery
# Skill: .cursor/skills/eliteew-gaf-send-file/SKILL.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SKILL_PY="$REPO_ROOT/.cursor/skills/eliteew-gaf-send-file/scripts/gaf_send_file_ops.py"

PROD_HOST="${ELITEEW_GAF_SEND_PROD_HOST:-192.168.1.111}"
API_CTR="${ELITEEW_GAF_SEND_API_CTR:-stack0-eliteew-api-prod-baked}"
REMOTE_TMP="${ELITEEW_GAF_SEND_REMOTE_TMP:-/tmp}"

FILE=""
BODY="File delivery via GAF (ops / elite_system)."
SOURCE_ID=""
SETTLE_SEC="2"
TO_USERS=()

usage() {
  cat <<EOF
Usage: bash docker/scripts/eliteew-gaf-send-file.sh --file PATH --to USER [USER...] [--body TEXT]

Env overrides:
  ELITEEW_GAF_SEND_PROD_HOST   default 192.168.1.111
  ELITEEW_GAF_SEND_API_CTR     default stack0-eliteew-api-prod-baked
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)
      FILE="${2:-}"
      shift 2
      ;;
    --to)
      shift
      while [[ $# -gt 0 && "$1" != --* ]]; do
        TO_USERS+=("$1")
        shift
      done
      ;;
    --body)
      BODY="${2:-}"
      shift 2
      ;;
    --source-id)
      SOURCE_ID="${2:-}"
      shift 2
      ;;
    --settle-sec)
      SETTLE_SEC="${2:-2}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "ERROR: --file must exist" >&2
  exit 2
fi
if [[ ${#TO_USERS[@]} -eq 0 ]]; then
  echo "ERROR: --to requires at least one username" >&2
  exit 2
fi
if [[ ! -f "$SKILL_PY" ]]; then
  echo "ERROR: missing skill script: $SKILL_PY" >&2
  exit 2
fi

BASENAME="$(basename -- "$FILE")"
SAFE_NAME="$(printf '%s' "$BASENAME" | tr -c 'A-Za-z0-9._-' '_')"
REMOTE_FILE="$REMOTE_TMP/eliteew-gaf-send-$SAFE_NAME"
REMOTE_PY="$REMOTE_TMP/gaf_send_file_ops.py"

echo "[gaf-send] scp → ${PROD_HOST}:${REMOTE_FILE}"
scp -q -- "$FILE" "${PROD_HOST}:${REMOTE_FILE}"
scp -q -- "$SKILL_PY" "${PROD_HOST}:${REMOTE_PY}"

echo "[gaf-send] podman cp + exec on ${API_CTR}"
ssh "$PROD_HOST" "podman cp $(printf '%q' "$REMOTE_FILE") $(printf '%q' "${API_CTR}:${REMOTE_FILE}")"
ssh "$PROD_HOST" "podman cp $(printf '%q' "$REMOTE_PY") $(printf '%q' "${API_CTR}:${REMOTE_PY}")"

PY_CMD=(
  /opt/venv/bin/python "$REMOTE_PY"
  --file "$REMOTE_FILE"
  --to "${TO_USERS[@]}"
  --body "$BODY"
  --settle-sec "$SETTLE_SEC"
)
if [[ -n "$SOURCE_ID" ]]; then
  PY_CMD+=(--source-id "$SOURCE_ID")
fi

# Build a single remote argv string with safe quoting
REMOTE_ARGV=""
for a in "${PY_CMD[@]}"; do
  REMOTE_ARGV+=" $(printf '%q' "$a")"
done

ssh "$PROD_HOST" "podman exec -w /app/api -e PYTHONPATH=/app $(printf '%q' "$API_CTR")${REMOTE_ARGV}"

echo "[gaf-send] done"
