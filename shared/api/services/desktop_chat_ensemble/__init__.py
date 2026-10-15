"""Desktop AI Chat — ensemble (multi-hero) mode."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

__all__ = ["stream_ensemble_turn"]

if TYPE_CHECKING:
    from api.services.desktop_chat_ensemble.stream_turn import stream_ensemble_turn as stream_ensemble_turn


def __getattr__(name: str) -> Any:
    if name == "stream_ensemble_turn":
        from api.services.desktop_chat_ensemble.stream_turn import stream_ensemble_turn as _fn

        return _fn
    raise AttributeError(name)
