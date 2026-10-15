"""Llama `keep_alive` for JSON bodies (chat, generate, embed).

Requests that hard-code ``\"5m\"`` override the server's ``LLAMA_KEEP_ALIVE`` (e.g. ``-1``),
so models were unloaded after five minutes despite stack2 env.
"""

from __future__ import annotations

from typing import Any


def coerce_llama_keep_alive_value(raw: Any) -> str | int:
    if raw is None:
        return -1
    if isinstance(raw, bool):
        return -1
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float) and raw.is_integer():
        return int(raw)
    s = str(raw).strip()
    if not s:
        return -1
    if s[0] in "-0123456789":
        try:
            return int(s, 10)
        except ValueError:
            pass
    return s


def llama_keep_alive_from_settings() -> str | int:
    from api.core.unified_config import unified_settings

    raw = getattr(unified_settings, "llama_keep_alive", "-1")
    return coerce_llama_keep_alive_value(raw)


def pop_keep_alive_from_kwargs(kwargs: dict[str, Any]) -> str | int:
    if "keep_alive" in kwargs:
        return coerce_llama_keep_alive_value(kwargs.pop("keep_alive"))
    return llama_keep_alive_from_settings()
