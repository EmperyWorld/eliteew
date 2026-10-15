# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock Wave B6: Core4 handlers with response_model must not annotate returns as bare dict/Any.
# Invariants:
# - Annotation drift scan is static AST only (no runtime import of routers).
# Related:
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
# ---
from __future__ import annotations

import ast
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]

CORE4_ROOTS = [
    API_ROOT / "routers" / "professional_worlds_admin.py",
    API_ROOT / "routers" / "music_forge_admin.py",
    API_ROOT / "routers" / "music_forge.py",
    API_ROOT / "routers" / "marketing_cabinet",
    API_ROOT / "ewa_platform" / "gateways" / "routers",
    API_ROOT / "routers" / "desktop_ai_chat.py",
]


def _iter_py_files() -> list[Path]:
    out: list[Path] = []
    for root in CORE4_ROOTS:
        if root.is_dir():
            out.extend(sorted(root.rglob("*.py")))
        elif root.is_file():
            out.append(root)
    return out


def _annotation_drift(path: Path) -> list[str]:
    src = path.read_text(encoding="utf-8")
    tree = ast.parse(src)
    hits: list[str] = []
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        has_rm = False
        for dec in node.decorator_list:
            text = ast.get_source_segment(src, dec) or ""
            if "response_model" in text:
                has_rm = True
                break
        if not has_rm or node.returns is None:
            continue
        ann = (ast.get_source_segment(src, node.returns) or "").strip()
        if "dict" in ann.lower() or ann in {"Any", "object"}:
            hits.append(f"{path.relative_to(API_ROOT)}:{node.lineno} {node.name} -> {ann}")
    return hits


def test_core4_response_model_annotations_not_bare_dict() -> None:
    all_hits: list[str] = []
    for path in _iter_py_files():
        all_hits.extend(_annotation_drift(path))
    assert all_hits == [], "annotation drift remaining:\n" + "\n".join(all_hits)
