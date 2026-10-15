# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Контракт admin assistant settings/preview маршрутов в product_desktop_assistant.
# Invariants:
# - GET/PATCH /admin/assistant/settings и POST /admin/assistant/preview зарегистрированы до FAQ CRUD.
# Related:
# - api/routers/product_desktop_assistant.py
# ---

from __future__ import annotations

from pathlib import Path

_ROUTER_PATH = Path(__file__).resolve().parents[1] / "routers" / "product_desktop_assistant.py"


def test_assistant_admin_settings_routes_exist_before_faq() -> None:
    text = _ROUTER_PATH.read_text(encoding="utf-8")
    settings_get = text.index('"/admin/assistant/settings"')
    preview_post = text.index('"/admin/assistant/preview"')
    faq_get = text.index('"/admin/assistant/faq"')
    assert settings_get < faq_get
    assert preview_post < faq_get


def test_assistant_admin_settings_handlers_registered() -> None:
    text = _ROUTER_PATH.read_text(encoding="utf-8")
    assert "async def admin_get_assistant_settings(" in text
    assert "async def admin_patch_assistant_settings(" in text
    assert "async def admin_preview_assistant_prompt(" in text
