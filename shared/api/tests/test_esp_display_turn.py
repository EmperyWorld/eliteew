# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract locks for ESP TFT display AI: flag, token, truncate, surface chat_only path.
# Related:
# - documentation/product/ewa/EWA-ESP-DISPLAY-AI.md
# ---
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.ewa_platform.companion import esp_display as esp_mod
from api.ewa_platform.companion.esp_display import (
    build_esp_display_user_line,
    format_ambient_prefix,
    rate_limit_allow,
    reset_esp_display_rate_limit_for_tests,
    truncate_reply_to_lines,
    verify_esp_display_token,
)
from api.ewa_platform.gateways.routers import esp_display as esp_router_mod
from api.middleware.oauth2_protection import build_public_path_strings


@pytest.fixture(autouse=True)
def reset_esp_display_rate_limit() -> None:
    reset_esp_display_rate_limit_for_tests()


def test_esp_display_path_is_jwt_public() -> None:
    import re

    patterns = [re.compile(p) for p in build_public_path_strings()]
    assert any(p.match("/api/v1/ewa/esp-display/turn") for p in patterns)


def test_verify_esp_display_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_ESP_DISPLAY_DEVICE_TOKEN", "secret-token")
    assert verify_esp_display_token("secret-token") is True
    assert verify_esp_display_token("wrong") is False
    assert verify_esp_display_token(None) is False


def test_truncate_reply_to_lines_caps_chars_and_lines() -> None:
    long = "слово " * 40
    lines = truncate_reply_to_lines(long, max_chars=78, max_lines=3, max_cols=26)
    assert 1 <= len(lines) <= 3
    assert all(len(x) <= 26 for x in lines)
    assert sum(len(x) for x in lines) <= 78
    assert any("слово" in x for x in lines)
    md = truncate_reply_to_lines("## Hello\n\n**world**")
    assert md
    assert "#" not in "".join(md)
    assert "*" not in "".join(md)


def test_truncate_wraps_single_long_sentence() -> None:
    text = "Я в строю и готов помочь с финальным синтезом данных в короткий отчёт."
    lines = truncate_reply_to_lines(text, max_chars=78, max_lines=3, max_cols=26)
    assert len(lines) >= 2
    assert all(len(x) <= 26 for x in lines)
    assert "".join(lines).replace(" ", "") in text.replace(" ", "") or "синтез" in "".join(lines)


def test_ambient_and_user_line_include_display_instruction() -> None:
    amb = format_ambient_prefix({"temp_c": 22.5, "humidity_pct": 40.0, "sound_level": 900, "sound_triggered": False})
    assert "22.5" in amb
    assert "ADC 900" in amb
    line = build_esp_display_user_line("status", {"temp_c": 22.5})
    assert "ESP TFT" in line or "ESP TFT display" in line or "ESP TFT 240" in line
    assert "22.5" in line
    assert "русск" in line.lower() or "по-русски" in line


def test_rate_limit_blocks_second_call() -> None:
    assert rate_limit_allow(now=100.0) is True
    assert rate_limit_allow(now=101.0) is False
    assert rate_limit_allow(now=109.0) is True


def _app_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    app = FastAPI()
    app.include_router(esp_router_mod.router, prefix="/api/v1/ewa")
    app.state.ewa_orchestration_pool = MagicMock()
    return TestClient(app)


def test_esp_display_turn_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ELITEEW_ESP_DISPLAY_AI_ENABLED", raising=False)
    monkeypatch.setenv("ELITEEW_ESP_DISPLAY_DEVICE_TOKEN", "tok")
    monkeypatch.setenv("ELITEEW_ESP_DISPLAY_PRINCIPAL_ID", "user-1")
    client = _app_client(monkeypatch)
    r = client.post(
        "/api/v1/ewa/esp-display/turn",
        headers={"X-EliteEW-Esp-Display-Token": "tok"},
        json={"intent": "status"},
    )
    assert r.status_code == 503
    assert r.json()["detail"] == "esp_display_ai_disabled"


def test_esp_display_turn_bad_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_ESP_DISPLAY_AI_ENABLED", "1")
    monkeypatch.setenv("ELITEEW_ESP_DISPLAY_DEVICE_TOKEN", "tok")
    monkeypatch.setenv("ELITEEW_ESP_DISPLAY_PRINCIPAL_ID", "user-1")
    client = _app_client(monkeypatch)
    r = client.post(
        "/api/v1/ewa/esp-display/turn",
        headers={"X-EliteEW-Esp-Display-Token": "nope"},
        json={"intent": "encourage"},
    )
    assert r.status_code == 401


def test_esp_display_turn_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_ESP_DISPLAY_AI_ENABLED", "1")
    monkeypatch.setenv("ELITEEW_ESP_DISPLAY_DEVICE_TOKEN", "tok")
    monkeypatch.setenv("ELITEEW_ESP_DISPLAY_PRINCIPAL_ID", "user-1")

    async def fake_run(pool, *, intent, ambient=None, client_turn_id=None):
        return {
            "ok": True,
            "intent": intent,
            "reply_lines": ["Привет с TFT.", "Всё спокойно."],
            "reply_chars": 28,
        }

    monkeypatch.setattr(esp_router_mod, "run_esp_display_turn", fake_run)
    client = _app_client(monkeypatch)
    r = client.post(
        "/api/v1/ewa/esp-display/turn",
        headers={"X-EliteEW-Esp-Display-Token": "tok"},
        json={
            "intent": "ambient",
            "ambient": {"temp_c": 21.0, "sound_level": 100, "sound_triggered": False},
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["intent"] == "ambient"
    assert len(body["reply_lines"]) == 2
    assert body["reply_chars"] == 28


@pytest.mark.asyncio
async def test_run_esp_display_turn_passes_surface(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_ESP_DISPLAY_PRINCIPAL_ID", "owner-uuid")
    captured: dict[str, object] = {}

    async def fake_execute(pool, **kwargs):
        captured.update(kwargs)
        return {"reply": "Короткий ответ для экрана."}

    monkeypatch.setattr(esp_mod, "execute_companion_chat_message", fake_execute)
    out = await esp_mod.run_esp_display_turn(MagicMock(), intent="next_step", ambient=None)
    assert captured.get("surface") == "esp_display"
    assert captured.get("bearer_token") is None
    assert out["ok"] is True
    assert out["reply_lines"]
    assert "esp_display" not in " ".join(out["reply_lines"]).lower()


@pytest.mark.asyncio
async def test_esp_display_surface_skips_pre_llm_route(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.core.auth import User
    from api.ewa_platform.companion.turn.phases import turn_entry as turn_entry_mod

    called = {"deterministic": False}

    async def boom_deterministic(*_a, **_k):
        called["deterministic"] = True
        raise AssertionError("deterministic must not run for esp_display")

    async def dedup_none(*_a, **_k):
        return None

    monkeypatch.setattr(turn_entry_mod, "maybe_route_deterministic_turn", boom_deterministic)
    monkeypatch.setattr(turn_entry_mod, "agentic_intake_gate_enabled", lambda: False)
    monkeypatch.setattr(turn_entry_mod, "companion_turn_dedup_try_fetch_response", dedup_none)

    class Msg:
        has_image_attachment = False
        user_line = "открой музыку"
        shell_norm = None

    out = await turn_entry_mod.resolve_sync_turn_entry_early(
        MagicMock(),
        principal_id="p1",
        client_turn_id=None,
        profile={},
        msg_ctx=Msg(),  # type: ignore[arg-type]
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
        bearer_token=None,
        auth_user=User(id="p1", email="x@y.z", username="x"),
        surface="esp_display",
    )
    assert out is None
    assert called["deterministic"] is False
