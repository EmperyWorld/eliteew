# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   EWDesk news route registration order: literal /news/* paths must not shadow {post_id}.
# Invariants:
#   - Static segments (counts, my-state) appear before /news/{post_id} in source.
# Related:
#   - api/routers/product_desktop_news.py
# ---

from __future__ import annotations

from pathlib import Path

_ROUTER_PATH = Path(__file__).resolve().parents[1] / "routers" / "product_desktop_news.py"


def test_ewdesk_news_static_routes_before_post_id() -> None:
    text = _ROUTER_PATH.read_text(encoding="utf-8")
    post_id_idx = text.index('"/news/{post_id}"')
    for literal in ('"/news/counts"', '"/news/my-state"'):
        assert text.index(literal) < post_id_idx, f"{literal} must be registered before {{post_id}}"
