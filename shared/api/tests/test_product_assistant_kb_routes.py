# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Контракт маршрутов KB справочника: literal `/summary` не должен попадать в `{doc_id}`.
# Invariants:
# - Статические сегменты (`summary`, `upload`, …) объявлены отдельно; `{doc_id:uuid}` — только UUID.
# Related:
# - api/routers/product_desktop_assistant_kb.py
# ---

from __future__ import annotations

import re
from pathlib import Path

_ROUTER_PATH = Path(__file__).resolve().parents[1] / "routers" / "product_desktop_assistant_kb.py"


def test_assistant_kb_summary_route_is_literal_before_uuid_doc_id() -> None:
    text = _ROUTER_PATH.read_text(encoding="utf-8")
    summary_idx = text.index('"/admin/assistant/kb/summary"')
    uuid_doc_idx = text.index('"/admin/assistant/kb/{doc_id:uuid}"')
    assert summary_idx < uuid_doc_idx


def test_assistant_kb_doc_id_routes_use_uuid_path_converter() -> None:
    text = _ROUTER_PATH.read_text(encoding="utf-8")
    kb_doc_paths = re.findall(
        r'@kb_router\.(?:get|post|patch|delete)\("(/admin/assistant/kb/[^"]+)"',
        text,
    )
    dynamic = [p for p in kb_doc_paths if "{doc_id" in p]
    assert dynamic
    assert all("{doc_id:uuid}" in p for p in dynamic)
    assert not any(re.search(r"\{doc_id\}(?!:uuid)", p) for p in dynamic)
