# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Desktop AI Chat LLM helpers (runtime, JSON sidecars) — lazy barrel only.
# Invariants:
#   - No eager imports of json_sidecar/runtime (avoids package-init cycle when
#     callers import ``llm.runtime`` directly, e.g. blueprint stream_turn).
#   - Chat HTTP uses stack2 OpenAI-compat via llm_openai_compat_http.
#   - ``TYPE_CHECKING`` re-exports satisfy basedpyright ``reportUnsupportedDunderAll``.
# Related:
#   - api/services/desktop_chat/llm/runtime.py
#   - api/services/desktop_chat/llm/json_sidecar.py
#   - api/services/desktop_chat_ensemble/blueprint/stream_turn.py
# ---

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from api.services.desktop_chat.llm.json_sidecar import desktop_llm_json_object
    from api.services.desktop_chat.llm.runtime import (
        desktop_http_llm_options,
        desktop_json_response_format_enabled,
        desktop_stream_chat_completion,
        resolve_desktop_chat_llm_runtime,
        resolve_desktop_tool_router_runtime,
    )

__all__ = [
    "desktop_http_llm_options",
    "desktop_json_response_format_enabled",
    "desktop_llm_json_object",
    "desktop_stream_chat_completion",
    "resolve_desktop_chat_llm_runtime",
    "resolve_desktop_tool_router_runtime",
]

_RUNTIME_EXPORTS = frozenset(
    {
        "desktop_http_llm_options",
        "desktop_json_response_format_enabled",
        "desktop_stream_chat_completion",
        "resolve_desktop_chat_llm_runtime",
        "resolve_desktop_tool_router_runtime",
    }
)


def __getattr__(name: str) -> Any:
    if name == "desktop_llm_json_object":
        from api.services.desktop_chat.llm.json_sidecar import desktop_llm_json_object

        return desktop_llm_json_object
    if name in _RUNTIME_EXPORTS:
        from api.services.desktop_chat.llm import runtime as _runtime

        return getattr(_runtime, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted({*globals().keys(), *__all__})
