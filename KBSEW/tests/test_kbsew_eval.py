# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Offline unit tests for kbsew_eval YAML load + hit scoring (no network).
# ---

from __future__ import annotations

import importlib.util
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
_SCRIPT = _ROOT / "scripts" / "kbsew_eval.py"


def _load_eval_module():
    spec = importlib.util.spec_from_file_location("kbsew_eval", _SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_load_sample_yaml_and_hit_scoring() -> None:
    mod = _load_eval_module()
    data = mod._load_yaml(_ROOT / "eval" / "sample_queries.yaml")
    cases = data.get("cases") or []
    assert len(cases) >= 2
    assert data["defaults"]["barrel_id"]
    assert cases[0].get("must_not_match")
    assert mod._case_hit(
        ["Маркетинг и бренд на рынке"],
        ["маркет", "бренд"],
    )
    assert not mod._case_hit(["unrelated text"], ["маркет", "бренд"])
    assert mod._case_forbidden(["Страница нормальный текст"], ["С т р а н и ц а"]) is None
    assert mod._case_forbidden(["С т р а н и ц а 1"], ["С т р а н и ц а"]) == "С т р а н и ц а"
