# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Route-level tests for Professional Worlds admin permission separation.
# Invariants:
# - High-risk import/rollout/publish operations require Empery World admin authorization.
# - Read-only and dry-run admin operations stay available to normal EliteEW admins.
# Related:
# - api/routers/professional_worlds_admin.py
# ---

from __future__ import annotations

import ast
from pathlib import Path

ROUTER_PATH = Path(__file__).resolve().parents[1] / "routers" / "professional_worlds_admin.py"
ROUTER_TREE = ast.parse(ROUTER_PATH.read_text(encoding="utf-8"))


def _decorator_path(decorator: ast.expr, method: str) -> str | None:
    if not isinstance(decorator, ast.Call):
        return None
    if not isinstance(decorator.func, ast.Attribute):
        return None
    if not isinstance(decorator.func.value, ast.Name) or decorator.func.value.id != "router":
        return None
    if decorator.func.attr != method.lower():
        return None
    if not decorator.args or not isinstance(decorator.args[0], ast.Constant):
        return None
    return str(decorator.args[0].value)


def _depends_name(default: ast.expr | None) -> str | None:
    if not isinstance(default, ast.Call):
        return None
    if not isinstance(default.func, ast.Name) or default.func.id != "Depends":
        return None
    if not default.args or not isinstance(default.args[0], ast.Name):
        return None
    return default.args[0].id


def _route_dependency_names(path: str, method: str) -> set[str]:
    for node in ROUTER_TREE.body:
        if not isinstance(node, ast.AsyncFunctionDef):
            continue
        if not any(_decorator_path(decorator, method) == path for decorator in node.decorator_list):
            continue
        args = node.args.args
        defaults = [None] * (len(args) - len(node.args.defaults)) + list(node.args.defaults)
        dependencies = {
            dep
            for dep in (_depends_name(default) for default in defaults + list(node.args.kw_defaults))
            if dep is not None
        }
        return dependencies
    raise AssertionError(f"route not found: {method} {path}")


def test_high_risk_professional_worlds_admin_routes_require_emperyworld_admin() -> None:
    """Confirmed import, publish/rollback and rollout mutations are operator-only."""
    high_risk_routes = (
        ("POST", "/verticals/import"),
        ("POST", "/packs/import/jobs/{job_id}/confirm"),
        ("POST", "/packs/releases/{release_id}/publish"),
        ("POST", "/packs/releases/{release_id}/rollback"),
        ("POST", "/rollouts"),
        ("PATCH", "/rollouts/{rollout_id}"),
        ("POST", "/rollouts/{rollout_id}/pause"),
        ("POST", "/rollouts/{rollout_id}/resume"),
    )

    for method, path in high_risk_routes:
        dependencies = _route_dependency_names(path, method)
        assert "require_emperyworld_admin" in dependencies
        assert "require_admin_user" not in dependencies


def test_read_and_dry_run_professional_worlds_admin_routes_allow_regular_admins() -> None:
    """Read-only, diff and dry-run endpoints require admin access but not operator access."""
    regular_admin_routes = (
        ("GET", "/overview"),
        ("GET", "/packs/import/jobs/{job_id}"),
        ("POST", "/packs/import/jobs"),
        ("POST", "/packs/{vertical_slug}/diff"),
        ("GET", "/rollouts"),
        ("POST", "/packs/releases/{release_id}/approve"),
        ("GET", "/ai-actions/{vertical_slug}/{action_key}/prompt-inspect"),
        ("GET", "/photo-presets/{vertical_slug}/{preset_key}/prompt-inspect"),
    )

    for method, path in regular_admin_routes:
        dependencies = _route_dependency_names(path, method)
        assert "require_admin_user" in dependencies
        assert "require_emperyworld_admin" not in dependencies
