#!/usr/bin/env bash
# Build a scratch clone with GitHub history drops. Never rewrites the working tree.
# Canon: documentation/platform/ELITEEW-GITHUB-REPOSITORY.md
#        documentation/platform/ELITEEW-GITHUB-REPOSITORY-PLAN.md §5
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"

MODE="development"
DEST=""
REPLACE=0
SELFTEST=0
SOURCE="$ROOT"

usage() {
  cat <<'EOF'
Usage: github-history-export.sh --dest DIR [--mode development|public] [--replace]
       github-history-export.sh --selftest

  --mode development   Drop paths that belong in neither repository (W2).
  --mode public        Also drop development-only paths (public export).
  --dest DIR           Scratch clone. Must be outside this working tree.
  --replace            Remove DEST first when it already exists outside the tree.
  --selftest           Refusal check plus a tiny real repository filter.

This script does not push and does not change the working tree remote.
EOF
}

refuse() {
  echo "ERROR: $*" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="${2:?}"
      shift 2
      ;;
    --dest)
      DEST="${2:?}"
      shift 2
      ;;
    --replace)
      REPLACE=1
      shift
      ;;
    --selftest)
      SELFTEST=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      refuse "unknown arg: $1"
      ;;
  esac
done

if [[ "$MODE" != "development" && "$MODE" != "public" ]]; then
  refuse "mode must be development or public"
fi

root_real="$(realpath "$ROOT")"

assert_dest_outside_tree() {
  local dest_real
  dest_real="$(realpath -m "$1")"
  case "$dest_real" in
    /|/data|/home|/tmp|/var|/var/tmp|"$root_real"|"$root_real"/*)
      refuse "dest must be a new directory outside the working tree: $dest_real"
      ;;
  esac
}

drop_paths() {
  PYTHONPATH="${ROOT}/tools" python3 - "$MODE" <<'PY'
import sys
from github_repository_policy import Placement, history_drop_paths

mode = sys.argv[1]
if mode == "development":
    paths = history_drop_paths(Placement.NEITHER)
elif mode == "public":
    paths = history_drop_paths(Placement.NEITHER, Placement.DEVELOPMENT_ONLY)
else:
    raise SystemExit(f"bad mode {mode}")
for path in paths:
    print(path)
PY
}

verify_index() {
  local dest="$1"
  local source="$2"
  PYTHONPATH="${ROOT}/tools" python3 - "$dest" "$source" "$MODE" <<'PY'
import subprocess
import sys
from github_repository_policy import Placement, index_violations

dest, source, mode = sys.argv[1], sys.argv[2], sys.argv[3]
raw = subprocess.check_output(["git", "-C", dest, "ls-files", "-z"])
paths = [item.decode() for item in raw.split(b"\0") if item]
source_raw = subprocess.check_output(["git", "-C", source, "ls-files", "-z"])
source_paths = [item.decode() for item in source_raw.split(b"\0") if item]
if mode == "development":
    allowed = frozenset({Placement.BOTH, Placement.DEVELOPMENT_ONLY})
    required = (
        "docker/env_file/bundles/prod-core.env.tar.sops",
        "shared/web/landing/kuku2.mp4",
    )
    forbidden_blobs = ("tg_bot_ip_verif/assets/app-prod-release.zip",)
elif mode == "public":
    allowed = frozenset({Placement.BOTH})
    required = ("shared/api",)
    forbidden_blobs = (
        "docker/env_file/bundles/prod-core.env.tar.sops",
        "tg_bot_ip_verif/assets/app-prod-release.zip",
    )
else:
    raise SystemExit(f"bad mode {mode}")

violations = index_violations(paths, allowed=allowed)
if violations:
    print("placement violations:", *violations[:20], sep="\n", file=sys.stderr)
    raise SystemExit(1)

objects = subprocess.check_output(
    ["git", "-C", dest, "rev-list", "--objects", "--all"],
    text=True,
)
for blob_path in forbidden_blobs:
    if blob_path in objects.splitlines() or any(
        line.endswith(" " + blob_path) or line.endswith(blob_path) for line in objects.splitlines()
    ):
        if blob_path in objects:
            print(f"forbidden object still present: {blob_path}", file=sys.stderr)
            raise SystemExit(1)

for path in required:
    if path == "shared/api":
        if not any(item.startswith("shared/api/") for item in paths):
            print("shared/api missing from export", file=sys.stderr)
            raise SystemExit(1)
        continue
    listed = path in paths or any(item.startswith(path + "/") for item in paths)
    if not listed:
        print(f"required path missing: {path}", file=sys.stderr)
        raise SystemExit(1)

if any(item.startswith("shared/web/frontend/public/audio/") for item in source_paths):
    if not any(item.startswith("shared/web/frontend/public/audio/") for item in paths):
        print("shell audio missing from export", file=sys.stderr)
        raise SystemExit(1)
print(f"[STEP] history_export_verified mode={mode} files={len(paths)}")
PY
}

export_history() {
  local dest="$1"
  assert_dest_outside_tree "$dest"
  if [[ -e "$dest" ]]; then
    if [[ "$REPLACE" -ne 1 ]]; then
      refuse "dest exists (pass --replace to recreate it): $dest"
    fi
    rm -rf -- "$dest"
  fi
  command -v git-filter-repo >/dev/null 2>&1 || refuse "git-filter-repo is not on PATH"
  echo "[STEP] clone_scratch source=$SOURCE dest=$dest"
  git clone --no-local "$SOURCE" "$dest"
  local -a args=()
  local path
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    args+=(--path "$path")
  done < <(drop_paths)
  echo "[STEP] filter_repo mode=$MODE paths=${#args[@]}"
  git -C "$dest" filter-repo --invert-paths "${args[@]}"
  verify_index "$dest" "$SOURCE"
}

run_selftest() {
  local scratch parent_code
  scratch="$(mktemp -d /tmp/eliteew-history-export-selftest.XXXXXX)"
  # shellcheck disable=SC2064
  trap "rm -rf -- '$scratch'" RETURN
  set +e
  bash "$ROOT/scripts/eliteew/github-history-export.sh" --dest "$ROOT" --mode development
  parent_code=$?
  set -e
  [[ "$parent_code" -eq 2 ]] || refuse "working-tree dest must exit 2, got $parent_code"

  local tiny="$scratch/src"
  local dev_out="$scratch/dev"
  local public_out="$scratch/public"
  mkdir -p \
    "$tiny/shared/api" \
    "$tiny/docker/env_file/bundles" \
    "$tiny/.cursor/hooks" \
    "$tiny/tg_bot_ip_verif/assets" \
    "$tiny/pack-cloud/mobile/adb_exports/openvpn" \
    "$tiny/shared/web/landing"
  printf 'api\n' >"$tiny/shared/api/main.py"
  printf 'sops\n' >"$tiny/docker/env_file/bundles/prod-core.env.tar.sops"
  printf 'age\n' >"$tiny/docker/env_file/bundles/.sops.yaml"
  printf 'hook\n' >"$tiny/.cursor/hooks/README.md"
  printf 'zip\n' >"$tiny/tg_bot_ip_verif/assets/app-prod-release.zip"
  printf 'apk\n' >"$tiny/pack-cloud/mobile/adb_exports/openvpn/base.apk"
  printf 'mp4\n' >"$tiny/shared/web/landing/kuku2.mp4"
  git -C "$tiny" init -q -b main
  git -C "$tiny" add .
  git -C "$tiny" \
    -c user.email="history-export@eliteew.local" \
    -c user.name="history-export" \
    -c commit.gpgsign=false \
    commit -q -m "fixture"

  SOURCE="$tiny"
  MODE="development"
  REPLACE=0
  export_history "$dev_out"
  MODE="public"
  export_history "$public_out"
  if git -C "$dev_out" ls-files | grep -q 'prod-core.env.tar.sops'; then
    :
  else
    refuse "development export dropped the sops bundle"
  fi
  if git -C "$public_out" ls-files | grep -q 'prod-core.env.tar.sops'; then
    refuse "public export kept the sops bundle"
  fi
  echo "[STEP] github_history_export_selftest_ok"
}

if [[ "$SELFTEST" -eq 1 ]]; then
  run_selftest
  exit 0
fi

[[ -n "$DEST" ]] || refuse "--dest is required"
export_history "$DEST"
