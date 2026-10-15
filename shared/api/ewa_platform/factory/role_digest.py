# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Role / recipe digests injected into factory plan checkpoints (Wave F5 · H lite).
# Invariants:
# - Read-only; never executes Hands/ECC deploy-agent.
# Related:
# - .cursor/orchestration/recipes/INDEX.md
# ---

from __future__ import annotations

from pathlib import Path


def _monorepo_root() -> Path | None:
    cur = Path.cwd().resolve()
    for candidate in (cur, *cur.parents):
        if (candidate / "EliteEW").is_dir() and (candidate / ".cursor").is_dir():
            return candidate
    return None


def load_recipe_index_digest(*, max_chars: int = 4000) -> str:
    root = _monorepo_root()
    if root is None:
        return ""
    path = root / ".cursor" / "orchestration" / "recipes" / "INDEX.md"
    if not path.is_file():
        return ""
    text = path.read_text(encoding="utf-8", errors="replace")
    return text[:max_chars]


def build_plan_checkpoint(*, pack_stems: list[str], title: str) -> dict[str, object]:
    digest = load_recipe_index_digest()
    return {
        "title": title,
        "pack_stems": list(pack_stems),
        "recipe_index_digest": digest,
        "plan_kind": "factory_plan_lite",
        "notes": "Wave F5 lite plan — no LLM implement; verify path uses factory gates.",
    }
