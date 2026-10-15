# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve monorepo neutral packages under shared/tools/ for stack0 API
# (dev-bind, baked, host). Runtime container/NFS alias remains /app/shared_tools.
# Invariants:
# - Only prepends the tools root; never imports product mid modules from it.
# Related:
# - shared/tools/i18n_rewriter/, services/i18n_rewrite_stack2_service.py
# ---
from __future__ import annotations

import os
import sys
from pathlib import Path


def resolve_shared_tools_dir() -> Path | None:
    """Return shared tools root when ``i18n_rewriter`` (or peers) is present."""
    candidates: list[Path] = []
    env = (os.environ.get("ELITEEW_SHARED_TOOLS_DIR") or "").strip()
    if env:
        candidates.append(Path(env))
    api_root = Path(__file__).resolve().parent
    # Container / baked: /app/api → /app/shared_tools (runtime alias)
    candidates.append(api_root.parent / "shared_tools")
    # Host: shared/api → shared/tools (sibling under shared/)
    candidates.append(api_root.parent / "tools")
    # Host: monorepo root → shared/tools (and legacy shared_tools/)
    if len(api_root.parents) >= 2:
        root = api_root.parents[1]
        candidates.append(root / "shared" / "tools")
        candidates.append(root / "shared_tools")
    seen: set[str] = set()
    for raw in candidates:
        try:
            shared = raw.resolve()
        except OSError:
            continue
        key = str(shared)
        if key in seen:
            continue
        seen.add(key)
        if shared.is_dir() and (shared / "i18n_rewriter").is_dir():
            return shared
    return None


def ensure_shared_tools_import_path() -> Path:
    """Idempotently prepend shared tools root so ``import i18n_rewriter`` works."""
    shared = resolve_shared_tools_dir()
    if shared is None:
        msg = (
            "shared tools directory missing (expected /app/shared_tools in prod or "
            "monorepo shared/tools/i18n_rewriter on host)"
        )
        raise RuntimeError(msg)
    shared_str = str(shared)
    if shared_str not in sys.path:
        sys.path.insert(0, shared_str)
    return shared
