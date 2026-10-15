# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Gate T lite — SHA256 freeze for eliteew-app-scaffold template assets (Wave F3/F7).
# Invariants:
# - FAILED if tmpl content drifts from TEMPLATE_FREEZE.json without freeze update.
# - Prod baked image has no monorepo `.cursor/` — fall back to packaged factory/gate_t_assets.
# Related:
# - .cursor/skills/eliteew-app-scaffold/assets/TEMPLATE_FREEZE.json
# - api/ewa_platform/factory/gate_t_assets/ (image-shipped mirror)
# - scripts/eliteew/verify-scaffold-templates.sh
# ---

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from api.services.desktop_app_manifests.factory_verify import monorepo_root_from_apps
from api.services.desktop_app_manifests.loader import apps_root

_CURSOR_ASSETS_REL = Path(".cursor") / "skills" / "eliteew-app-scaffold" / "assets"


def packaged_gate_t_assets_dir() -> Path:
    """Assets copied into the API image (Wave F7) — mirror of skill assets."""

    # …/api/services/desktop_app_manifests → …/api/ewa_platform/factory/gate_t_assets
    return Path(__file__).resolve().parents[2] / "ewa_platform" / "factory" / "gate_t_assets"


def assets_dir(root: Path | None = None) -> Path:
    """Prefer monorepo `.cursor` skill assets; else packaged mirror for baked runtime."""

    if root is not None:
        cursor_assets = root / _CURSOR_ASSETS_REL
        if (cursor_assets / "TEMPLATE_FREEZE.json").is_file():
            return cursor_assets
        packaged = packaged_gate_t_assets_dir()
        if (packaged / "TEMPLATE_FREEZE.json").is_file():
            return packaged
        return cursor_assets
    base = monorepo_root_from_apps(apps_root())
    cursor_assets = base / _CURSOR_ASSETS_REL
    if (cursor_assets / "TEMPLATE_FREEZE.json").is_file():
        return cursor_assets
    packaged = packaged_gate_t_assets_dir()
    if (packaged / "TEMPLATE_FREEZE.json").is_file():
        return packaged
    return cursor_assets


def verify_template_freeze(root: Path | None = None) -> tuple[str, str]:
    assets = assets_dir(root)
    freeze_path = assets / "TEMPLATE_FREEZE.json"
    if not freeze_path.is_file():
        return "FAILED", f"missing {freeze_path}"
    data = json.loads(freeze_path.read_text(encoding="utf-8"))
    expected = data.get("files") or {}
    if not isinstance(expected, dict) or not expected:
        return "FAILED", "TEMPLATE_FREEZE.json files map empty"
    problems: list[str] = []
    for name, want in sorted(expected.items()):
        path = assets / name
        if not path.is_file():
            problems.append(f"missing template {name}")
            continue
        got = hashlib.sha256(path.read_bytes()).hexdigest()
        if got != want:
            problems.append(f"drift {name}: freeze={want} actual={got}")
    # unexpected new .tmpl without freeze entry
    for path in sorted(assets.glob("*.tmpl")):
        if path.name not in expected:
            problems.append(f"unfrozen template {path.name} — add to TEMPLATE_FREEZE.json")
    if problems:
        return "FAILED", "; ".join(problems)
    source = "packaged" if assets == packaged_gate_t_assets_dir() else "cursor"
    return "PASSED", f"templates={len(expected)} freeze_ok source={source}"


def main() -> int:
    status, detail = verify_template_freeze()
    print(f"verify_status={status} {detail}")
    return 0 if status == "PASSED" else 1


if __name__ == "__main__":
    raise SystemExit(main())
