"""History shaping for ensemble (joint preview length, no DB)."""

from __future__ import annotations

from types import SimpleNamespace

from api.services.desktop_chat_ensemble.history import content_for_history_message


def test_joint_history_preview_uses_extended_cap() -> None:
    body = "Z" * 1200
    m = SimpleNamespace(
        role="assistant",
        content=body,
        message_metadata={
            "desktop_ensemble_joint": True,
            "desktop_ensemble_contributors": ["viktor_engineer"],
        },
        tool_calls=None,
    )
    out = content_for_history_message(m)
    assert "Совместный ответ участников" in out
    assert "Z" * 200 in out
    assert out.endswith("…") is False


def test_joint_history_truncates_beyond_cap() -> None:
    body = "Q" * 3000
    m = SimpleNamespace(
        role="assistant",
        content=body,
        message_metadata={
            "desktop_ensemble_joint": True,
            "desktop_ensemble_contributors": ["viktor_engineer"],
        },
        tool_calls=None,
    )
    out = content_for_history_message(m)
    assert out.endswith("…")
    assert "QQQQ" in out


def test_heuristic_blueprint_hint_product_dev() -> None:
    """Требует зависимостей API (SQLAlchemy); на голом хосте без venv пропускается."""
    import pytest

    pytest.importorskip("sqlalchemy")
    from api.services.desktop_chat_ensemble.conversational_route import (
        heuristic_ensemble_route_phase,
    )

    phase = heuristic_ensemble_route_phase(
        user_text="Давайте сделаем разработку продукта и MVP",
        defaults={},
    )
    assert phase == "blueprint"
