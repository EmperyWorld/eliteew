#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Zero-Trust pre-commit enforcement: critical-path atomicity, format/lint, smoke tests.
# Invariants:
# - Exit 1 on policy violation; SKIP_ZERO_TRUST_PRE_COMMIT=1 bypass (emergency only).
# - Operates on staged files only for lint/tests; critical-path scan uses full porcelain.
# Related:
# - .githooks/pre-commit, .pre-commit-config.yaml
# - documentation/platform/ZERO-TRUST-GIT-HOOKS.md
# - docker/scripts/deploy-provenance-lib.sh
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

PHASE="${1:-all}"

if [[ "${SKIP_ZERO_TRUST_PRE_COMMIT:-0}" == "1" ]]; then
  echo "WARN: SKIP_ZERO_TRUST_PRE_COMMIT=1 — zero-trust pre-commit bypassed" >&2
  exit 0
fi

die() {
  echo "ERROR: [ZERO-TRUST PRE-COMMIT] $*" >&2
  exit 1
}

staged_files() {
  git diff --cached --name-only --diff-filter=ACMRT 2>/dev/null || true
}

# --- Phase 1: critical path atomicity -----------------------------------------

zero_trust_check_critical_paths() {
  python3 - "${ROOT}" <<'PY'
import subprocess
import sys

repo = sys.argv[1]

CRITICAL_PREFIXES = (
    "docker/scripts/",
    "docker/builders/",
    "docker/stack/",
    "documentation/platform/audit/",
    "documentation/platform/docker-re_doc/",
)

def is_critical(path: str) -> bool:
    norm = path.replace("\\", "/")
    for prefix in CRITICAL_PREFIXES:
        p = prefix.rstrip("/")
        if norm == p or norm.startswith(prefix):
            return True
    return False

def git_lines(*args: str) -> list[str]:
    try:
        out = subprocess.check_output(["git", "-C", repo, *args], text=True)
    except subprocess.CalledProcessError:
        return []
    return [ln for ln in out.splitlines() if ln.strip()]

status = git_lines("status", "--porcelain")
staged = set(git_lines("diff", "--cached", "--name-only", "--diff-filter=ACMRT"))

critical_status: list[tuple[str, str, str]] = []
for line in status:
    if len(line) < 4:
        continue
    xy = line[:2]
    path = line[3:].split(" -> ", 1)[-1].strip()
    if not is_critical(path):
        continue
    critical_status.append((xy, path, line))

if not critical_status:
    sys.exit(0)

problems: list[str] = []
staged_critical = [p for _, p, _ in critical_status if p in staged or any(p == s for s in staged)]

for xy, path, raw in critical_status:
    if raw.startswith("??"):
        problems.append(
            f"untracked critical file must be staged or removed: {path}"
        )
        continue
    index_c, work_c = xy[0], xy[1]
    if work_c not in (" ", "?"):
        problems.append(
            f"incomplete critical-path staging (index/worktree={xy}): {path}"
        )

staged_any = bool(staged)
staged_has_critical = any(is_critical(p) for p in staged)
if staged_any and not staged_has_critical:
    for xy, path, raw in critical_status:
        problems.append(
            f"non-critical commit blocked while critical path is dirty: {path} ({xy})"
        )

if problems:
    print("Critical-path integrity violations:", file=sys.stderr)
    for item in problems:
        print(f"  - {item}", file=sys.stderr)
    print(
        "\nFix: commit or stash all docker/deploy/audit changes atomically "
        "before unrelated commits.",
        file=sys.stderr,
    )
    sys.exit(1)
PY
}

# --- Phase 2: format / lint ---------------------------------------------------

zero_trust_format_lint() {
  local -a py_files=() fe_files=() sh_files=()
  local path
  while IFS= read -r path; do
    [[ -z "${path}" ]] && continue
    case "${path}" in
      shared/api/*|DEWA/backend/*)
        [[ "${path}" == *.py ]] && py_files+=("${path}")
        ;;
      shared/web/frontend/src/*|DEWA/frontend/src/*)
        [[ "${path}" == *.ts || "${path}" == *.tsx ]] && fe_files+=("${path}")
        ;;
      docker/scripts/*.sh|scripts/eliteew/*.sh)
        sh_files+=("${path}")
        ;;
    esac
  done < <(staged_files)

  if ((${#py_files[@]})); then
    if ! command -v uv >/dev/null 2>&1; then
      die "uv not found — cannot run Ruff on staged Python"
    fi
    local -a elite_py=() dewa_py=()
    for path in "${py_files[@]}"; do
      if [[ "${path}" == shared/api/* ]]; then
        elite_py+=("${ROOT}/${path}")
      elif [[ "${path}" == DEWA/backend/* ]]; then
        dewa_py+=("${ROOT}/${path}")
      fi
    done
    if ((${#elite_py[@]})); then
      (
        cd "${ROOT}/shared/api"
        uv run ruff format "${elite_py[@]}"
        uv run ruff check "${elite_py[@]}"
      ) || die "Ruff failed on staged EliteEW API Python"
    fi
    if ((${#dewa_py[@]})); then
      (
        cd "${ROOT}/DEWA/backend"
        uv run ruff format "${dewa_py[@]}"
        uv run ruff check "${dewa_py[@]}"
      ) || die "Ruff failed on staged DEWA backend Python"
    fi
    for path in "${py_files[@]}"; do
      git add -- "${path}" 2>/dev/null || true
    done
  fi

  if ((${#fe_files[@]})); then
    local fe_root="${ROOT}/shared/web/frontend"
    local dewa_fe="${ROOT}/DEWA/frontend"
    local -a elite_subset=() dewa_subset=()
    for path in "${fe_files[@]}"; do
      if [[ "${path}" == shared/web/frontend/* ]]; then
        elite_subset+=("${path#shared/web/frontend/}")
      elif [[ "${path}" == DEWA/frontend/* ]]; then
        dewa_subset+=("${path#DEWA/frontend/}")
      fi
    done
    if ((${#elite_subset[@]})); then
      (
        cd "${fe_root}"
        pnpm exec biome check --write "${elite_subset[@]}"
      ) || die "Biome failed on staged EliteEW frontend files"
      for path in "${fe_files[@]}"; do
        [[ "${path}" == shared/web/frontend/* ]] && git add -- "${path}"
      done
    fi
    if ((${#dewa_subset[@]})); then
      (
        cd "${dewa_fe}"
        pnpm exec biome check --write "${dewa_subset[@]}"
      ) || die "Biome failed on staged DEWA frontend files"
      for path in "${fe_files[@]}"; do
        [[ "${path}" == DEWA/frontend/* ]] && git add -- "${path}"
      done
    fi
  fi

  if ((${#sh_files[@]})); then
    for path in "${sh_files[@]}"; do
      bash -n "${ROOT}/${path}" || die "bash -n failed: ${path}"
      if command -v shellcheck >/dev/null 2>&1; then
        shellcheck -x "${ROOT}/${path}" || die "shellcheck failed: ${path}"
      fi
    done
  fi
}

# --- Phase 3: smoke tests -----------------------------------------------------

zero_trust_smoke_tests() {
  python3 - "${ROOT}" <<'PY'
import subprocess
import sys
from pathlib import Path

repo = Path(sys.argv[1])

def git_staged() -> list[str]:
    out = subprocess.check_output(
        ["git", "-C", str(repo), "diff", "--cached", "--name-only", "--diff-filter=ACMRT"],
        text=True,
    )
    return [ln.strip() for ln in out.splitlines() if ln.strip()]

staged = git_staged()
if not staged:
    sys.exit(0)

fe_root = repo / "shared/web/frontend"
api_root = repo / "shared/api"

vitest_targets: list[str] = []
pytest_targets: list[str] = []

for rel in staged:
    p = Path(rel)
    if rel.startswith("shared/web/frontend/src/") and p.suffix in {".ts", ".tsx"}:
        rel_fe = p.relative_to(Path("shared/web/frontend"))
        if rel_fe.name.endswith((".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")):
            vitest_targets.append(str(rel_fe))
            continue
        for suffix in (".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"):
            candidate = rel_fe.with_name(rel_fe.stem + suffix)
            if (fe_root / candidate).is_file():
                vitest_targets.append(str(candidate))
                break
        else:
            parts = rel_fe.parts
            if "UltimateDocEditor" in parts:
                vitest_targets.extend(
                    [
                        "src/components/UltimateDocEditor/utils/safeEditorGetHtml.test.ts",
                        "src/components/UltimateDocEditor/utils/docEditorAnalyticalPipeline.test.ts",
                    ]
                )
    if rel.startswith("shared/api/") and p.suffix == ".py":
        if rel.startswith("shared/api/tests/"):
            pytest_targets.append(rel.replace("shared/api/", ""))
        else:
            stem = p.stem
            test_glob = api_root / "tests" / f"test_{stem}.py"
            if test_glob.is_file():
                pytest_targets.append(str(test_glob.relative_to(api_root)))

vitest_targets = sorted(set(vitest_targets))
pytest_targets = sorted(set(pytest_targets))

if vitest_targets and fe_root.is_dir():
    cmd = ["pnpm", "exec", "vitest", "run", *vitest_targets, "--passWithNoTests"]
    print(">>> zero-trust smoke:", " ".join(cmd), file=sys.stderr)
    subprocess.check_call(cmd, cwd=fe_root)

if pytest_targets and api_root.is_dir():
    wrapper = repo / "docker/scripts/run-stack0-api-tests.sh"
    if wrapper.is_file():
        cmd = ["bash", str(wrapper), *pytest_targets]
    else:
        cmd = ["uv", "run", "python", "-m", "pytest", "-q", *pytest_targets]
    print(">>> zero-trust smoke:", " ".join(cmd), file=sys.stderr)
    subprocess.check_call(cmd, cwd=api_root)
PY
}

case "${PHASE}" in
  all)
    zero_trust_check_critical_paths
    zero_trust_format_lint
    zero_trust_smoke_tests
    echo "✅ zero-trust pre-commit passed"
    ;;
  critical | critical-paths)
    zero_trust_check_critical_paths
    ;;
  lint | format)
    zero_trust_format_lint
    ;;
  tests | smoke)
    zero_trust_smoke_tests
    ;;
  *)
    die "unknown phase: ${PHASE} (use all|critical|lint|tests)"
    ;;
esac
