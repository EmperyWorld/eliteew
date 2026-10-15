#!/usr/bin/env python3
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Read-only static validator: git diff vs .cursor/domain_matrix.json — cross-domain imports,
# unregistered new top-level modules, and illegal sys.path in DEWA/EWGen.
# Invariants:
# - Never modifies application code or domain_matrix.json.
# - Exit 1 on Check 1/3 failure; Check 2 emits warnings only (stdout/stderr).
# - sys.path Check 3 applies to door domains desktop_client / mobile_android
#   (legacy dewa/ewgen ids kept for historical fixtures).
# Related:
# - .cursor/domain_matrix.json, .cursor/rules/domain-boundary-gate.mdc
# ---
from __future__ import annotations

import argparse
import ast
import fnmatch
import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

MATRIX_REL = ".cursor/domain_matrix.json"
INFRASTRUCTURE_PREFIXES = (
    "tools/",
    ".github/",
    ".gitlab/",
    ".vscode/",
)

# Import module prefixes → monorepo path prefix (for cross-domain detection).
MODULE_PATH_HINTS: tuple[tuple[str, str], ...] = (
    ("api.", "shared/api/"),
    ("api/", "shared/api/"),
    ("ewa_platform.", "shared/api/ewa_platform/"),
    ("services.", "shared/api/services/"),  # ambiguous; gated by source domain
    ("app.", "DEWA/backend/app/"),
    ("generators.", "EWGen/generators/"),
    ("ewgen.", "EWGen/"),
)

NEUTRAL_PATH_PREFIXES = (
    "shared/tools/",
    "nexus-root/protocol/",
)

SYSPATH_DOMAIN_IDS = frozenset({"desktop_client", "mobile_android", "dewa", "ewgen"})

TS_IMPORT_RE = re.compile(
    r"""(?:import\s+[^'";]+from\s+|import\s+)['"]([^'"]+)['"]""",
    re.MULTILINE,
)
SYSPATH_RE = re.compile(
    r"sys\.path\.(?:insert|append)\s*\(\s*(?:0\s*,\s*)?([^)]+)\)",
    re.MULTILINE,
)


@dataclass
class Finding:
    level: str  # error | warning
    check: str
    path: str
    message: str


@dataclass
class GuardResult:
    findings: list[Finding] = field(default_factory=list)

    @property
    def errors(self) -> list[Finding]:
        return [f for f in self.findings if f.level == "error"]

    @property
    def warnings(self) -> list[Finding]:
        return [f for f in self.findings if f.level == "warning"]

    def exit_code(self) -> int:
        return 1 if self.errors else 0


def _pattern_matches(rel: str, pattern: str) -> bool:
    pat = str(pattern).replace("\\", "/")
    if pat.endswith("/**"):
        prefix = pat[:-3].rstrip("/")
        return rel == prefix or rel.startswith(f"{prefix}/")
    if any(ch in pat for ch in "*?[]"):
        return fnmatch.fnmatch(rel, pat)
    prefix = pat.rstrip("/")
    return rel == prefix or rel.startswith(f"{prefix}/")


def load_matrix(repo_root: Path) -> dict:
    path = repo_root / MATRIX_REL
    if not path.is_file():
        msg = f"Missing domain matrix: {path}"
        raise SystemExit(msg)
    return json.loads(path.read_text(encoding="utf-8"))


def is_excluded(rel: str, matrix: dict) -> bool:
    exclude = matrix.get("exclude") or {}
    for prefix in exclude.get("path_prefixes") or []:
        p = str(prefix).rstrip("/")
        if rel == p or rel.startswith(f"{p}/"):
            return True
    for pattern in exclude.get("path_globs") or []:
        if fnmatch.fnmatch(rel, str(pattern)):
            return True
    return False


def resolve_domains(rel: str, matrix: dict) -> list[dict]:
    if is_excluded(rel, matrix):
        return []
    matched: list[tuple[int, dict]] = []
    for domain in matrix.get("domains") or []:
        for pattern in domain.get("path_patterns") or []:
            if _pattern_matches(rel, pattern):
                prefix_len = len(str(pattern).split("/**")[0].rstrip("/"))
                matched.append((prefix_len, domain))
                break
    matched.sort(key=lambda x: x[0], reverse=True)
    seen: set[str] = set()
    out: list[dict] = []
    for _, domain in matched:
        did = str(domain.get("id", ""))
        if did and did not in seen:
            seen.add(did)
            out.append(domain)
    return out


def primary_domain(rel: str, matrix: dict) -> dict | None:
    domains = resolve_domains(rel, matrix)
    return domains[0] if domains else None


def shared_contract_allows(target_rel: str, matrix: dict) -> bool:
    for pattern in matrix.get("shared_contract_paths") or []:
        if _pattern_matches(target_rel, str(pattern)):
            return True
    for prefix in NEUTRAL_PATH_PREFIXES:
        if target_rel == prefix.rstrip("/") or target_rel.startswith(prefix):
            return True
    return False


def module_to_target_rel(module: str | None, source_rel: str) -> str | None:
    if not module:
        return None
    mod = module.replace(".", "/")
    for prefix, path_prefix in MODULE_PATH_HINTS:
        if module.startswith(prefix) or mod.startswith(prefix.rstrip(".")):
            return f"{path_prefix}{mod[len(prefix.rstrip('.')):].lstrip('/')}"
    if mod.startswith("EliteEW/") or mod.startswith("DEWA/") or mod.startswith("EWGen/"):
        return mod
    return None


def path_literal_to_rel(raw: str) -> str | None:
    text = raw.strip().strip("'\"")
    if not text or text.startswith("{"):
        return None
    text = text.replace("\\", "/")
    markers = (
        "EliteEW/",
        "DEWA/",
        "EWGen/",
        "shared/tools/",
        "shared_tools/",
        "nexus-root/",
    )
    for marker in markers:
        idx = text.find(marker)
        if idx >= 0:
            return text[idx:]
    p = Path(text)
    if p.is_absolute():
        parts = p.as_posix().split("/")
        for marker in (
            "EliteEW",
            "DEWA",
            "EWGen",
            "shared_tools",
            "pack-cloud",
            "pack-organization",
        ):
            if marker in parts:
                i = parts.index(marker)
                return "/".join(parts[i:])
        # Host path …/shared/tools/…
        if "shared" in parts and "tools" in parts:
            i = parts.index("shared")
            if i + 1 < len(parts) and parts[i + 1] == "tools":
                return "/".join(parts[i:])
    return None


def domain_label(domain: dict | None) -> str:
    if not domain:
        return "unregistered"
    return str(domain.get("label") or domain.get("id") or "unknown")


def check_cross_domain_python(
    rel: str,
    source_domain: dict,
    content: str,
    matrix: dict,
    result: GuardResult,
) -> None:
    source_id = str(source_domain.get("id", ""))
    try:
        tree = ast.parse(content, filename=rel)
    except SyntaxError as exc:
        result.findings.append(
            Finding(
                "warning",
                "cross_domain",
                rel,
                f"Skip AST parse: {exc}",
            )
        )
        return

    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            if node.level and node.level > 0:
                continue
            target_rel = module_to_target_rel(node.module, rel)
            if not target_rel:
                continue
            _assert_cross_domain_import(
                rel, source_domain, source_id, target_rel, matrix, result, node.module or ""
            )
        elif isinstance(node, ast.Import):
            for alias in node.names:
                target_rel = module_to_target_rel(alias.name, rel)
                if target_rel:
                    _assert_cross_domain_import(
                        rel,
                        source_domain,
                        source_id,
                        target_rel,
                        matrix,
                        result,
                        alias.name,
                    )


def _assert_cross_domain_import(
    source_rel: str,
    source_domain: dict,
    source_id: str,
    target_rel: str,
    matrix: dict,
    result: GuardResult,
    module_ref: str,
) -> None:
    if shared_contract_allows(target_rel, matrix):
        return
    target_domains = resolve_domains(target_rel, matrix)
    if not target_domains:
        return
    target_id = str(target_domains[0].get("id", ""))
    if not target_id or target_id == source_id:
        return
    result.findings.append(
        Finding(
            "error",
            "cross_domain",
            source_rel,
            (
                f"[ARCHITECTURE ERROR] Domain Breach: {domain_label(source_domain)} "
                f"is attempting to access {domain_label(target_domains[0])} "
                f"without a shared contract (import `{module_ref}` → `{target_rel}`)."
            ),
        )
    )


def check_cross_domain_ts(
    rel: str,
    source_domain: dict,
    content: str,
    matrix: dict,
    result: GuardResult,
) -> None:
    source_id = str(source_domain.get("id", ""))
    for match in TS_IMPORT_RE.finditer(content):
        spec = match.group(1)
        if spec.startswith("."):
            continue
        target_rel = spec.replace("\\", "/")
        if not any(
            target_rel.startswith(p)
            for p in ("EliteEW/", "DEWA/", "EWGen/", "@/", "src/")
        ):
            continue
        if target_rel.startswith("@/") or target_rel.startswith("src/"):
            if "DEWA/" in rel and "EliteEW/" in target_rel:
                target_rel = target_rel  # normalized below
            elif "EliteEW/" in rel and "DEWA/" in target_rel:
                pass
            else:
                continue
        if target_rel.startswith("@/"):
            if "shared/web/frontend" in rel:
                target_rel = f"shared/web/frontend/{target_rel[2:]}"
            elif "DEWA/frontend" in rel:
                target_rel = f"DEWA/frontend/{target_rel[2:]}"
        if not target_rel.startswith(("EliteEW/", "DEWA/", "EWGen/")):
            continue
        if shared_contract_allows(target_rel, matrix):
            continue
        target_domains = resolve_domains(target_rel, matrix)
        if not target_domains:
            continue
        target_id = str(target_domains[0].get("id", ""))
        if target_id and target_id != source_id:
            result.findings.append(
                Finding(
                    "error",
                    "cross_domain",
                    rel,
                    (
                        f"[ARCHITECTURE ERROR] Domain Breach: {domain_label(source_domain)} "
                        f"is attempting to access {domain_label(target_domains[0])} "
                        f"without a shared contract (import `{spec}`)."
                    ),
                )
            )


def check_syspath(
    rel: str,
    source_domain: dict,
    content: str,
    matrix: dict,
    result: GuardResult,
) -> None:
    source_id = str(source_domain.get("id", ""))
    if source_id not in SYSPATH_DOMAIN_IDS:
        return
    for match in SYSPATH_RE.finditer(content):
        raw = match.group(1)
        target_rel = path_literal_to_rel(raw)
        if not target_rel:
            continue
        if shared_contract_allows(target_rel, matrix):
            continue
        if any(
            _pattern_matches(target_rel, p)
            for p in (source_domain.get("path_patterns") or [])
        ):
            continue
        target_domains = resolve_domains(target_rel, matrix)
        if not target_domains:
            if "shared_tools" in raw or "shared/tools" in raw:
                continue
            result.findings.append(
                Finding(
                    "error",
                    "syspath",
                    rel,
                    (
                        f"[ARCHITECTURE ERROR] Illegal sys.path mutation in {source_id}: "
                        f"`{raw.strip()}` is not shared/tools (or /app/shared_tools) "
                        f"or a registered contract path."
                    ),
                )
            )
            continue
        target_id = str(target_domains[0].get("id", ""))
        if target_id != source_id:
            result.findings.append(
                Finding(
                    "error",
                    "syspath",
                    rel,
                    (
                        f"[ARCHITECTURE ERROR] Illegal sys.path mutation in {source_id}: "
                        f"`{raw.strip()}` points to {domain_label(target_domains[0])}."
                    ),
                )
            )


def check_new_domains(
    added_paths: list[str],
    matrix: dict,
    result: GuardResult,
) -> None:
    registered_prefixes: set[str] = set()
    for domain in matrix.get("domains") or []:
        for pattern in domain.get("path_patterns") or []:
            head = str(pattern).split("/**")[0].split("/")[0]
            if head:
                registered_prefixes.add(head)

    seen_top: set[str] = set()
    for rel in added_paths:
        top = rel.split("/", 1)[0]
        if not top or top in seen_top:
            continue
        seen_top.add(top)
        if any(rel.startswith(p) for p in INFRASTRUCTURE_PREFIXES):
            continue
        if top in registered_prefixes:
            continue
        if any(_pattern_matches(rel, p) for d in matrix.get("domains") or [] for p in d.get("path_patterns") or []):
            continue
        result.findings.append(
            Finding(
                "warning",
                "shadow_domain",
                rel,
                (
                    "[ARCHITECTURE WARNING] New domain/module detected but not registered "
                    f"in {MATRIX_REL} (top-level `{top}/`)."
                ),
            )
        )


def git_diff_name_status(repo_root: Path, base: str, head: str) -> list[tuple[str, str]]:
    proc = subprocess.run(
        ["git", "diff", "--name-status", f"{base}...{head}"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        proc = subprocess.run(
            ["git", "diff", "--name-status", base, head],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=True,
        )
    rows: list[tuple[str, str]] = []
    for line in proc.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            status = parts[0].strip()
            path = parts[-1].strip()
            rows.append((status, path.replace("\\", "/")))
    return rows


def read_file_at_ref(repo_root: Path, ref: str, rel: str) -> str | None:
    proc = subprocess.run(
        ["git", "show", f"{ref}:{rel}"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        return None
    return proc.stdout


def scan_file(
    rel: str,
    content: str,
    matrix: dict,
    result: GuardResult,
) -> None:
    if is_excluded(rel, matrix):
        return
    source_domain = primary_domain(rel, matrix)
    if not source_domain:
        return
    if rel.endswith(".py"):
        check_cross_domain_python(rel, source_domain, content, matrix, result)
        check_syspath(rel, source_domain, content, matrix, result)
    elif rel.endswith((".ts", ".tsx", ".js", ".jsx")):
        check_cross_domain_ts(rel, source_domain, content, matrix, result)


def validate_diff(repo_root: Path, base: str, head: str) -> GuardResult:
    result = GuardResult()
    matrix = load_matrix(repo_root)
    rows = git_diff_name_status(repo_root, base, head)
    added: list[str] = []

    for status, rel in rows:
        if status.startswith("A"):
            added.append(rel)
        if status.startswith("D"):
            continue
        if not rel.endswith((".py", ".ts", ".tsx", ".js", ".jsx")):
            continue
        content = read_file_at_ref(repo_root, head, rel)
        if content is None:
            path = repo_root / rel
            if path.is_file():
                content = path.read_text(encoding="utf-8")
            else:
                continue
        scan_file(rel, content, matrix, result)

    check_new_domains(added, matrix, result)
    return result


def validate_file(
    repo_root: Path,
    as_rel: str,
    content: str,
    matrix: dict | None = None,
) -> GuardResult:
    matrix = matrix or load_matrix(repo_root)
    result = GuardResult()
    scan_file(as_rel.replace("\\", "/"), content, matrix, result)
    return result


def print_findings(result: GuardResult) -> None:
    for finding in result.findings:
        stream = sys.stderr if finding.level == "error" else sys.stdout
        print(f"{finding.message} ({finding.path})", file=stream)


def main() -> None:
    parser = argparse.ArgumentParser(description="Architecture Guard — domain boundary validator")
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path.cwd(),
        help="Monorepo root (default: cwd)",
    )
    parser.add_argument("--base", default="HEAD^", help="Git base ref for diff")
    parser.add_argument("--head", default="HEAD", help="Git head ref for diff")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("validate", help="Validate git diff base..head (default)")

    vf = sub.add_parser("validate-file", help="Validate a single file (tests/fixtures)")
    vf.add_argument("file", type=Path, help="File to read")
    vf.add_argument(
        "--as-path",
        required=True,
        help="Logical repo-relative path for domain resolution (e.g. DEWA/backend/app/x.py)",
    )

    args = parser.parse_args()
    repo_root = args.repo.resolve()

    if args.command == "validate-file":
        content = args.file.read_text(encoding="utf-8")
        result = validate_file(repo_root, args.as_path, content)
        print_findings(result)
        raise SystemExit(result.exit_code())

    result = validate_diff(repo_root, args.base, args.head)
    print_findings(result)
    if result.warnings:
        print(
            f"Architecture Guard: {len(result.errors)} error(s), "
            f"{len(result.warnings)} warning(s).",
            file=sys.stdout,
        )
    raise SystemExit(result.exit_code())


if __name__ == "__main__":
    main()
