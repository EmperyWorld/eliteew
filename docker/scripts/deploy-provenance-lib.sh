#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared git/manifest/nested-repo helpers for deploy provenance audit, gate, and verify.
# Invariants:
# - Source-only library; never execute directly.
# - Blocking dirty ≠ OpenAPI pilot/generated leftovers (WARN-pass allowlist).
# - Repo root from DEWA_OPS_REPO_ROOT or monorepo discovery from this file.
# Related:
# - docker/scripts/deploy-provenance-audit.sh
# - docker/scripts/deploy-provenance-gate.sh
# - documentation/platform/audit/STANDARDIZATION-ADR.md
# ---

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Source deploy-provenance-lib.sh; do not execute directly." >&2
  exit 2
fi

DEPLOY_PROVENANCE_SCHEMA_VERSION=1
DEPLOY_PROVENANCE_GATE_EXIT=42

deploy_provenance_repo_root() {
  if [[ -n "${DEWA_OPS_REPO_ROOT:-}" ]]; then
    printf '%s\n' "${DEWA_OPS_REPO_ROOT}"
    return 0
  fi
  local lib_dir
  lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "${lib_dir}/../.." && pwd
}

deploy_provenance_git_sha() {
  local repo="${1:-$(deploy_provenance_repo_root)}"
  git -C "${repo}" rev-parse HEAD 2>/dev/null || echo "unknown"
}

deploy_provenance_git_branch() {
  local repo="${1:-$(deploy_provenance_repo_root)}"
  git -C "${repo}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
}

deploy_provenance_dirty_tracked_files() {
  local repo="${1:-$(deploy_provenance_repo_root)}"
  git -C "${repo}" status --porcelain --untracked-files=no 2>/dev/null | awk '{print $2}' || true
}

deploy_provenance_is_dirty_tracked() {
  local repo="${1:-$(deploy_provenance_repo_root)}"
  ! git -C "${repo}" diff-index --quiet HEAD -- 2>/dev/null
}

deploy_provenance_source_prefixes() {
  printf '%s\n' \
    'shared/api/' \
    'shared/apps/' \
    'host/kernel-offline/' \
    'shared/web/frontend/src/' \
    'shared/web/frontend/public/' \
    'shared/web/frontend/vite.config.ts' \
    'shared/web/frontend/vite-plugin-build-version.ts' \
    'shared/web/frontend/package.json' \
    'shared/web/frontend/pnpm-lock.yaml' \
    'shared/web/frontend/nginx.prod.conf' \
    'shared/web/frontend/nginx/' \
    'shared/web/frontend/scripts/verify-app-build-id.mjs' \
    'docker/builders/stack0-api/' \
    'docker/builders/stack0-frontend/' \
    'docker/scripts/' \
    'shared/tools/'
}

deploy_provenance_build_artifact_excludes() {
  printf '%s\n' \
    'shared/web/frontend/public/meta.json'
}

# Leftover paths from --refresh-openapi-pilots (tracked SSOT; not gitignored).
# Dirty *only* here → gate WARN-pass; any other source dirty → fail closed.
deploy_provenance_openapi_regen_prefixes() {
  printf '%s\n' \
    'shared/web/frontend/openapi/pilot/' \
    'shared/web/frontend/src/generated/'
}

deploy_provenance_is_openapi_regen_path() {
  local path="${1:?path required}"
  python3 - "${path}" <<'PY'
import sys
from pathlib import PurePosixPath

path = PurePosixPath(sys.argv[1].replace("\\", "/"))
parts = path.parts
# shared/web/frontend/openapi/pilot/**
if parts[:5] == ("shared", "web", "frontend", "openapi", "pilot"):
    raise SystemExit(0)
# shared/web/frontend/src/generated/*-openapi.ts
if (
    parts[:5] == ("shared", "web", "frontend", "src", "generated")
    and len(parts) == 6
    and parts[5].endswith("-openapi.ts")
):
    raise SystemExit(0)
raise SystemExit(1)
PY
}

deploy_provenance_dirty_source_files() {
  local repo="${1:-$(deploy_provenance_repo_root)}"
  python3 - "${repo}" <<'PY'
import subprocess
import sys

repo = sys.argv[1]
prefixes = [
    "shared/api/",
    "shared/apps/",
    "host/kernel-offline/",
    "shared/web/frontend/src/",
    "shared/web/frontend/openapi/pilot/",
    "shared/web/frontend/public/",
    "shared/web/frontend/vite.config.ts",
    "shared/web/frontend/vite-plugin-build-version.ts",
    "shared/web/frontend/package.json",
    "shared/web/frontend/pnpm-lock.yaml",
    "shared/web/frontend/nginx.prod.conf",
    "shared/web/frontend/nginx/",
    "shared/web/frontend/scripts/verify-app-build-id.mjs",
    "docker/builders/stack0-api/",
    "docker/builders/stack0-frontend/",
    "docker/scripts/",
    "shared/tools/",
]
excludes = {"shared/web/frontend/public/meta.json"}

def in_scope(path: str) -> bool:
    if path in excludes:
        return False
    return any(path == p.rstrip("/") or path.startswith(p) for p in prefixes)

try:
    status = subprocess.check_output(
        ["git", "-C", repo, "status", "--porcelain", "--untracked-files=no"],
        text=True,
    ).strip()
except Exception:
    raise SystemExit(0)

try:
    for line in status.splitlines():
        if not line.strip():
            continue
        path = line.split(maxsplit=1)[1]
        if in_scope(path):
            print(path, flush=True)
except BrokenPipeError:
    # Downstream closed early (e.g. historical stdin/heredoc bug); not a soft fail for callers.
    raise SystemExit(0)
PY
}

deploy_provenance_is_openapi_regen_dirty_path() {
  # stdin: paths, one per line; stdout: those that match openapi regen allowlist.
  # Must use -c (not heredoc on stdin) so a pipe into this function reaches Python.
  python3 -c '
import sys
from pathlib import PurePosixPath

def is_openapi_regen(path: str) -> bool:
    p = PurePosixPath(path.replace("\\", "/"))
    parts = p.parts
    if parts[:5] == ("shared", "web", "frontend", "openapi", "pilot"):
        return True
    if (
        parts[:5] == ("shared", "web", "frontend", "src", "generated")
        and len(parts) == 6
        and parts[5].endswith("-openapi.ts")
    ):
        return True
    return False

try:
    for line in sys.stdin:
        path = line.strip()
        if path and is_openapi_regen(path):
            print(path, flush=True)
except BrokenPipeError:
    raise SystemExit(0)
'
}

deploy_provenance_dirty_openapi_regen_files() {
  local repo="${1:-$(deploy_provenance_repo_root)}"
  deploy_provenance_dirty_source_files "${repo}" | deploy_provenance_is_openapi_regen_dirty_path
}

deploy_provenance_dirty_blocking_source_files() {
  local repo="${1:-$(deploy_provenance_repo_root)}"
  python3 - "${repo}" <<'PY'
import subprocess
import sys
from pathlib import PurePosixPath

repo = sys.argv[1]
prefixes = [
    "shared/api/",
    "shared/apps/",
    "host/kernel-offline/",
    "shared/web/frontend/src/",
    "shared/web/frontend/openapi/pilot/",
    "shared/web/frontend/public/",
    "shared/web/frontend/vite.config.ts",
    "shared/web/frontend/vite-plugin-build-version.ts",
    "shared/web/frontend/package.json",
    "shared/web/frontend/pnpm-lock.yaml",
    "shared/web/frontend/nginx.prod.conf",
    "shared/web/frontend/nginx/",
    "shared/web/frontend/scripts/verify-app-build-id.mjs",
    "docker/builders/stack0-api/",
    "docker/builders/stack0-frontend/",
    "docker/scripts/",
    "shared/tools/",
]
excludes = {"shared/web/frontend/public/meta.json"}

def in_scope(path: str) -> bool:
    if path in excludes:
        return False
    return any(path == p.rstrip("/") or path.startswith(p) for p in prefixes)

def is_openapi_regen(path: str) -> bool:
    p = PurePosixPath(path.replace("\\", "/"))
    parts = p.parts
    if parts[:5] == ("shared", "web", "frontend", "openapi", "pilot"):
        return True
    if (
        parts[:5] == ("shared", "web", "frontend", "src", "generated")
        and len(parts) == 6
        and parts[5].endswith("-openapi.ts")
    ):
        return True
    return False

try:
    status = subprocess.check_output(
        ["git", "-C", repo, "status", "--porcelain", "--untracked-files=no"],
        text=True,
    ).strip()
except Exception:
    raise SystemExit(0)

for line in status.splitlines():
    if not line.strip():
        continue
    path = line.split(maxsplit=1)[1]
    if in_scope(path) and not is_openapi_regen(path):
        print(path)
PY
}

deploy_provenance_is_dirty_source() {
  local repo="${1:-$(deploy_provenance_repo_root)}"
  # Backward-compatible name: "dirty" for gate/audit means *blocking* source dirt.
  [[ -n "$(deploy_provenance_dirty_blocking_source_files "${repo}")" ]]
}

deploy_provenance_is_dirty_openapi_regen() {
  local repo="${1:-$(deploy_provenance_repo_root)}"
  [[ -n "$(deploy_provenance_dirty_openapi_regen_files "${repo}")" ]]
}

deploy_provenance_frozen_git_sha() {
  if [[ -n "${DEPLOY_PROVENANCE_BUILD_GIT_SHA:-}" ]]; then
    printf '%s\n' "${DEPLOY_PROVENANCE_BUILD_GIT_SHA}"
    return 0
  fi
  deploy_provenance_git_sha "$@"
}

deploy_provenance_write_dist_manifest() {
  local dist_dir="${1:?dist-build directory required}"
  local sync_mode="${2:-baked-release}"
  local active_line="${3:-baked}"
  local out_path="${dist_dir}/deployment-manifest.json"
  local repo
  repo="$(deploy_provenance_repo_root)"
  mkdir -p "${dist_dir}"
  DEPLOY_PROVENANCE_SCHEMA_VERSION="${DEPLOY_PROVENANCE_SCHEMA_VERSION}" \
    DEPLOY_PROVENANCE_BUILD_GIT_SHA="${DEPLOY_PROVENANCE_BUILD_GIT_SHA:-}" \
    python3 - "${out_path}" "${sync_mode}" "${active_line}" "${repo}" "${dist_dir}" <<'PY'
import hashlib
import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

out = Path(sys.argv[1])
sync_mode = sys.argv[2]
active_line = sys.argv[3]
repo = Path(sys.argv[4])
dist_dir = Path(sys.argv[5])
schema = int(os.environ.get("DEPLOY_PROVENANCE_SCHEMA_VERSION", "1"))
frozen_sha = os.environ.get("DEPLOY_PROVENANCE_BUILD_GIT_SHA", "").strip()

def git_field(*args):
    try:
        return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()
    except Exception:
        return "unknown"

deploy_id_path = dist_dir / "app-build-version.txt"
deploy_id = deploy_id_path.read_text(encoding="utf-8").strip() if deploy_id_path.is_file() else "unknown"

ewgen = {"present": False, "git_sha": None, "dirty": False}
ewgen_dir = repo / "EWGen"
if (ewgen_dir / ".git").is_dir():
    ewgen["present"] = True
    try:
        ewgen["git_sha"] = subprocess.check_output(
            ["git", "-C", str(ewgen_dir), "rev-parse", "HEAD"], text=True
        ).strip()
        st = subprocess.check_output(
            ["git", "-C", str(ewgen_dir), "status", "--porcelain", "--untracked-files=no"],
            text=True,
        ).strip()
        ewgen["dirty"] = bool(st)
    except Exception:
        ewgen["git_sha"] = "unknown"

lock_path = repo / "shared/api/requirements/locks/api.lock"
lock_hash = "unknown"
if lock_path.is_file():
    lock_hash = hashlib.sha256(lock_path.read_bytes()).hexdigest()

def dist_tree_sha256(root: Path) -> str:
    h = hashlib.sha256()
    for path in sorted(p for p in root.rglob("*") if p.is_file() and p.name != "deployment-manifest.json"):
        rel = path.relative_to(root).as_posix().encode()
        h.update(rel)
        h.update(path.read_bytes())
    return h.hexdigest()

git_sha = frozen_sha or git_field("rev-parse", "HEAD")
payload = {
    "schema_version": schema,
    "deploy_id": deploy_id,
    "monorepo": {
        "git_sha": git_sha,
        "git_branch": git_field("rev-parse", "--abbrev-ref", "HEAD"),
        "dirty": False,
        "dirty_files": [],
    },
    "nested_repos": {"EWGen": ewgen},
    "artifacts": {
        "build_lock_hash": lock_hash,
        "frontend_dist_sha256": dist_tree_sha256(dist_dir) if dist_dir.is_dir() else "unknown",
        "stack0_api_image": os.environ.get("STACK0_API_BAKED_IMAGE", ""),
        "stack0_frontend_image": os.environ.get("STACK0_FRONTEND_BAKED_IMAGE", ""),
    },
    "lines": {
        "active": active_line,
        "sync_mode": sync_mode,
    },
    "built_at": datetime.now(UTC).isoformat(),
    "built_on_host": os.uname().nodename,
    "transport_checksums": {},
}
canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
payload["manifest_sha256"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"✅ deployment-manifest written: {out}")
print(payload["manifest_sha256"])
PY
}

deploy_provenance_read_manifest_exports() {
  local manifest_path="${1:?manifest path}"
  if [[ ! -f "${manifest_path}" ]]; then
    return 1
  fi
  python3 - "${manifest_path}" <<'PY'
import json
import sys
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
print(data.get("deploy_id", "unknown"))
print(data.get("manifest_sha256", "unknown"))
print(data.get("monorepo", {}).get("git_sha", "unknown"))
PY
}

deploy_provenance_untracked_under() {
  local repo="${1:-$(deploy_provenance_repo_root)}"
  shift
  local prefix path
  git -C "${repo}" ls-files --others --exclude-standard "$@" 2>/dev/null || true
}

deploy_provenance_read_deploy_id() {
  local repo="${1:-$(deploy_provenance_repo_root)}"
  local path="${repo}/shared/web/frontend/dist-build/app-build-version.txt"
  if [[ -f "${path}" ]]; then
    tr -d '\n\r' <"${path}"
    return 0
  fi
  echo "unknown"
}

deploy_provenance_ewgen_state_json() {
  local repo="${1:-$(deploy_provenance_repo_root)}"
  python3 - "${repo}" <<'PY'
import json
import subprocess
import sys
from pathlib import Path

repo = Path(sys.argv[1])
ewgen = repo / "EWGen"
out = {"present": False, "git_sha": None, "dirty": False, "dirty_files": []}
if not (ewgen / ".git").is_dir():
    print(json.dumps(out))
    raise SystemExit(0)
out["present"] = True
try:
    out["git_sha"] = subprocess.check_output(
        ["git", "-C", str(ewgen), "rev-parse", "HEAD"], text=True
    ).strip()
except Exception:
    out["git_sha"] = "unknown"
try:
    status = subprocess.check_output(
        ["git", "-C", str(ewgen), "status", "--porcelain", "--untracked-files=no"],
        text=True,
    ).strip()
    if status:
        out["dirty"] = True
        out["dirty_files"] = [line.split(maxsplit=1)[1] for line in status.splitlines() if line.strip()]
except Exception:
    pass
print(json.dumps(out, ensure_ascii=False))
PY
}

deploy_provenance_collect_local_json() {
  local repo="${1:-$(deploy_provenance_repo_root)}"
  local tier="${2:-audit}"
  local dirty_files openapi_regen_files deploy_id ewgen_json
  dirty_files="$(deploy_provenance_dirty_blocking_source_files "${repo}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')"
  openapi_regen_files="$(deploy_provenance_dirty_openapi_regen_files "${repo}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')"
  deploy_id="$(deploy_provenance_read_deploy_id "${repo}")"
  ewgen_json="$(deploy_provenance_ewgen_state_json "${repo}")"
  python3 - "${repo}" "${tier}" "${dirty_files}" "${deploy_id}" "${ewgen_json}" "${openapi_regen_files}" <<'PY'
import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

repo = Path(sys.argv[1])
tier = sys.argv[2]
dirty_files = json.loads(sys.argv[3])
deploy_id = sys.argv[4]
ewgen = json.loads(sys.argv[5])
openapi_regen_files = json.loads(sys.argv[6])

def git_field(*args):
    try:
        return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()
    except Exception:
        return "unknown"

lock_path = repo / "shared/api/requirements/locks/api.lock"
lock_hash = "unknown"
if lock_path.is_file():
    import hashlib
    lock_hash = hashlib.sha256(lock_path.read_bytes()).hexdigest()

payload = {
    "schema_version": int(os.environ.get("DEPLOY_PROVENANCE_SCHEMA_VERSION", "1")),
    "audited_at": datetime.now(UTC).isoformat(),
    "tier": tier,
    "deploy_id": deploy_id,
    "monorepo": {
        "git_sha": git_field("rev-parse", "HEAD"),
        "git_branch": git_field("rev-parse", "--abbrev-ref", "HEAD"),
        "dirty": bool(dirty_files),
        "dirty_files": dirty_files,
        "openapi_regen_dirty_files": openapi_regen_files,
        "dirty_scope": "source_paths",
    },
    "nested_repos": {"EWGen": ewgen},
    "artifacts": {
        "build_lock_hash": lock_hash,
    },
    "built_on_host": os.uname().nodename,
}
print(json.dumps(payload, ensure_ascii=False, indent=2))
PY
}

deploy_provenance_write_unified_manifest() {
  local out_path="${1:?manifest path required}"
  local sync_mode="${2:-baked-export}"
  local active_line="${3:-baked}"
  local repo
  repo="$(deploy_provenance_repo_root)"
  mkdir -p "$(dirname "${out_path}")"
  DEPLOY_PROVENANCE_SCHEMA_VERSION="${DEPLOY_PROVENANCE_SCHEMA_VERSION}" \
    python3 - "${out_path}" "${sync_mode}" "${active_line}" "${repo}" <<'PY'
import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

out = Path(sys.argv[1])
sync_mode = sys.argv[2]
active_line = sys.argv[3]
repo = Path(sys.argv[4])
schema = int(os.environ.get("DEPLOY_PROVENANCE_SCHEMA_VERSION", "1"))

def git_field(*args):
    try:
        return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()
    except Exception:
        return "unknown"

deploy_id_path = repo / "shared/web/frontend/dist-build/app-build-version.txt"
deploy_id = deploy_id_path.read_text(encoding="utf-8").strip() if deploy_id_path.is_file() else "unknown"
dirty_files = []
try:
    status = subprocess.check_output(
        ["git", "-C", str(repo), "status", "--porcelain", "--untracked-files=no"],
        text=True,
    ).strip()
    if status:
        dirty_files = [line.split(maxsplit=1)[1] for line in status.splitlines() if line.strip()]
except Exception:
    pass

ewgen = {"present": False, "git_sha": None, "dirty": False}
ewgen_dir = repo / "EWGen"
if (ewgen_dir / ".git").is_dir():
    ewgen["present"] = True
    try:
        ewgen["git_sha"] = subprocess.check_output(
            ["git", "-C", str(ewgen_dir), "rev-parse", "HEAD"], text=True
        ).strip()
        st = subprocess.check_output(
            ["git", "-C", str(ewgen_dir), "status", "--porcelain", "--untracked-files=no"],
            text=True,
        ).strip()
        ewgen["dirty"] = bool(st)
    except Exception:
        ewgen["git_sha"] = "unknown"

lock_path = repo / "shared/api/requirements/locks/api.lock"
lock_hash = "unknown"
if lock_path.is_file():
    import hashlib
    lock_hash = hashlib.sha256(lock_path.read_bytes()).hexdigest()

payload = {
    "schema_version": schema,
    "deploy_id": deploy_id,
    "monorepo": {
        "git_sha": git_field("rev-parse", "HEAD"),
        "git_branch": git_field("rev-parse", "--abbrev-ref", "HEAD"),
        "dirty": bool(dirty_files),
        "dirty_files": dirty_files,
    },
    "nested_repos": {"EWGen": ewgen},
    "artifacts": {
        "build_lock_hash": lock_hash,
        "stack0_api_image": os.environ.get("STACK0_API_BAKED_IMAGE", ""),
        "stack0_frontend_image": os.environ.get("STACK0_FRONTEND_BAKED_IMAGE", ""),
    },
    "lines": {
        "active": active_line,
        "sync_mode": sync_mode,
    },
    "built_at": datetime.now(UTC).isoformat(),
    "built_on_host": os.uname().nodename,
    "transport_checksums": {},
}
out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"✅ deployment-manifest written: {out}")
PY
}

deploy_provenance_remote_probe_json() {
  local ssh_target="${DEWA_OPS_PROD_CORE_SSH:-prod-core}"
  local mount="${ELITEEW_PROD_LINE_MOUNT:-/mnt/eliteew-prod-line-export}"
  ssh "${ssh_target}" bash -s "${mount}" <<'REMOTE' 2>/dev/null || echo '{"error":"ssh_probe_failed"}'
set -euo pipefail
mount="$1"
export MOUNT_PATH="${mount}"
python3 <<'PY'
import json
import os
import subprocess
import urllib.request
from pathlib import Path

mount = os.environ.get("MOUNT_PATH", "/mnt/eliteew-prod-line-export")
out = {
    "active_line": "unknown",
    "runtime_git_sha": None,
    "deploy_id": None,
    "live_manifest_git_sha": None,
    "live_manifest_deploy_id": None,
    "live_manifest_sha256": None,
    "manifest_git_sha": None,
    "manifest_deploy_id": None,
    "runtime_manifest_sha256": None,
    "frontend_image": None,
    "api_image": None,
}

def curl_body(url):
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            return r.read().decode()
    except Exception:
        return None

def curl_txt(url):
    body = curl_body(url)
    return body.strip() if body else None

out["deploy_id"] = curl_txt("http://127.0.0.1:29001/app-build-version.txt")
live_manifest_raw = curl_body("http://127.0.0.1:29001/deployment-manifest.json")
if live_manifest_raw:
    try:
        live = json.loads(live_manifest_raw)
        out["live_manifest_git_sha"] = live.get("monorepo", {}).get("git_sha")
        out["live_manifest_deploy_id"] = live.get("deploy_id")
        out["live_manifest_sha256"] = live.get("manifest_sha256")
    except Exception:
        pass

manifest_path = Path(mount) / "manifest.json"
if manifest_path.is_file():
    m = json.loads(manifest_path.read_text())
    out["manifest_git_sha"] = m.get("git_sha")
    out["manifest_deploy_id"] = m.get("deploy_id")

def inspect_label(name, label):
    try:
        return subprocess.check_output(
            ["podman", "inspect", "-f", f"{{{{index .Config.Labels \"{label}\"}}}}", name],
            text=True,
        ).strip()
    except Exception:
        return None

out["runtime_git_sha"] = inspect_label("stack0-eliteew-api-prod-baked", "org.eliteew.build.git_sha")
out["runtime_manifest_sha256"] = inspect_label(
    "stack0-eliteew-frontend-prod-baked", "org.eliteew.deploy.manifest_sha256"
)
try:
    out["api_image"] = subprocess.check_output(
        ["podman", "inspect", "-f", "{{.Config.ImageName}}", "stack0-eliteew-api-prod-baked"],
        text=True,
    ).strip()
except Exception:
    pass
try:
    out["frontend_image"] = subprocess.check_output(
        ["podman", "inspect", "-f", "{{.Config.ImageName}}", "stack0-eliteew-frontend-prod-baked"],
        text=True,
    ).strip()
except Exception:
    pass

state = Path(mount) / ".prod-line-state.json"
if state.is_file():
    out["active_line"] = json.loads(state.read_text()).get("active_line", "unknown")
elif out["runtime_git_sha"]:
    out["active_line"] = "baked"

print(json.dumps(out, ensure_ascii=False))
PY
REMOTE
}

deploy_provenance_score_findings() {
  local local_json="${1:?local json path}"
  local remote_json="${2:-}"
  if [[ -z "${remote_json}" ]]; then
    remote_json='{"error":"no_remote"}'
  fi
  python3 - "${local_json}" "${remote_json}" <<'PY'
import json
import sys
from pathlib import Path

local = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
remote_raw = sys.argv[2].strip()
remote = json.loads(remote_raw) if remote_raw.startswith("{") else {"error": "invalid_remote"}

findings = []
local_sha = local.get("monorepo", {}).get("git_sha")
if local.get("monorepo", {}).get("dirty"):
    findings.append({
        "severity": "P0",
        "code": "dirty_source_tree",
        "message": "Monorepo has uncommitted changes in deploy source paths",
        "files": local["monorepo"].get("dirty_files", [])[:20],
    })

openapi_regen = local.get("monorepo", {}).get("openapi_regen_dirty_files") or []
if openapi_regen and not local.get("monorepo", {}).get("dirty"):
    findings.append({
        "severity": "P2",
        "code": "openapi_regen_dirty_tree",
        "message": (
            "OpenAPI pilot/generated leftovers after --refresh-openapi-pilots "
            "(non-blocking; commit when ready)"
        ),
        "files": openapi_regen[:20],
    })

ewgen = local.get("nested_repos", {}).get("EWGen", {})
if ewgen.get("dirty"):
    findings.append({
        "severity": "P1",
        "code": "ewgen_dirty",
        "message": "EWGen nested repo has uncommitted tracked changes",
    })

if "error" not in remote:
    rt_sha = remote.get("runtime_git_sha")
    active_line = remote.get("active_line", "unknown")
    if rt_sha and local_sha and rt_sha != local_sha:
        findings.append({
            "severity": "P0",
            "code": "runtime_git_sha_mismatch",
            "message": f"prod-core image git_sha {rt_sha[:12]} != local HEAD {local_sha[:12]}",
            "local_git_sha": local_sha,
            "runtime_git_sha": rt_sha,
        })
    live_sha = remote.get("live_manifest_git_sha")
    if live_sha and local_sha and live_sha != local_sha and active_line == "baked":
        findings.append({
            "severity": "P0",
            "code": "live_manifest_git_sha_mismatch",
            "message": f"live :29001/deployment-manifest.json git_sha {live_sha[:12]} != local HEAD {local_sha[:12]}",
            "local_git_sha": local_sha,
            "live_manifest_git_sha": live_sha,
        })
    live_id = remote.get("deploy_id")
    live_manifest_id = remote.get("live_manifest_deploy_id")
    if live_id and live_manifest_id and live_id != live_manifest_id and active_line == "baked":
        findings.append({
            "severity": "P0",
            "code": "live_manifest_deploy_id_mismatch",
            "message": "live deploy_id differs from deployment-manifest.json on :29001",
        })
    live_manifest_hash = remote.get("live_manifest_sha256")
    runtime_manifest_hash = remote.get("runtime_manifest_sha256")
    if (
        live_manifest_hash
        and runtime_manifest_hash
        and live_manifest_hash != runtime_manifest_hash
        and active_line == "baked"
    ):
        findings.append({
            "severity": "P1",
            "code": "manifest_label_hash_mismatch",
            "message": "frontend image manifest_sha256 label differs from live manifest file",
        })
    m_sha = remote.get("manifest_git_sha")
    if m_sha and local_sha and m_sha != local_sha and active_line == "dev-bind":
        findings.append({
            "severity": "P1",
            "code": "manifest_git_sha_stale",
            "message": f"prod-line manifest git_sha {m_sha[:12]} != local HEAD {local_sha[:12]}",
        })
    m_id = remote.get("manifest_deploy_id")
    if live_id and m_id and live_id != m_id and active_line == "dev-bind":
        findings.append({
            "severity": "P2",
            "code": "manifest_deploy_id_stale",
            "message": "NFS manifest deploy_id differs from live :29001 (line may have switched)",
        })

scorecard = {
    "audited_at": local.get("audited_at"),
    "local": {
        "git_sha": local_sha,
        "dirty_tracked": local.get("monorepo", {}).get("dirty", False),
        "ewgen_sha": ewgen.get("git_sha"),
        "deploy_id": local.get("deploy_id"),
    },
    "prod_core": remote if "error" not in remote else {"probe": remote.get("error")},
    "findings": findings,
}
print(json.dumps(scorecard, ensure_ascii=False, indent=2))
PY
}
