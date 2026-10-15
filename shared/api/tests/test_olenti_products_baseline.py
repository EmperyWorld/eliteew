# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Neutral olenti products.json collections align with starter/signature catalog seed.
# Related:
# - site-templates/olenti/server/products.json
# ---
from __future__ import annotations

import json
from pathlib import Path

import pytest


def _resolve_products_json() -> Path | None:
    here = Path(__file__).resolve()
    candidates = [
        here.parents[3] / "site-templates" / "olenti" / "server" / "products.json",
        here.parents[2].parent / "site-templates" / "olenti" / "server" / "products.json",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


PRODUCTS_JSON = _resolve_products_json()


@pytest.mark.skipif(PRODUCTS_JSON is None, reason="site-templates/olenti not mounted in this runtime")
def test_products_json_uses_neutral_collections() -> None:
    assert PRODUCTS_JSON is not None
    data = json.loads(PRODUCTS_JSON.read_text(encoding="utf-8"))
    collections = {item["collection"] for item in data.get("products", [])}
    assert collections <= {"starter", "signature"}
    descriptions = data.get("collectionDescriptions", {})
    assert "starter" in descriptions
    assert "signature" in descriptions
